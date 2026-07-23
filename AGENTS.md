# AGENTS.md

## What this is
Three standalone, single-file HTML/JS revision apps for one Grade 6 learner (South Africa / CAPS curriculum), used on an iPad with Apple Pencil, plus a launcher page. Personal project — no build, no dependencies, no tests, no CI.

- `index.html` — "Decimal Dash": decimal fractions, 4 guided sessions.
- `paper2/index.html` — "Shape Dash": Maths Paper 2 topics (shapes, measurement, data), 9 sessions (5 core + 4 Extra Practice). Forked from `index.html`.
- `history-p2/index.html` — "Explorer Dash": History Paper 2 (Mapungubwe → explorers), 7 sessions (6 core + 1 Extra Challenge). Forked from Shape Dash — has the `input:'draw'` + `selfMark(ok)` flow.
- `hub/index.html` — "Study Hub" launcher; the `APPS` array at the top drives the tiles (relative links `../`, `../paper2/`, `../history-p2/`).

## Run / verify / deploy
- Edit the HTML, open it in a browser, check the JS console. That is the entire workflow — there is no lint/test/build command.
- Deploy = push to `origin gh-pages` (the only branch). GitHub Pages serves `https://mthiyanecd.github.io/decimal-dash/`, `.../paper2/`, `.../history-p2/` and `.../hub/`.

## Architecture (not obvious from filenames)
- Each app file is self-contained: CSS + utilities + `SKILLS`/`LESSONS` content + `TYPES` question generators + session/quiz engine + parent dashboard. ~600 lines (CSS, utils, Pencil canvas, parent corner) are **duplicated between the three app files** — apply shared fixes to all, but note the copies have drifted (each keeps a different subset of the math utils; Decimal Dash's `stripUnits` strips fewer units; its answer input has iPad-optimised `type`/`inputmode` the others lack) and don't overwrite one with another.
- Learner name: sanitised by `cleanName()` (strips trailing spaces/dashes) at every entry point and in `load()` — use it for any new name-input site, or "Zimmy -"-style stored names return.
- Questions: `TYPES.<id>.gen(fx)` returns `{type,skill,prompt,input,ans,alt?,exact?,fracAns?,sol,hints:[h1,h2],marks,diff,pencil?}`. Random by default; pass an `fx` fixture for a deterministic item (used by `diagnosticSet()`, `trapSet()`, `mockSet()`). The math engines show `hints[0]` after the first wrong attempt and `sol` after the second — keep both fields on every generator (Explorer Dash uses single-hint items).
- Shape Dash & Explorer Dash add a fourth input kind: `input:'draw'` (netDraw, symDraw, graphDraw in Shape Dash; `wr()` written answers in Explorer Dash), self-marked via `selfMark(ok)`. Decimal Dash has no such flow — engine patches often need an extra site in the other two.
- Sessions are declarative step lists in `SESSIONS` (step kinds: `screen`, `lesson`, `quiz`). Completion check: Decimal Dash hardcodes `S.session>=4`; Shape Dash and Explorer Dash use `S.session>=SESSIONS.length` — adding a session to Decimal Dash also requires bumping that constant.
- State: one object `S` in localStorage — key `dd1` (Decimal Dash), `ddp2` (Shape Dash), `histp2` (Explorer Dash). `load()` merges saved JSON over `DEFAULT`, so add new state fields to `DEFAULT` (old saves then inherit them). The per-session arrays `done`/`stretch` in `DEFAULT` are sized to the session count (4 in Decimal Dash, 9 in Shape Dash, 7 in Explorer Dash) and indexed by badges — grow them when adding a session. The parent dashboard computes the total as `S.done.length`; keep it that way.

## South African notation — do not "fix"
- Decimal **comma** everywhere: `12,34`. Values are stored as scaled integers and rendered via `fmt(v,dp)`; `parseNum`/`checkAnswer` accept comma or period from the learner.
- Minus sign in prompts/parsers is U+2212 (`−`), not ASCII hyphen.
- Answer checking modes: `exact:true` = normalized string match; `fracAns:true` = must be a fraction in simplest form (**Decimal Dash only** — the other engines have no fracAns branch); `alt` = extra accepted forms; units ("R", "kg") are stripped by `stripUnits`. Shape Dash's `stripUnits` ends its unit regex with `(?![a-z0-9])`, not `\b` — `\b` fails after the non-ASCII `ℓ` and correct answers typed with units (mℓ, kℓ, ℓ) were marked wrong. Explorer Dash checks text answers case/punctuation-insensitively via `norm()` instead.
- Never "upgrade" answer boxes to `type="number"`: iOS then returns an empty `.value` for SA-comma input and blocks `/` in fractions. Markup currently differs per file: Decimal Dash uses `type="text" inputmode="${it.fracAns?'text':'decimal'}"` (full keyboard when a `/` may be needed); Shape Dash and Explorer Dash still have a plain `<input class="ans">` with no `type`/`inputmode`.

## Gotchas
- Quiz auto-advance `setTimeout`s must stay guarded with `if(!S.cur) return;` — the mock-exam countdown can call `finishQuiz()` (nulling `S.cur`) while a post-answer advance is still pending, and an unguarded callback crashes `renderQuestion()`. There are 2 guarded sites in Decimal Dash and 3 each in Shape Dash and Explorer Dash (the extra one is in `selfMark`).
- Pencil canvas: internal height comes from `cv.clientHeight` (draw questions set a 300px box via inline style; everything else uses the 240px CSS default). Don't re-hardcode 240 in `initCanvas`/`exportCanvas` — that clipped the bottom of draw canvases and their JPEG exports.
- "Submit my work" has no backend: it downloads a session JSON (marker `app:'DecimalDash'` / `app:'ShapeDashP2'` / `app:'ExplorerDashH2'`, verified on import) and opens an `sms:` iMessage link. "Sent to iCloud" just means the iPad's browser download folder.
- Handwriting canvas exports JPEG data URLs into `S.log[].png`; on localStorage quota errors `save()` silently drops oldest pngs (~4 MB budget). Don't store more in `S` than necessary.
- Parent retry codes match `/^DD-([a-zA-Z0-9.]+)$/` in all apps and push type ids into `retryQueue` — the `DD-` prefix is shared even in Shape Dash and Explorer Dash.

## Conventions
- Kid-facing tone: encouraging, emoji-heavy, SA names/contexts (Thabo, rand amounts). Preserve it when editing prompts, hints, and feedback.
- Content is tied to a specific textbook — generators carry `src` refs like `Book Q14 p.116`; keep them when editing.
- Commit style: short imperative ("Add …", "Fix …").
