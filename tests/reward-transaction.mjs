// H-01: reward redemption + key award are atomic, idempotent, balance-checked.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const { sync, fs } = await loadSync({ pathname: "/hub/" });
const VAULT = "families/zimmy/vault/main";

// Award keys via transaction; append-only award subdoc; idempotent by requestId.
await sync.awardKeys("mock done", 3, "req-A");
await sync.awardKeys("mock done", 3, "req-A"); // duplicate must be a no-op
assert.equal(fs.store.get(VAULT).examKeys, 3, "idempotent award: duplicate requestId not double-counted");
assert.ok([...fs.store.keys()].some(p => p.startsWith(VAULT + "/awards/")), "award recorded in append-only subcollection");

// Redeem with balance available.
const r1 = await sync.redeemReward({ requestId: "red-1", rewardId: "ice", rewardDesc: "Ice cream", level: 1 });
assert.equal(r1.status, "ok");
assert.equal(fs.store.get(VAULT).usedKeys, 1, "one key consumed");
// Duplicate redemption is idempotent (no second key consumed).
const r2 = await sync.redeemReward({ requestId: "red-1", rewardId: "ice", rewardDesc: "Ice cream", level: 1 });
assert.equal(r2.status, "duplicate");
assert.equal(fs.store.get(VAULT).usedKeys, 1, "duplicate redemption did not consume another key");

// Balance exhausted => rejected.
await sync.redeemReward({ requestId: "red-2", rewardId: "x", rewardDesc: "x" }); // uses key 2
await sync.redeemReward({ requestId: "red-3", rewardId: "x", rewardDesc: "x" }); // uses key 3
let threw = false;
try { await sync.redeemReward({ requestId: "red-4", rewardId: "x", rewardDesc: "x" }); }
catch (e) { threw = true; assert.match(String(e.message), /insufficient/); }
assert.ok(threw, "redemption beyond balance must be rejected in-transaction");
console.log("reward transaction contract passed");
