// Parent Corner UI must be gated by verified email identity, never by synced PIN state.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

const hub = readSource("hub/index.html");
assert.ok(/id="parentAuth"/.test(hub), "Parent Corner needs an email authentication panel");
assert.ok(/id="parentEmail"/.test(hub) && /id="parentSignIn"/.test(hub), "email-link controls are required");
assert.ok(/Send sign-in link/.test(hub), "sign-in action must explain what is sent");
assert.ok(/startParentSignIn/.test(hub), "Hub must invoke shared email-link auth");
assert.ok(/completeParentSignInIfPresent/.test(hub), "Hub must support same-device link completion when email is needed");
assert.ok(/signOutParent/.test(hub), "parent can return the Hub to learner mode");
assert.match(hub, /signOutParent\(\)[\s\S]{0,120}location\.reload\(\)/,
  "sign-out must rebuild listeners under the learner identity");
assert.match(hub, /completeParentSignInIfPresent\(email\)[\s\S]{0,160}location\.reload\(\)/,
  "manual link completion must rebuild privileged parent listeners");
assert.ok(/getIdentity/.test(hub) && /onIdentity/.test(hub), "Parent Corner must render from shared identity state");
assert.ok(/\.isParent/.test(hub), "privileged panel must require isParent");
assert.ok(!/storedPinHashes|storedPins|sha256\(str\)/.test(hub), "Hub must not use learner PINs as its security gate");
assert.ok(!/r\.allResolved\s*&&\s*!hasPin/.test(hub), "empty data must never unlock parent controls");

for (const rel of ["index.html", "paper2/index.html", "history-p2/index.html"]) {
  const source = readSource(rel);
  assert.doesNotMatch(source, /Create a 4 digit PIN|Enter PIN|Wrong PIN|S\.pin|id="setPin"/,
    rel + ": local PIN must not authorize parent controls");
  const auth = source.slice(source.indexOf("function parentIdentity"), source.indexOf("function pTabs"));
  const gate = source.slice(source.indexOf("function renderParentGate"), source.indexOf("function pTabs"));
  assert.match(auth, /StudyDashSync/, rel + ": local Parent Corner must consult shared Firebase identity");
  assert.match(auth, /getIdentity\(\)/, rel + ": local Parent Corner must restore the signed-in parent");
  assert.match(gate, /identity\.isParent/, rel + ": local Parent Corner must require the parent role");
  assert.match(gate, /hub\//, rel + ": unauthenticated parents must be directed to Hub sign-in");
  const parent = source.slice(source.indexOf("function renderParent(tab)"), source.indexOf("function renderPDetail"));
  assert.match(parent, /parentIdentity\(\)\.isParent/, rel + ": direct renderParent calls must also be guarded");
  const detail = source.slice(source.indexOf("function renderPDetail"), source.indexOf("function renderPDetail") + 220);
  assert.match(detail, /parentIdentity\(\)\.isParent/, rel + ": direct parent detail calls must also be guarded");
}

console.log("Parent Corner email-auth UI contract passed");
