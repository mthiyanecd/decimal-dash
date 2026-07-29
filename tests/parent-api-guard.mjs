// Privileged Hub mutations must be blocked client-side unless identity is parent.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const { sync, fs } = await loadSync({ pathname: "/hub/" });
const privileged = [
  ["add assignment", () => sync.addAssignment({ note: "x" })],
  ["remove assignment", () => sync.removeAssignment("a1")],
  ["award keys", () => sync.awardKeys("x", 1, "k1")],

  ["transfer learner state", () => sync.transferLearnerState("dd1", "replacement")],
  ["approve redemption", () => sync.approveRedemption({ requestId: "r1" })],
  ["reject redemption", () => sync.rejectRedemption({ requestId: "r1" })],
  ["add catalogue", () => sync.addCatalogueItem({ level: "Spark", description: "x" })],
  ["remove catalogue", () => sync.removeCatalogueItem("c1")],
  ["set redemption", () => sync.setRedemption("r1", { status: "fulfilled" })]
];
for (const [name, action] of privileged) {
  await assert.rejects(action, /parent-required/, name + " must require parent identity");
}
assert.equal(fs.writes.length, 0, "blocked controls must not reach Firestore");

await sync.requestReward({ requestId: "child-r1", rewardId: "c1", rewardDesc: "Movie", level: "Spark" });
assert.equal(fs.store.get("families/zimmy/redemptions/child-r1").status, "pending", "anonymous learner may request a reward");

console.log("parent-only sync API guard contract passed");
