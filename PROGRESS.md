# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 29 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (34 assertions), JavaScript syntax checks, and repository CI configuration.
- Catalog snapshot: `data/cards.json` declares `asOf: 2026-06-15`; rate or offer changes require current official bank sources before edits.

## Latest cycle: enforce checks in CI

### Why this was selected

The engine and catalog contracts had useful local coverage but nothing ran them automatically. A small GitHub Actions workflow makes those safeguards persistent on the main branch and visible during pull-request review.

### Changes

- Added `.github/workflows/ci.yml` for main-branch pushes and pull requests.
- Runs the 34-assertion engine suite and syntax-checks every JavaScript file on Node 20.
- Uses read-only repository permissions and a five-minute timeout to constrain the job.

### Verification and scores

- `node tools/test-engine.mjs`: 34 passed, 0 failed.
- `node --check js/*.js`: passed.
- Python `yaml.safe_load` of `.github/workflows/ci.yml`: passed (Ruby was unavailable; no project failure).
- `git diff --check`: passed.
- Correctness/reliability: 8/10 (no runtime behavior changed; existing checks remain green).
- Verifiability: 8/10 (tests are now automatically enforceable; hosted execution awaits a push).
- Maintainability: 8/10 (workflow mirrors the documented local commands and workspace conventions).
- Security/robustness: 8/10 (CI has explicit read-only permissions and a bounded runtime).

### Lessons and process improvements

- CI should invoke the same entrypoints developers run locally, avoiding a second source of test truth.
- Validate workflow syntax with Python/PyYAML in this workspace; Ruby and `actionlint` are not currently installed.
- Hosted status cannot be claimed until commits are pushed; local workflow-command parity is the available evidence.

## Previous cycle

- Cycle 28 (`062eaea`): validated catalog snapshots before ranking/rendering; assertions increased from 29 to 34.
- Cycle 27 (`73407b8`): normalized invalid horizons, added strict calendar parsing, and made malformed promotion windows fail closed; assertions increased from 23 to 29.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Correct annual-fee accounting for arbitrary multi-year horizons | Correctness | Medium | Small / low | Current fee drag charges at most one annual fee beyond month 12; current UI tops out at 24 months |
| 2 | Re-verify every catalog fact against current official bank pages | Data correctness | High | Medium / medium | Local snapshot is dated 2026-06-15; requires source-by-source official evidence |
| 3 | Add a whole-site integrity test for local asset/script references | Reliability / tests | Medium | Small / low | Engine behavior is covered, but broken static paths can still reach production |

## Next cycle

Correct annual-fee accounting for horizons beyond the first renewal, with focused 12-, 24-, and 36-month fixtures. The UI currently stops at 24 months, so this is a low-risk direct-engine correctness improvement rather than a user-facing expansion.
