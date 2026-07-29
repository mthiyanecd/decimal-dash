// F-02: an offline submission is queued in a durable outbox and returns "queued".
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const { sync, fs, localStorage } = await loadSync({ localStorage: { ddp2: JSON.stringify({ name: "Z", log: [] }) }, pathname: "/paper2/" });
fs.fail = true; fs.failCode = "unavailable";
const r = await sync.submitSession("run-off", { session: 1 });
assert.equal(r.status, "queued", "offline write must report queued, not synced");
assert.equal(sync.getStatus(), "offline", "network-unavailable classified as offline");
const outbox = sync.getOutbox();
assert.equal(outbox.length, 1, "envelope retained in outbox");
assert.equal(outbox[0].id, "run-off");

fs.failCode = "permission-denied";
const blocked = await sync.submitSession("run-blocked", { clientTs: 999, session: 1 });
assert.equal(blocked.status, "blocked");
assert.equal(blocked.reason, "permission-denied");
assert.equal(sync.getOutbox().some(e => e.id === "run-blocked"), false,
  "permanent authorization failures must leave the retry outbox");
// durably persisted before the network attempt
assert.ok(localStorage.getItem("sdOutbox_ddp2").includes("run-off"), "outbox persisted to localStorage");

const storageFailure = await loadSync({
  localStorage: { ddp2: JSON.stringify({ name: "Z", log: [] }) }, pathname: "/paper2/"
});
storageFailure.fs.fail = true;
storageFailure.localStorage.setItem = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
const notQueued = await storageFailure.sync.submitSession("run-no-storage", { session: 1 });
assert.equal(notQueued.status, "storage-failed",
  "submission must not promise a durable queue when localStorage rejected it");
assert.equal(storageFailure.sync.getStatus(), "error");
assert.equal(storageFailure.sync.getOutbox().some(e => e.id === "run-no-storage"), false);

const cleanupFailure = await loadSync({
  localStorage: { ddp2: JSON.stringify({ name: "Z", log: [] }) }, pathname: "/paper2/"
});
const realSetItem = cleanupFailure.localStorage.setItem.bind(cleanupFailure.localStorage);
let outboxWrites = 0;
cleanupFailure.localStorage.setItem = (key, value) => {
  if (key === "sdOutbox_ddp2" && ++outboxWrites === 2) throw new Error("cleanup failed");
  return realSetItem(key, value);
};
const remotelySaved = await cleanupFailure.sync.submitSession("run-cleanup-failed", { session: 1 });
assert.equal(remotelySaved.status, "synced",
  "an acknowledged remote write remains synced when only local outbox cleanup fails");
assert.equal(remotelySaved.warning, "outbox-cleanup-failed");
assert.ok(cleanupFailure.fs.store.has("families/zimmy/submissions/run-cleanup-failed"));
assert.ok(cleanupFailure.sync.getOutbox().some(e => e.id === "run-cleanup-failed"),
  "failed cleanup safely retains the idempotent submission for a later retry");
console.log("offline session outbox contract passed");
