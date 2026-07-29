// Learner-side review effects: pending -> final exactly once, including progress/rewards.
import assert from "node:assert";
import vm from "node:vm";
import { loadSync, readSource } from "./helpers/load-sync-runtime.mjs";

const { sync } = await loadSync({ pathname: "/history-p2/" });
const state = {
  mastery: { s1: 50, s2: 50 }, stars: 0, streak: 0, best: 0, reviewEffects: {}, overrides: {},
  log: [
    { id: "partial", skill: "s1", correct: null, marks: 0, maxMarks: 2, needsParentReview: true },
    { id: "full", skill: "s2", correct: null, marks: 0, maxMarks: 3, needsParentReview: true }
  ]
};
const partial = { id: "histp2_partial", appKey: "histp2", attemptId: "partial", decision: "correct", marks: 1, maxMarks: 2, correct: false, comment: "Half right" };
const full = { id: "histp2_full", appKey: "histp2", attemptId: "full", decision: "override", marks: 3, maxMarks: 3, correct: true, comment: "All correct" };

assert.equal(sync.applyPencilReviewsToState(state, [partial]), 1);
assert.equal(state.log[0].correct, false, "partial is final, not pending");
assert.equal(state.log[0].marks, 1);
assert.equal(state.log[0].needsParentReview, false);
assert.equal(state.log[0].parentReview.decision, "correct");
assert.equal(state.stars, 0, "partial credit does not earn a full-answer star");
const partialMastery = state.mastery.s1;

assert.equal(sync.applyPencilReviewsToState(state, [partial]), 0, "duplicate snapshot is a no-op");
assert.equal(state.mastery.s1, partialMastery, "duplicate cannot change mastery twice");
assert.equal(state.stars, 0);

assert.equal(sync.applyPencilReviewsToState(state, [full, full]), 1, "duplicate records in one snapshot apply once");
assert.equal(state.log[1].correct, true);
assert.equal(state.log[1].marks, 3);
assert.equal(state.stars, 1, "full parent-approved answer earns one star");
assert.equal(state.streak, 1);
const fullMastery = state.mastery.s2;
assert.equal(sync.applyPencilReviewsToState(state, [full]), 0);
assert.equal(state.stars, 1, "reload/snapshot retry cannot award a second star");
assert.equal(state.mastery.s2, fullMastery);

// A parent resolution that arrives while AI transport is in flight is final:
// the late callback must neither revert it to pending nor apply progress twice.
for (const rel of ["paper2/index.html", "history-p2/index.html"]) {
  const race = {
    mastery: { s1: 50 }, stars: 1, streak: 1, best: 1, reviewEffects: {}, overrides: {},
    log: [{ id: "race", skill: "s1", correct: null, marks: 0, maxMarks: 2,
      needsParentReview: true, pencil: true, grading: { status: "pending" } }]
  };
  assert.equal(sync.applyPencilReviewsToState(race, [
    { id: "review-race", appKey: "ddp2", attemptId: "race", decision: "override",
      marks: 2, maxMarks: 2, correct: true }
  ]), 1);
  const source = readSource(rel);
  const fn = source.slice(source.indexOf("function finalisePencilAttempt"), source.indexOf("async function gradePencilAnswer"));
  let masteryCalls = 0, saves = 0;
  const context = { S: race, updateMastery: () => { masteryCalls++; }, save: () => { saves++; } };
  vm.createContext(context);
  vm.runInContext(fn + "\nthis.finalisePencilAttempt=finalisePencilAttempt;", context);
  const result = context.finalisePencilAttempt(race.log[0], {
    correct: false, verdict: "partial", score: 1, confidence: 0.7,
    humanReview: "required", transcription: "late", feedback: "late", criteria: []
  });
  assert.equal(race.log[0].correct, true, rel + ": late AI must not replace the parent decision");
  assert.equal(race.log[0].marks, 2, rel + ": late AI must not replace reviewed marks");
  assert.equal(result.applied, false, rel + ": late AI must apply no second learner effect");
  assert.equal(masteryCalls, 0, rel + ": late AI must not update mastery after review");
}

// If AI wins the timing race by milliseconds, the already-created parent
// resolution is still authoritative and must replace (not merely consume) it.
const aiFirst = {
  progressBase: { mastery: { s1: 50 }, stars: 0, streak: 0, best: 0 },
  mastery: { s1: 64 }, stars: 1, streak: 1, best: 1, reviewEffects: {}, overrides: {},
  log: [{ id: "ai-first", skill: "s1", correct: true, marks: 2, maxMarks: 2,
    needsParentReview: false, pencil: true, gradingFinalised: true,
    pencilEffectApplied: true, pencilEffectSource: "ai", pencilMasteryDelta: 14, ts: 1,
    progressEffect: { masteryDelta: 14, streak: "increment", stars: 1, source: "ai" },
    pencilStarApplied: true, pencilStreakBefore: 0, pencilStreakAfter: 1,
    pencilBestBefore: 0, pencilBestAfter: 1 }]
};
assert.equal(sync.applyPencilReviewsToState(aiFirst, [
  { id: "review-ai-first", appKey: "histp2", attemptId: "ai-first", decision: "override",
    marks: 0, maxMarks: 2, correct: false }
]), 1, "parent review must supersede an AI result that won the timing race");
assert.equal(aiFirst.log[0].correct, false);
assert.equal(aiFirst.log[0].marks, 0);
assert.equal(aiFirst.log[0].parentReview.id, "review-ai-first");
assert.equal(aiFirst.mastery.s1, 42,
  "AI mastery effect must be reversed before the parent-reviewed effect is applied");
assert.equal(aiFirst.stars, 0, "AI star must be removed when the parent rejects full credit");
assert.equal(aiFirst.streak, 0);
assert.equal(aiFirst.best, 0, "race-only AI best streak must not remain as a reward artefact");

const legacyAi = {
  // A save created by the pre-ledger feature build is migrated with its current
  // totals as the baseline; the recorded AI contribution is already inside it.
  progressBase: { mastery: { s1: 64 }, stars: 1, streak: 1, best: 1 },
  mastery: { s1: 64 }, stars: 1, streak: 1, best: 1, reviewEffects: {}, overrides: {},
  log: [{ id: "legacy-ai", skill: "s1", correct: true, marks: 2, maxMarks: 2, ts: 1,
    needsParentReview: false, pencil: true, gradingFinalised: true,
    pencilEffectApplied: true, pencilEffectSource: "ai", pencilMasteryDelta: 14,
    pencilStarApplied: true, pencilStreakBefore: 0, pencilStreakAfter: 1,
    pencilBestBefore: 0, pencilBestAfter: 1 }]
};
assert.equal(sync.applyPencilReviewsToState(legacyAi, [
  { id: "review-legacy", appKey: "histp2", attemptId: "legacy-ai", decision: "override",
    marks: 0, maxMarks: 2, correct: false }
]), 1);
assert.equal(legacyAi.mastery.s1, 42,
  "legacy AI contribution already present in the baseline must be replaced, not double-counted");
assert.equal(legacyAi.stars, 0);
assert.equal(legacyAi.streak, 0);
assert.equal(legacyAi.best, 0);

const chronological = {
  progressBase: { mastery: { s1: 90 }, stars: 0, streak: 0, best: 0 },
  mastery: { s1: 100 }, stars: 2, streak: 2, best: 2, reviewEffects: {}, overrides: {},
  log: [
    { id: "early-ai", skill: "s1", correct: true, marks: 2, maxMarks: 2, ts: 1,
      needsParentReview: false, pencil: true, gradingFinalised: true,
      pencilEffectApplied: true, pencilEffectSource: "ai",
      progressEffect: { masteryDelta: 14, streak: "increment", stars: 1, source: "ai" } },
    { id: "later", skill: "s1", correct: true, marks: 1, maxMarks: 1, ts: 2,
      progressEffect: { masteryDelta: 14, streak: "increment", stars: 1, source: "answer" } }
  ]
};
assert.equal(sync.applyPencilReviewsToState(chronological, [
  { id: "review-early", appKey: "histp2", attemptId: "early-ai", decision: "override",
    marks: 0, maxMarks: 2, correct: false }
]), 1);
assert.equal(chronological.mastery.s1, 96,
  "retroactive review must replay later clamped mastery effects chronologically");
assert.equal(chronological.stars, 1);
assert.equal(chronological.streak, 1, "later correct answer must remain the current streak");
assert.equal(chronological.best, 1, "best streak must be derived from chronological effects");

const reverseBatch = {
  progressBase: { mastery: { s1: 50 }, stars: 0, streak: 0, best: 0 },
  mastery: { s1: 50 }, stars: 0, streak: 0, best: 0, reviewEffects: {}, overrides: {},
  log: [
    { id: "first", skill: "s1", correct: null, marks: 0, maxMarks: 1, ts: 1, needsParentReview: true, pencil: true },
    { id: "second", skill: "s1", correct: null, marks: 0, maxMarks: 1, ts: 2, needsParentReview: true, pencil: true }
  ]
};
assert.equal(sync.applyPencilReviewsToState(reverseBatch, [
  { id: "r-second", appKey: "histp2", attemptId: "second", decision: "override", marks: 0, maxMarks: 1, correct: false },
  { id: "r-first", appKey: "histp2", attemptId: "first", decision: "override", marks: 1, maxMarks: 1, correct: true }
]), 2);
assert.equal(reverseBatch.streak, 0, "review batch order must not override attempt chronology");
assert.equal(reverseBatch.best, 1);

for (const rel of ["paper2/index.html", "history-p2/index.html"]) {
  const source = readSource(rel);
  assert.match(source, /reviewEffects:\{\}/, rel + " must inherit an idempotency ledger in old saves");
  assert.match(source, /progressBase:null/, rel + " must establish a stable pre-ledger progress baseline");
  assert.match(source, /function replayProgressEffects\(/, rel + " must replay progress in attempt chronology");
  const regular = source.slice(source.indexOf("function recordAttempt"), source.indexOf("function finishQuiz", source.indexOf("function recordAttempt")));
  assert.match(regular, /progressEffect/, rel + ": every new ordinary attempt must record a replayable effect");
  const pencil = source.slice(source.indexOf("function finalisePencilAttempt"), source.indexOf("async function gradePencilAnswer"));
  assert.match(pencil, /progressEffect/, rel + ": an automatic Pencil result must record a replayable effect");
  assert.match(source, /onPencilReviews/, rel + " must subscribe to durable parent resolutions");
  assert.match(source, /applyPencilReviewsToState\(S,reviews\)/, rel + " must apply the shared exactly-once transition");
}

console.log("learner Pencil review exactly-once effects contract passed");
