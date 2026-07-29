// Pending Pencil work contributes to no accuracy denominator, possible marks,
// session fragments, or mock Keys until a parent resolution is applied.
import assert from "node:assert";
import vm from "node:vm";
import { loadSync, readSource } from "./helpers/load-sync-runtime.mjs";

const hub = readSource("hub/index.html");
const start = hub.indexOf("function lastTs");
const end = hub.indexOf("function collectionLevel", start);
const context = { Date, Math, Object, Number, String, Array, sync: null, KEYS: ["dd1", "ddp2", "histp2"] };
vm.createContext(context);
vm.runInContext(hub.slice(start, end) + "\nthis.api={summarise,pctOfSession};", context);

const pendingState = {
  name: "Z", done: [true], mastery: {}, retryQueue: [],
  log: [
    { id: "final", session: 0, correct: true, marks: 1, maxMarks: 1, ts: 1 },
    { id: "pending", session: 0, pencil: true, correct: null, needsParentReview: true, marks: 0, maxMarks: 5, ts: 2 }
  ]
};
const pendingSummary = context.api.summarise("ddp2", pendingState);
assert.equal(pendingSummary.attempts, 1, "pending work is not an accuracy attempt");
assert.equal(pendingSummary.correctRate, 1, "pending work is not an incorrect answer");
assert.equal(pendingSummary.pendingReviews, 1);
assert.equal(pendingSummary.frag, 0, "a session with pending review earns no fragments yet");
assert.equal(pendingSummary.avgPct, null, "pending session cannot affect collection level");

const authoritativeZero = {
  ...pendingState,
  stats: { attempts: 1, correct: 1, marks: 1, maxMarks: 1, pendingReviews: 0,
    sessions: { 0: { marks: 1, maxMarks: 1, pendingReviews: 0 } } }
};
const resolvedSummary = context.api.summarise("ddp2", authoritativeZero);
assert.equal(resolvedSummary.pendingReviews, 0, "server zero must not fall back to stale capped/local pending logs");
assert.equal(resolvedSummary.frag, 4, "resolved full-mark session may earn its fragments");

const { sync } = await loadSync({ pathname: "/paper2/", localStorage: { ddp2: "{}" } });
const mockState = {
  mastery: { s1: 50 }, stars: 0, streak: 0, best: 0, reviewEffects: {}, lastMockStart: 100, mockScore: null,
  log: [
    { id: "m1", mode: "mock", ts: 101, skill: "s1", correct: null, needsParentReview: true, marks: 0, maxMarks: 2 },
    { id: "m2", mode: "mock", ts: 102, skill: "s1", correct: null, needsParentReview: true, marks: 0, maxMarks: 2 }
  ]
};
assert.equal(sync.applyPencilReviewsToState(mockState, [
  { id: "r1", appKey: "ddp2", attemptId: "m1", decision: "override", marks: 2, maxMarks: 2 }
]), 1);
assert.equal(mockState.mockScore, null, "mock stays unscored while another review is pending");
assert.equal(sync.applyPencilReviewsToState(mockState, [
  { id: "r2", appKey: "ddp2", attemptId: "m2", decision: "correct", marks: 1, maxMarks: 2 }
]), 1);
assert.equal(mockState.mockScore, 3, "last resolution recomputes this mock run from final marks");

for (const rel of ["paper2/index.html", "history-p2/index.html"]) {
  const source = readSource(rel);
  const finish = source.slice(source.indexOf("function finishQuiz"), source.indexOf("/* ============ Apple Pencil", source.indexOf("function finishQuiz")));
  assert.match(finish, /lastMockStart/, rel + ": persists current mock boundary");
  assert.match(finish, /pending[^?]*\?null:/s, rel + ": an unresolved mock must not publish a provisional score");
  assert.match(source, /function gradedSessionAttempts/, rel + ": learner accuracy summaries need a final-attempt denominator");
  assert.match(source, /function pendingSessionCount/, rel + ": learner summary must report pending work separately");
  assert.match(source, /function sessionReviewed/, rel + ": completion badges must wait for all Pencil reviews");
  assert.match(source, /pendingReviews:pending/, rel + ": submission envelope must expose pending work separately");
  assert.match(source, /ok===null\?'waiting for review'/, rel + ": local parent table must label pending work explicitly");
  assert.match(source, /const at=S\.log\.filter\(a=>a\.correct===true\|\|a\.correct===false\)/,
    rel + ": local parent overview denominator must contain final attempts only");
}

const shapeSource = readSource("paper2/index.html");
const corrections = shapeSource.slice(shapeSource.indexOf("function startQuiz"), shapeSource.indexOf("function startQuiz") + 1000);
assert.match(corrections, /filter\(a=>a\.mode==='mock'&&a\.correct===false\)/,
  "Shape correction rounds must include only finally incorrect attempts");
assert.doesNotMatch(corrections, /a\.mode==='mock'&&!a\.correct/,
  "pending Pencil work must not be consumed as an incorrect correction item");

console.log("pending Pencil reward and mock-scoring contract passed");
