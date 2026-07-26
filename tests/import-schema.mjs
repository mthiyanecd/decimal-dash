// M-03/C-02/M-07: importers validate every field, dedup within a package, cap
// size/count, never wholesale-replace mastery, and can restore a full backup.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

for (const [name, rel] of [["Decimal", "index.html"], ["Shape", "paper2/index.html"], ["Explorer", "history-p2/index.html"]]) {
  const s = readSource(rel);
  assert.ok(/function normAttempt/.test(s), name + ": strict normAttempt validator required");
  assert.ok(/if\(!TYPES\[raw\.type\]\)throw/.test(s.replace(/\s/g, "")) , name + ": unknown types rejected");
  assert.ok(/if\(!SKILLS\[raw\.skill\]\)throw/.test(s.replace(/\s/g, "")), name + ": unknown skills rejected");
  assert.ok(/seen\.add\(a\.id\)/.test(s), name + ": dedup set updated on each accepted attempt");
  assert.ok(/attempts\.length>2000/.test(s.replace(/\s/g, "")), name + ": attempt count capped");
  assert.ok(/f\.size>2000000/.test(s.replace(/\s/g, "")), name + ": file size capped");
  assert.ok(/kind==='full-backup'/.test(s), name + ": full-backup restore path required");
  // Never import raw prompt HTML wholesale: prompt is escaped plain text.
  assert.ok(/prompt:esc\(String\(raw\.promptText\|\|raw\.prompt/.test(s.replace(/\s/g, "")), name + ": imported prompt escaped as plain text");
  // No wholesale mastery replacement from an imported package.
  assert.ok(!/if\(p\.mastery\)S\.mastery=p\.mastery/.test(s.replace(/\s/g, "")), name + ": must not wholesale-replace mastery from import");
}
console.log("import schema validation contract passed in all three apps");
