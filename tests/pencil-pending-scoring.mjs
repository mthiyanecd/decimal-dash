// THE grading-integrity contract (was the failing one): pending-review attempts
// (correct===null) must NOT enter the graded aggregates in stripPngs(). They are
// counted separately as pendingReviews. This MUST pass.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const state = {
  name: "Z",
  overrides: {},
  log: [
    { id: "a", correct: true,  marks: 2, maxMarks: 2, session: 0 },   // graded correct
    { id: "b", correct: false, marks: 0, maxMarks: 2, session: 0 },   // graded wrong
    { id: "c", correct: null,  marks: 0, maxMarks: 3, session: 0, needsParentReview: true } // pending
  ]
};

const { sync, fs } = await loadSync({ pathname: "/history-p2/", localStorage: { histp2: JSON.stringify(state) } });
await sync.syncNow();
const doc = fs.store.get("families/zimmy/state/histp2");
const st = doc.stats;

assert.equal(st.attempts, 2, "pending review must not enter the graded-attempt denominator");
assert.equal(st.correct, 1, "only strictly-graded correct answers counted");
assert.equal(st.maxMarks, 4, "pending maxMarks (3) excluded from possible marks");
assert.equal(st.marks, 2, "only earned graded marks aggregated");
assert.equal(st.pendingReviews, 1, "pending reviews published separately");
assert.equal(st.sessions[0].maxMarks, 4, "session-level graded maxMarks excludes pending");
assert.equal(st.sessions[0].pendingReviews, 1, "session-level pending count published");
console.log("pencil pending scoring contract passed");
