// Runtime security/configuration is loaded before the shared module on every page.
import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readSource } from "./helpers/load-sync-runtime.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfgPath = join(ROOT, "config.js");
assert.ok(existsSync(cfgPath), "one shared public runtime config file is required");
const cfg = readFileSync(cfgPath, "utf8");
assert.match(cfg, /window\.StudyDashConfig\s*=/, "config.js must publish StudyDashConfig");
assert.match(cfg, /familyId\s*:\s*["']zimmy["']/, "family id is explicit");
assert.match(cfg, /aiModel\s*:/, "AI model is configurable");
assert.match(cfg, /appCheckSiteKey\s*:/, "production App Check site key is configurable");
assert.match(cfg, /appCheckDebug\s*:\s*false/, "debug App Check is disabled by default");
assert.match(cfg, /parentEmails\s*:/, "parent email UX allowlist is explicit");
assert.doesNotMatch(cfg, /(private[_-]?key|service[_-]?account|debug[_-]?token)\s*:/i,
  "runtime config must never contain a private key, service account, or debug token");

for (const [rel, configSrc, syncSrc] of [
  ["index.html", "config.js", "sync.js"],
  ["paper2/index.html", "../config.js", "../sync.js"],
  ["history-p2/index.html", "../config.js", "../sync.js"],
  ["hub/index.html", "../config.js", "../sync.js"]
]) {
  const source = readSource(rel);
  const configTag = `<script src="${configSrc}"></script>`;
  const syncTag = `<script type="module" src="${syncSrc}"></script>`;
  assert.ok(source.includes(configTag), rel + ": shared runtime config script missing");
  assert.ok(source.indexOf(configTag) < source.indexOf(syncTag), rel + ": runtime config must load before sync.js");
}

const sync = readSource("sync.js");
const versions = [...sync.matchAll(/gstatic\.com\/firebasejs\/(\d+\.\d+\.\d+)\//g)].map(m => m[1]);
assert.ok(versions.length >= 4, "Firebase CDN imports must remain explicit");
assert.equal(new Set(versions).size, 1, "all Firebase modules must use one coordinated SDK version");
assert.match(sync, /runtimeConfig\.familyId/, "sync runtime must consume the configured family id");
assert.match(sync, /runtimeConfig\.appCheckDebug/, "local App Check debug mode must be explicit");
assert.match(sync, /localhost|127\.0\.0\.1/, "debug mode must be restricted to local origins");
assert.doesNotMatch(sync, /FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*["'][^"']+["']/,
  "a committed App Check debug token is forbidden");
assert.doesNotMatch(sync, /pinHash|sha256\(s\.pin\)/,
  "legacy Parent PIN material must never be uploaded after verified Auth migration");

console.log("runtime security configuration contract passed");
