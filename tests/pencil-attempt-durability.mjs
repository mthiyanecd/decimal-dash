// Pencil work is persisted as pending before the AI network call and later finalised in place.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

for (const [name, rel] of [["Shape", "paper2/index.html"], ["Explorer", "history-p2/index.html"]]) {
  const source = readSource(rel);
  const start = source.indexOf("async function gradePencilAnswer");
  const end = source.indexOf("function qToken", start);
  const body = source.slice(start, end);
  const pendingCall = body.indexOf("recordPendingPencilAttempt(it,png)");
  const transport = body.indexOf("await sync.gradePencil");
  assert.ok(pendingCall >= 0 && transport > pendingCall,
    name + ": pending attempt must be saved before awaiting AI transport");
  assert.match(body, /finalisePencilAttempt\(attempt,g\)/, name + ": the same attempt must be finalised in place");
  assert.match(source, /grading:\{status:'pending'/, name + ": pending transport state must survive reload");
  assert.match(source, /feedback:g\.feedback/, name + ": parent audit evidence must retain feedback");
  assert.match(source, /criteria:g\.criteria/, name + ": parent audit evidence must retain rubric criteria");
  assert.match(source, /gradedAt:g\.gradedAt/, name + ": parent audit evidence must retain grading time");
  assert.match(source, /questionMarkScheme/, name + ": rubric must include the question-specific mark scheme");
}

console.log("Pencil pre-transport persistence and evidence contract passed");
