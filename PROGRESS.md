# CardFitSG continuous improvement log

Last updated: 2026-09-06 (CardFitSG Cycle 58)

## Current state

- Branch: `main`; continuous-improvement commits are published to `origin/main` after verification.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: workflow policy (14 assertions), `node tools/test-engine.mjs`
  (130 assertions), `node
  tools/test-catalog-freshness.mjs` (19 assertions), the live catalog-deadline
  check, `node tools/test-site.mjs` (13 references/fragments), `node
  tools/test-app.mjs` (104 assertions), recursive JavaScript syntax checks, JSON
  catalog JSON parsing, and repository CI on Node 24 LTS.
- Catalog snapshot: all six cards and the current OCBC/UOB/SC promotion terms
  were rechecked from official sources on 2026-09-01; `data/cards.json`
  declares `asOf` 2026-09-01 and `reviewBy` 2026-09-25 (before the earliest
  2026-09-30 offer ends).
- UOB One's optimizer condition was reverified against UOB's product page, full
  terms, and FAQ on 2026-08-10; the official product page reconfirmed its
  fixed S$60/S$100/S$200 quarterly award structure on 2026-08-11.
- AMEX True Cashback's official page reconfirmed on 2026-08-11 that 3% applies
  to up to S$5,000 of eligible spend in the first six months for new members,
  followed by 1.5% on subsequent eligible purchases.
- Current OCBC, UOB, and Standard Chartered promotion terms reconfirmed on
  2026-08-11 that their modeled signup offers require respectively 12, 6, and
  12 months without the issuer's principal credit cards.
- Catalog review policy: recheck by 2026-09-25, five days before the dated
  offers end on 2026-09-30; daily CI enforces the boundary.
- Deployment version: `2026.09.06.1` (pending PR: non-blocking fonts + versioned catalog).


## Latest cycle: non-blocking fonts + versioned catalog (2026-09-06)

### Why this was selected

Google Fonts still blocked first paint, and `fetch("data/cards.json", { cache: "no-cache" })`
forced revalidation on every visit before rankings could paint. Version bumps already exist
for deploys; the catalog URL should ride that stamp instead of bypassing HTTP cache.

### Changes

- Loaded Google Fonts with `media="print" onload="this.media='all'"` plus a `<noscript>` fallback
  in `index.html` so the form can paint with system fonts first.
- Fetched the catalog as `data/cards.json?v=` + `SITE_VERSION.id` with default cache behaviour
  (removed `cache: "no-cache"`).
- Left ranked `publishedRateSummary` pills, `renderResult`, and catalog `reviewBy` stacking alone.
- Extended `tools/test-app.mjs` and `tools/test-site.mjs` for the versioned fetch URL, absent
  no-cache option, and non-blocking font link pattern.
- Bumped site version to `2026.09.06.1`.

## Previous cycle: honest ranked rate pills (2026-09-04)

### Why this was selected

Ranked-list rate pills still rendered raw `flatRate × 100` as "% base", so UOB One
showed `0.0% base` and OCBC 365 showed only its tiny base while compare already used
`publishedRateSummary()`. Visitors saw conflicting rate honesty between the two panels.

### Changes

- Reused `publishedRateSummary(card)` (escaped) for ranked pills in `js/app.js`.
- Allowed pill text to wrap with a tiny CSS tweak.
- Extended `tools/test-app.mjs` so `#ranked` pills match compare honesty for UOB One,
  OCBC 365, flat, and intro cards.
- Bumped site version to `2026.09.04.1`.

## Previous cycle: restore current September signup windows (2026-09-01)

### Why this was selected

The enforced 30 August review date had passed, and the catalog still ended the
OCBC and Standard Chartered welcome offers on 31 August. Their official product
pages now show the same modeled offers extended through 30 September, so the
live calculator was excluding valid signup value from September scenarios.

### Changes

- Rechecked all six official product pages and the governing OCBC/UOB/SC terms.
- Extended both OCBC card offers and Standard Chartered Simply Cash through
  30 September without changing their spend, cash, gift, or issuer-lookback
  mechanics.
- Advanced the catalog snapshot to 1 September and its enforced review date to
  25 September.
- Added regression assertions for all three renewed windows and bumped the site
  to `2026.09.01.1`.

## Previous cycle: bind dated offers to official terms (2026-08-28)

### Why this was selected

The scheduled source audit found no modeled reward change, but it exposed a
verification gap: product-page links established each card's identity while
the separate acquisition terms established offer dates and 6/12-month issuer
lookbacks. Those governing terms were neither retained in the catalog nor
reachable from a recommendation.

### Changes

- Rechecked all six products and current OCBC, UOB, and Standard Chartered
  acquisition terms. Modeled rates, fees, eligibility windows, and dated
  offers remain unchanged; the audit date advances to 2026-08-28.
- Clarified OCBC 365's separate 0.5% advertising-instalment disclosure and the
  4 August start of UOB Absolute's temporary contactless bonus without adding
  either category-specific rate to generic-spend rankings.
- Added `signup.termsUrl` to every dated offer and an `Offer terms` action on
  the top recommendation.
- Extended the issuer URL boundary so a dated offer fails catalog validation
  when its terms link is missing, non-HTTPS, credentialed, or outside that
  card's official issuer domain.
- Documented the offer-terms field and bumped deployment version to
  `2026.08.28.1`.

### Verification and scores

- Test-first: engine baseline was 123 passed / 4 failed for the stale audit
  date, missing terms links, and absent validation; the app render contract
  also failed before the action existed.
- The three distinct OCBC, UOB, and Standard Chartered terms URLs each
  returned HTTP 200 from their official domains.
- Engine 128, freshness 17, app 86, site 13 references/fragments, workflow 14,
  live two-day deadline, recursive syntax, catalog/manifest JSON, and diff
  checks pass locally.
- Hosted CI run `33097431797` passed every gate; Pages run `33097430186`
  deployed successfully. The public site serves version `2026.08.28.1`, audit
  date 2026-08-28, review date 2026-08-30, all five dated terms links, and the
  `Offer terms` action. Each of the three distinct deployed terms URLs returns
  HTTP 200 from its issuer domain.
- Correctness/reliability: 7/10 -> 10/10 (offer claims now carry their own
  validated source rather than borrowing a product-page citation).
- Verifiability: 7/10 -> 10/10 (presence, issuer binding, rendering, and live
  reachability are independently checked).
- Maintainability: 8/10 -> 9/10 (the existing issuer-domain policy owns both
  product and offer URLs).
- User experience: 7/10 -> 9/10 (the exact eligibility terms are one action
  away from the recommendation).
- Performance: 10/10 -> 10/10; security/robustness: 9/10 -> 10/10.

### Lessons and process improvements

- A product page and acquisition terms support different facts; retain both
  instead of expecting one generic source URL to prove the whole model.
- Bind acquisition links to the modeled issuer at startup, before rendering,
  so catalog drift cannot silently redirect users to unrelated terms.
- The 28 August audit is useful new evidence but does not replace the final
  pre-expiry check enforced for 30 August.

### Next opportunity

Recheck the expiring OCBC and Standard Chartered offers on 30 August 2026. At
workspace scope, rotate until that enforced financial-data deadline.

## Previous cycle: share wallet and issuer history in the URL (2026-08-25)

### Why this was selected

Copy link restored spend and flags, but not cards already held or recent
issuer lookbacks. A partner reopening the URL saw signup cash that the sender
had already excluded.

### Changes

- Encode held catalog cards as `hold=` and extra recent issuers as `issuers=`.
- Boot restores those checkboxes; unknown tokens are dropped.
- Version `2026.08.25.5`.

## Previous cycle: share a scenario as a URL (2026-08-25)

### Why this was selected

Copy result pasted the generic site URL. Partners on WhatsApp could not reopen
the same one-off, monthly, horizon, and flags. Saved localStorage helped only
the same browser.

### Changes

- Encode oneOff, monthly, months, goal, fuss, optimizer, and Amex into the query.
- Boot prefers the shared URL over the last local scenario.
- Ranking `replaceState`s the canonical query so the address bar matches the screen.
- Top fit adds Copy link; Copy result now includes that same scenario URL.
- Version `2026.08.25.4`.

### Next opportunity

Recheck the expiring OCBC and Standard Chartered offers on 30 August 2026.

## Previous cycle: cancel duplicate and stale CI work (2026-08-25)

### Why this was selected

Cycle 51's code push unexpectedly launched two complete CI runs for the same
commit (`32774933691` and `32774934265`). CardFit's workflow had no concurrency
group, so duplicated events or rapid superseding pushes could consume two
hosted gates and let obsolete work continue. This was new, measured evidence
and a small compounding process fix that did not require changing dated card
facts.

### Changes

- Added a workflow/ref-scoped concurrency group with
  `cancel-in-progress: true`.
- Added a zero-dependency workflow-policy suite covering triggers, scheduled
  deadline enforcement, least privilege, timeout, supported actions/Node,
  self-execution order, and concurrency behavior.
- Made the policy suite the first CI test after Node setup.
- Runtime files, catalog facts, and deployment version remain unchanged.

### Verification and scores

- Test-first: the new policy suite failed on the absent concurrency group.
- Workflow policy 14, engine 124, catalog freshness 17, live five-day deadline,
  app 68, site references/fragments, recursive syntax, catalog/manifest JSON,
  and diff checks passed locally.
- Push CI `32775192959` passed the policy first and then every product gate;
  Pages `32775191543` also passed.
- Controlled same-ref proof: dispatch `32775252976` was cancelled when
  `32775256228` arrived two seconds later. The replacement passed all gates in
  10s.
- Correctness/reliability: 9/10 → 9/10 (runtime behavior is unchanged).
- Verifiability: 3/10 → 10/10 (policy and real cancellation both execute).
- Maintainability/process: 6/10 → 9/10 (workflow assumptions are executable).
- Performance/resources: 4/10 → 10/10 (obsolete same-ref work is cancelled).
- Security/robustness: 9/10 → 9/10 (read-only permission remains enforced).
- User experience: 9/10 → 9/10 (no calculator behavior changed).

### Lessons and process improvements

- Hosted run history is an observability surface: duplicate successful runs can
  reveal waste even when no test fails.
- A concurrency declaration deserves both a source contract and a controlled
  two-run proof; either alone leaves part of the behavior assumed.
- Process-only workflow changes should keep the runtime version stable.

### Next opportunity

Recheck the expiring OCBC and Standard Chartered offers on 30 August 2026. At
workspace scope, rotate until that enforced financial-data deadline.

## Previous cycle: fail closed on unsafe or mismatched issuer links (2026-08-25)

### Why this was selected

Catalog text was escaped consistently, but official product URLs were only
attribute-encoded before entering `href`. Encoding quotes does not make a
`javascript:` URL safe or prove that an HTTPS hostname belongs to the card's
issuer. The positional `meta.sources` fallback also had no contract tying each
URL to its corresponding card, so a reorder could send users to the wrong
bank's product page.

### Changes

- Added one issuer-domain policy covering OCBC, UOB, American Express, and
  Standard Chartered.
- Require exactly one source URL per card, absolute HTTPS, no URL credentials,
  and an exact or subdomain match for that card's issuer.
- Apply the same policy to optional per-card `officialUrl` overrides.
- Added engine contracts for unsafe schemes, issuer mismatches, lookalike
  domains, and unsafe overrides, plus app-level fail-closed startup coverage.
- Bumped deployment version to `2026.08.25.3`; card facts and dates are unchanged.

### Verification and scores

- Test-first: all four unsafe/mismatched URL fixtures passed validation, and
  the application continued startup instead of showing its safe fatal state.
- Engine 124, catalog freshness 17, app 68, site references/fragments, live
  five-day deadline sentinel, recursive syntax, catalog/manifest JSON parsing,
  and diff checks passed.
- CardFit has no package manifest, lockfile, or runtime dependency; an
  exploratory `npm audit` was therefore inapplicable and made no changes.
- Duplicate hosted CI runs `32774933691` and `32774934265` both passed the same
  commit. Pages run `32774933278` deployed successfully, and the live site
  serves version `2026.08.25.3`.
- Correctness/reliability: 5/10 → 10/10 (each source is tied to its card issuer).
- Verifiability: 4/10 → 10/10 (four URL attacks and app startup are executable).
- Maintainability: 7/10 → 9/10 (one domain policy owns both catalog URL paths).
- Performance: 10/10 → 10/10 (six tiny URL parses occur once at startup).
- Security/robustness: 3/10 → 10/10 (unsafe schemes and lookalikes fail closed).
- User experience: 6/10 → 9/10 (an “Official page” link now proves its claim).

### Lessons and process improvements

- HTML attribute escaping and URL authorization solve different problems; a
  safe `href` needs both.
- Positional metadata needs a semantic alignment check, not only equal lengths.
- Check whether a project has dependency metadata before running package-manager
  audits; zero-dependency static checks are the correct gate here.
- Two CI runs started for one push. Add ref-scoped stale-run cancellation so a
  duplicated or superseded event cannot consume two complete hosted gates.

### Next opportunity

Add tested ref-scoped concurrency cancellation to CardFit CI, then rotate until
the enforced 30 August official-source review date.

## Previous cycle: reconcile completed backlog state (2026-08-25)

### Why this was selected

State loading found that Cycle 49's style-aware comparison was fully shipped
and verified, but the prioritized table and `Next cycle` section still named
that same work as pending. Both active rows also omitted the table's Status
field. That stale handoff could send future improvement cycles back through
already-completed work, directly violating the workspace's anti-loop rule.

### Changes

- Marked the comparison and persistence work completed with its Cycle 49
  evidence instead of leaving it as priority 2.
- Marked the official-source recheck explicitly pending with its enforced 30
  August deadline.
- Replaced the stale local handoff with the only currently scheduled CardFitSG
  work and retained the instruction to rotate until the deadline.
- Runtime files, catalog facts, and deployment version remain unchanged.

### Verification and scores

- Cross-checked the backlog against the Cycle 49 log, current 65-assertion app
  baseline, and deployment version `2026.08.25.2`.
- Engine 120, catalog freshness 17, app 65, and site reference/fragment
  contracts passed. The live deadline sentinel reports five days remaining.
- Recursive JavaScript syntax, catalog/manifest JSON parsing, and diff checks
  passed.
- Correctness/reliability: 6/10 → 10/10 (planning state matches shipped state).
- Verifiability: 7/10 → 9/10 (the completed row points to its exact evidence).
- Maintainability/process: 4/10 → 10/10 (the next cycle cannot select completed work).
- Performance, security, and user experience: unchanged (no runtime change).

### Lessons and process improvements

- Completion must be reflected in every active planning surface, not only the
  narrative cycle log.
- Treat a stale `Next cycle` pointer as a real process defect because it can
  waste autonomous cycles and distort prioritization.

### Next opportunity

Recheck the expiring OCBC and Standard Chartered offers on 30 August 2026; at
workspace scope, rotate to another repository until that enforced date.

## Previous cycle: truthful style-aware card comparison (2026-08-25)

### Why this was selected

The comparison panel described every card using `flatRate`. That made UOB One
look like a 0.0% product and rounded OCBC 365's 0.25% base to 0.3%, obscuring
the conditions users most need when comparing non-flat products. The existing
app harness only checked that comparison markup existed and provided no
`localStorage`, leaving both selection and scenario recovery unverified.

### Changes

- Replaced the generic base-rate line with catalog-driven summaries for flat,
  intro-then-flat, category, and fixed-period tiered products.
- UOB One now shows its S$60–S$200 award range, three-month qualifying period,
  and S$600–S$2,000 monthly thresholds instead of `0.0% base`.
- OCBC 365 now distinguishes its exact 0.25% base from category rates up to
  6.0% and the S$800 monthly threshold. AMEX True separates its 3.0% capped
  six-month intro from the 1.5% ongoing rate.
- Expanded the VM harness with a real in-memory storage boundary. Compare
  selection, valid scenario restoration, mutually exclusive saved modes,
  malformed JSON recovery, and replacement with valid persisted state are now
  behavioral contracts.
- Bumped the deployed version to `2026.08.25.2` and clarified the README feature.

### Verification and scores

- Test-first: the new tiered-card assertion failed on the observed `UOB One ·
  0.0% base` output before the implementation.
- `node tools/test-engine.mjs`: 120 passed, 0 failed.
- `node tools/test-catalog-freshness.mjs`: 17 passed; the live sentinel reports
  five days until the enforced review date.
- `node tools/test-app.mjs`: 65 passed, up from 47. `node tools/test-site.mjs`:
  9 local references and 4 fragments passed.
- Recursive JavaScript syntax checks, catalog/manifest JSON parsing, and
  `git diff --check` passed.
- Hosted CI run `32763011108` and Pages run `32763009847` passed; the public
  site serves version `2026.08.25.2` and the style-aware comparison formatter.
- Correctness/reliability: 8/10 → 9/10 (conditional products are no longer flattened or rounded misleadingly).
- Verifiability: 7/10 → 9/10 (selection and both storage recovery paths execute in the app harness).
- Maintainability: 8/10 → 9/10 (one style dispatcher derives copy from validated catalog fields).
- Performance: 10/10 → 10/10 (six tiny synchronous summaries per render).
- Security/robustness: 9/10 → 9/10 (rendered summaries pass through HTML escaping).
- User experience: 7/10 → 9/10 (comparison now explains the qualification model at a glance).

### Lessons and process improvements

- A common field is not necessarily a common user-facing concept; rendering
  must follow the product's earning model, not merely schema availability.
- Exact sub-percent rates need two-decimal precision even when most rates fit
  the interface's one-decimal convention.
- A persistence claim should include executable storage recovery coverage, not
  just a source-string assertion.

### Next opportunity

Rotate to ChristoDay and reload its ranked backlog before selecting a new
small, test-backed reliability improvement; avoid another financial-data cycle
unless the 30 August review deadline is reached.

## Previous cycle: official-source audit and conservative disclosures (2026-08-25)

### Why this was selected

The catalog had only three days until its enforced review date, and its two
OCBC/SC signup campaigns end on 31 August. Financial correctness and a fresh
source trail outranked another interface feature. Durable state also lagged the
already-shipped comparison feature by one cycle.

### Changes

- Rechecked all six official issuer product pages plus OCBC, UOB, and Standard
  Chartered acquisition terms. Base rates, annual fees, 6/12-month issuer
  lookbacks, signup amounts/windows, UOB One fixed quarterly awards, and AMEX's
  six-month/S$5,000 intro remain unchanged.
- Recorded OCBC 365's newly advertised 1% marketing-expense rate with no usual
  minimum or cap as a disclosure. Generic-spend rankings do not assume a
  marketing category or incorrectly apply the lifestyle cap to it.
- Clarified that UOB One's estimate models the fixed quarterly award but not
  its additional partner, grocery, and Singapore Power cashback because the
  form does not collect a category mix.
- Advanced `asOf` to 2026-08-25, `reviewBy` to 2026-08-30, and deployed version
  to `2026.08.25.1`. README and this state now include Cycle 47's compare and
  local scenario-restore features.

### Verification and scores

- Test-first: four assertions failed on the stale audit/review dates and absent
  OCBC/UOB disclosures before the catalog change.
- `node tools/test-engine.mjs`: 120 passed, 0 failed (up from 117).
- `node tools/test-catalog-freshness.mjs`: 17 passed; the live sentinel reports
  five days to review and 2026-08-31 as the earliest dated offer end.
- `node tools/test-app.mjs`: 47 startup, event, eligibility, preset, dock, and
  render assertions passed. `node tools/test-site.mjs`: 9 references and 4
  fragments passed.
- Hosted CI run `32759372374` and Pages run `32759370029` passed; the live site
  serves `2026.08.25.1`, `asOf` 2026-08-25, and `reviewBy` 2026-08-30.
- Correctness/reliability: 8/10 → 10/10 (current facts and omitted-rate scope are explicit).
- Verifiability: 8/10 → 10/10 (snapshot date, next deadline, and both new disclosures are locked).
- Maintainability: 8/10 → 9/10 (conditions stay in dated catalog data, not UI code).
- Performance: 10/10 → 10/10 (data-only runtime change).
- Security/robustness: 9/10 → 9/10 (no new external boundary; estimates remain conservative).
- User experience: 8/10 → 9/10 (users can see what the generic estimate omits and why).

### Lessons and process improvements

- A new rate with different qualification/cap semantics should be disclosed,
  not inserted into a shared rate bucket that would silently inherit the wrong
  rules.
- Source audits must compare both modeled values and explicit omissions.
- Update durable state in the same shipping cycle; the comparison feature's
  missing Cycle 47 entry made prioritization noisier than necessary.

### Next opportunity

Make card comparison truthful for non-flat products: replace the current raw
`flatRate` line with style-aware summaries and add behavioral tests for compare
selection plus saved-scenario recovery.

## Previous cycle: compare cards and restore the last scenario (2026-08-18)

### Why this was selected

Rankings answered “what wins” but did not let users inspect two alternatives,
and refreshing discarded a carefully entered scenario.

### Changes

- Added side-by-side card selectors with current-scenario net estimates and
  direct official issuer links.
- Added best-effort local persistence for one-off/monthly spend, horizon,
  intent, modes, and Amex acceptance; malformed or unavailable storage fails
  closed.
- Added the top recommendation's official product link and bumped version to
  `2026.08.18.5` (`4c9478d`).

### Verification

- The app harness confirms catalog options, compare output, official links,
  and the local scenario key. The full 47 app assertions and existing engine,
  freshness, site, syntax, CI, and Pages gates passed when shipped.

### Next opportunity

Execute the official-source catalog audit before the enforced review date.

## Previous cycle: official catalog re-audit (2026-08-18)

### Why this was selected

The approved feature plan’s first cycle is the issuer audit due before
2026-08-24. OCBC and SC welcome windows still end 2026-08-31.

### Changes

- Rechecked official product pages for all six cards. Base rates, UOB One
  fixed quarterly awards, AMEX 6-month/S$5,000 intro, and 6/12-month
  lookbacks are unchanged. OCBC S$180 and SC S$100+luggage still end
  31 August 2026; UOB gifts still list 30 September 2026.
- Advanced `asOf` to 2026-08-18 and `reviewBy` to 2026-08-28.
- Top-fit card now shows remaining SGT days on dated signup value and a
  Copy result line for WhatsApp.
- Version `2026.08.18.4`.

## Previous cycle: glanceable spend presets and ranking UX

### Why this was selected

The calculator already ranked fuss-free cashback correctly, but the first
visible screen still asked users to invent amounts and then hunt for the
answer below a stacked form on phones. The honeymoon / monthly / big-trip
scenarios were buried in copy. A ranking that printed signup, rate cash, and
reasons in one dense line was accurate and unread.

### Changes

- Added three gold outline preset chips above the amount fields: Honeymoon
  S$3,500, Monthly only, and Big trip S$8,000. Chips write `#oneOff` /
  `#monthly` and call the existing live `run()` path; fields stay editable.
- Added a sticky top-fit dock under the header summarizing
  `Top fit · CARD · S$NET · RATE%`. It jumps to `#primary`, matches the
  topbar blur and gold line, tracks header auto-hide, and collapses when
  there is no spend ranking.
- Made S$ net the ranking hero, added a thin gold bar scaled to the best
  net, and moved signup / rate cash plus `rankReasons` into a
  `Why this rank` `<details>`. The `.is-top` gold ring is unchanged.
- Presentation only: engine scoring is untouched. Version is `2026.08.18.2`.

### Verification and scores

- `node tools/test-engine.mjs`: 117 passed, 0 failed.
- `node tools/test-app.mjs`: 47 startup, event, eligibility, preset, dock,
  and render assertions passed (up from 31), including honeymoon default
  state, monthly-only / big-trip live updates, dock show/hide, hero net,
  bars, and tucked reasons.
- `node tools/test-site.mjs`: local references and fragments still resolve,
  including the new `#primary` dock target.
- Recursive `node --check js/*.js`, catalog JSON, and `git diff --check`
  pass; scoring contracts were not changed.
- Correctness/reliability: 10/10 → 10/10 (no scoring change).
- Verifiability: 9/10 → 10/10 (preset, dock, and ranking presentation now
  have harness contracts).
- Maintainability: 9/10 → 9/10 (chips reuse `run()`; dock is a sibling of
  the existing sticky header).
- Performance: 10/10 → 10/10 (three buttons and one extra render string).
- Security/robustness: 9/10 → 9/10 (preset values are static; card names
  stay escaped).
- User experience: 6/10 → 9/10 (a first-screen scenario, a phone-visible
  top pick, and a scannable ranking).

### Lessons and process improvements

- A correct ranking is still a form-first page on mobile unless the answer
  can travel with the header.
- Presets should write the same fields a person would type so the live
  path stays the single source of truth.
- Keep warnings outside collapsed details: they are the line the optimizer
  and eligibility tests already treat as the visible ranking signal.

### Next opportunity

Execute the official-source catalog audit by 2026-08-24 and advance both
`asOf` and `reviewBy`.

## Previous cycle: collect issuer-level current/recent card history

### Why this was selected

Workspace rotation returned here after Seeking Biblical Truth. The scheduled
full catalog audit remains 6 days early. Cycle 43 could exclude signup value
only when one of the six catalog cards implied the issuer, so an unlisted or
recently cancelled OCBC, UOB, or Standard Chartered principal card still kept
impossible welcome value and the tool told users that history was uncollected.

### Changes

- Added `issuersWithSignupLookback()` to list unique official lookback windows
  from catalog metadata.
- Added current-or-recent principal-card checkboxes independent of the six
  wallet cards, then merged those issuers into the existing eligibility set.
- Treat catalog holdings and unlisted/recent issuer marks as the same
  current-or-recent principal-card signal.
- Drop the contradictory “history is not collected” note now that the form
  asks the lookback question.
- Documented the control and bumped the deployed version to `2026.08.18.1`.

### Verification and scores

- Test-first evidence: the engine already zeroed OCBC 365 when `existingIssuers`
  contained OCBC, but the warning still said a catalog card was “held”, the
  lookback helper did not exist, and an app scenario with only a UOB recent-
  issuer mark produced an empty issuer list.
- `node tools/test-engine.mjs`: 117 passed, 0 failed (up from 113).
- `node tools/test-app.mjs`: 31 startup, event, eligibility, and render
  assertions passed (up from 27), including rendered lookback banks and
  composed recent-issuer → ranking exclusion.
- All 117 engine assertions pass under `TZ=UTC`, `America/Los_Angeles`, and
  `Pacific/Kiritimati`; 17 freshness contracts, the live deadline check
  (6 days remaining), 14 site references/fragments, catalog JSON parsing,
  recursive syntax, and `git diff --check` pass.
- Correctness/reliability: 6/10 → 10/10 (unlisted and cancelled issuer history
  can now suppress welcome value).
- Verifiability: 7/10 → 10/10 (helper, empty-metadata, unlisted OCBC, and
  composed UOB ranking contracts cover the new path).
- Maintainability: 8/10 → 9/10 (one catalog-derived issuer list drives the form
  and keeps lookback months out of hardcoded UI).
- Performance: 10/10 → 10/10 (three extra checkboxes and a tiny issuer set).
- Security/robustness: 9/10 → 9/10 (malformed lookbacks still fail closed).
- User experience: 6/10 → 9/10 (users can resolve the 6/12-month rule without
  leaving the tool).

### Lessons and process improvements

- A binary eligibility rule is only as complete as the inputs that can set it;
  catalog wallet cards are a convenience, not the official lookback domain.
- Once the form collects a signal, stop claiming that signal is uncollected.
- Derive optional form options from validated catalog metadata so a later
  issuer lookback does not require a second hardcoded bank list.

### Next opportunity

Execute the official-source catalog audit by 2026-08-24 and advance both
`asOf` and `reviewBy`.

## Previous cycle: exclude known same-issuer signup ineligibility

### Why this was selected

The scheduled full catalog audit remains 13 days early. The application already
derived issuers from cards marked in the wallet, but the engine used that fact
only for a 10-point soft penalty. A user holding OCBC INFINITY could still be
awarded OCBC 365's S$180 signup cash even though the live promotion is only for
new OCBC cardmembers; the same gap affected Standard Chartered cash and UOB
non-cash gifts.

### Changes

- Added declarative `signup.newToIssuerMonths` lookbacks: 12 months for OCBC,
  six for UOB, and 12 for Standard Chartered, matching current official terms.
- Validate optional lookbacks as positive whole months up to 120; malformed
  direct calls fail closed with no signup value and a precise warning.
- Exclude cash and gift value when the wallet identifies the same issuer, name
  the relevant lookback, and remove the contradictory older “may be weaker”
  note while retaining the issuer-overlap ranking penalty.
- When no known same-issuer holding exists, retain eligible value but disclose
  that recent closed-card history is not collected and must be confirmed.
- Extended the app harness to carry selected wallet cards through issuer
  derivation into a real recommendation; documented the rule and bumped the
  deployed version to `2026.08.11.6`.

### Verification and scores

- Official OCBC welcome terms dated 30 June 2026 require no current principal
  OCBC card and none in the prior 12 months; UOB's updated July terms require no
  current principal UOB card and no cancellation in the prior six months;
  Standard Chartered's current promotion requires neither current nor cancelled
  principal SC cards in the prior 12 months.
- Test-first evidence: 10 assertions failed on absent catalog lookbacks/schema,
  retained S$180 OCBC and S$100 SC value, missing eligibility disclosure, and
  unsafe malformed direct calls; the eligible-spend control remained green.
- Self-review added three UOB gift and truthful-note contracts; the old soft
  eligibility note failed before it was removed.
- `node tools/test-engine.mjs`: 113 passed, 0 failed (up from 99).
- `node tools/test-app.mjs`: 27 startup, event, eligibility, and render
  assertions passed (up from 25), including composed wallet → issuer → ranking
  behavior.
- All 113 engine assertions pass under `TZ=UTC`, `America/Los_Angeles`, and
  `Pacific/Kiritimati`; 17 freshness contracts, the live deadline check, 14
  site references/fragments, catalog JSON parsing, recursive syntax, and diff
  checks pass.
- Hosted CI for `2ed0474` passed every engine, freshness, deadline, site, app,
  and syntax step in 8s; GitHub Pages deployed successfully.
- The live site responds HTTP 200 and serves `2026.08.11.6` plus the new known-
  issuer eligibility and recent-history disclosure text.
- Correctness/reliability: 4/10 → 10/10 (known issuer ineligibility removes impossible signup value).
- Verifiability: 6/10 → 10/10 (three issuers, cash/gift, schema, bypass, disclosure, and app composition are covered).
- Maintainability: 7/10 → 9/10 (one declarative lookback and generic rule replace card-specific assumptions).
- Performance: 10/10 → 10/10 (one six-item issuer set and constant-time lookup per score).
- Security/robustness: 5/10 → 9/10 (malformed eligibility metadata fails toward zero promotional value).
- User experience: 5/10 → 9/10 (rankings no longer promise known-ineligible value and name uncollected history).

### Lessons and process improvements

- An issuer-overlap penalty cannot stand in for a binary official eligibility
  rule; separate ranking preference from reward qualification.
- Model the lookback as catalog data because banks use different six- and
  twelve-month definitions even for superficially similar “new customer” copy.
- Carry financial facts through a composed app test. Pure engine correctness is
  insufficient if the form never supplies the issuer signal.
- When the UI lacks enough history to decide, preserve value only with an
  explicit disclosure rather than silently assuming eligibility.
- Verification commands are code too: a first timezone loop interpolated a
  slash-containing zone into `sed` and stopped after two green runs. Replacing
  the presentation step with `printf` completed all three zones safely.

### Next opportunity

Add issuer-level current/recent-card history independent of the six catalog
cards so users can resolve the disclosed lookback instead of only confirming it
outside the tool.

## Previous cycle: evaluate offers on Singapore's calendar date

### Why this was selected

The scheduled issuer review remains 13 days early, so another catalog audit
would repeat recent work without new evidence. Runtime review instead found
that expiring offers were compared with the browser device's local calendar
date. A user outside Singapore could therefore gain or lose a day of modeled
signup value even though the catalog and product market are Singapore-specific.

### Changes

- Changed the engine's public `todayYmd()` helper to project the current instant
  into `Asia/Singapore` using `Intl.DateTimeFormat`, matching the existing
  catalog-freshness policy.
- Kept the optional instant injectable so timezone boundaries are deterministic
  in tests while the application continues calling the helper with no argument.
- Added three contracts around the exact UTC+8 midnight boundary and across the
  Singapore market day; engine coverage increased from 96 to 99 assertions.
- Documented the market-date behavior and bumped the deployed version to
  `2026.08.11.5`.

### Verification and scores

- Test-first evidence: the pre-fix helper failed the boundary contract because
  it ignored the injected instant and read local date fields from a new device-
  timezone `Date`.
- `node tools/test-engine.mjs`: 99 passed, 0 failed.
- The same 99 assertions also pass under `TZ=UTC`, `TZ=America/Los_Angeles`, and
  `TZ=Pacific/Kiritimati`, proving host timezone independence across UTC−7 to
  UTC+14.
- The full freshness, site, app, JSON, recursive syntax, diff, hosted CI, Pages,
  and live-version results are recorded in the Cycle 136 completion summary.
- Correctness/reliability: 7/10 → 10/10 (offer expiry follows the market day).
- Verifiability: 6/10 → 10/10 (both sides of UTC+8 midnight and three hostile
  host timezones are exercised directly).
- Maintainability: 8/10 → 9/10 (runtime and CI now use the same named market
  timezone convention).
- Performance: 10/10 → 10/10 (one formatter call during initial rendering).
- Security/robustness: 8/10 → 9/10 (device settings cannot shift promo state).
- User experience: 7/10 → 10/10 (traveling users see Singapore offer dates).

### Lessons and process improvements

- A market-specific financial catalog needs an explicit market clock; local
  date getters silently make user location part of the recommendation model.
- Injecting the instant into date helpers makes midnight boundaries testable
  without global fake timers.
- Run date contracts under multiple hostile `TZ` values even when the unit
  cases pass, because that proves independence from the surrounding process.

### Next opportunity

Rotate to AlpArcade and audit runtime persistence plus browser failure isolation
for the next small, reproducible correctness or verification gap.

## Previous cycle: model UOB One as fixed quarterly awards

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

- Cycle 45: shipped spend-preset chips, a sticky mobile top-fit dock, and
  glanceable ranking bars without changing engine math.
- Cycle 44: collected issuer-level current/recent principal-card history so
  unlisted and cancelled cards can exclude official welcome value.
- Cycle 43: excluded known same-issuer signup cash and gifts using official
  6/12-month lookbacks.
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

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency | Status |
|---|---|---|---|---|---|---|
| — | Recheck and extend the OCBC and SC offers into September | Process / data | High | Small / low | Official pages now end all three offers on 2026-09-30; freshness, engine, app, site, and workflow checks pass on the 2026-09-01 snapshot | Completed in Cycle 56 |
| — | Bind each dated offer to its issuer's official acquisition terms | Correctness / security / UX | High | Small / low | Engine 128 and app 86 cover required issuer-bound URLs and the top-fit action; all three distinct links returned HTTP 200 | Completed in Cycle 55 |
| — | Add ref-scoped stale/duplicate CI cancellation | Process / efficiency | Medium | Small / low | Controlled dispatch 32775252976 cancelled; replacement 32775256228 passed | Completed in Cycle 52 |
| — | Validate official URLs against each card issuer | Correctness / security | High | Small / low | Engine 124 and app 68 reject schemes, lookalikes, mismatches, and unsafe overrides | Completed in Cycle 51 |
| — | Make compare summaries style-aware and behaviorally test selection/persistence | Correctness / UX / tests | Medium-high | Small / low | Cycle 49 derives all four earning styles and exercises 65 app/storage assertions | Completed in Cycle 49 |
| — | Glanceable spend presets, sticky top-fit dock, ranking bars | UX | Medium | Small / low | 47 app assertions cover presets, dock show/hide, hero net, and tucked reasons | Completed in Cycle 45 |
| — | Collect issuer-level current/recent card history | Correctness / UX | Medium-high | Small-medium / low | Unlisted and cancelled principal cards now set the same eligibility set as catalog holdings | Completed in Cycle 44 |
| — | Exclude known same-issuer signup ineligibility | Correctness / safety | High | Small-medium / low | 117 engine and 31 app assertions cover official 6/12-month rules, cash/gift suppression, schema, bypass, and composition | Completed in Cycle 43 |
| — | Model fixed quarterly awards between UOB One thresholds | Correctness / safety | High | Small-medium / low | Nine contracts cover fixed bands, schema dependencies, and direct-call fallback | Completed in Cycle 41 |
| — | Apply intro rates only inside their acquisition window | Correctness / safety | Medium-high | Small-medium / low | Eight contracts cover time, cap, tenure, disclosure, and direct-call fallback | Completed in Cycle 40 |
| — | Model qualifying-quarter completeness for arbitrary horizons | Correctness / safety | Low-medium | Medium / medium | Declarative three-month periods now exclude incomplete quarters and preserve standard horizons | Completed in Cycle 39 |
| — | Align opposing optimizer/fuss-free toggle events | Correctness / UI tests | Medium | Small / low | Ordered event tests prove corrected controls reach the single ranking render | Completed in Cycle 38 |

## Next cycle

Local next: recheck all dated offers by 2026-09-25. Workspace next: rotate
until the next enforced financial-data deadline.
