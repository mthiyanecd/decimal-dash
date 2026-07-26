// H-01: key awards are atomic + idempotent; reward redemption is now a
// request/approve split — the child request writes NOTHING to the vault, and
// only the parent approval spends a Key (see reward-approval.mjs for the full
// approval-side contract).
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const { sync, fs } = await loadSync({ pathname: "/hub/" });
const VAULT = "families/zimmy/vault/main";

// Award keys via transaction; append-only award subdoc; idempotent by requestId.
await sync.awardKeys("mock done", 3, "req-A");
await sync.awardKeys("mock done", 3, "req-A"); // duplicate must be a no-op
assert.equal(fs.store.get(VAULT).examKeys, 3, "idempotent award: duplicate requestId not double-counted");
assert.ok([...fs.store.keys()].some(p => p.startsWith(VAULT + "/awards/")), "award recorded in append-only subcollection");

// A child reward request creates a pending redemption but NEVER spends a Key.
const r1 = await sync.requestReward({ requestId: "red-1", rewardId: "ice", rewardDesc: "Ice cream", level: 1 });
assert.equal(r1.status, "pending");
assert.equal(fs.store.get(VAULT).usedKeys, undefined, "child request must not touch usedKeys");
assert.equal(fs.store.get("families/zimmy/redemptions/red-1").status, "pending");

// The back-compat redeemReward alias is request-only (no vault write).
const r2 = await sync.redeemReward({ requestId: "red-1", rewardId: "ice", rewardDesc: "Ice cream", level: 1 });
assert.equal(r2.status, "duplicate", "alias stays idempotent and request-only");
assert.equal(fs.store.get(VAULT).usedKeys, undefined, "alias never spends a Key");

console.log("reward transaction contract passed");
