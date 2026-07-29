// F-01: every Firestore document reference must have an even segment count,
// and the vault must use the four-segment families/zimmy/vault/main path.
import assert from "node:assert";
import { loadSync, readSource } from "./helpers/load-sync-runtime.mjs";

const src = readSource("sync.js");
assert.ok(/doc\(db,\s*"families",\s*FAMILY,\s*"vault",\s*"main"\)/.test(src), "vault must be four-segment vault/main");
assert.ok(!/doc\(db,\s*"families",\s*FAMILY,\s*"vault"\)/.test(src), "must not use the invalid three-segment vault reference");
assert.ok(/"submissions"/.test(src), "submissions collection reference required");

const parentEmail = "parent@example.test";
const { sync, fs } = await loadSync({
  authUser: { uid: "parent", email: parentEmail, emailVerified: true, isAnonymous: false },
  authClaims: { familyId: "zimmy", role: "parent" },
  StudyDashConfig: { parentEmails: [parentEmail] },
  localStorage: { dd1: JSON.stringify({ name: "Z", log: [{ id: "a1", correct: true, marks: 1, maxMarks: 1, session: 0 }] }) }
});
await sync.syncNow();
await sync.submitSession("sess-1", { session: 0, summary: "done" });
await sync.awardKeys("test", 1, "req-1");

let checked = 0;
for (const w of fs.writes) {
  const segs = w.path.split("/");
  assert.equal(segs.length % 2, 0, "odd segment count in write path: " + w.path);
  checked++;
}
assert.ok(fs.writes.some(w => w.path === "families/zimmy/vault/main"), "vault write must target vault/main");
assert.ok(fs.writes.some(w => w.path === "families/zimmy/state/dd1"), "state write expected");
assert.ok(fs.writes.some(w => w.path.startsWith("families/zimmy/submissions/")), "submission write expected");
console.log("sync startup contract passed for " + checked + " document writes");
