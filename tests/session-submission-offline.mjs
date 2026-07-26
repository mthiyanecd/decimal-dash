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
// durably persisted before the network attempt
assert.ok(localStorage.getItem("sdOutbox_ddp2").includes("run-off"), "outbox persisted to localStorage");
console.log("offline session outbox contract passed");
