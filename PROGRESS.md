# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 33 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (68 assertions), `node tools/test-site.mjs` (14 references/fragments), JavaScript syntax checks, and repository CI configuration.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.

## Latest cycle: honor signup offer windows

### Why this was selected

Signup qualification previously counted one-off spend plus exactly one recurring month for every offer. That was accurate for 30-day OCBC windows but understated Standard Chartered's 60-day offer. Non-cash gifts also bypassed their minimum-spend hurdle entirely. A shared bounded estimate fixes both behaviors.

### Changes

- Added a single signup-spend calculation based on one-off spend plus recurring spend available during `windowDays`.
- Uses a 30-day month convention, defaults unstated windows to one month, and caps available months at the scenario horizon.
- Applies the same qualification hurdle to cash rewards and non-cash gifts.
- Preserved fail-closed handling for expired and malformed offer dates.
- Added five regressions for 60-day qualification, a one-month horizon, a 30-day non-qualification, and gift hurdle messaging.

### Verification and scores

- `node tools/test-engine.mjs`: 68 passed, 0 failed (63 before this cycle; 3 targeted regressions failed before implementation).
- `node tools/test-site.mjs`: 9 local references and 5 fragments verified.
- `node --check js/*.js`: passed.
- `node --check tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (offer qualification now matches the represented time window without exceeding user scope).
- Verifiability: 9/10 (both window boundaries and gift eligibility are pinned by focused tests).
- Maintainability: 9/10 (cash and non-cash offers share one qualification path).
- User safety: 9/10 (the engine neither hides reachable cash nor advertises an unearned gift).

### Lessons and process improvements

- Offer duration is part of eligibility math, not merely display metadata.
- Qualification estimates must be bounded by both offer terms and the user's scenario horizon.
- Cash and non-cash acquisition value should share the same date and spend gates even when only cash affects ranking.

## Previous cycle

- Cycle 32 (`c8d877b`): added zero-dependency static deployment checks and wired them into CI.
- Cycle 31 (`13bf421`): refreshed all six cards from official sources, expanded representation, and increased engine assertions from 39 to 63.
- Cycle 30 (`cd20640`): accounted for repeated annual fees across arbitrary horizons; assertions increased from 34 to 39.
- Cycle 29 (`de57158`): added least-privilege GitHub Actions coverage for engine and syntax checks.
- Cycle 28 (`062eaea`): validated catalog snapshots before ranking/rendering; assertions increased from 29 to 34.
- Cycle 27 (`73407b8`): normalized invalid horizons, added strict calendar parsing, and made malformed promotion windows fail closed; assertions increased from 23 to 29.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Cover startup/render failure paths with a minimal DOM harness | Reliability / tests | Medium | Medium / low | Validator behavior is covered, but its user-facing integration is syntax-checked only |
| 2 | Surface card-specific optimizer conditions in results | User safety / UX | Medium | Small / low | UOB One requires 10 purchases in each month of a qualifying quarter, but the current result shows only a generic optimizer note |
| 3 | Schedule the next official-source catalog audit before the earliest active offer expires | Process / data | High | Small / low | OCBC and SC offers in this snapshot end 2026-08-31 |

## Next cycle

Cover app startup with a minimal dependency-free DOM/fetch harness: valid catalog renders, invalid catalog shows the safe fatal message, and engine/script-order assumptions are exercised rather than syntax-checked only.
