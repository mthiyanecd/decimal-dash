// Hub listeners must match the restrictive Rules query shapes. A learner-mode
// Hub gets only member-safe feeds; a trusted parent gets the full dashboard.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const base = "families/zimmy/";
{
  const { fs } = await loadSync({ pathname: "/hub/", appKeys: ["ddp2"] });
  const paths = [...fs.colListeners.keys()];
  assert.ok(paths.includes(base + "catalogue"), "learner Hub may read the family catalogue");
  assert.ok(paths.includes(base + "redemptions"), "learner Hub subscribes to its own redemption requests");
  assert.ok(!paths.includes(base + "assignments"), "learner Hub must not open an unscoped assignment query");
  assert.ok(!paths.includes(base + "submissions"), "learner Hub must not open the parent submission feed");
  assert.ok(!paths.includes(base + "pencilReviews"), "learner Hub must not open the parent review feed");
  assert.equal([...fs.docListeners.keys()].filter(p => p.startsWith(base + "state/")).length, 0,
    "learner Hub uses same-origin local state and must not read missing/other-app singleton state docs");

  const red = fs.colListeners.get(base + "redemptions").ref;
  const ownerWhere = (red.constraints || []).find(c => c.__c === "where" && c.args[0] === "ownerUid");
  assert.deepEqual(ownerWhere && ownerWhere.args, ["ownerUid", "==", "anon"],
    "learner redemption query must be constrained to the signed-in owner UID");
}

{
  const email = "parent@example.test";
  const { fs } = await loadSync({
    pathname: "/hub/",
    authUser: { uid: "parent", email, emailVerified: true, isAnonymous: false },
    authClaims: { familyId: "zimmy", role: "parent" },
    StudyDashConfig: { parentEmails: [email] }
  });
  const paths = [...fs.colListeners.keys()];
  for (const name of ["assignments", "submissions", "pencilReviews", "catalogue", "redemptions"]) {
    assert.ok(paths.includes(base + name), "parent Hub requires " + name + " listener");
  }
  assert.equal([...fs.docListeners.keys()].filter(p => p.startsWith(base + "state/")).length, 3,
    "trusted parent subscribes to all three family state documents");
  const red = fs.colListeners.get(base + "redemptions").ref;
  assert.ok(!(red.constraints || []).some(c => c.__c === "where" && c.args[0] === "ownerUid"),
    "trusted parent may read all redemption requests");
}

console.log("Hub identity-scoped listener contract passed");
