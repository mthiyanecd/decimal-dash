// Complete Firestore Rules allow/deny matrix. Run only through the Firestore
// emulator (`npm run test:rules`); no production project is contacted.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";

const projectId = "demo-study-dash";
const host = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [hostname, portText] = host.split(":");
const env = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: hostname,
    port: Number(portText),
    rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")
  }
});

const parentClaims = { familyId: "zimmy", role: "parent", email_verified: true, email: "parent@example.test" };
const wrongFamilyClaims = { familyId: "other", role: "parent", email_verified: true };
const parent = env.authenticatedContext("parent-1", parentClaims).firestore();
const wrongFamilyParent = env.authenticatedContext("parent-other", wrongFamilyClaims).firestore();
const unverifiedParent = env.authenticatedContext("parent-unverified", { familyId: "zimmy", role: "parent", email_verified: false }).firestore();
const learner = env.authenticatedContext("learner-1").firestore();
const otherLearner = env.authenticatedContext("learner-2").firestore();
const sameAppLearner = env.authenticatedContext("learner-3").firestore();
const newDevice = env.authenticatedContext("new-device").firestore();
const outsider = env.authenticatedContext("outsider").firestore();
const unauth = env.unauthenticatedContext().firestore();
const p = suffix => `families/zimmy/${suffix}`;

async function seed(path, data) {
  await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), path), data));
}

try {
  await env.clearFirestore();
  await seed(p("members/learner-1"), {
    familyId: "zimmy", role: "learner", active: true, appKeys: ["dd1", "ddp2", "histp2"],
    label: "learner iPad", createdByUid: "parent-1", createdAt: 1, updatedAt: 1
  });
  await seed(p("members/learner-2"), {
    familyId: "zimmy", role: "learner", active: true, appKeys: ["ddp2"],
    label: "other", createdByUid: "parent-1", createdAt: 1, updatedAt: 1
  });
  await seed(p("members/learner-3"), {
    familyId: "zimmy", role: "learner", active: true, appKeys: ["histp2"],
    label: "replacement", createdByUid: "parent-1", createdAt: 1, updatedAt: 1
  });

  // Membership and parent bootstrap.
  await assertSucceeds(getDoc(doc(learner, p("members/learner-1"))));
  await assertFails(getDoc(doc(learner, p("members/learner-2"))));
  await assertFails(setDoc(doc(outsider, p("members/outsider")), { familyId: "zimmy", role: "learner", active: true, appKeys: ["dd1"] }));
  await assertSucceeds(setDoc(doc(parent, p("members/new-device")), {
    familyId: "zimmy", role: "learner", active: true, appKeys: ["dd1"], label: "new",
    createdByUid: "parent-1", createdAt: 2, updatedAt: 2
  }));
  await assertFails(getDoc(doc(wrongFamilyParent, p("members/learner-1"))));
  await assertFails(getDoc(doc(unverifiedParent, p("members/learner-1"))));

  // App state: enrolled app owner only; identity fields are immutable.
  const state = {
    family: "zimmy", appKey: "dd1", app: "DecimalDash", ownerUid: "learner-1",
    updated: 10, name: "Z", log: [], stats: {}
  };
  await assertSucceeds(setDoc(doc(learner, p("state/dd1")), state));
  await assertSucceeds(updateDoc(doc(learner, p("state/dd1")), { name: "Zimmy", updated: 11 }));
  await assertFails(updateDoc(doc(learner, p("state/dd1")), { ownerUid: "outsider" }));
  await assertFails(setDoc(doc(otherLearner, p("state/dd1")), { ...state, ownerUid: "learner-2" }));
  await assertFails(getDoc(doc(outsider, p("state/dd1"))));
  await assertSucceeds(getDoc(doc(parent, p("state/dd1"))));
  await assertFails(getDoc(doc(wrongFamilyParent, p("state/dd1"))));
  await assertSucceeds(runTransaction(parent, async tx => {
    const stateRef = doc(parent, p("state/dd1"));
    const memberRef = doc(parent, p("members/new-device"));
    const transferRef = doc(parent, p("stateTransfers/dd1_new-device"));
    const [stateSnap, memberSnap, transferSnap] = await Promise.all([
      tx.get(stateRef), tx.get(memberRef), tx.get(transferRef)
    ]);
    assert.ok(stateSnap.exists() && memberSnap.exists() && !transferSnap.exists());
    tx.update(stateRef, { ownerUid: "new-device" });
    tx.set(transferRef, {
      family: "zimmy", appKey: "dd1", oldOwnerUid: "learner-1", newOwnerUid: "new-device",
      transferredByUid: "parent-1", createdAt: serverTimestamp()
    });
  }));
  await assertFails(updateDoc(doc(learner, p("state/dd1")), { name: "old owner", updated: 12 }));
  await assertSucceeds(updateDoc(doc(newDevice, p("state/dd1")), { name: "replacement", updated: 12 }));
  await assertFails(updateDoc(doc(parent, p("stateTransfers/dd1_new-device")), { oldOwnerUid: "changed" }));
  await seed(p("state/ddp2"), {
    family: "zimmy", appKey: "ddp2", app: "ShapeDashP2", updated: 12, name: "legacy", log: [], stats: {}
  });
  await assertSucceeds(runTransaction(parent, async tx => {
    const stateRef = doc(parent, p("state/ddp2"));
    const memberRef = doc(parent, p("members/learner-2"));
    const transferRef = doc(parent, p("stateTransfers/ddp2_learner-2"));
    const [stateSnap, memberSnap, transferSnap] = await Promise.all([
      tx.get(stateRef), tx.get(memberRef), tx.get(transferRef)
    ]);
    assert.ok(stateSnap.exists() && memberSnap.exists() && !transferSnap.exists());
    tx.update(stateRef, { ownerUid: "learner-2" });
    tx.set(transferRef, {
      family: "zimmy", appKey: "ddp2", oldOwnerUid: "", newOwnerUid: "learner-2",
      transferredByUid: "parent-1", createdAt: serverTimestamp()
    });
  }));
  await assertSucceeds(getDoc(doc(otherLearner, p("state/ddp2"))));

  // Parent assignments; learner may only complete a task for an allowed app.
  const assignment = {
    family: "zimmy", appKey: "dd1", status: "todo", createdBy: "parent",
    createdByUid: "parent-1", created: 20, note: "Do a fix-it round"
  };
  await assertSucceeds(setDoc(doc(parent, p("assignments/a1")), assignment));
  await assertSucceeds(setDoc(doc(parent, p("assignments/a2")), assignment));
  await assertSucceeds(getDoc(doc(learner, p("assignments/a1"))));
  await assertFails(getDoc(doc(otherLearner, p("assignments/a1"))));
  await assertSucceeds(getDocs(query(collection(learner, p("assignments")), where("appKey", "==", "dd1"))));
  await assertFails(getDocs(collection(otherLearner, p("assignments"))));
  await assertSucceeds(updateDoc(doc(learner, p("assignments/a1")), { status: "done", doneTs: 21 }));
  await assertFails(updateDoc(doc(learner, p("assignments/a2")), { note: "changed", status: "done", doneTs: 21 }));
  await assertSucceeds(updateDoc(doc(parent, p("assignments/a1")), { status: "todo" }));
  await assertFails(deleteDoc(doc(learner, p("assignments/a1"))));

  // Vault and append-only awards.
  await seed(p("vault/main"), { examKeys: 2, usedKeys: 0, openedChests: 0, updatedAt: 30 });
  await assertSucceeds(getDoc(doc(learner, p("vault/main"))));
  await assertFails(updateDoc(doc(learner, p("vault/main")), { examKeys: 99 }));
  await assertFails(updateDoc(doc(parent, p("vault/main")), { examKeys: 99 }));
  const award = { family: "zimmy", label: "Mock", keys: 1, createdByUid: "parent-1", ts: 31, createdAt: 31 };
  await assertSucceeds(runTransaction(parent, async tx => {
    const vaultRef = doc(parent, p("vault/main")), awardRef = doc(parent, p("vault/main/awards/award-1"));
    const [vaultSnap, awardSnap] = await Promise.all([tx.get(vaultRef), tx.get(awardRef)]);
    assert.ok(vaultSnap.exists() && !awardSnap.exists());
    tx.set(awardRef, award);
    tx.update(vaultRef, { examKeys: 3, lastAwardId: "award-1", updatedAt: serverTimestamp() });
  }));
  await assertSucceeds(getDoc(doc(learner, p("vault/main/awards/award-1"))));
  await assertFails(updateDoc(doc(parent, p("vault/main/awards/award-1")), { keys: 2 }));
  await assertFails(deleteDoc(doc(parent, p("vault/main/awards/award-1"))));

  // Catalogue is member-readable and parent-managed.
  const item = { family: "zimmy", description: "Ice cream", level: "Star", createdByUid: "parent-1", created: 40 };
  await assertSucceeds(setDoc(doc(parent, p("catalogue/item-1")), item));
  await assertSucceeds(getDoc(doc(learner, p("catalogue/item-1"))));
  await assertFails(setDoc(doc(learner, p("catalogue/item-2")), item));

  // Reward requests are owner-created pending records; only parent can move
  // pending -> approved/rejected and approved -> fulfilled without changing identity.
  const redemption = {
    family: "zimmy", ownerUid: "learner-1", rewardId: "item-1", rewardDesc: "Ice cream",
    level: "Star", status: "pending", ts: 50, createdAt: 50
  };
  await assertSucceeds(setDoc(doc(learner, p("redemptions/r1")), redemption));
  await assertSucceeds(setDoc(doc(parent, p("redemptions/r-parent")), { ...redemption, ownerUid: "parent-1", ts: 53, createdAt: 53 }));
  await assertSucceeds(getDoc(doc(learner, p("redemptions/r1"))));
  await assertFails(getDoc(doc(otherLearner, p("redemptions/r1"))));
  await assertFails(updateDoc(doc(learner, p("redemptions/r1")), { status: "approved" }));
  await assertFails(updateDoc(doc(parent, p("redemptions/r1")), { rewardDesc: "Changed", status: "approved", approvedAt: 51 }));
  await assertSucceeds(runTransaction(parent, async tx => {
    const redemptionRef = doc(parent, p("redemptions/r1")), vaultRef = doc(parent, p("vault/main"));
    const [redemptionSnap, vaultSnap] = await Promise.all([tx.get(redemptionRef), tx.get(vaultRef)]);
    assert.ok(redemptionSnap.exists() && vaultSnap.exists());
    tx.update(redemptionRef, { status: "approved", approvedAt: serverTimestamp(), approvedLearnerKeys: 0 });
    tx.update(vaultRef, { usedKeys: 1, openedChests: 1, lastRedemptionId: "r1", updatedAt: serverTimestamp() });
  }));
  await assertSucceeds(updateDoc(doc(parent, p("redemptions/r1")), { status: "fulfilled", fulfilledTs: 52 }));
  await assertFails(deleteDoc(doc(parent, p("redemptions/r1"))));

  // Stable session submission can be refreshed by its owner, but identity and
  // original client timestamp cannot change.
  const submission = {
    id: "dd1_s0", family: "zimmy", appKey: "dd1", app: "DecimalDash", ownerUid: "learner-1",
    clientTs: 60, receivedAt: 60, session: 0, summary: "pending", attempts: 0, pendingReviews: 1
  };
  await assertSucceeds(setDoc(doc(learner, p("submissions/dd1_s0")), submission));
  await assertSucceeds(updateDoc(doc(learner, p("submissions/dd1_s0")), { summary: "final", attempts: 1, pendingReviews: 0, receivedAt: 61 }));
  await assertFails(updateDoc(doc(learner, p("submissions/dd1_s0")), { ownerUid: "outsider" }));
  await assertFails(getDoc(doc(otherLearner, p("submissions/dd1_s0"))));
  await assertSucceeds(getDoc(doc(parent, p("submissions/dd1_s0"))));
  await assertFails(deleteDoc(doc(parent, p("submissions/dd1_s0"))));
  const legacySubmission = { ...submission }; delete legacySubmission.ownerUid;
  await seed(p("submissions/legacy"), { ...legacySubmission, id: "legacy" });
  await assertSucceeds(setDoc(doc(learner, p("submissions/legacy")), { ...legacySubmission, id: "legacy", ownerUid: "learner-1", receivedAt: 62 }));

  // Images are immutable after creation (an exact idempotent retry is allowed).
  const image = {
    family: "zimmy", ownerUid: "learner-1", key: "dd1", ts: 70,
    jpeg: "data:image/jpeg;base64,AAAA", w: 100, h: 80, type: "q", skill: "s1", session: 0
  };
  await assertSucceeds(setDoc(doc(learner, p("images/dd1_70")), image));
  await assertSucceeds(setDoc(doc(learner, p("images/dd1_70")), image));
  await assertFails(updateDoc(doc(learner, p("images/dd1_70")), { jpeg: "data:image/jpeg;base64,BBBB" }));
  await assertSucceeds(getDoc(doc(parent, p("images/dd1_70"))));
  const legacyImage = { ...image, ts: 71 }; delete legacyImage.family; delete legacyImage.ownerUid;
  await seed(p("images/dd1_71"), legacyImage);
  await assertSucceeds(setDoc(doc(learner, p("images/dd1_71")), { ...legacyImage, family: "zimmy", ownerUid: "learner-1" }));

  // Parent review decisions are append-only and readable only to the relevant
  // enrolled app (or the parent).
  const review = {
    version: 1, appKey: "dd1", ownerUid: "learner-1", attemptId: "attempt-1", decision: "correct",
    correct: false, marks: 1, maxMarks: 2, transcription: "answer", comment: "one step",
    resolverUid: "parent-1", resolvedAt: 80, automated: null
  };
  await assertSucceeds(setDoc(doc(parent, p("pencilReviews/dd1_attempt-1")), review));
  await assertSucceeds(getDoc(doc(learner, p("pencilReviews/dd1_attempt-1"))));
  await assertFails(getDoc(doc(otherLearner, p("pencilReviews/dd1_attempt-1"))));
  await assertSucceeds(getDocs(query(collection(learner, p("pencilReviews")),
    where("appKey", "==", "dd1"), where("ownerUid", "==", "learner-1"))));
  await assertFails(getDocs(query(collection(sameAppLearner, p("pencilReviews")),
    where("appKey", "==", "histp2"))));
  await assertSucceeds(getDocs(query(collection(sameAppLearner, p("pencilReviews")),
    where("appKey", "==", "histp2"), where("ownerUid", "==", "learner-3"))));
  await assertFails(updateDoc(doc(parent, p("pencilReviews/dd1_attempt-1")), { marks: 2 }));
  await assertFails(deleteDoc(doc(parent, p("pencilReviews/dd1_attempt-1"))));

  // No generic authenticated or unauthenticated access, and no cross-family access.
  await assertFails(getDoc(doc(outsider, p("vault/main"))));
  await assertFails(getDoc(doc(unauth, p("catalogue/item-1"))));
  await assertFails(setDoc(doc(parent, "families/other/catalogue/x"), { family: "other" }));

  assert.ok(true);
  console.log("Firestore Rules allow/deny matrix passed");
} finally {
  await env.cleanup();
}
