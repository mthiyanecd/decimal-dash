// F-02: syncNow() resolves only after setDoc succeeds, returns a timestamp,
// and concurrent callers share one in-flight promise.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const { sync, fs } = await loadSync({ localStorage: { dd1: JSON.stringify({ name: "Z", log: [] }) } });
const before = fs.writes.filter(w => w.path === "families/zimmy/state/dd1").length;
const [a, b] = await Promise.all([sync.syncNow(), sync.syncNow()]);
assert.equal(typeof a, "number", "syncNow resolves to a timestamp");
assert.equal(a, b, "concurrent callers share one in-flight promise (same timestamp)");
const after = fs.writes.filter(w => w.path === "families/zimmy/state/dd1").length;
assert.equal(after - before, 1, "shared in-flight promise must not double-write");
assert.equal(sync.getLastSyncedAt(), a, "lastSyncedAt recorded");
console.log("explicit state synchronization contract passed");
