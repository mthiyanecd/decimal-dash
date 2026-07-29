// Parent Corner exposes safe, actionable approve/correct/override controls.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

const hub = readSource("hub/index.html");
assert.match(hub, /id="pencilReviewList"/, "Parent Corner needs a dedicated Pencil review list");
assert.match(hub, /function renderPencilReviews\(data\)/, "review list needs a renderer");
const start = hub.indexOf("function renderPencilReviews(data)");
const end = hub.indexOf("function renderAssignList", start);
const body = hub.slice(start, end);
assert.ok(start >= 0 && end > start, "review renderer must be present before assignment rendering");
assert.match(body, /sync\.getPencilReviews\(\)/, "resolved documents must hide already-decided attempts");
assert.match(body, /needsParentReview===true/, "only pending learner attempts are actionable");
assert.match(body, /a\.correct===null/, "final answers must not re-enter the review queue");
assert.match(body, /document\.createElement/, "learner and AI data must be rendered with DOM APIs");
assert.match(body, /\.textContent=/, "learner and AI data must use textContent, not HTML interpolation");
assert.doesNotMatch(body, /innerHTML\s*=.*(?:prompt|feedback|transcription|criteria)/s,
  "review evidence must not be interpolated into innerHTML");
assert.match(body, /loadImage\(item\.appKey,item\.attempt\.ts/, "parent can load the original handwriting image");
for (const decision of ["approve", "correct", "override"]) {
  assert.match(body, new RegExp("decision:'" + decision + "'"), decision + " decision must call the durable API");
}
assert.match(body, /sync\.resolvePencilReview\(/, "controls must persist through the shared transaction API");
assert.match(body, /result\.status==='conflict'/, "an immutable conflict needs an explicit stale-decision branch");
assert.match(body, /different final decision/, "a conflict must be reported instead of displayed as saved");
assert.match(body, /typeof g\.score==='number'/, "null or string AI scores must not become an approvable zero");
assert.match(body, /min='0'|\.min='0'/, "corrected marks cannot go below zero");
assert.match(body, /max=String\(maxMarks\)|\.max=String\(maxMarks\)/, "corrected marks must be bounded by question marks");
assert.match(hub, /renderPencilReviews\(data\)/, "authenticated Parent Corner refresh must render reviews");
assert.match(hub, /sync\.onPencilReviews\(\(\)=>refresh\(\)\)/, "review snapshots must refresh the panel");
assert.match(hub, /st\.pendingReviews\?\?/, "zero server pending reviews must not fall back to a stale local count");

for (const rel of ["paper2/index.html", "history-p2/index.html"]) {
  const source = readSource(rel);
  const detail = source.slice(source.indexOf("function renderPDetail"), source.indexOf("function makeCode"));
  assert.match(detail, /const pending=a\.pencil===true&&a\.correct===null&&a\.needsParentReview===true/,
    rel + ": pending Pencil work must be identified explicitly");
  assert.match(detail, /pending\?/, rel + ": pending Pencil controls must use a separate path");
  assert.match(detail, /hub\//, rel + ": pending Pencil decisions must be sent to the durable Hub workflow");
  assert.match(detail, /parentIdentity\(\)\.isParent/, rel + ": direct detail calls must remain parent guarded");
}

console.log("Parent Corner actionable Pencil review UI contract passed");
