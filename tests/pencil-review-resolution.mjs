// Durable parent Pencil resolution: approve/correct/override are immutable and idempotent.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const parent = { uid: "parent-1", email: "dad@example.com", emailVerified: true, isAnonymous: false };
const { sync, fs } = await loadSync({
  pathname: "/hub/",
  authUser: parent,
  authClaims: { familyId: "zimmy", role: "parent" },
  StudyDashConfig: { parentEmails: ["dad@example.com"] }
});
const STATE = "families/zimmy/state/histp2";
const REVIEW = id => `families/zimmy/pencilReviews/histp2_${id}`;
const pending = (id, score = 1, maxMarks = 3) => ({
  id, type: "s1w", skill: "s1", session: 0, correct: null, marks: 0, maxMarks,
  needsParentReview: true,
  grading: { verdict: score === maxMarks ? "correct" : "partial", score, maxMarks, confidence: 0.72,
    humanReview: "recommended", transcription: "learner answer", feedback: "Check one fact",
    criteria: [{ label: "fact", met: false, marks: score, evidence: "one fact present" }],
    model: "test-model", gradedAt: 1234 }
});
fs.emitDoc(STATE, { app: "ExplorerDashH2", ownerUid: "learner-1", log: [
  pending("a"), pending("b", 0, 2), pending("c", 0, 2),
  { ...pending("d", 0, 2), grading: { score: null, verdict: "unavailable" } }
] });

const approved = await sync.resolvePencilReview({ appKey: "histp2", attemptId: "a", decision: "approve" });
assert.equal(approved.status, "applied");
assert.equal(fs.store.get(REVIEW("a")).marks, 1, "approve accepts the automated partial score");
assert.equal(fs.store.get(REVIEW("a")).correct, false, "partial score is final but not fully correct");
assert.equal(fs.store.get(REVIEW("a")).resolverUid, "parent-1");
assert.equal(fs.store.get(REVIEW("a")).ownerUid, "learner-1");
assert.equal(fs.store.get(REVIEW("a")).automated.feedback, "Check one fact");
assert.equal(fs.store.get(REVIEW("a")).automated.criteria[0].evidence, "one fact present");
assert.equal(fs.store.get(REVIEW("a")).automated.gradedAt, 1234);

const duplicate = await sync.resolvePencilReview({ appKey: "histp2", attemptId: "a", decision: "approve" });
assert.equal(duplicate.status, "duplicate", "same resolution retry is a no-op");
assert.equal(fs.writes.filter(w => w.path === REVIEW("a")).length, 1, "duplicate retry creates no second effect record");

const conflict = await sync.resolvePencilReview({ appKey: "histp2", attemptId: "a", decision: "override", correct: true });
assert.equal(conflict.status, "conflict", "a different second decision cannot rewrite the immutable resolution");
assert.equal(fs.store.get(REVIEW("a")).marks, 1);

const corrected = await sync.resolvePencilReview({
  appKey: "histp2", attemptId: "b", decision: "correct", marks: 1,
  transcription: "corrected reading", comment: "One of the two facts is right."
});
assert.equal(corrected.status, "applied");
assert.equal(fs.store.get(REVIEW("b")).marks, 1);
assert.equal(fs.store.get(REVIEW("b")).transcription, "corrected reading");
assert.equal(fs.store.get(REVIEW("b")).comment, "One of the two facts is right.");

const overridden = await sync.resolvePencilReview({ appKey: "histp2", attemptId: "c", decision: "override", correct: true });
assert.equal(overridden.status, "applied");
assert.equal(fs.store.get(REVIEW("c")).marks, 2, "positive override grants full marks");
assert.equal(fs.store.get(REVIEW("c")).correct, true);

await assert.rejects(
  sync.resolvePencilReview({ appKey: "histp2", attemptId: "missing", decision: "approve" }),
  /attempt-missing/
);
await assert.rejects(
  sync.resolvePencilReview({ appKey: "histp2", attemptId: "b", decision: "correct", marks: 9 }),
  /marks-range/
);
await assert.rejects(
  sync.resolvePencilReview({ appKey: "histp2", attemptId: "d", decision: "approve" }),
  /automated-score-missing/
);

console.log("durable Pencil review resolution contract passed");
