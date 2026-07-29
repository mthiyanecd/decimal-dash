// Stable parent identity: trusted claims authorize; the public email list only
// limits which addresses the static UI will send links to.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const parent = {
  uid: "parent-uid",
  email: "Dad@Example.com",
  emailVerified: true,
  isAnonymous: false
};
const cfg = { parentEmails: ["dad@example.com"] };
const parentClaims = { familyId: "zimmy", role: "parent" };

{
  const { sync, authCalls } = await loadSync({
    pathname: "/hub/",
    href: "https://example.test/hub/",
    StudyDashConfig: cfg,
    authUser: parent,
    authClaims: parentClaims
  });
  assert.equal(authCalls.anonymous, 0, "restored parent must not be replaced by a new anonymous user");
  assert.deepEqual(sync.getIdentity(), {
    uid: "parent-uid",
    email: "dad@example.com",
    emailVerified: true,
    anonymous: false,
    familyId: "zimmy",
    role: "parent",
    isParent: true,
    parentConfigured: true,
    linkPending: false
  });
}

{
  const { sync } = await loadSync({
    pathname: "/hub/",
    href: "https://example.test/hub/",
    StudyDashConfig: cfg,
    authUser: { ...parent, email: "visitor@example.com" },
    authClaims: parentClaims
  });
  assert.equal(sync.getIdentity().isParent, true,
    "trusted claims—not a public source allowlist—authorize a restored parent");
}

{
  const { sync } = await loadSync({
    pathname: "/hub/",
    authUser: parent,
    authClaims: parentClaims
  });
  assert.equal(sync.getIdentity().isParent, true,
    "trusted parent claims remain authoritative with the default empty UX send-list");
  assert.equal(sync.getIdentity().parentConfigured, false,
    "the empty send-list remains an explicit external configuration gate");
}

{
  const { sync } = await loadSync({
    pathname: "/hub/",
    href: "https://example.test/hub/",
    StudyDashConfig: cfg,
    authUser: parent
  });
  assert.equal(sync.getIdentity().isParent, false, "client allowlisting cannot replace a trusted parent role claim");
  assert.equal(sync.getIdentity().role, null);
}

{
  const { sync, authCalls, localStorage } = await loadSync({
    pathname: "/hub/",
    href: "https://example.test/hub/",
    StudyDashConfig: cfg
  });
  await sync.startParentSignIn(" DAD@example.com ");
  assert.equal(authCalls.emailLinks.length, 1);
  assert.equal(authCalls.emailLinks[0].email, "dad@example.com");
  assert.equal(authCalls.emailLinks[0].settings.handleCodeInApp, true);
  assert.equal(authCalls.emailLinks[0].settings.url, "https://example.test/hub/");
  assert.equal(localStorage.getItem("sdParentEmailForSignIn"), "dad@example.com");

  await assert.rejects(
    sync.startParentSignIn("visitor@example.com"),
    /parent-email-not-authorised/,
    "the public Hub must not send parent links to arbitrary addresses"
  );
}

{
  const { sync, authCalls, localStorage } = await loadSync({
    pathname: "/hub/",
    href: "https://example.test/hub/?mode=signIn&oobCode=abc",
    StudyDashConfig: cfg,
    emailLink: true,
    emailLinkUser: parent,
    authClaims: parentClaims,
    localStorage: { sdParentEmailForSignIn: "dad@example.com" }
  });
  assert.equal(authCalls.completeLinks.length, 1, "Hub startup completes a pending email link");
  assert.equal(authCalls.anonymous, 0, "email-link completion happens before anonymous fallback");
  assert.equal(sync.getIdentity().isParent, true);
  assert.equal(localStorage.getItem("sdParentEmailForSignIn"), null, "one-time pending email is removed");

  await sync.signOutParent();
  assert.equal(sync.getIdentity().anonymous, true, "sign-out restores a child-safe anonymous session");
  assert.equal(sync.getIdentity().isParent, false);
}

console.log("parent email-link authentication contract passed");
