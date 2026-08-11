# CardFitSG continuous improvement log

Last updated: 2026-08-11 (Cycle 127 across the projects workspace; CardFitSG Cycle 41)

## Current state

- Branch: `main`; continuous-improvement commits are published to `origin/main` after verification.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (96 assertions), `node
  tools/test-catalog-freshness.mjs` (17 assertions), the live catalog-deadline
  check, `node tools/test-site.mjs` (14 references/fragments), `node
  tools/test-app.mjs` (25 assertions), recursive JavaScript syntax checks, JSON
  catalog JSON parsing, and repository CI on Node 24 LTS.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.
- UOB One's optimizer condition was reverified against UOB's product page, full
  terms, and FAQ on 2026-08-10; the official product page reconfirmed its
  fixed S$60/S$100/S$200 quarterly award structure on 2026-08-11.
- AMEX True Cashback's official page reconfirmed on 2026-08-11 that 3% applies
  to up to S$5,000 of eligible spend in the first six months for new members,
  followed by 1.5% on subsequent eligible purchases.
- Catalog review policy: audit by 2026-08-24, seven days before the earliest dated offers end on 2026-08-31; daily CI enforces the boundary.

## Latest cycle: model UOB One as fixed quarterly awards

### Why this was selected

The scheduled full catalog audit remains 13 days early. Engine review exposed a
current financial correctness bug instead: UOB One's S$60/S$100/S$200 fixed
quarterly awards were represented only as 3.33% rate proxies. The engine applied
that rate to every dollar above a tier threshold, substantially overstating
cashback between thresholds even though exact-threshold tests stayed green.

### Changes

- Added declarative `periodCashback` values of S$60, S$100, and S$200 to the
  three UOB One tiers while retaining the issuer's “up to 3.33%” display proxy.
- Fixed-tier scoring now multiplies the selected award by complete qualifying
  periods rather than multiplying a percentage by actual monthly spend.
- Validates fixed awards as non-negative numbers and requires a valid
  `qualifyingPeriodMonths`; malformed direct calls fail closed to zero category
  value with an explicit warning.
- Added nine catalog, schema, between-threshold, upper-tier, direct-call, and
  disclosure assertions; engine coverage increased from 87 to 96.
- Clarified the fixed-award feature and bumped version to `2026.08.11.4`.

### Verification and scores

- Official issuer evidence: UOB's current product page and promotion terms both
  state that S$600/S$1,000/S$2,000 monthly tiers earn fixed S$60/S$100/S$200
  cashback per qualifying quarter after three statement months with ten
  purchases each month.
- Test-first evidence: eight initial assertions failed on missing catalog data,
  absent validation, all four between/above-threshold calculations, unsafe
  direct-call fallback, and missing disclosure. Self-review added a ninth red
  contract for fixed awards without a qualifying period.
- At S$800/month, modeled annual UOB One cashback fell from S$320 to S$240; at
  S$1,200 it fell from S$480 to S$400; at S$1,999 it fell from about S$800 to
  S$400. S$2,500 remains correctly capped at S$800 across four quarters.
- `node tools/test-engine.mjs`: 96 passed, 0 failed.
- All 17 freshness contracts passed; the live deadline check still reports 13
  days until review. Fourteen site references/fragments and 25 app startup,
  event, and render assertions passed.
- Catalog JSON parsing, recursive syntax, and diff checks passed; hosted CI,
  Pages, and live-version evidence are recorded in the Cycle 127 completion
  summary.
- Correctness/reliability: 4/10 → 10/10 (cashback is now constant within each
  award band instead of rising beyond the published fixed award).
- Verifiability: 6/10 → 10/10 (thresholds, between-threshold points, the top
  band, schema dependencies, and bypassed validation are directly covered).
- Maintainability: 7/10 → 9/10 (fixed periodic economics are declarative and
  reusable rather than encoded by card identity).
- Performance: 10/10 → 10/10 (constant-time fixed-period arithmetic replaces
  constant-time percentage arithmetic).
- Security/robustness: 7/10 → 9/10 (malformed fixed-award metadata cannot
  silently reactivate the overstating percentage proxy).
- User experience: 5/10 → 10/10 (optimizer rankings no longer promise
  impossible base cashback for ordinary between-tier spend).

### Lessons and process improvements

- Exact-threshold tests can validate a percentage proxy accidentally; every
  tiered fixed award needs at least one between-threshold contract.
- “Up to N%” marketing language is not always the calculation primitive. Model
  the actual award mechanism and retain the percentage only as disclosure.
- When new metadata changes arithmetic, validate both its value and the fields
  needed to interpret its time unit before accepting the catalog at startup.

## Previous cycle: bound intro cashback by its acquisition window

### Why this was selected

The scheduled full catalog audit remains 13 days early. Engine review exposed
a current correctness bug instead: `introMonths` was catalog-validated but
never used. AMEX True Cashback therefore applied 3% to the first S$5,000 even
when low recurring spend reached that amount after the six-month welcome
window, and it also awarded the new-member rate to an already-held card.

### Changes

- Limits intro-eligible spend to the one-off purchase plus recurring spend in
  the lesser of the scenario horizon and declared intro months.
- Applies the standard rate to all later or above-cap spend and names the month
  window in result notes.
- Excludes new-member intro rates when the card is already in the wallet.
- Makes malformed direct-call intro windows fail safely to the standard rate
  with an explicit warning instead of extending promotional value.
- Added eight official-term, six-/twelve-month, disclosure, invalid-metadata,
  and existing-card assertions; engine coverage increased from 79 to 87.
- Documented the model and bumped version to `2026.08.11.3`.

### Verification and scores

- Official issuer evidence: AMEX's live True Cashback page states 3% on up to
  S$5,000 of eligible purchases in the first six months for new card members,
  then 1.5% on subsequent eligible purchases.
- Test-first evidence: the initial contracts left the six-month case green but
  failed four times on the 12-month amount, missing window disclosure, unsafe
  direct-call value, and absent warning.
- At S$500/month, twelve-month modeled cashback fell from S$165 to the correct
  S$135 (S$90 intro plus S$45 standard); six months remain S$90.
- An already-held card now models S$45 across six months instead of incorrectly
  awarding S$90 of new-member value.
- `node tools/test-engine.mjs`: 87 passed, 0 failed.
- All 17 freshness contracts passed; the live deadline check still reports 13
  days until review. Fourteen site references/fragments and 25 app startup,
  event, and render assertions passed.
- Catalog JSON parsing, recursive syntax, and diff checks passed; hosted CI,
  Pages, and live-version evidence are recorded in the Cycle 117 completion
  summary.
- Correctness/reliability: 5/10 → 10/10 (both spend and membership eligibility
  now obey the declared acquisition window).
- Verifiability: 7/10 → 10/10 (window boundary, later spend, direct bypass, and
  tenure all have exact contracts).
- Maintainability: 7/10 → 9/10 (the existing catalog field finally owns the
  engine rule rather than remaining dead metadata).
- Performance: 10/10 → 10/10 (constant-time arithmetic only).
- Security/robustness: 7/10 → 9/10 (malformed direct inputs remain finite and
  fail toward lower promotional value).
- User experience: 7/10 → 10/10 (rankings and notes no longer overstate a
  time-limited or new-member-only offer).

### Lessons and process improvements

- A validated field is not a behavioral contract until a boundary test proves
  the calculation consumes it.
- Promotional spend needs both a monetary cap and a temporal cap; applying only
  the first can overstate low-cadence users most severely.
- “Already hold” must suppress acquisition economics, not only signup cash.

## Previous cycle: count only complete qualifying quarters

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

- Cycle 41: modeled UOB One's fixed quarterly awards across threshold bands and
  rejected incomplete fixed-period metadata.
- Cycle 40: bounded AMEX welcome cashback by its six-month/new-member window.
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
| — | Model fixed quarterly awards between UOB One thresholds | Correctness / safety | High | Small-medium / low | Nine contracts cover fixed bands, schema dependencies, and direct-call fallback | Completed in Cycle 41 |
| — | Apply intro rates only inside their acquisition window | Correctness / safety | Medium-high | Small-medium / low | Eight contracts cover time, cap, tenure, disclosure, and direct-call fallback | Completed in Cycle 40 |
| — | Model qualifying-quarter completeness for arbitrary horizons | Correctness / safety | Low-medium | Medium / medium | Declarative three-month periods now exclude incomplete quarters and preserve standard horizons | Completed in Cycle 39 |
| — | Align opposing optimizer/fuss-free toggle events | Correctness / UI tests | Medium | Small / low | Ordered event tests prove corrected controls reach the single ranking render | Completed in Cycle 38 |

## Next cycle

Local next: execute the full official-source audit by 2026-08-24 and advance
both `asOf` and `reviewBy`; avoid a low-information repeat before the deadline
absent issuer changes. Workspace next: rotate to AlpArcade after this focused
correctness cycle.
