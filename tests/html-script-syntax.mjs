// Compile every inline script in the four standalone pages. External ES modules
// are checked separately with `node --check sync.js`.
import assert from "node:assert";
import vm from "node:vm";
import { readSource } from "./helpers/load-sync-runtime.mjs";

const pages = ["index.html", "paper2/index.html", "history-p2/index.html", "hub/index.html"];
let compiled = 0;
for (const page of pages) {
  const html = readSource(page);
  const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(tags.length, page + ": expected at least one script tag");
  for (let i = 0; i < tags.length; i++) {
    if (/\bsrc\s*=/.test(tags[i][1])) continue;
    new vm.Script(tags[i][2], { filename: page + "#inline-script-" + (i + 1) });
    compiled++;
  }
}
assert.ok(compiled >= 7, "expected all standalone inline scripts to compile");
console.log(`HTML inline-script syntax contract passed (${compiled} scripts)`);
