// F-03: Shape + Explorer remove self-marking and grade via gradePencil, storing
// uncertain results as pending review without touching mastery/stars; the Hub
// flags pending reviews.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

for (const [name, rel] of [["Shape", "paper2/index.html"], ["Explorer", "history-p2/index.html"]]) {
  const s = readSource(rel);
  assert.ok(!/function selfMark/.test(s), name + ": selfMark() must be removed");
  assert.ok(!/Mine matches/.test(s) && !/Not quite yet/.test(s), name + ": self-mark UI must be gone");
  assert.ok(/gradePencil\(/.test(s), name + ": must call the gradePencil adapter");
  assert.ok(/function gradePencilAnswer/.test(s) && /function pencilRubric/.test(s), name + ": rubric-based grading required");
  // Pending path is durable before transport; only a fully validated result may apply progress.
  const pending = s.slice(s.indexOf("function recordPendingPencilAttempt"), s.indexOf("async function gradePencilAnswer"));
  const finalise = s.slice(s.indexOf("function finalisePencilAttempt"), s.indexOf("async function gradePencilAnswer"));
  assert.ok(/correct:null/.test(pending), name + ": pending result stored as correct:null");
  assert.ok(/needsParentReview:true/.test(pending), name + ": pending result requires parent review");
  const compactFinalise = finalise.replace(/\s/g, "");
  assert.ok(/if\(correct&&!a\.pencilEffectApplied\).*progressEffect=\{.*source:'ai'/.test(compactFinalise),
    name + ": confidently correct AI work records exactly one replayable effect");
  assert.ok(/replayProgressEffects\(\)/.test(finalise),
    name + ": AI progress must be derived by chronological replay");
  // capture the real canvas JPEG
  assert.ok(/constpng=exportCanvas\(\)/.test(s.replace(/\s/g, "")), name + ": captures the real canvas image");
}

const hub = readSource("hub/index.html");
assert.ok(/pendingReviews/.test(hub), "Hub must count pending Pencil reviews");
console.log("automated Pencil grading UI contract passed in Shape, Explorer, and Parent Corner");
