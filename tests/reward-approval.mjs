// H-01 request/approve split: the learner may only REQUEST a reward (no vault
// write); the parent APPROVES to spend exactly one Key. Everything stays
// transactional + idempotent, and rejection never touches the vault.
import assert from "node:assert";
import { loadSync, readSource } from "./helpers/load-sync-runtime.mjs";

const parentEmail = "parent@example.test";
const { sync, fs } = await loadSync({
  pathname: "/hub/",
  authUser: { uid: "parent", email: parentEmail, emailVerified: true, isAnonymous: false },
  authClaims: { familyId: "zimmy", role: "parent" },
  StudyDashConfig: { parentEmails: [parentEmail] }
});
const VAULT = "families/zimmy/vault/main";
const RED = id => "families/zimmy/redemptions/" + id;

// Grant a balance to approve against (parent side).
await sync.awardKeys("exam", 2, "award-1");
assert.equal(fs.store.get(VAULT).examKeys, 2);
const vaultWritesBefore = fs.writes.filter(w => w.path === VAULT).length;

// 1) requestReward creates a pending redemption and writes NOTHING to the vault.
const req = await sync.requestReward({ requestId: "r1", rewardId: "ic", rewardDesc: "Ice cream", level: "Star" });
assert.equal(req.status, "pending");
assert.equal(fs.store.get(RED("r1")).status, "pending", "redemption is pending");
assert.equal(fs.writes.filter(w => w.path === VAULT).length, vaultWritesBefore, "requestReward wrote nothing to vault/main");
assert.equal(fs.store.get(VAULT).usedKeys, undefined, "no key spent on request");

// 2) A duplicate request is idempotent (no second redemption / no vault write).
const dup = await sync.requestReward({ requestId: "r1", rewardId: "ic", rewardDesc: "Ice cream", level: "Star" });
assert.equal(dup.status, "duplicate");
assert.equal(fs.writes.filter(w => w.path === VAULT).length, vaultWritesBefore, "duplicate request still no vault write");

// 3) approveRedemption decrements the vault exactly once and is idempotent on retry.
const ap = await sync.approveRedemption({ requestId: "r1" });
assert.equal(ap.status, "approved");
assert.equal(fs.store.get(RED("r1")).status, "approved", "redemption approved");
assert.equal(fs.store.get(VAULT).usedKeys, 1, "exactly one key spent on approval");
assert.equal(fs.store.get(VAULT).openedChests, 1, "exactly one chest opened on approval");

const ap2 = await sync.approveRedemption({ requestId: "r1" });
assert.equal(ap2.status, "duplicate", "re-approval is a no-op");
assert.equal(fs.store.get(VAULT).usedKeys, 1, "idempotent approval did not spend a second key");

// 4) approveRedemption throws when there are no keys left.
await sync.requestReward({ requestId: "r2", rewardId: "x", rewardDesc: "x", level: "Star" });
await sync.approveRedemption({ requestId: "r2" }); // spends key 2 of 2
await sync.requestReward({ requestId: "r3", rewardId: "x", rewardDesc: "x", level: "Star" });
let threw = false;
try { await sync.approveRedemption({ requestId: "r3" }); }
catch (e) { threw = true; assert.match(String(e.message), /insufficient/); }
assert.ok(threw, "approval beyond balance rejected in-transaction");
assert.equal(fs.store.get(VAULT).usedKeys, 2, "failed approval spent no extra key");
assert.notEqual(fs.store.get(RED("r3")).status, "approved", "failed approval left redemption unapproved");

// 5) rejectRedemption sets rejected and never touches the vault.
const vaultWritesPreReject = fs.writes.filter(w => w.path === VAULT).length;
const rej = await sync.rejectRedemption({ requestId: "r3" });
assert.equal(rej.status, "rejected");
assert.equal(fs.store.get(RED("r3")).status, "rejected");
assert.equal(fs.writes.filter(w => w.path === VAULT).length, vaultWritesPreReject, "reject wrote nothing to vault");
const rej2 = await sync.rejectRedemption({ requestId: "r3" });
assert.equal(rej2.status, "duplicate", "reject is idempotent");
assert.equal(fs.store.get("families/zimmy/vault/main").usedKeys, 2, "reject leaves the vault untouched");

// Mock-exam Keys are derived in the trusted parent view from pending-safe state.
// They are not stored as examKeys, but an explicit parent approval must be able
// to spend one of them instead of showing a Key that can never be used.
fs.store.set("families/zimmy/vault/main", { examKeys: 0, usedKeys: 0, openedChests: 0 });
fs.store.set("families/zimmy/redemptions/r-mock", {
  family: "zimmy", ownerUid: "anon", rewardId: "reward-mock", rewardDesc: "Mock reward",
  level: "Star", status: "pending", ts: 3, createdAt: 3
});
const mockApproval = await sync.approveRedemption({ requestId: "r-mock", learnerKeys: 1 });
assert.equal(mockApproval.status, "approved");
assert.equal(fs.store.get("families/zimmy/vault/main").usedKeys, 1, "one pending-safe mock Key is spent");
assert.equal(fs.store.get("families/zimmy/redemptions/r-mock").approvedLearnerKeys, 1,
  "the parent-approved mock-Key basis is durable on the redemption");

const hubSource = readSource("hub/index.html");
assert.match(hubSource, /approveRedemption\(\{requestId:r\.id,learnerKeys:lastVC\.mockKeys\}\)/,
  "Hub approval must pass its pending-safe mock-Key total");

console.log("reward approval contract passed");
