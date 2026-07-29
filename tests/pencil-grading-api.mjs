// F-03: gradePencil validates input/output and auto-corrects only when
// validation passes AND confidence>=threshold AND humanReview=not_needed AND verdict=correct.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const IMG = "data:image/jpeg;base64," + "A".repeat(64);
function modelReturning(obj) { return { async generateContent() { return { response: { text: () => JSON.stringify(obj) } }; } }; }

const { sync } = await loadSync({ pathname: "/history-p2/", localStorage: { histp2: "{}" } });

// Invalid image rejected before any model call.
{
  const r = await sync.gradePencil({ image: "not-an-image", maxMarks: 3 });
  assert.equal(r.correct, null); assert.equal(r.needsParentReview, true); assert.equal(r.error, "invalid-image");
}
// Non-positive rubric max rejected.
{
  const r = await sync.gradePencil({ image: IMG, maxMarks: 0 });
  assert.equal(r.error, "invalid-maxMarks");
}
// Confident, correct, not-needed => auto-correct true.
{
  sync._setPencilModel(modelReturning({ transcription: "3 classes", verdict: "correct", score: 3, maxMarks: 3, confidence: 0.95, humanReview: "not_needed", criteria: [{ label: "c", met: true, marks: 3 }], feedback: "great" }));
  const r = await sync.gradePencil({
    image: IMG, maxMarks: 3, rubric: { criteria: [{ label: "c", marks: 3 }] }, confidenceThreshold: 0.85
  });
  assert.equal(r.correct, true, "auto-correct on high-confidence correct");
  assert.equal(r.needsParentReview, false);
}
// Negative and over-allocated criterion marks can sum to the total but must
// never auto-award credit. Every returned criterion is bound to its rubric row.
{
  sync._setPencilModel(modelReturning({
    verdict: "correct", score: 3, maxMarks: 3, confidence: 0.99, humanReview: "not_needed",
    criteria: [{ label: "fact", met: false, marks: -2 }, { label: "reason", met: true, marks: 5 }]
  }));
  const r = await sync.gradePencil({
    image: IMG, maxMarks: 3,
    rubric: { criteria: [{ label: "fact", marks: 1 }, { label: "reason", marks: 2 }] }
  });
  assert.equal(r.correct, null);
  assert.equal(r.error, "criterion-range");
}
{
  sync._setPencilModel(modelReturning({
    verdict: "correct", score: 3, maxMarks: 3, confidence: 0.99, humanReview: "not_needed",
    criteria: [{ label: "wrong row", met: true, marks: 3 }]
  }));
  const r = await sync.gradePencil({
    image: IMG, maxMarks: 3, rubric: { criteria: [{ label: "expected row", marks: 3 }] }
  });
  assert.equal(r.error, "criterion-identity");
}
// Low confidence => pending review, no auto-correct.
{
  sync._setPencilModel(modelReturning({ transcription: "x", verdict: "correct", score: 3, maxMarks: 3, confidence: 0.4, humanReview: "not_needed", criteria: [] }));
  const r = await sync.gradePencil({ image: IMG, maxMarks: 3, confidenceThreshold: 0.85 });
  assert.equal(r.correct, null, "low confidence must not auto-correct");
  assert.equal(r.needsParentReview, true);
}
// A model may contradict itself (verdict=correct but partial score). Never turn
// that into full learner credit; it needs a parent decision.
{
  sync._setPencilModel(modelReturning({ transcription: "one fact", verdict: "correct", score: 1, maxMarks: 3, confidence: 0.99, humanReview: "not_needed", criteria: [{ label: "c", met: true, marks: 1 }] }));
  const r = await sync.gradePencil({ image: IMG, maxMarks: 3, confidenceThreshold: 0.85 });
  assert.equal(r.correct, null, "partial score cannot auto-award full credit even when verdict says correct");
  assert.equal(r.needsParentReview, true);
}
// Out-of-range score rejected as invalid.
{
  sync._setPencilModel(modelReturning({ verdict: "correct", score: 9, maxMarks: 3, confidence: 0.9, humanReview: "not_needed" }));
  const r = await sync.gradePencil({ image: IMG, maxMarks: 3 });
  assert.equal(r.error, "score-range");
}
// Criterion totals inconsistent with score rejected.
{
  sync._setPencilModel(modelReturning({
    verdict: "correct", score: 3, maxMarks: 3, confidence: 0.9, humanReview: "not_needed",
    criteria: [{ met: false, marks: 1 }, { met: false, marks: 0 }]
  }));
  const r = await sync.gradePencil({ image: IMG, maxMarks: 3 });
  assert.equal(r.error, "criterion-total");
}
// humanReview required => never auto-correct even if confident+correct.
{
  sync._setPencilModel(modelReturning({ verdict: "correct", score: 3, maxMarks: 3, confidence: 0.99, humanReview: "required", criteria: [] }));
  const r = await sync.gradePencil({ image: IMG, maxMarks: 3 });
  assert.equal(r.correct, null);
}
console.log("automated Pencil grading transport contract passed");
