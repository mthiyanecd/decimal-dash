// F-01: each learner-state subscription tracked independently as
// loading -> ready | empty | error via getStateStatus().
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const { sync, fs } = await loadSync({
  pathname: "/hub/",
  authUser: { uid: "parent", email: "parent@example.test", emailVerified: true, isAnonymous: false },
  authClaims: { familyId: "zimmy", role: "parent" }
});
assert.deepEqual(sync.getStateStatus(), { dd1: "loading", ddp2: "loading", histp2: "loading" });

fs.emitDoc("families/zimmy/state/dd1", { name: "Zim", app: "DecimalDash" });   // ready
fs.emitDoc("families/zimmy/state/ddp2", null);                                  // empty (resolved missing)
fs.emitError("families/zimmy/state/histp2", Object.assign(new Error("x"), { code: "permission-denied" }));

const st = sync.getStateStatus();
assert.equal(st.dd1, "ready", "existing doc => ready");
assert.equal(st.ddp2, "empty", "resolved-missing doc => empty (not loading forever)");
assert.equal(st.histp2, "error", "listener failure => error");
console.log("sync state readiness contract passed");
