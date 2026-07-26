// F-01/H-01: Hub gate requires all apps resolved, surfaces distinct connection
// phases with a bounded startup + Retry, subscribes to submissions, and redeems
// rewards transactionally.
import assert from "node:assert";
import { readSource } from "./helpers/load-sync-runtime.mjs";
const h = readSource("hub/index.html");

// Fail-open gate closed: readiness requires every app ready|empty|error, not anyLoaded.
assert.ok(/getStateStatus/.test(h), "hub must consult per-app getStateStatus()");
assert.ok(/allResolved/.test(h), "gate must require all subscriptions resolved");
assert.ok(!/function anyLoaded/.test(h), "the fail-open anyLoaded() gate must be gone");

// Distinct, actionable connection copy per phase.
assert.ok(/setConnMsg/.test(h), "connection status renderer required");
// distinct, actionable copy for each degraded phase (not one generic line)
assert.ok(/appear to be offline/.test(h), "distinct offline copy");
assert.ok(/refused access/.test(h) && /'permission-denied'/.test(h), "distinct permission-denied copy");
assert.ok(/Could not sign in/.test(h) && /'auth-failed'/.test(h), "distinct auth-failed copy");
// Bounded startup wait + Retry instead of polling forever.
assert.ok(/bootTries/.test(h) && /Retry/.test(h), "bounded startup wait with a Retry control");

// Submissions "last session received" view + transactional reward + pending review.
assert.ok(/onSubmissions/.test(h) && /Last session received/.test(h), "submissions receipt view required");
assert.ok(/requestReward/.test(h), "child reward pick must go through the request-only API (no direct vault write)");
assert.ok(!/updateVault\(\{usedKeys/.test(h.replace(/\s/g, "")), "child path must not increment the vault directly");
assert.ok(/approveRedemption/.test(h) && /rejectRedemption/.test(h), "parent corner must approve/reject redemptions");
assert.ok(/Sent to Dad to approve/.test(h), "child sees request-sent copy");
assert.ok(/rewardpick.*disabled|disabled=true/.test(h.replace(/\n/g, " ")), "reward buttons disabled while pending");
assert.ok(/pendingReviews/.test(h) && /waiting for your review/.test(h), "hub counts + highlights pending Pencil reviews");
console.log("Hub readiness and error-state contract passed");
