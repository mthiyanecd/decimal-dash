// Optional AI transport must not be part of the critical Auth/Firestore module
// dependency chain: a firebase-ai CDN failure must not take Parent Corner down.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

const source = readSource("sync.js");
assert.doesNotMatch(source, /^import[^;]*firebase-ai\.js[^;]*;/m,
  "Firebase AI must not be a static import that can abort sync.js evaluation");
assert.doesNotMatch(source, /^import[^;]*firebase-app-check\.js[^;]*;/m,
  "optional App Check must not be a static import that can abort Parent Corner");
assert.match(source, /import\("https:\/\/www\.gstatic\.com\/firebasejs\/12\.16\.0\/firebase-ai\.js"\)/,
  "Pencil grading should lazily load the coordinated Firebase AI SDK");
assert.match(source, /import\("https:\/\/www\.gstatic\.com\/firebasejs\/12\.16\.0\/firebase-app-check\.js"\)/,
  "configured App Check should lazily load its coordinated SDK module");
assert.match(source, /await\s+pencilModel\(\)/,
  "grading must await lazy model initialisation");
assert.match(source, /const\s+appCheckReady\s*=\s*initialiseOptionalAppCheck\(\)/,
  "configured App Check must expose one shared readiness promise");
assert.match(source, /await\s+appCheckReady/,
  "protected optional transports must wait for the App Check attempt");
assert.match(source, /runtimeConfig\.appCheckSiteKey\s*&&\s*!appCheckOk[^\n]+app-check-init-failed/,
  "a configured App Check failure must stop protected startup visibly");
assert.match(source, /app-check-init-failed[^\n]+\?\s*"error"\s*:\s*"auth-failed"/,
  "App Check initialisation failure must not be misreported as an Auth failure");

console.log("optional Firebase AI module isolation contract passed");
