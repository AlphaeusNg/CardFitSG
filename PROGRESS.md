# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 34 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (68 assertions), `node tools/test-site.mjs` (14 references/fragments), `node tools/test-app.mjs` (16 assertions), JavaScript syntax checks, and repository CI configuration.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.

## Latest cycle: exercise app startup and rendering

### Why this was selected

The engine, catalog, and static paths were well covered, but `app.js` startup was only syntax-checked. A dependency-free VM harness now executes the real browser bootstrap across success and failure paths, catching integration faults without introducing a package manager or DOM library.

### Changes

- Added `tools/test-app.mjs` with a minimal mock of only the DOM/events used by `app.js`.
- Executes the real engine, app, and checked-in catalog together in a Node VM.
- Verifies valid startup, metadata/wallet/ranking/action-plan/version rendering, and the exposed app API.
- Verifies invalid catalogs and HTTP failures show the same safe fatal message, log actionable details, and do not partially render.
- Added the integration harness to GitHub Actions and the documented local check sequence.

### Verification and scores

- `node tools/test-app.mjs`: 16 startup/render assertions passed.
- `node tools/test-engine.mjs`: 68 passed, 0 failed.
- `node tools/test-site.mjs`: 9 local references and 5 fragments verified.
- `node --check js/*.js`: passed.
- `node --check tools/*.mjs`: passed.
- Workflow YAML parsing: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (catalog validation is proven to gate the actual UI bootstrap).
- Verifiability: 9/10 (pure logic, static structure, and browser integration now have separate fast checks).
- Maintainability: 9/10 (the harness mocks only the current app contract and uses no third-party dependencies).
- User safety: 9/10 (startup failures are proven to avoid partial recommendations and expose generic safe messaging).

### Lessons and process improvements

- A small purpose-built DOM boundary can provide valuable integration confidence for a zero-build app without importing jsdom.
- Failure tests should verify absence of partial rendering in addition to the presence of an error message.
- Separating engine, static-reference, and bootstrap suites keeps failures localized and all checks below one second locally.

## Previous cycle

- Cycle 33 (`d64dcf9`): honored 30/60-day signup windows and applied spend hurdles to non-cash gifts; assertions increased from 63 to 68.
- Cycle 32 (`c8d877b`): added zero-dependency static deployment checks and wired them into CI.
- Cycle 31 (`13bf421`): refreshed all six cards from official sources, expanded representation, and increased engine assertions from 39 to 63.
- Cycle 30 (`cd20640`): accounted for repeated annual fees across arbitrary horizons; assertions increased from 34 to 39.
- Cycle 29 (`de57158`): added least-privilege GitHub Actions coverage for engine and syntax checks.
- Cycle 28 (`062eaea`): validated catalog snapshots before ranking/rendering; assertions increased from 29 to 34.
- Cycle 27 (`73407b8`): normalized invalid horizons, added strict calendar parsing, and made malformed promotion windows fail closed; assertions increased from 23 to 29.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Surface card-specific optimizer conditions in results | User safety / UX | Medium | Small / low | UOB One requires 10 purchases in each month of a qualifying quarter, but the current result shows only a generic optimizer note |
| 2 | Schedule the next official-source catalog audit before the earliest active offer expires | Process / data | High | Small / low | OCBC and SC offers in this snapshot end 2026-08-31 |
| 3 | Add interaction tests for opposing optimizer/fuss-free toggles | UI tests | Low | Small / low | Startup rendering is covered; event callbacks are currently mocked but not invoked |

## Next cycle

Local next: surface UOB One's quarterly and transaction-count conditions whenever optimizer mode estimates its value. Workspace next: pivot to VerseKeep correctness and test coverage after eight compounding CardFitSG cycles, avoiding diminishing returns in one repo.
