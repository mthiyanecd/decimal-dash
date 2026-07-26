// F-02: a queued submission is recovered on startup and on the window 'online' event.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

// Startup recovery: an outbox seeded in localStorage is flushed once auth resolves.
{
  const { fs } = await loadSync({
    pathname: "/history-p2/",
    localStorage: {
      histp2: JSON.stringify({ name: "Z", log: [] }),
      sdOutbox_histp2: JSON.stringify([{ id: "queued-1", session: 0, clientTs: 1 }])
    }
  });
  await new Promise(r => setTimeout(r, 10));
  assert.ok(fs.store.has("families/zimmy/submissions/queued-1"), "startup flush recovers queued submission");
}

// Online recovery: fail first, then recover on 'online'.
{
  const { sync, fs, window } = await loadSync({ localStorage: { dd1: JSON.stringify({ name: "Z", log: [] }) } });
  fs.fail = true;
  const r = await sync.submitSession("queued-2", { session: 0 });
  assert.equal(r.status, "queued");
  fs.fail = false;
  window.dispatch("online");
  await new Promise(res => setTimeout(res, 10));
  assert.ok(fs.store.has("families/zimmy/submissions/queued-2"), "online event flushes the outbox");
  assert.equal(sync.getOutbox().length, 0, "outbox cleared after recovery");
}
console.log("pending completion recovery contract passed");
