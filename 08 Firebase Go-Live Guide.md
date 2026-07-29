# Firebase Go-Live Guide

**Project:** Study Dash / Decimal Dash

**Firebase project:** `zimmy-study-hub`

**Static host:** GitHub Pages

**Prepared:** 29 July 2026 (SAST)
**Rules source:** `firestore.rules`

## 1. Purpose and release boundary

This guide covers the safe release of the static learner applications, Parent Corner, Firestore Rules, Firebase Authentication, App Check and Firebase AI Logic.

GitHub Pages deployment and Firestore Rules deployment are separate operations. A push to `gh-pages` does **not** deploy `firestore.rules`.

The repository is code-complete only when its local gates pass. Production is ready only after the Console, identity, migration and real-device gates below are also complete.

## 2. Current release decision

At the time this guide was prepared:

- Node contracts: **39/39 passed**.
- Firestore emulator allow/deny matrix: **passed**.
- JavaScript and all 16 inline scripts: **parsed successfully**.
- `git diff --check`: **passed**.
- Production npm audit: **0 vulnerabilities**; there are no production npm dependencies.
- Development-only Firebase CLI dependencies retain transitive advisories. These packages are not shipped to browsers.
- Firebase CLI authentication: **not available in the release workspace**.
- `config.js` still has an empty parent email allowlist and empty reCAPTCHA Enterprise App Check site key.
- Real email-link sign-in, trusted parent claims, enrolled learner identity, deployed restrictive Rules, production App Check, real Firebase AI, Safari/iPad and Apple Pencil tests remain external gates.

Therefore, do not describe the release as secure production synchronisation until sections 5–10 are complete.

## 3. Security model

### Parent

Parent authority requires all of the following:

- A non-anonymous Firebase Authentication user.
- A verified email.
- Trusted token claim `familyId: "zimmy"`.
- Trusted token claim `role: "parent"`.

The email list in `config.js` limits email-link sending and account discovery in the UI. It is public UX configuration, not the Rules authorisation boundary.

Custom claims must be assigned from a trusted Admin SDK environment. Never place Admin SDK credentials, private keys or service-account JSON in this repository or any browser file.

### Learner

The learner uses anonymous Firebase Auth for a device identity. Remote access additionally requires:

```text
families/zimmy/members/{learnerUid}
```

with an active learner role and explicit app keys. Anonymous users cannot self-enrol. An unenrolled device remains deliberately local-only, retains work on-device and avoids repeated protected Firestore calls.

Parent sign-in replaces anonymous Auth persistence on the same browser origin. Enrol the learner from a **separate parent device or browser profile**. Do not sign in to Parent Corner on the learner iPad.

### App Check

App Check is abuse mitigation, not user or family authorisation. Production should use reCAPTCHA Enterprise. `appCheckDebug` must remain `false` in committed configuration. A local debug token must never be committed.

### Educational data

Learner progress, mastery and mock-exam results are client-authored and are advisory rather than server-proven facts. Pending Pencil work contributes nothing until resolved. Durable Key awards, reward approvals and Pencil decisions require a trusted parent action and immutable audit record.

## 4. Repository gates

Run from the repository root:

```bash
npm ci
npm run test:contracts
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:rules
node --check sync.js
node --check config.js
node tests/html-script-syntax.mjs
git diff --check
npm audit --omit=dev
```

Expected release evidence:

```text
Node contracts: 39/39 passed
Firestore Rules allow/deny matrix passed
HTML inline-script syntax contract passed (16 scripts)
found 0 vulnerabilities
```

The emulator uses project `demo-study-dash` and must never contact production.

## 5. Firebase Console prerequisites

Complete these before deploying restrictive Rules or using real child data:

1. In Firebase Authentication, enable Anonymous authentication for learner devices.
2. Enable Email link (passwordless) authentication for the parent.
3. Add the exact GitHub Pages host to Authentication authorised domains:
   ```text
   mthiyanecd.github.io
   ```
4. Create or confirm the intended parent Firebase user.
5. From a trusted Admin SDK environment, assign:
   ```json
   {
     "familyId": "zimmy",
     "role": "parent"
   }
   ```
6. Force-refresh the parent ID token after assigning claims (sign out/in or explicitly refresh it).
7. Register the web app with Firebase App Check using reCAPTCHA Enterprise.
8. Enable Firebase AI Logic and the selected model in the intended region/project.
9. Configure billing, budget alerts, quotas and monitoring before sending handwriting.
10. Record privacy, retention and deletion decisions for learner state, images, submissions and review records.

Do not use a public email allowlist, anonymous Auth or App Check as a substitute for trusted claims and Rules.

## 6. Runtime configuration

`config.js` is public browser configuration. Set the intended values before static deployment:

```js
window.StudyDashConfig = {
  familyId: "zimmy",
  aiModel: "<validated Firebase AI Logic model>",
  appCheckSiteKey: "<public reCAPTCHA Enterprise site key>",
  appCheckDebug: false,
  parentEmails: ["<normalised parent email>"]
};
```

Safe to publish:

- Firebase browser configuration.
- reCAPTCHA Enterprise site key.
- Model identifier.
- Deliberate small parent email allowlist, if its privacy trade-off is accepted.

Never publish:

- Service-account JSON or private keys.
- Admin SDK credentials.
- Provider API secrets.
- App Check debug tokens.
- Passwords or PINs.

All pages must load `config.js` before `sync.js`.

## 7. Existing-data and identity migration

Perform migration using synthetic data first, then take a backup before touching existing family data.

### Capture the learner identity

1. On the learner iPad, open a learner app or Hub without signing in as the parent.
2. Record the displayed learner device ID (Firebase anonymous UID).
3. Keep that browser profile intact. Clearing site data rotates the anonymous UID.

### Enrol from a separate parent device

1. Sign in to Parent Corner from a separate trusted parent device/profile.
2. Verify Parent Corner displays the trusted parent role rather than merely a verified email.
3. Paste the learner UID.
4. Enrol it for `dd1`, `ddp2` and `histp2`.
5. If it replaces an old identity, explicitly select the replacement-device transfer option.
6. Confirm an immutable `stateTransfers/{appKey}_{targetUid}` record exists for each transferred state.

Enrolment alone does not silently steal state from another device. Transfer is explicit, atomic and audited. A transfer identifier permits one transfer to that target UID for an app; a later reversal requires a fresh identity or a trusted Admin migration.

### Legacy documents

Before restrictive Rules cutover, inspect and migrate legacy documents that lack current identity fields:

- State: `family`, `appKey`, `app`, `ownerUid`.
- Submissions: canonical `id`, `family`, `appKey`, `app`, `ownerUid`, original `clientTs`.
- Images: `family`, `ownerUid`, app key and stable image ID.
- Redemptions: `family`, `ownerUid`, immutable request fields and valid status.
- Assignments/catalogue: current family, app and creator fields.
- Pencil reviews: `ownerUid` and immutable review evidence.

Use a trusted Admin SDK migration for records that cannot satisfy the narrow client-side legacy transition. Do not broaden Rules for convenience.

## 8. Firestore Rules deployment

### Authenticate and select the project

```bash
./node_modules/.bin/firebase login --reauth
./node_modules/.bin/firebase projects:list
```

Do not store a Firebase token in source control.

### Back up current Rules

Copy the currently deployed Rules from Firebase Console into a dated secure rollback record. Record the current static deployment commit as well.

### Validate and deploy

```bash
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:rules
./node_modules/.bin/firebase deploy \
  --only firestore:rules \
  --project zimmy-study-hub
```

Verify the CLI reports a successful Rules release for `zimmy-study-hub`. GitHub Pages deployment alone is insufficient.

### Post-deploy allow/deny smoke

Using synthetic records only:

- Trusted parent can read family dashboards and create enrolment.
- Wrong-family and unverified parent users are denied.
- Enrolled learner can read/write only owned, allowed-app records.
- Unenrolled anonymous user remains local-only.
- Learner cannot mutate vault, awards, reviews or transfers.
- Parent Key award creates an immutable award and exact vault delta atomically.
- Parent reward approval creates the exact spend atomically; rejection leaves the vault unchanged.
- Parent Pencil resolution is immutable; duplicate is a no-op; conflict remains visible.

## 9. Static GitHub Pages deployment

The deployed branch is `gh-pages`. Deploy only a commit that passed all repository gates and contains the intended public runtime configuration.

Recommended controlled release:

```bash
git fetch origin
git switch gh-pages
git pull --ff-only origin gh-pages
git merge --ff-only <verified-feature-commit>
git push origin gh-pages
```

If fast-forward is impossible, do not force-push. Review the branch relationship and use an explicit merge commit only after confirming the exact diff.

Rollback:

```bash
git revert <deployment-commit>
git push origin gh-pages
```

Do not rewrite public history.

## 10. Live verification

After both deployments, verify these URLs over HTTPS:

- `https://mthiyanecd.github.io/decimal-dash/`
- `https://mthiyanecd.github.io/decimal-dash/paper2/`
- `https://mthiyanecd.github.io/decimal-dash/history-p2/`
- `https://mthiyanecd.github.io/decimal-dash/hub/`

For each route:

- Page title and first learner screen render.
- `window.StudyDashSync` appears.
- No uncaught module/bootstrap error appears in the console.
- Network requests use Firebase SDK `12.16.0` consistently.
- Unenrolled identities display local-only rather than looping permission failures.

Parent checks:

- Empty or invalid parent configuration remains locked.
- Email-link round trip completes on the intended authorised domain.
- Verified email without trusted claims remains locked.
- Correct trusted claims unlock Parent Corner.
- Sign-out tears down privileged listeners.
- Retry actually rebuilds identity-dependent listeners.

Learner/iPad checks:

- Existing local progress remains present.
- Enrolled UID synchronises all allowed apps.
- Offline work queues and reconnects.
- Permanent permission failure becomes visible and is not retried forever.
- Apple Pencil captures the full 300 px draw area and exported image.
- AI result retains question-specific mark scheme and criterion evidence.
- Malformed, uncertain, partial, incorrect and unavailable results await parent review.
- Pending work changes no score, mastery, reward, Key or mock result.
- Parent resolution applies exactly once after reconnect/reload.

App Check checks:

- Confirm valid production tokens in App Check metrics.
- Monitor before enabling enforcement.
- Enable enforcement gradually for Firestore and Firebase AI only after legitimate traffic is healthy.
- Keep the rollback procedure ready.

## 11. Operational monitoring

For the first release window, monitor:

- Firebase Auth sign-in and quota failures.
- Firestore permission-denied and unavailable errors.
- App Check valid/invalid/unverified request metrics.
- Firebase AI errors, latency, quota and cost.
- Firestore document size growth and write volume.
- Submission outbox backlog and pending Pencil review count.
- Vault award/redemption ledger consistency.

Set budget alerts; a budget alert does not automatically cap spend.

## 12. Release record template

Record the following for every production release:

```text
Static source commit:
Static gh-pages deployment commit:
Previous gh-pages rollback commit:
Firestore Rules source commit:
Rules deployment time and operator:
Previous Rules rollback copy:
Firebase SDK version: 12.16.0
AI model:
Parent claims verified: yes/no
Learner UID enrolled and apps:
Legacy migration completed: yes/no
App Check registration: yes/no
App Check enforcement: off/monitoring/enforced
Synthetic backend smoke: pass/fail
Safari/iPad/Apple Pencil smoke: pass/fail
Open incidents or accepted risks:
```

## 13. Stop conditions

Stop or roll back immediately if:

- Parent Corner unlocks without trusted claims.
- An unrelated UID can read family data.
- An enrolled learner loses existing local state.
- Restrictive Rules deny the production client payload unexpectedly.
- A pending Pencil answer affects any learner outcome.
- A duplicate event changes marks, Keys or vault balances twice.
- App Check enforcement blocks legitimate learner traffic.
- Document growth approaches Firestore’s 1 MiB document limit.

Passing local tests does not prove deployed Rules, real Auth, App Check, Firebase AI, Safari, iPad or Apple Pencil behaviour. Record those gates honestly.