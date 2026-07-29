// H-01: key awards are atomic + idempotent; reward redemption is now a
// request/approve split — the child request writes NOTHING to the vault, and
// only the parent approval spends a Key (see reward-approval.mjs for the full
// approval-side contract).
import assert from "node:assert";
import { loadSync, readSource } from "./helpers/load-sync-runtime.mjs";

const rewardSource = readSource("sync.js").slice(
  readSource("sync.js").indexOf("async requestReward"),
  readSource("sync.js").indexOf("// Back-compat alias")
);
assert.doesNotMatch(rewardSource, /tx\.get\(redDoc\(requestId\)\)/,
  "learner reward creation must not read a missing owner-protected document");

const parentEmail = "parent@example.test";
const { sync, fs } = await loadSync({
  pathname: "/hub/",
  authUser: { uid: "parent", email: parentEmail, emailVerified: true, isAnonymous: false },
  authClaims: { familyId: "zimmy", role: "parent" },
  StudyDashConfig: { parentEmails: [parentEmail] }
});
const VAULT = "families/zimmy/vault/main";

// Award keys via transaction; append-only award subdoc; idempotent by requestId.
await assert.rejects(sync.awardKeys("missing id", 1), /requestId/);
assert.equal(sync.updateVault, undefined, "no public helper may bypass the append-only award/redemption ledgers");
await sync.awardKeys("mock done", 3, "req-A");
await sync.awardKeys("mock done", 3, "req-A"); // duplicate must be a no-op
assert.equal(fs.store.get(VAULT).examKeys, 3, "idempotent award: duplicate requestId not double-counted");
assert.equal(fs.store.get(VAULT).lastAwardId, "req-A", "vault update is coupled to its audit record");
assert.ok([...fs.store.keys()].some(p => p.startsWith(VAULT + "/awards/")), "award recorded in append-only subcollection");
const hubSource = readSource("hub/index.html");
assert.match(hubSource, /pendingAwardId\(label,n\)/, "Hub persists an award request ID before transport");
assert.match(hubSource, /awardKeys\(label,n,requestId\)/, "Hub supplies that stable ID to the transaction API");

// A child reward request creates a pending redemption but NEVER spends a Key.
const r1 = await sync.requestReward({ requestId: "red-1", rewardId: "ice", rewardDesc: "Ice cream", level: 1 });
assert.equal(r1.status, "pending");
assert.equal(fs.store.get(VAULT).usedKeys, undefined, "child request must not touch usedKeys");
assert.equal(fs.store.get("families/zimmy/redemptions/red-1").status, "pending");

// The back-compat redeemReward alias is request-only (no vault write).
const r2 = await sync.redeemReward({ requestId: "red-1", rewardId: "ice", rewardDesc: "Ice cream", level: 1 });
assert.equal(r2.status, "duplicate", "alias stays idempotent and request-only");
assert.equal(fs.store.get(VAULT).usedKeys, undefined, "alias never spends a Key");

const retryRuntime = await loadSync({
  pathname: "/hub/",
  authUser: { uid: "parent", email: parentEmail, emailVerified: true, isAnonymous: false },
  authClaims: { familyId: "zimmy", role: "parent" },
  StudyDashConfig: { parentEmails: [parentEmail] }
});
retryRuntime.fs.store.set("families/zimmy/redemptions/reload-1", {
  rewardId: "ice", rewardDesc: "Ice cream", level: "Star", status: "pending",
  family: "zimmy", ownerUid: "parent", ts: 1, createdAt: 1
});
retryRuntime.fs.denySetOverwrite = true;
const reloaded = await retryRuntime.sync.requestReward({ requestId: "reload-1", rewardId: "ice", rewardDesc: "Ice cream", level: "Star" });
assert.equal(reloaded.status, "duplicate", "a Rules-denied overwrite verifies the existing owner request after reload");

console.log("reward transaction contract passed");
