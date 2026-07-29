// Run every top-level Node contract except the Firestore Rules matrix, which
// must run under `npm run test:rules` with the emulator.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter(name => name.endsWith(".mjs") && !["run-all.mjs", "firestore-rules.mjs"].includes(name))
  .sort();
let failed = 0;
for (const name of files) {
  const result = spawnSync(process.execPath, [join(dir, name)], { stdio: "inherit" });
  if (result.status !== 0) {
    failed++;
    console.error("FAILED:", name);
  }
}
console.log(`Node contracts: ${files.length - failed}/${files.length} passed`);
if (failed) process.exit(1);
