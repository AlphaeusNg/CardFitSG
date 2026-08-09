# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 30 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (39 assertions), JavaScript syntax checks, and repository CI configuration.
- Catalog snapshot: `data/cards.json` declares `asOf: 2026-06-15`; rate or offer changes require current official bank sources before edits.

## Latest cycle: account for every annual-fee period

### Why this was selected

The engine accepted direct-call horizons up to 120 months but charged at most one renewal fee. This overstated net value from month 25 onward and also failed to accumulate a requested non-waived first-year fee with later renewals. Explicit fee periods fix the math without changing the current 6/12/24-month UI outcomes.

### Changes

- Replaced the single post-year-one fee branch with a count of every started renewal year.
- Counted a requested non-waived first-year fee independently, so it accumulates correctly with renewals.
- Added five assertions across waived 12-, 24-, and 36-month horizons and non-waived first-year scenarios.

### Verification and scores

- `node tools/test-engine.mjs`: 39 passed, 0 failed (34 before this cycle).
- `node --check js/*.js`: passed.
- Python `yaml.safe_load` of `.github/workflows/ci.yml`: passed (Ruby was unavailable; no project failure).
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (multi-year net value now includes every applicable annual fee).
- Verifiability: 8/10 (fee boundaries and accumulation have focused executable coverage).
- Maintainability: 8/10 (billing periods are explicit instead of encoded in overlapping branches).
- Security/robustness: 8/10 (bounded horizons continue to keep all fee math finite).

### Lessons and process improvements

- Time-horizon calculations should count discrete billing periods rather than infer charges from a single threshold.
- Boundary fixtures at 12, 24, and 36 months exposed both the repeated-renewal bug and the first-year accumulation bug before implementation.
- Keeping direct-engine behavior correct prevents latent defects if the UI later exposes longer horizons.

## Previous cycle

- Cycle 29 (`de57158`): added least-privilege GitHub Actions coverage for engine and syntax checks.
- Cycle 28 (`062eaea`): validated catalog snapshots before ranking/rendering; assertions increased from 29 to 34.
- Cycle 27 (`73407b8`): normalized invalid horizons, added strict calendar parsing, and made malformed promotion windows fail closed; assertions increased from 23 to 29.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Re-verify every catalog fact against current official bank pages | Data correctness | High | Medium / medium | Local snapshot is dated 2026-06-15; requires source-by-source official evidence |
| 2 | Add a whole-site integrity test for local asset/script references | Reliability / tests | Medium | Small / low | Engine behavior is covered, but broken static paths can still reach production |
| 3 | Cover startup/render failure paths with a minimal DOM harness | Reliability / tests | Medium | Medium / low | Validator behavior is covered, but its user-facing integration is syntax-checked only |

## Next cycle

Audit the catalog against current official issuer pages. Change only facts supported by primary sources, preserve citations in `meta.sources`, advance `meta.asOf`, and add regression expectations for any ranking-sensitive updates.
