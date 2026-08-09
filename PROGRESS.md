# CardFitSG continuous improvement log

Last updated: 2026-08-09 (Cycle 27 across the projects workspace)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (29 assertions), plus JavaScript syntax checks.
- Catalog snapshot: `data/cards.json` declares `asOf: 2026-06-15`; rate or offer changes require current official bank sources before edits.

## Latest cycle: validate engine time inputs

### Why this was selected

The UI constrains the horizon to 6, 12, or 24 months, but the exported pure engine accepted arbitrary callers. A negative horizon produced negative recurring spend and cashback. JavaScript date rollover also accepted impossible promotion dates such as `2026-02-30`, which could incorrectly qualify a signup reward. These are high-impact financial-correctness faults with a small, reversible fix.

### Changes

- Added `normalizeMonths` with the documented 12-month fallback, integer normalization, and a 120-month safety cap.
- Normalized the scenario returned by `recommend`, keeping displayed and calculated horizons consistent.
- Replaced permissive date construction with strict `YYYY-MM-DD` calendar validation.
- Made malformed promotion windows fail closed and explain that the offer could not be validated.
- Added six regression assertions covering negative horizons and impossible promotion dates.

### Verification and scores

- `node tools/test-engine.mjs`: 29 passed, 0 failed (23 before this cycle).
- `node --check js/engine.js`: passed.
- `node --check js/app.js`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 8/10 (invalid time inputs can no longer create impossible value).
- Verifiability: 6/10 (stronger boundary coverage, but no automated CI yet).
- Maintainability: 7/10 (time normalization is centralized and exported for direct testing).
- Security/robustness: 7/10 (untrusted direct-call inputs remain finite and invalid offers fail closed).

### Lessons and process improvements

- UI constraints are not an engine contract; exported functions need their own boundary tests.
- For financial recommendations, malformed or stale offer metadata should remove uncertain value rather than assume eligibility.
- Writing the regression first exposed six failures and confirmed that the fix, rather than the test, changed behavior.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Validate the catalog schema and numeric bounds before ranking cards | Correctness / tests | High | Small / low | Missing or non-finite rates, fees, caps, scores, or card IDs can currently yield `NaN`, crashes, or misleading ranks |
| 2 | Add GitHub Actions for engine tests and static syntax checks | Verifiability | High | Small / low | Local checks exist but are not enforced on commits or pull requests |
| 3 | Correct annual-fee accounting for arbitrary multi-year horizons | Correctness | Medium | Small / low | Current fee drag charges at most one annual fee beyond month 12; current UI tops out at 24 months |
| 4 | Re-verify every catalog fact against current official bank pages | Data correctness | High | Medium / medium | Local snapshot is dated 2026-06-15; requires source-by-source official evidence |
| 5 | Add static asset/reference and service-worker coverage if offline support is introduced | Reliability | Medium | Small / low | No automated whole-site integrity check exists |

## Next cycle

Add a deterministic catalog validator and regression fixtures for duplicate IDs, invalid numeric fields, and malformed signup dates. This compounds the new fail-closed behavior by preventing an entire bad snapshot from silently corrupting recommendations.
