# CardFitSG continuous improvement log

Last updated: 2026-08-10 (Cycle 83 across the projects workspace; CardFitSG Cycle 36)

## Current state

- Branch: `main`; continuous-improvement commits are published to `origin/main` after verification.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (71 assertions), `node tools/test-catalog-freshness.mjs` (13 assertions), the live catalog-deadline check, `node tools/test-site.mjs` (14 references/fragments), `node tools/test-app.mjs` (17 assertions), recursive JavaScript syntax checks, JSON parsing, and repository CI.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.
- UOB One's optimizer condition was reverified against UOB's product page, full terms, and FAQ on 2026-08-10.
- Catalog review policy: audit by 2026-08-24, seven days before the earliest dated offers end on 2026-08-31; daily CI enforces the boundary.

## Latest cycle: make the next catalog audit deadline enforceable

### Why this was selected

The backlog correctly required another official-source audit before offers expire on 2026-08-31, but that deadline existed only in prose. A missed manual follow-up could leave expired financial offers visible without any failing check or notification.

### Changes

- Added `meta.reviewBy: 2026-08-24`, one week before the earliest active offer expiry.
- Added a dependency-free catalog freshness evaluator with strict calendar parsing, Singapore-local default dates, actionable output, and fail-closed snapshot/deadline/offer ordering.
- Added deterministic boundary and malformed-policy tests plus workflow-wiring contracts.
- Scheduled CI daily at 00:17 UTC and enabled manual dispatch; push and pull-request checks enforce the same deadline.
- Documented the refresh procedure and bumped the deployed version to `2026.08.10.1`.

### Verification and scores

- Test-first evidence: the new policy suite initially failed because the evaluator module did not yet exist.
- `node tools/test-engine.mjs`: 71 passed, 0 failed.
- `node tools/test-catalog-freshness.mjs`: 13 boundary, malformed-data, and workflow-wiring assertions passed.
- `node tools/catalog-freshness.mjs`: reports 14 days remaining before review and the 2026-08-31 earliest offer end; a controlled 2026-08-24 run fails as required.
- `node tools/test-app.mjs`: 17 startup/render assertions passed.
- `node tools/test-site.mjs`: 9 local references and 5 fragments verified.
- Recursive `node --check` across `js/` and `tools/`: passed.
- Catalog and manifest JSON parsing: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (stale catalog risk now has a hard, date-aware boundary).
- Verifiability: 10/10 (deadline semantics and automation wiring are deterministic and regression-tested).
- Maintainability: 9/10 (future audits update one explicit metadata field alongside `asOf`).
- User safety: 10/10 (time-sensitive financial data can no longer age past the planned review silently).
- Performance: 10/10 (the small checker runs only in CI/developer workflows, never in the browser).

### Lessons and process improvements

- A dated financial snapshot needs both “last reviewed” and “review again by”; `asOf` alone records history but cannot create a future alert.
- Keep wall-clock logic injectable. Explicit boundary dates make expiry behavior testable without waiting or mocking global time.
- Test scheduled-workflow wiring as policy text so later CI cleanup cannot silently remove the alert path.
- Schedule Singapore-facing checks after midnight Singapore time to avoid a one-day UTC lag.

## Previous cycles

- Cycle 35 (`28bc6bc`): surfaced official UOB One statement-month and qualifying-quarter conditions in optimizer results.
- Cycle 34 (`05833f8`): executed real app startup/rendering and failure paths in a dependency-free VM harness.
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
| 1 | Execute the official-source catalog audit by 2026-08-24 | Process / data | High | Small / low | Daily CI now fails on the deadline; OCBC and SC offers end 2026-08-31 |
| 2 | Add interaction tests for opposing optimizer/fuss-free toggles | UI tests | Low | Small / low | Startup rendering is covered; event callbacks are currently mocked but not invoked |
| 3 | Model qualifying-quarter completeness for arbitrary horizons | Correctness / safety | Low-medium | Medium / medium | Current UI horizons are 6/12/24 months, but direct engine callers can request fewer than three months |

## Next cycle

Local next: execute the full official-source audit by 2026-08-24 and advance both `asOf` and `reviewBy`. Workspace next: rotate to another project after this process-focused CardFitSG cycle; on return before the audit date, add event-level coverage for the opposing mode toggles.
