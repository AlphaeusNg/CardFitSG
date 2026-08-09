# CardFitSG continuous improvement log

Last updated: 2026-08-10 (Cycle 72 across the projects workspace; CardFitSG Cycle 35)

## Current state

- Branch: `main`; improvements are committed locally and not yet pushed.
- Runtime: zero-build static HTML/CSS/JavaScript.
- Verification: `node tools/test-engine.mjs` (71 assertions), `node tools/test-site.mjs` (14 references/fragments), `node tools/test-app.mjs` (17 assertions), JavaScript syntax checks, and repository CI configuration.
- Catalog snapshot: all six cards were checked against official issuer pages on 2026-08-09; `data/cards.json` declares the same `asOf` date.
- UOB One's optimizer condition was reverified against UOB's product page, full terms, and FAQ on 2026-08-10.

## Latest cycle: surface UOB One optimizer conditions

### Why this was selected

Optimizer mode assigned UOB One its equivalent 3.33% tier value when monthly spend cleared S$600/S$1,000/S$2,000, but results showed only a generic optimizer note. Users were not warned that the selected quarterly tier also requires at least 10 eligible purchases in each statement month for all three months of their qualifying quarter.

### Changes

- Reverified the current S$60/S$100/S$200 quarterly tiers and 10-purchase statement-month requirement against first-party UOB sources.
- Rewrote each tier note as a complete selected-tier condition: spend and 10 eligible purchases in each statement month for all three months of the qualifying quarter.
- Replaced rate-only tier lookup with the highest qualifying spend tier, so S$1,000 results surface S$100—not the equal-rate S$60 tier's copy.
- Promoted the selected tier note to a highlighted optimizer warning only when the minimum is met and tier value is actually estimated.
- Made tier notes mandatory in catalog validation and added engine plus rendered-ranking regressions.

### Verification and scores

- Source evidence: UOB's [current product page](https://www.uob.com.sg/personal/cards/cashback/one-card.page/), [full card terms](https://www.uob.com.sg/assets/pdfs/one_card_full_tnc.pdf), and [FAQ](https://www.uob.com.sg/assets/pdfs/uob-one-credit-card-faq.pdf) all state that qualifying spend and at least 10 purchases must be met in each statement month of the three-month qualifying quarter.
- Test-first evidence: the engine finished with 69 passes and one failure because a qualifying S$1,000 optimizer score contained no quarterly-condition warning.
- `node tools/test-engine.mjs`: 71 passed, 0 failed.
- `node tools/test-app.mjs`: 17 startup/render assertions passed; the real app renders the selected S$100 tier condition in the full ranking.
- `node tools/test-site.mjs`: 9 local references and 5 fragments verified.
- `node --check js/*.js`: passed.
- `node --check tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (the warning follows the actual selected spend tier).
- Verifiability: 10/10 (official sources, engine output, catalog validation, and rendered HTML agree).
- Maintainability: 9/10 (conditions live with tier data instead of card-ID-specific UI code).
- User safety: 10/10 (estimated cashback no longer hides its transaction-count and quarter requirements).
- Performance: 10/10 (one tier object replaces a rate lookup; runtime complexity is unchanged).

### Lessons and process improvements

- When rates are equal across spend tiers, selecting by highest eligible threshold is necessary to preserve the correct cap and condition copy.
- Conditions that decide whether modeled value exists belong in highlighted warnings, not generic methodology notes.
- Use issuer terminology precisely: “statement month” and “qualifying quarter” are not interchangeable with calendar months.
- Keep financial-condition copy data-driven and validate its presence so future catalog refreshes cannot silently drop it.

## Previous cycle

- Cycle 35: surfaced official UOB One statement-month and qualifying-quarter conditions in optimizer results.
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
| 1 | Schedule the next official-source catalog audit before the earliest active offer expires | Process / data | High | Small / low | OCBC and SC offers in this snapshot end 2026-08-31 |
| 2 | Add interaction tests for opposing optimizer/fuss-free toggles | UI tests | Low | Small / low | Startup rendering is covered; event callbacks are currently mocked but not invoked |
| 3 | Model qualifying-quarter completeness for arbitrary horizons | Correctness / safety | Low-medium | Medium / medium | Current UI horizons are 6/12/24 months, but direct engine callers can request fewer than three months |

## Next cycle

Local next: schedule and execute the next full official-source catalog audit before the 2026-08-31 OCBC/SC offer expiries. Workspace next: pivot to VerseKeep's high-impact browser startup/navigation coverage rather than continue into lower-leverage CardFitSG UI work.
