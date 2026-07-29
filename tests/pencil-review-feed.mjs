// A bounded collection snapshot must not hide the immutable resolution for any
// locally pending Pencil attempt; deterministic document reads backfill all.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const log = [], initialDocs = {};
for (let i = 0; i < 101; i++) {
  const attemptId = `pending-${i}`;
  log.push({ id: attemptId, pencil: true, correct: null, needsParentReview: true, marks: 0, maxMarks: 1, ts: i + 1 });
  initialDocs[`families/zimmy/pencilReviews/ddp2_${attemptId}`] = {
    appKey: "ddp2", ownerUid: "anon", attemptId, decision: "override",
    correct: true, marks: 1, maxMarks: 1, resolverUid: "parent", resolvedAt: i + 1
  };
}
const { sync } = await loadSync({
  pathname: "/paper2/",
  localStorage: { ddp2: JSON.stringify({ log, reviewEffects: {} }) },
  initialDocs
});
await new Promise(resolve => setTimeout(resolve, 20));
const reviews = sync.getPencilReviews();
assert.equal(reviews.length, 101, "all pending attempt resolutions must be fetched by deterministic ID");
assert.ok(reviews.some(r => r.attemptId === "pending-100"), "the 101st review cannot be hidden by SUB_LIMIT");
console.log("deterministic pending Pencil-review feed contract passed");