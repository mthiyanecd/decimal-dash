// Parent correctness overrides must keep marks and correctness in parity.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const state = {
  name: "Z",
  overrides: { wrong: true, right: false },
  log: [
    { id: "wrong", session: 0, correct: false, marks: 1, maxMarks: 2 },
    { id: "right", session: 1, correct: true, marks: 2, maxMarks: 2 }
  ]
};
const { sync, fs } = await loadSync({ pathname: "/", localStorage: { dd1: JSON.stringify(state) } });
await sync.syncNow();
const uploaded = fs.store.get("families/zimmy/state/dd1");
assert.equal(uploaded.stats.correct, 1, "one overridden attempt is correct");
assert.equal(uploaded.stats.sessions[0].marks, 2,
  "overriding a partially marked incorrect answer to correct must award its maximum marks");
assert.equal(uploaded.stats.sessions[1].marks, 0,
  "overriding a correct answer to incorrect must remove its marks");
console.log("parent override mark-accounting contract passed");
