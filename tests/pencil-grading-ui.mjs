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
  // Pending path: correct:null + needsParentReview, no mastery/stars unless confidently correct.
  const rp = s.slice(s.indexOf("function recordPencilAttempt"));
  assert.ok(/correct=g&&g\.correct===true\?true:null/.test(rp.replace(/\s/g, "")), name + ": uncertain result stored as correct:null");
  assert.ok(/needsParentReview:correct!==true/.test(rp.replace(/\s/g, "")), name + ": needsParentReview when not auto-correct");
  assert.ok(/if\(correct===true\)updateMastery/.test(rp.replace(/\s/g, "")), name + ": mastery only updated when confidently correct");
  // capture the real canvas JPEG
  assert.ok(/exportCanvas\(\)/.test(rp) || /const png=exportCanvas/.test(s.replace(/\s/g, "")), name + ": captures the real canvas image");
}

const hub = readSource("hub/index.html");
assert.ok(/pendingReviews/.test(hub), "Hub must count pending Pencil reviews");
console.log("automated Pencil grading UI contract passed in Shape, Explorer, and Parent Corner");
