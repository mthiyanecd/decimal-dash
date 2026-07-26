// Harness self-check: the real sync.js boots in the VM and exposes the API.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";
const { sync } = await loadSync({ localStorage: { dd1: JSON.stringify({ name: "Z", log: [] }) } });
assert.equal(sync.role, "app");
for (const m of ["syncNow", "submitSession", "gradePencil", "getStatus", "getStateStatus", "redeemReward", "awardKeys"]) {
  assert.equal(typeof sync[m], "function", "missing API: " + m);
}
console.log("sync runtime harness self-check passed");
