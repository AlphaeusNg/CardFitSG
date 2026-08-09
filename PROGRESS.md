# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 31 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (63 assertions), JavaScript syntax checks, and repository CI configuration.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.

## Latest cycle: audit the financial catalog

### Why this was selected

The local snapshot was dated 2026-06-15 and included expired offers plus incorrect card networks. Because these facts directly affect eligibility, acceptance penalties, signup value, and 24-month net value, a primary-source refresh had higher impact than another UI or documentation improvement.

### Changes

- Replaced aggregator links with one current official issuer page for each catalog card and advanced `meta.asOf` to 2026-08-09.
- Corrected OCBC INFINITY from Visa to Mastercard and UOB Absolute from Visa to Amex; aligned the latter's acceptance score with the existing Amex baseline.
- Refreshed active OCBC, UOB, and Standard Chartered signup windows and values while keeping non-cash gifts out of ranking.
- Updated UOB One to the S$600/S$1,000/S$2,000 quarterly structure and removed its unsupported 0.3% fallback.
- Updated OCBC 365 to its current 0.25% fallback, 6%/5%/3% categories, S$80/S$160 cap tiers, active signup cash, and two-year fee waiver.
- Extended the engine and validator for explicit fee-waiver years and tiered monthly caps; dated non-cash offers now expire correctly.
- Made long-term selection honor the user's Amex acceptance constraint.
- Bumped the site version to `2026.08.09.1` and documented the official-source-only refresh rule.

### Verification and scores

- `node tools/test-engine.mjs`: 63 passed, 0 failed (39 before this cycle; 16 audit regressions failed before implementation).
- `node --check js/*.js`: passed.
- `python3 -m json.tool data/cards.json`: passed.
- Python `yaml.safe_load` of `.github/workflows/ci.yml`: passed (Ruby was unavailable; no project failure).
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (ranking inputs now reflect current official terms and corrected networks).
- Verifiability: 9/10 (24 new assertions pin the audit date, critical facts, schema invariants, and required representation behavior).
- Maintainability: 8/10 (official sources and refresh policy are explicit; new schema fields are validated).
- User safety: 9/10 (expired cash and non-cash value fail closed, and acceptance preferences are honored).

### Lessons and process improvements

- Network is ranking data, not just display metadata: correcting UOB Absolute to Amex exposed a bypass in long-term selection.
- A boolean first-year-waiver field cannot represent a two-year waiver; source audits must test whether the schema can express the evidence.
- Promotional headline rates should not be forced into the base model when their transaction/registration conditions are not represented.
- Primary-source review found materially fresher facts than the dated local snapshot; aggregator sources were removed from the update path.

## Previous cycle

- Cycle 30 (`cd20640`): accounted for repeated annual fees across arbitrary horizons; assertions increased from 34 to 39.
- Cycle 29 (`de57158`): added least-privilege GitHub Actions coverage for engine and syntax checks.
- Cycle 28 (`062eaea`): validated catalog snapshots before ranking/rendering; assertions increased from 29 to 34.
- Cycle 27 (`73407b8`): normalized invalid horizons, added strict calendar parsing, and made malformed promotion windows fail closed; assertions increased from 23 to 29.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Add a whole-site integrity test for local asset/script references | Reliability / tests | Medium | Small / low | Engine behavior is covered, but broken static paths can still reach production |
| 2 | Model signup qualifying spend across the stated offer window | Correctness | Medium | Small / medium | The current conservative check uses one-off plus one month even for the 60-day SC offer |
| 3 | Cover startup/render failure paths with a minimal DOM harness | Reliability / tests | Medium | Medium / low | Validator behavior is covered, but its user-facing integration is syntax-checked only |
| 4 | Schedule the next official-source catalog audit before the earliest active offer expires | Process / data | High | Small / low | OCBC and SC offers in this snapshot end 2026-08-31 |

## Next cycle

Add a zero-dependency whole-site integrity test for local HTML, stylesheet, script, manifest, icon, and navigation references, then run it in CI. This catches a deployment class that engine tests cannot see.
