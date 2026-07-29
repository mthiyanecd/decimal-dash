// An anonymous user without an active family membership remains a functional
// local-only learner. The client must not repeatedly hit protected Firestore
// paths, and queued work must remain on-device for later enrolment.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const localState = JSON.stringify({
  name: "Zimmy", session: 0, step: 0, qi: 0, cur: null, log: [], retryQueue: [],
  mastery: {}, streak: 0, best: 0, badges: [], stars: 0, stretch: [],
  mockScore: null, mockTotal: 40, done: [], overrides: {}, comments: {},
  sessionSubmissions: {}, reviewEffects: {}, lastMockStart: 0, schemaVersion: 1
});
const { sync, fs, localStorage } = await loadSync({
  pathname: "/paper2/", enrolled: false, localStorage: { ddp2: localState }
});
assert.equal(sync.getStatus(), "local-only");
assert.equal(sync.getMembershipStatus(), "unenrolled");
assert.equal(fs.writes.length, 0, "unenrolled startup must not attempt protected writes");
assert.equal(fs.docListeners.size + fs.colListeners.size, 0, "unenrolled startup must not open protected listeners");
await assert.rejects(sync.syncNow(), /local-only/);
assert.equal(localStorage.getItem("ddp2"), localState, "local progress remains intact");
assert.equal(fs.writes.length, 0, "explicit sync also stays local-only");

console.log("unenrolled local-only fallback contract passed");
