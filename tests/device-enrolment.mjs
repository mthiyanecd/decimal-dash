// A trusted parent can enrol/revoke the learner's anonymous Firebase UID; an
// anonymous visitor cannot self-enrol or broaden its app access.
import assert from "node:assert";
import { loadSync, readSource } from "./helpers/load-sync-runtime.mjs";

{
  const { sync } = await loadSync({ pathname: "/hub/" });
  await assert.rejects(sync.enrolLearnerDevice("learner-uid", "iPad", ["dd1"]), /parent-required/);
  await assert.rejects(sync.disableLearnerDevice("learner-uid"), /parent-required/);
}

{
  const email = "parent@example.test";
  const { sync, fs } = await loadSync({
    pathname: "/hub/",
    authUser: { uid: "parent", email, emailVerified: true, isAnonymous: false },
    authClaims: { familyId: "zimmy", role: "parent" },
    StudyDashConfig: { parentEmails: [email] }
  });
  await assert.rejects(sync.enrolLearnerDevice("bad/uid", "iPad", ["dd1"]), /invalid-learner-uid/);
  await assert.rejects(sync.enrolLearnerDevice("learner-uid", "iPad", ["unknown"]), /invalid-app-key/);

  const first = await sync.enrolLearnerDevice("learner-uid", "Zimmy's iPad", ["dd1", "ddp2", "histp2"]);
  assert.equal(first.status, "enrolled");
  const path = "families/zimmy/members/learner-uid";
  const member = fs.store.get(path);
  assert.deepEqual(member.appKeys, ["dd1", "ddp2", "histp2"]);
  assert.equal(member.active, true);
  assert.equal(member.role, "learner");
  assert.equal(member.familyId, "zimmy");
  assert.equal(member.createdByUid, "parent");

  const createdAt = member.createdAt;
  const second = await sync.enrolLearnerDevice("learner-uid", "Replacement iPad", ["dd1", "ddp2"]);
  assert.equal(second.status, "updated");
  assert.equal(fs.store.get(path).createdAt, createdAt, "re-enrolment preserves immutable audit identity");
  assert.deepEqual(fs.store.get(path).appKeys, ["dd1", "ddp2"]);

  fs.store.set("families/zimmy/state/dd1", {
    family: "zimmy", appKey: "dd1", app: "DecimalDash", ownerUid: "old-device", updated: 1, log: []
  });
  const transfer = await sync.transferLearnerState("dd1", "learner-uid");
  assert.equal(transfer.status, "transferred");
  assert.equal(fs.store.get("families/zimmy/state/dd1").ownerUid, "learner-uid");
  const transferPath = "families/zimmy/stateTransfers/dd1_learner-uid";
  assert.equal(fs.store.get(transferPath).oldOwnerUid, "old-device");
  assert.equal(fs.store.get(transferPath).newOwnerUid, "learner-uid");
  assert.equal((await sync.transferLearnerState("dd1", "learner-uid")).status, "duplicate");

  await sync.disableLearnerDevice("learner-uid");
  assert.equal(fs.store.get(path).active, false);
}

const hub = readSource("hub/index.html");
assert.match(hub, /Learner device ID/, "learner UID must be visible for trusted enrolment");
assert.match(hub, /enrolLearnerDevice/, "Parent Corner needs an enrol-device action");
assert.match(hub, /transferLearnerState/, "replacement-device progress needs a parent-audited transfer action");
assert.match(hub, /replacement device/i, "ownership transfer must be an explicit parent choice");
assert.match(hub, /Do not sign in to Parent Corner on the learner iPad/i,
  "UI must warn that parent sign-in would replace the learner's anonymous session");

console.log("trusted learner-device enrolment contract passed");
