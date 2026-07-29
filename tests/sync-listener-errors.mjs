// Parent Corner connection state must reflect real Firestore listener failures.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

async function statusAfterListenerError(path, code) {
  const { sync, fs } = await loadSync({
    pathname: "/hub/",
    authUser: { uid: "parent", email: "parent@example.test", emailVerified: true, isAnonymous: false },
    authClaims: { familyId: "zimmy", role: "parent" }
  });
  assert.equal(sync.getStatus(), "connected", "hub starts connected");
  fs.emitError(path, Object.assign(new Error(code), { code }));
  return sync.getStatus();
}

assert.equal(
  await statusAfterListenerError("families/zimmy/state/dd1", "permission-denied"),
  "permission-denied",
  "state permission failures must reach Parent Corner"
);
assert.equal(
  await statusAfterListenerError("families/zimmy/redemptions", "unavailable"),
  "offline",
  "collection network failures must reach Parent Corner"
);
assert.equal(
  await statusAfterListenerError("families/zimmy/vault/main", "unauthenticated"),
  "auth-failed",
  "expired authentication must not be misreported as a rules denial"
);
assert.equal(
  await statusAfterListenerError("families/zimmy/catalogue", "internal"),
  "error",
  "unexpected listener failures must reach Parent Corner"
);

console.log("Firestore listener error propagation contract passed");
