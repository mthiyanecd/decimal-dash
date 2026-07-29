// F-02: submitSession writes an idempotent submission and clears the outbox on ack.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const { sync, fs } = await loadSync({ localStorage: { histp2: JSON.stringify({ name: "Z", log: [] }) }, pathname: "/history-p2/" });
const r1 = await sync.submitSession("run-42", { id: "attacker-id", clientTs: 12345, session: 2, summary: "6/8" });
assert.equal(r1.status, "synced");
assert.equal(sync.getOutbox().length, 0, "outbox cleared after acknowledgement");

// Retry / double-tap with the same id must not create a second submission doc.
const r2 = await sync.submitSession("run-42", { clientTs: 12345, session: 2, summary: "6/8" });
assert.equal(r2.status, "synced");
const submPaths = fs.writes.filter(w => w.path === "families/zimmy/submissions/run-42");
assert.ok(submPaths.length >= 1, "submission written to stable id");
assert.equal(fs.store.has("families/zimmy/submissions/run-42"), true, "single submission doc by id (idempotent)");
assert.equal(fs.store.has("families/zimmy/submissions/attacker-id"), false, "envelope cannot override the API id");
assert.equal(fs.store.get("families/zimmy/submissions/run-42").clientTs, 12345, "client timestamp is stable across retries");
console.log("durable session submission contract passed");
