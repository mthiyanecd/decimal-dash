# Study Dash — Cumulative Code and Go-Live Audit

**Repository:** `mthiyanecd/decimal-dash`

**Feature branch:** `fix/firebase-submission-pencil-grading`

**Original audited baseline:** `bf9d93080afed4a35695c93009fc897679d9627e`

**Current feature base before this implementation:** `06716e4185b399e592da5644f7c626432751c0b1`

**Current deployed baseline at final verification start:** `22a7a21fec2aa30b9ed2a8fdf2ea5d71966ab691`

**Final verification date:** 29 July 2026 (SAST)

## 1. Scope

This cumulative audit covers:

- `index.html`, `paper2/index.html`, `history-p2/index.html` and `hub/index.html`.
- Shared Firebase/Auth/Firestore/AI runtime in `sync.js`.
- Runtime configuration in `config.js`.
- Complete version-controlled Firestore Rules and emulator tests.
- Learner scoring, Pencil grading/review, History variety, session submission, rewards and vault integrity.
- Static GitHub Pages and Firebase go-live controls.

The original workspace did not contain a tracked `CODE_AUDIT.md`; this file reconstructs the historical findings and records their final cumulative dispositions in the authoritative native-filesystem clone.

## 2. Executive decision

### Repository implementation

**PASS at the repository gate after the independent findings below were addressed.**

At the final local gate:

```text
Node contracts: 41/41 passed
Firestore Rules allow/deny matrix passed
HTML inline-script syntax contract passed (16 scripts)
git diff --check: passed
npm audit --omit=dev: found 0 vulnerabilities
```

### Production synchronisation

**CONDITIONAL / NOT YET PROVEN by local tests.**

Firebase CLI authentication, parent custom claims, parent email configuration, App Check registration, existing-data migration, deployed Rules, real Firebase AI and iPad verification are external operational gates. Passing local contracts must not be reported as proof of those systems.

## 3. Cumulative finding register

Status meanings:

- **Addressed:** implemented and covered by focused or aggregate tests.
- **Partial:** material risk reduced, with a documented residual limitation.
- **Outstanding:** external or source work remains before secure production use.
- **Regressed:** a previously fixed behaviour became unsafe again.

| ID | Severity | Finding | Final status | Evidence / disposition |
|---|---:|---|---|---|
| F-01 | Critical | Invalid three-segment Firestore vault document reference aborted Parent Corner | **Addressed** | Runtime uses `families/zimmy/vault/main` at `sync.js:196`; startup and Hub readiness contracts pass. |
| F-02 | Critical | Parent Corner could remain indefinitely “connecting” and hide listener failures | **Addressed** | Connection classification and listener callbacks are exercised by `tests/hub-readiness.mjs`, `tests/sync-listener-errors.mjs` and `tests/sync-state-readiness.mjs`. |
| F-03 | Critical | Parent PIN was only a client-side gate and could not authorise Firestore | **Addressed** | Parent authority now requires verified non-anonymous Auth plus trusted claims at `sync.js:92-117` and `firestore.rules:12`; all four Parent Corner entry points are covered. PIN-derived remote state was removed. |
| F-04 | Critical | Anonymous Auth was treated as household membership | **Addressed** | Parent-created `members/{uid}` enrolment, allowed app keys and local-only fallback are enforced from `sync.js:209` and Rules membership helpers. Anonymous self-enrolment is denied. |
| F-05 | Critical | Rules were permissive, unversioned and untested | **Addressed in repository; deployment outstanding** | Complete `firestore.rules` plus real emulator matrix in `tests/firestore-rules.mjs`. Firebase deployment remains a separate authenticated operation. |
| F-06 | High | Parent and learner Auth sessions share browser persistence, rotating the learner UID | **Partial** | UI warns against parent sign-in on learner iPad; separate-device enrolment is operationally required. Explicit audited replacement transfer is implemented at `sync.js:741` and `firestore.rules:152`. Anonymous UID durability remains a platform limitation. |
| F-07 | High | Replacement enrolment had no safe state-ownership migration | **Addressed** | Explicit opt-in Hub action, active target membership, atomic owner change and immutable `stateTransfers` record; old/new owner emulator probes pass. Legacy ownerless state is covered. |
| F-08 | High | Optional Firebase AI/App Check imports could take down Auth/Firestore startup | **Addressed** | Both are dynamic optional imports; App Check initialisation attempt is sequenced before Auth at `sync.js:46-66,173`. Module-isolation contracts pass. |
| F-09 | High | App Check could race first protected operation | **Addressed in source; production registration outstanding** | `appCheckReady` gates Auth startup. `config.js` still requires the production reCAPTCHA Enterprise site key and Console enforcement staging. |
| F-10 | High | Learner listeners relied on Rules as filters or exceeded enrolled app scope | **Addressed** | Learner queries are owner/app scoped; learner Hub does not open parent state feeds. Subset-membership fixture in `tests/hub-listener-scope.mjs` passes. |
| F-11 | High | Session submission was download-gated, non-durable or mutable across retry | **Addressed** | Stable envelope ID and original `clientTs` are retained. Outbox persistence is verified before transport; transient work is retained, permanent authorisation failures are removed, and acknowledged remote writes remain `synced` with an explicit warning if only local cleanup fails. |
| F-12 | High | Shape/History Pencil work could self-award marks | **Addressed** | Work is persisted before AI, graded via shared transport, and uncertain/invalid results route to review. No learner self-mark path remains. |
| F-13 | High | Pending Pencil work inflated marks, possible marks, mastery or rewards | **Addressed** | Tri-state `correct:null` exclusion is covered by pending-scoring and pending-rewards contracts across marks, mastery, badges, fragments, Keys, vault and mock outcomes. |
| F-14 | High | AI grading accepted plausible totals with malformed individual criteria | **Addressed** | `gradePencil()` at `sync.js:511` validates criterion count/identity, non-negative allocation, per-criterion maximum, total, boolean `met`, score/verdict consistency and ranges. |
| F-15 | High | AI request lacked question-specific evidence and could lose work before transport | **Addressed** | Shape and History persist a stable pending attempt and image before calling `gradePencil`; rubric/mark scheme, transcription, feedback, criteria, evidence, model and timestamp are retained. |
| F-16 | Critical | Parent approve/correct/override decisions were not durable or idempotent | **Addressed** | Immutable review records, owner binding, parent resolver/timestamp, duplicate/conflict outcomes and exactly-once learner `reviewEffects` are covered by the review contracts. Progress is derived from the immutable attempt/effect chronology rather than review arrival order. |
| F-17 | High | Same-app learner could read another owner’s Pencil reviews | **Addressed** | Review documents include `ownerUid`; learner listener includes `appKey` and `ownerUid`; Rules at `firestore.rules:445` and emulator query probes enforce it. |
| F-18 | Medium | Hub presented immutable review conflicts as saved | **Addressed** | Conflict remains unresolved with a stale-decision message in `hub/index.html:395-480`; Hub review UI contract passes. |
| F-19 | High | History questions lacked stable identity and repeated excessively | **Addressed** | Stable `qid` assignment begins at `history-p2/index.html:177`; unseen/different-variant selection and exact correction replay are covered by `tests/history-question-variety.mjs`. Programme retains the 35-mark mock. |
| F-20 | Critical | Child reward redemption could write/spend vault Keys | **Addressed** | Child `requestReward()` creates only immutable pending redemption; parent approval at `sync.js:865` is the only learner-triggered spend path. |
| F-21 | High | Reward create transaction read a missing owner-protected document | **Addressed** | Create-first semantics plus stable local retry identity and owner-visible duplicate verification; `tests/reward-transaction.mjs` covers Rules-denied overwrite. |
| F-22 | High | Hub displayed derived mock Keys that approval could not spend | **Addressed with parent attestation** | Hub passes the final review-aware mock-Key count to trusted parent approval, which records `approvedLearnerKeys` in the immutable redemption before spending. Pending mock work remains ineligible. |
| F-23 | Critical | Broad parent vault update and generated retry IDs allowed unaudited/double credits | **Addressed** | Public `updateVault()` removed; caller ID required and persisted before transport; immutable award and exact vault delta are atomically coupled with `lastAwardId`. Redemption spend is coupled with `lastRedemptionId` (`firestore.rules:240-278`). |
| F-24 | High | Firestore server timestamps did not match Rules fixtures/transitions | **Addressed** | Emulator fixtures use `serverTimestamp()` for production transitions; complete matrix passes. |
| F-25 | High | Legacy remote text/IDs could reach HTML injection sinks | **Addressed for reviewed Hub paths** | Assignment, catalogue, redemption, review and synced score boundaries use escaping, DOM APIs/`textContent` and finite-number normalisation. `tests/hub-xss.mjs` passes. |
| F-26 | Medium | History and app auto-advance callbacks could act on a replaced/null run | **Addressed** | Token-guarded `scheduleAdvance()` and `S.cur` guard contracts pass; first-wrong input lock prevents retry-spam. |
| F-27 | Medium | Remote state could exceed Firestore’s 1 MiB document limit | **Partial** | Remote log capped at 400 newest entries, PNGs split/downscaled/deduplicated and listeners bounded. There is no exact serialised-byte preflight; monitoring remains required. |
| F-28 | High | Client-authored educational state could be mistaken for server truth | **Partial / accepted architecture** | Rules enforce ownership, shape and privileged transitions, but do not prove educational correctness. Parent-reviewed Pencil decisions and ledger mutations are authoritative; ordinary client progress remains advisory. |
| F-29 | High | Production App Check, Auth provider, claims and authorised domains were assumed complete | **Outstanding external gate** | Required Console/Admin steps are explicit in `08 Firebase Go-Live Guide.md`. No local test may be used to claim they are deployed. |
| F-30 | High | Existing anonymous identity/data could be stranded by restrictive Rules cutover | **Partial** | Local-only fallback and audited owner transfer exist. The actual learner UID must still be captured, enrolled and legacy records migrated before production Rules cutover. |
| F-31 | Medium | Dependency advisories could be hidden behind a production-only audit | **Documented** | Browser deployment has no npm production dependencies and production audit is clean. Firebase CLI development tree currently reports 21 transitive advisories (17 high, 4 moderate); it is not shipped. Review CLI updates separately rather than force-downgrading. |
| F-32 | High | Parent correctness overrides changed accuracy but retained the original marks | **Addressed** | `effectiveMarks()` now applies the same override before accepting stored marks; `tests/override-mark-accounting.mjs` covers both correction directions and per-session totals. |
| F-33 | Critical | A late AI response could overwrite a completed parent Pencil review, or an AI result could cause the parent review effect to be consumed | **Addressed** | Parent resolutions finalise the attempt before a late callback can mutate it. If AI wins first, the parent effect replaces the AI effect at the same stable attempt position. Both race directions and duplicate delivery are covered by `tests/pencil-review-effects.mjs`. |
| F-34 | High | A failed `localStorage` outbox write was silently reported as durably queued | **Addressed** | Outbox writes now require successful read-back; failure returns `storage-failed`, sets an error state, and all learner UIs tell the user to export a backup rather than promising automatic retry. |
| F-35 | Medium | Shape mock correction rounds treated unresolved Pencil attempts as incorrect | **Addressed** | Correction selection now requires `correct===false`; pending work remains excluded. The source contract is in `tests/pencil-pending-rewards.mjs`. |
| F-36 | Medium | Decimal Dash's direct Parent Detail renderer omitted the trusted-parent guard present in the other apps | **Addressed** | `renderPDetail()` now fails closed through `renderParentGate()`; all three detail entry points are enforced by `tests/parent-corner-auth-ui.mjs`. |
| F-37 | High | Retroactive Pencil reviews mutated mastery/streak/best in delivery order, producing different results when later attempts or reversed batches existed | **Addressed** | Shape and History establish a stable progress baseline and record every new ordinary, AI and parent effect on its attempt. Shared review application replaces that attempt's effect and replays mastery clamps, stars, streak and best in timestamp/index order. A pre-ledger AI effect already frozen into a migrated baseline is removed through its recorded exact effect metadata before replacement. Intervening-attempt, clamp-boundary, reverse-batch and legacy-save probes pass in `tests/pencil-review-effects.mjs`. |
| F-38 | Medium | The unordered 100-document Pencil-review feed could permanently omit an older parent decision | **Addressed** | The live collection remains bounded, but each unresolved local/Hub attempt is also read by its deterministic immutable review-document ID in bounded batches, including on reconnect and the learner sync interval. `tests/pencil-review-feed.mjs` proves all 101 pending decisions are recovered. |

No finding was classified as regressed at the final local gate.

## 4. Architecture and trust boundaries

### Browser-local authority

The learner apps retain full local history in `localStorage`. A remote state payload is a synchronisation/reporting copy, not a tamper-proof academic record.

### Parent authority

`identitySnapshot()` (`sync.js:92`) recognises parent authority only from restored Firebase identity plus verified email and trusted family/role claims. The public email allowlist controls link sending, not Rules access.

### Membership

Runtime membership bootstrap starts at `sync.js:209`. Missing membership produces explicit local-only operation. Parent enrolment/revocation and explicit replacement transfer are parent guarded in both source and Rules.

### Pencil lifecycle

1. Stable attempt and captured work are persisted locally.
2. AI transport returns structured evidence.
3. Only a fully correct, full-mark, sufficiently confident, no-review result is auto-final.
4. Every other result remains `correct:null`.
5. Parent writes one immutable review resolution.
6. Learner replaces that attempt's effect, replays all post-baseline effects chronologically, and records a durable marker; parent resolution wins either AI/review timing order and later attempts retain their correct effects.

### Rewards and vault

- Learner creates only a pending reward request.
- Trusted parent approval records the final eligible learner-Key attestation.
- Award and redemption events are immutable.
- Aggregate vault changes include a stable mutation ID and are Rules-coupled to the matching event.
- Duplicate operations do not change the aggregate twice.

## 5. Test and verification matrix

| Gate | Result | What it proves | What it does not prove |
|---|---|---|---|
| `npm run test:contracts` | 41/41 pass | Production source contracts, runtime harness behaviours and HTML invariants | Browser engine, deployed Firebase or real network behaviour |
| Rules emulator | Pass | Complete local Rules compile and synthetic principal allow/deny matrix | Currently deployed Rules or production data compatibility |
| `node --check` + inline scripts | Pass | JavaScript parses | Runtime integrations or device UX |
| `git diff --check` | Pass | No whitespace-error diff | Semantic correctness |
| `npm audit --omit=dev` | 0 vulnerabilities | No vulnerable production npm tree | Firebase CDN or dev CLI advisories |
| Isolated local HTTP browser smoke | Pass on all four routes | Current static routes, same-origin config/module order, anonymous role gate and no-production startup in the desktop browser | Safari, iPad, Apple Pencil, real AI/Auth/App Check |

Expected permission-denied emulator messages are generated by `assertFails` probes. The matrix result is determined by process exit and assertions.

The final browser matrix loaded Decimal Dash, Shape Dash, Explorer Dash and the Study Hub from an ephemeral no-network copy. Each route exposed the sentinel learner identity, made no remote request and produced no uncaught console error. Parent Corner remained locked with the missing-configuration notice and separate-device warning. The ephemeral server and copy were removed after the probe.

## 6. External release gates

Before real child data or enforcement:

- Authenticate Firebase CLI for `zimmy-study-hub`.
- Enable anonymous and email-link Auth and authorised domains.
- Configure the intended parent email in `config.js`.
- Assign parent claims from trusted Admin SDK code.
- Capture/enrol the current learner UID from a separate parent device.
- Migrate legacy ownerless records and preserve original submission timestamps.
- Register reCAPTCHA Enterprise App Check and configure the public site key.
- Enable and quota-limit Firebase AI Logic; confirm model availability.
- Deploy restrictive Rules separately and run synthetic production smoke.
- Verify Safari/iPad/Home Screen, Apple Pencil, offline/reconnect and parent email-link round trip.
- Configure privacy/retention, billing, budget alerts, monitoring and rollback records.

## 7. Release and rollback

The exact release commit, deployment commit, Rules deployment time and rollback commits must be appended after deployment. Never force-push `gh-pages`. Static rollback uses `git revert`; Rules rollback uses the saved previous Rules copy.

## 8. Final audit statement

The implementation closes the original critical Parent Corner, authorisation, grading, review, reward and Firestore parity failures in repository source, including all code findings from the final independent security and learner-integrity reviews. It deliberately does not claim that local contracts equal production configuration. Secure go-live requires the external identity, migration, App Check, Rules deployment and real-device gates listed above.