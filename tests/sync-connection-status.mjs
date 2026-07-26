// F-01: public connection lifecycle via getStatus()/onStatus().
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

// Happy path: auth resolves -> connected; a state write moves syncing -> connected.
{
  const seen = [];
  const { sync } = await loadSync({ localStorage: { dd1: JSON.stringify({ name: "Z", log: [] }) } });
  sync.onStatus(s => seen.push(s));
  assert.equal(sync.getStatus(), "connected");
  await sync.syncNow();
  assert.ok(seen.includes("syncing"), "should surface a syncing phase during write");
  assert.equal(sync.getStatus(), "connected");
}

// Auth failure surfaces auth-failed rather than a generic connecting state.
{
  const { sync } = await loadSync({ authFail: true, localStorage: { dd1: "{}" } });
  assert.equal(sync.getStatus(), "auth-failed");
}
console.log("sync connection status contract passed");
