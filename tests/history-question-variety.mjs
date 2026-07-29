// Explorer Dash: stable question identities and bounded unseen selection.
import assert from "node:assert";
import vm from "node:vm";
import fs from "node:fs";

const file = new URL("../history-p2/index.html", import.meta.url);
const html = fs.readFileSync(file, "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.ok(scripts.length >= 3, "expected Explorer Dash inline scripts");
const sessionsStart = scripts[2].indexOf("const SESSIONS=[");
const sessionsEnd = scripts[2].indexOf("\n\n/* ============ answer checking", sessionsStart);
assert.ok(sessionsStart >= 0 && sessionsEnd > sessionsStart, "session plan markers changed");

const fixedMath = Object.create(Math);
fixedMath.random = () => 0;
let uuid = 0;
const crypto = { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` };
const context = {
  console,
  Math: fixedMath,
  Date,
  self: { crypto },
  crypto,
  document: { querySelector: () => null, getElementById: () => ({}) },
  S: { log: [], mastery: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s${i + 1}`, 50])) }
};
vm.createContext(context);
vm.runInContext(`${scripts[0]}\n${scripts[1]}\n${scripts[2].slice(sessionsStart, sessionsEnd)}\n` +
  `globalThis.__historyApi={TYPES,makeItem,makeFromSkill,makeSimilarItem,replayItem,questionHistory,warmSet,diagnosticSet,mockSet,chalA,chalB,chalWrite,SESSIONS};`,
  context, { filename: "history-p2/index.html" });
const api = context.__historyApi;
const ids = items => items.map(item => item.qid);

assert.equal(api.TYPES.s1q.count, 10, "registered pools must expose their finite size");
assert.equal(api.makeItem("s1q", { i: 0 }).qid, "s1q:0", "fixture identity must be stable");
assert.equal(api.makeItem("s1q", { i: 10 }).qid, "s1q:0", "wrapped fixture identity must stay canonical");

const warm = api.warmSet();
const diagnostic = api.diagnosticSet();
assert.equal(ids(warm).filter(id => new Set(ids(diagnostic)).has(id)).length, 0,
  "warm-up must not repeat an exact diagnostic question");

const fixedProgramme = api.SESSIONS.flatMap(session => session.steps
  .filter(step => step.k === "quiz" && step.make)
  .flatMap(step => step.make()));
assert.equal(fixedProgramme.length, 97, "fixed programme appearance count changed unexpectedly");
assert.ok(new Set(ids(fixedProgramme)).size >= 76,
  "fixed programme must retain the improved bank coverage rather than reverting to repeated fixtures");

const beforeMock = [...warm, ...diagnostic];
for (let si = 0; si <= 5; si++) {
  for (const step of api.SESSIONS[si].steps) {
    if (step.k === "quiz" && step.make && step.mode !== "warm" && step.mode !== "diag" && step.mode !== "mock") {
      beforeMock.push(...step.make());
    }
  }
}
const priorIds = new Set(ids(beforeMock));
const diagnosticIds = new Set(ids(diagnostic));
const avoidableMockRepeats = api.mockSet().filter(item =>
  priorIds.has(item.qid) && !diagnosticIds.has(item.qid) && api.TYPES[item.type].count > 1);
assert.deepEqual(ids(avoidableMockRepeats), [], "mock may repeat diagnostic anchors only when repetition is intentional or unavoidable");
assert.equal(api.mockSet().reduce((sum, item) => sum + item.marks, 0), 35, "mock total must remain 35 marks");

const priorBeforeChallenge = new Set([...priorIds, ...ids(api.mockSet())]);
const avoidableChallengeRepeats = [...api.chalA(), ...api.chalB()].filter(item => priorBeforeChallenge.has(item.qid));
assert.deepEqual(ids(avoidableChallengeRepeats), [], "Extra Challenge objective questions should use unseen bank variants");

// Adaptive/retry-style selection must consume every unseen finite variant before fallback.
context.S.log = [{ type: "s1q", qid: "s1q:0", prompt: api.makeItem("s1q", { i: 0 }).prompt }];
const used = api.questionHistory();
const fresh = Array.from({ length: 9 }, () => api.makeFromSkill("s1", false, used));
assert.equal(new Set(ids(fresh)).size, 9, "one quiz must not select the same variant twice");
assert.ok(!ids(fresh).includes("s1q:0"), "recently logged variant must be avoided while alternatives exist");
assert.equal(api.makeFromSkill("s1", false, used).type, "s1q", "exhaustion must fall back without looping");

// Old saves did not have qid; type+prompt fallback still prevents an immediate repeat.
const legacy = api.makeItem("s2q", { i: 0 });
context.S.log = [{ type: legacy.type, prompt: legacy.prompt }];
const legacyPick = api.makeFromSkill("s2", false, api.questionHistory());
assert.notEqual(legacyPick.qid, legacy.qid, "legacy prompt history must participate in de-duplication");

context.S.log = [];
assert.notEqual(api.makeSimilarItem({ type: "s1q", qid: "s1q:0" }, api.questionHistory()).qid, "s1q:0",
  "similar retry should avoid the failed variant while alternatives exist");
assert.equal(api.replayItem({ type: "s1q", qid: "s1q:4" }).qid, "s1q:4",
  "correction mode must deliberately replay the exact missed question");

assert.match(html, /qid:it\.qid/, "attempt logs must persist stable question identity");
assert.match(html, /retryQueue\.push\(\{type:it\.type,qid:it\.qid/, "automatic similar-question requests must retain failed identity");
assert.match(html, /a\.mode==='mock'&&a\.correct===false&&\(a\.ts\|\|0\)>=start/,
  "corrections must include only incorrect attempts from the latest mock run");
assert.match(html, /S\.lastMockStart=start/, "latest mock boundary must survive finishQuiz");

console.log("History question variety contract passed");
