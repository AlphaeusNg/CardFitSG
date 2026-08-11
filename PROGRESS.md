# CardFitSG continuous improvement log

Last updated: 2026-08-11 (Cycle 107 across the projects workspace; CardFitSG Cycle 39)

## Current state

- Branch: `main`; continuous-improvement commits are published to `origin/main` after verification.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (79 assertions), `node
  tools/test-catalog-freshness.mjs` (17 assertions), the live catalog-deadline
  check, `node tools/test-site.mjs` (14 references/fragments), `node
  tools/test-app.mjs` (25 assertions), recursive JavaScript syntax checks, JSON
  catalog JSON parsing, and repository CI on Node 24 LTS.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.
- UOB One's optimizer condition was reverified against UOB's product page, full
  terms, and FAQ on 2026-08-10; the official product page reconfirmed its
  quarterly award structure on 2026-08-11.
- Catalog review policy: audit by 2026-08-24, seven days before the earliest dated offers end on 2026-08-31; daily CI enforces the boundary.

## Latest cycle: count only complete qualifying quarters

### Why this was selected

The scheduled catalog audit is not due until 2026-08-24, so repeating it after
two days would be a low-information loop. The remaining engine edge was real:
UOB One's 3.33% proxy accrued cashback for every horizon month even though its
S$60/S$100/S$200 award requires a complete qualifying quarter. Direct callers
could therefore claim impossible value at one or two months and overcount a
trailing partial quarter at four or five months.

### Changes

- Added a declarative `qualifyingPeriodMonths: 3` catalog property to UOB One
  rather than hard-coding card identity in the engine.
- Validated optional qualifying periods as positive whole months from one to
  twelve.
- Limited optimistic category cashback to complete qualifying periods while
  preserving base-rate one-off handling and all 6/12/24-month UI results.
- Added a precise warning when an arbitrary direct-call horizon contains an
  incomplete period.
- Made `scoreCard` fall back safely when called directly with an invalid period,
  preventing `NaN` even if catalog validation was bypassed.
- Added eight catalog, validation, complete/partial-period, disclosure, and
  direct-call assertions; documented the behavior and bumped version to
  `2026.08.11.2`.

### Verification and scores

- Official-source evidence: UOB's live product page still describes quarterly
  S$60/S$100/S$200 cashback based on the applicable monthly spend and minimum
  10 purchases for each qualifying quarter.
- Test-first evidence: six of the first seven new assertions failed—the absent
  catalog period, absent validation, two incorrect partial-horizon amounts, and
  two missing warnings. The unchanged 12-month S$400 result already passed.
- A follow-up adversarial direct-call assertion reproduced `NaN` with a zero
  period before the calculation guard was added.
- `node tools/test-engine.mjs`: 79 passed, 0 failed (up from 71).
- Two months at S$1,000 now model S$0 instead of ~S$66.67; four months model one
  complete S$100 quarter instead of ~S$133.33; twelve months remain S$400.
- Process failure: the first combined gate tried to parse a nonexistent
  `package.json`, revealing stale “manifest JSON” verification wording in this
  dependency-free repo. The gate and historical state now name only the tracked
  catalog JSON.
- All freshness, deadline, site, app, catalog JSON, recursive syntax, and diff
  gates pass; the catalog check still reports 13 days until its scheduled
  review.
- Correctness/reliability: 6/10 → 10/10 (cashback now follows the award period,
  not a fractional-quarter proxy).
- Verifiability: 8/10 → 10/10 (schema, complete periods, partial periods,
  warnings, and bypassed validation are directly covered).
- Maintainability: 7/10 → 9/10 (period semantics are declarative and reusable).
- Performance: 10/10 → 10/10 (constant-time arithmetic replaces constant-time
  arithmetic).
- Security/robustness: 8/10 → 9/10 (invalid public-helper input remains finite
  and estimates no longer overclaim rewards).

### Lessons and process improvements

- Percentage proxies for periodic lump-sum rewards must be bounded by complete
  qualification periods; warnings alone do not correct the estimate.
- Product-specific timing belongs in validated catalog data so the engine stays
  generic.
- Public pure helpers need safe arithmetic even when their normal caller has
  already validated the catalog.

## Previous cycle: align opposing mode events with rendered rankings

### Why this was selected

Fuss-free and optimizer checkboxes are intentionally mutually exclusive, but the app's generic `change` listener was registered before the listener that corrected the opposing checkbox. A user click therefore rendered once from a transient state where both modes were enabled, then changed only the visible checkbox state. The ranking could disagree with the controls until another event.

### Changes

- Extended the dependency-free app harness to retain ordered event listeners, dispatch real form events, and record every scenario sent to the recommendation engine.
- Added eight event assertions covering mutual exclusion in both directions, exactly one render per change, and agreement between corrected checkbox state and engine mode flags.
- Registered the two mutual-exclusion handlers before the existing generic change handler, so correction happens before the single ranking render.
- Bumped the deployed version to `2026.08.11.1`.

### Verification and scores

- Test-first evidence: enabling optimizer mode unchecked the fuss-free box but the captured recommendation scenario still had `preferFussFree: true`, reproducing the UI/ranking mismatch.
- `node tools/test-engine.mjs`: 71 passed, 0 failed.
- `node tools/test-catalog-freshness.mjs`: 17 boundary, scheduling, and runtime-policy assertions passed.
- `node tools/catalog-freshness.mjs`: reports 13 days remaining before review and the 2026-08-31 earliest offer end; the deterministic deadline contract still fails on 2026-08-24 as required.
- `node tools/test-app.mjs`: 25 startup, event, and render assertions passed, up from 17.
- `node tools/test-site.mjs`: 9 local references and 5 fragments verified.
- Local runtime: Node `v24.14.1`.
- Recursive `node --check` across `js/` and `tools/`: passed.
- Catalog JSON parsing: passed.
- `git diff --check`: passed.
- Correctness/reliability: 10/10 (rendered ranking and visible mode state now come from the same corrected event).
- Verifiability: 10/10 (ordered dispatch, engine scenario capture, mutual exclusion, and render counts are explicit).
- Maintainability: 9/10 (one listener-order invariant preserves the existing generic handler without duplicate mode code).
- Performance: 10/10 (each toggle still triggers exactly one recommendation/render pass).
- Security/robustness: 9/10 (no external boundary changed; catalog and input guards remain intact).
- User experience: 10/10 (users cannot see optimizer controls paired with a fuss-free-influenced ranking, or vice versa).

### Lessons and process improvements

- Listener registration order is observable application state when handlers mutate inputs consumed by later handlers.
- A DOM harness that only records `addEventListener` calls cannot verify interaction correctness; ordered dispatch and downstream scenario capture expose transient-state bugs cheaply.
- Assert one render as well as final flags: calling `run()` again inside corrective handlers would hide the mismatch but double work and briefly paint the wrong result.

## Previous cycles

- Cycle 39: limited UOB One optimizer value to complete declarative qualifying
  quarters across arbitrary engine horizons.
- Cycle 38: aligned opposing mode events with exactly one corrected ranking render.
- Cycle 37 (`699fa42`): upgraded CI actions to v7 and moved project tests to Node 24 LTS.
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
| — | Model qualifying-quarter completeness for arbitrary horizons | Correctness / safety | Low-medium | Medium / medium | Declarative three-month periods now exclude incomplete quarters and preserve standard horizons | Completed in Cycle 39 |
| — | Align opposing optimizer/fuss-free toggle events | Correctness / UI tests | Medium | Small / low | Ordered event tests prove corrected controls reach the single ranking render | Completed in Cycle 38 |

## Next cycle

Local next: execute the full official-source audit by 2026-08-24 and advance both `asOf` and `reviewBy`; avoid a low-information repeat before the deadline absent issuer changes. Workspace next: rotate to the next least-recently improved project after this focused correctness cycle.
