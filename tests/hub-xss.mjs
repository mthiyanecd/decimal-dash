// Remote/legacy Firestore data and synced learner state are untrusted even after
// restrictive Rules are enabled. Hub HTML attribute and score sinks must encode
// or normalise those values before assigning innerHTML.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";

const hub = readSource("hub/index.html");
const dash = hub.slice(hub.indexOf("function renderDash"), hub.indexOf("function renderPencilReviews"));
assert.doesNotMatch(dash, /data-ts="'\+p\.ts/, "handwriting timestamps must not enter an attribute raw");
const summary = hub.slice(hub.indexOf("function summarise"), hub.indexOf("function collectionLevel"));
assert.match(summary, /Number\(S\.mockScore\)/, "synced mock scores must cross a numeric boundary");
assert.match(summary, /Number\.isFinite\(mockScore\)/, "non-finite mock scores must be rejected");

const assignments = hub.slice(hub.indexOf("function renderAssignList"), hub.indexOf("function renderCatalogue"));
assert.doesNotMatch(assignments, /data-(?:reopen|done|del)="'\+a\.id/,
  "legacy assignment IDs must be attribute-escaped");
const catalogue = hub.slice(hub.indexOf("function renderCatalogue"), hub.indexOf("function renderRedemptions"));
assert.doesNotMatch(catalogue, /data-delc="'\+c\.id/, "legacy catalogue IDs must be attribute-escaped");
const chest = hub.slice(hub.indexOf("function openChest"), hub.indexOf("let redeeming"));
assert.doesNotMatch(chest, /data-id="'\+it\.id/, "legacy reward IDs must be attribute-escaped");

console.log("Hub legacy-data XSS hardening contract passed");
