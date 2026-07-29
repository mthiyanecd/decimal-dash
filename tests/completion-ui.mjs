// F-02: all three completion screens show every control immediately (no
// download-gating), submit via the acknowledged API, and demote JSON to backup.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

for (const [name, rel] of [["Decimal", "index.html"], ["Shape", "paper2/index.html"], ["Explorer", "history-p2/index.html"]]) {
  const s = readSource(rel);
  assert.ok(/sessionSubmissions:\{\}/.test(s), name + ": sessionSubmissions must be in DEFAULT");
  assert.ok(/function submitCurrentSession/.test(s) && /submitSession\(/.test(s), name + ": completion must call the submitSession API");
  assert.ok(/clientTs:rec\.created/.test(s), name + ": Sync again must reuse the original client timestamp");
  assert.ok(/Sync blocked/.test(s), name + ": permanent authorization errors must not be called offline");
  assert.ok(/storage-failed/.test(s) && /could not queue|storage/i.test(s),
    name + ": local storage failure must not promise an automatic retry");
  assert.ok(/Sync again/.test(s), name + ": completion shows a Sync again control immediately");
  assert.ok(/Export backup/.test(s) && /function exportSession/.test(s), name + ": JSON download demoted to Export backup");
  assert.ok(/Synced with Dad|Saved offline/.test(s), name + ": lifecycle status copy present");
  // The old download-then-reveal doSubmit gate must be gone.
  assert.ok(!/function doSubmit/.test(s), name + ": download-gating doSubmit() must be removed");
  // renderSubmit auto-starts sync and shows the Done control in the same render (not gated behind a download).
  const rs = s.slice(s.indexOf("function renderSubmit"), s.indexOf("function renderSubmit") + 1600);
  assert.ok(/submitCurrentSession\(/.test(rs), name + ": renderSubmit auto-starts submission");
  assert.ok(/closeSession\(|Finish!/.test(rs), name + ": Done/Finish shown immediately, not behind a download");
}
console.log("learner completion UI contract passed in all three apps");
