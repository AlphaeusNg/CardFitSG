# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 32 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (63 assertions), `node tools/test-site.mjs` (14 references/fragments), JavaScript syntax checks, and repository CI configuration.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.

## Latest cycle: verify static deployment structure

### Why this was selected

Engine tests could pass while a missing stylesheet, script, manifest, redirect, or catalog path broke the deployed static site. A zero-dependency integrity test closes that gap cheaply and is reusable on every future change.

### Changes

- Added `tools/test-site.mjs` to validate local HTML and CSS targets without dependencies.
- Rejects root-absolute project paths and references that escape the repository root.
- Verifies same-page fragments, the 404 refresh target, manifest JSON and project-relative startup, runtime script presence/order, and the app's catalog fetch.
- Added the integrity test to GitHub Actions and the local README workflow.
- Corrected the test's URL model after its first run showed that `fetch()` resolves relative to the document rather than the script file.

### Verification and scores

- `node tools/test-site.mjs`: 9 local references and 5 fragments verified.
- `node tools/test-engine.mjs`: 63 passed, 0 failed.
- `node --check js/*.js`: passed.
- `node --check tools/*.mjs`: passed.
- Python `yaml.safe_load` of `.github/workflows/ci.yml`: passed (Ruby was unavailable; no project failure).
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (broken static dependencies now fail before deployment).
- Verifiability: 9/10 (behavioral and deployment contracts both run locally and in CI).
- Maintainability: 9/10 (the test uses only Node built-ins and reports the exact source/reference pair).
- User safety: 9/10 (no recommendation behavior changed; the current audited catalog remains green).

### Lessons and process improvements

- Static reference checks must model browser URL bases: HTML/CSS references use their containing file, while JavaScript `fetch()` uses the document URL.
- Running the new check before CI caught and corrected a false-positive path model immediately.
- A deployment test can cover high-value failures without adding jsdom, a package manifest, or a build step.

## Previous cycle

- Cycle 31 (`13bf421`): refreshed all six cards from official sources, expanded representation, and increased engine assertions from 39 to 63.
- Cycle 30 (`cd20640`): accounted for repeated annual fees across arbitrary horizons; assertions increased from 34 to 39.
- Cycle 29 (`de57158`): added least-privilege GitHub Actions coverage for engine and syntax checks.
- Cycle 28 (`062eaea`): validated catalog snapshots before ranking/rendering; assertions increased from 29 to 34.
- Cycle 27 (`73407b8`): normalized invalid horizons, added strict calendar parsing, and made malformed promotion windows fail closed; assertions increased from 23 to 29.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Model signup qualifying spend across the stated offer window | Correctness | Medium | Small / medium | The current conservative check uses one-off plus one month even for the 60-day SC offer |
| 2 | Cover startup/render failure paths with a minimal DOM harness | Reliability / tests | Medium | Medium / low | Validator behavior is covered, but its user-facing integration is syntax-checked only |
| 3 | Schedule the next official-source catalog audit before the earliest active offer expires | Process / data | High | Small / low | OCBC and SC offers in this snapshot end 2026-08-31 |

## Next cycle

Use each offer's stated `windowDays` to count the monthly spend plausibly available for signup qualification, bounded by the scenario horizon. Add 30-, 60-, and short-horizon regressions so the change neither overcounts nor invents eligibility.
