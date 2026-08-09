# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 28 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (34 assertions), plus JavaScript syntax checks.
- Catalog snapshot: `data/cards.json` declares `asOf: 2026-06-15`; rate or offer changes require current official bank sources before edits.

## Latest cycle: validate catalog snapshots

### Why this was selected

The app previously checked only that `cards` was a non-empty array. Duplicate IDs could break wallet selection, invalid rates could create misleading rankings, and missing display arrays could crash rendering. A deterministic validation gate protects every future catalog refresh and makes data defects observable before any recommendations are shown.

### Changes

- Added `validateCatalog`, returning stable validation status and path-specific errors.
- Enforced unique IDs, required display fields, supported styles, boolean fee flags, and render-safe `pros` arrays.
- Bounded rates, scores, fees, caps, thresholds, intro fields, tier data, and signup values.
- Required strict snapshot and signup calendar dates.
- Gated app initialization on validation; detailed failures go to the developer console while the UI retains a generic safe message.
- Added five assertions covering the exported validator, the current snapshot, duplicate IDs, an out-of-range rate, and an impossible signup date.

### Verification and scores

- `node tools/test-engine.mjs`: 34 passed, 0 failed (29 before this cycle).
- `node --check js/engine.js`: passed.
- `node --check js/app.js`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 8/10 (bad snapshots are rejected before ranking or rendering).
- Verifiability: 7/10 (catalog invariants now have executable fixtures, but no automated CI yet).
- Maintainability: 8/10 (one explicit contract documents the scorer and renderer's data assumptions).
- Security/robustness: 8/10 (unexpected JSON types and bounds fail closed with actionable diagnostics).

### Lessons and process improvements

- Validate at the data boundary once instead of scattering defensive fallbacks throughout scoring and rendering.
- Error paths should serve both audiences: concise text for users and precise paths for maintainers.
- A checked-in catalog should be tested as a valid fixture so stricter future schema changes cannot accidentally strand production data.

## Previous cycle

- Cycle 27 (`73407b8`): normalized invalid horizons, added strict calendar parsing, and made malformed promotion windows fail closed; engine assertions increased from 23 to 29.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Add GitHub Actions for engine tests and static syntax checks | Verifiability | High | Small / low | Local checks exist but are not enforced on commits or pull requests |
| 2 | Correct annual-fee accounting for arbitrary multi-year horizons | Correctness | Medium | Small / low | Current fee drag charges at most one annual fee beyond month 12; current UI tops out at 24 months |
| 3 | Re-verify every catalog fact against current official bank pages | Data correctness | High | Medium / medium | Local snapshot is dated 2026-06-15; requires source-by-source official evidence |
| 4 | Add static asset/reference and service-worker coverage if offline support is introduced | Reliability | Medium | Small / low | No automated whole-site integrity check exists |

## Next cycle

Add a minimal GitHub Actions workflow that runs the engine suite and syntax checks on pushes and pull requests. This turns the new input and catalog contracts into enforced repository safeguards.
