// Firestore writes carry server-verifiable identity and learner APIs expose only
// the narrow transitions allowed by the production ruleset.
import assert from "node:assert";
import { loadSync, readSource } from "./helpers/load-sync-runtime.mjs";

const STATE = "families/zimmy/state/dd1";
{
  const { sync, fs } = await loadSync({
    pathname: "/",
    localStorage: { dd1: JSON.stringify({ name: "Z", log: [] }) }
  });
  await sync.syncNow();
  const state = fs.store.get(STATE);
  assert.equal(state.family, "zimmy");
  assert.equal(state.appKey, "dd1");
  assert.equal(state.ownerUid, "anon");

  await sync.submitSession("dd1_s0", { session: 0, summary: "done" });
  const submission = fs.store.get("families/zimmy/submissions/dd1_s0");
  assert.equal(submission.family, "zimmy");
  assert.equal(submission.appKey, "dd1");
  assert.equal(submission.ownerUid, "anon");

  await sync.setAssignment("assignment-1", { status: "done", doneTs: 123 });
  await assert.rejects(
    sync.setAssignment("assignment-1", { note: "learner rewrote parent task" }),
    /learner-assignment-transition/,
    "learner API must reject changes outside todo-to-done completion fields"
  );
}

{
  const { sync, fs } = await loadSync({ pathname: "/hub/" });
  await sync.requestReward({ requestId: "reward-1", rewardId: "ice", rewardDesc: "Ice cream", level: "Star" });
  const request = fs.store.get("families/zimmy/redemptions/reward-1");
  assert.equal(request.family, "zimmy");
  assert.equal(request.ownerUid, "anon");
  await assert.rejects(
    sync.addRedemption({ rewardId: "bypass" }),
    /parent-required/,
    "legacy arbitrary redemption creation must not bypass the pending request contract"
  );
}

{
  const email = "parent@example.test";
  const { sync } = await loadSync({
    pathname: "/hub/",
    authUser: { uid: "parent", email, emailVerified: true, isAnonymous: false },
    authClaims: { familyId: "zimmy", role: "parent" },
    StudyDashConfig: { parentEmails: [email] }
  });
  await sync.setAssignment("assignment-1", { status: "todo", note: "parent edit" });
}

const source = readSource("sync.js");
assert.match(source, /where\("appKey",\s*"==",\s*myKey\)/,
  "learner assignment/review subscriptions must be app-scoped for Rules-compatible queries");
assert.match(source, /setDoc\(imgDoc\([\s\S]*?ownerUid:/,
  "handwriting image documents must carry immutable owner identity");
assert.match(source, /createdByUid:\s*identitySnapshot\(\)\.uid/,
  "parent-created records must identify their creator");

console.log("Firestore identity payload and transition contract passed");
