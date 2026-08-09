# CardFitSG continuous improvement log

Last updated: 2026-08-10 (Cycle 84 across the projects workspace; CardFitSG Cycle 37)

## Current state

- Branch: `main`; continuous-improvement commits are published to `origin/main` after verification.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (71 assertions), `node tools/test-catalog-freshness.mjs` (17 assertions), the live catalog-deadline check, `node tools/test-site.mjs` (14 references/fragments), `node tools/test-app.mjs` (17 assertions), recursive JavaScript syntax checks, JSON parsing, and repository CI on Node 24 LTS.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.
- UOB One's optimizer condition was reverified against UOB's product page, full terms, and FAQ on 2026-08-10.
- Catalog review policy: audit by 2026-08-24, seven days before the earliest dated offers end on 2026-08-31; daily CI enforces the boundary.

## Latest cycle: remove deprecated CI action runtimes

### Why this was selected

Cycle 36's hosted verification passed but warned that `actions/checkout@v4` and `actions/setup-node@v4` target the deprecated Node 20 action runtime and were being forced onto Node 24. The workflow also still tested the project itself on Node 20, which is end-of-life. This new concrete evidence outranked the planned repository rotation.

### Changes

- Upgraded `actions/checkout` and `actions/setup-node` from v4 to their current v7 majors.
- Moved the project test runtime from end-of-life Node 20 to Node 24 LTS.
- Added workflow policies requiring both current action majors and Node 24 while rejecting the deprecated v4 references.
- Bumped the deployed version to `2026.08.10.2`.

### Verification and scores

- Official evidence: the action repositories document v7 usage, and Node's release table identifies v20 as end-of-life and v24 as LTS.
- Test-first evidence: the workflow policy failed on the old checkout major before implementation.
- `node tools/test-engine.mjs`: 71 passed, 0 failed.
- `node tools/test-catalog-freshness.mjs`: 17 boundary, scheduling, and runtime-policy assertions passed.
- `node tools/catalog-freshness.mjs`: reports 14 days remaining before review and the 2026-08-31 earliest offer end; a controlled 2026-08-24 run fails as required.
- `node tools/test-app.mjs`: 17 startup/render assertions passed.
- `node tools/test-site.mjs`: 9 local references and 5 fragments verified.
- Local runtime: Node `v24.14.1`.
- Recursive `node --check` across `js/` and `tools/`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (CI no longer depends on compatibility-forced action runtimes).
- Verifiability: 10/10 (runtime majors and the project Node line are explicit policy assertions).
- Maintainability: 10/10 (the workflow follows current official action examples and a supported LTS line).
- Security/robustness: 9/10 (both action runtime and test runtime receive supported fixes).
- Performance: 10/10 (the same small workflow uses newer runtimes without adding steps).

### Lessons and process improvements

- Treat hosted annotations as verification evidence even when the job is green; compatibility shims are an actionable early warning.
- Test the action implementation runtime and the project's test runtime separately. Updating only the action major would have left the EOL Node 20 test target behind.
- Encode infrastructure migrations as policy checks so later copy/paste edits cannot reintroduce deprecated majors.

## Previous cycles

- Cycle 36 (`aa2e66f`): added a deterministic catalog review deadline and daily CI sentinel.
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
