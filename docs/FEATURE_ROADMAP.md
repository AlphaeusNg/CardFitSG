# Feature roadmap — researched 2026-10-13

## Chosen: optional OCBC 365 monthly category planner (CARD-07)

The generic ranking deliberately assumes base spend. Visitors cannot currently check whether their real category mix meets the monthly minimum or hits a cap. Add a folded, opt-in monthly planner beside results, outside the ranked net and share scenario. This fills the existing CARD-07 backlog without making fuss-free estimates depend on category guesses.

Primary research:

- [Official current terms, through October](https://www.ocbc.com/iwov-resources/sg/ocbc/personal/pdf/cards/tncs-governing-365-cc-cashback-programme.pdf), clauses 2A–2D and 3: category eligibility, base earn, two spend tiers, separate advertising cashback; clause 4: posted calendar-month transactions; October computes two decimals per transaction without rounding.
- [Official revised terms, from November](https://www.ocbc.com/iwov-resources/sg/ocbc/personal/pdf/cards/tncs-governing-365-cc-cashback-programme-wef1nov26.pdf), clauses 2A–2D and 3: revised category rates, Watsons end date, single tier and category cap; clause 4: posting and exclusions. Existing catalog already records these dated rates. Research confirms the planner can reuse them without changing catalog facts.
- [Issuer product page and FAQ](https://www.ocbc.com/personal-banking/cards/365-cashback-credit-card), change notice and posting-date FAQ: use the calendar month when transactions post, rather than purchase date.

Scope: start disabled; default to the current Singapore month. An independent eligible monthly total includes category allocations once; unallocated spend earns base cashback. Reject negative/nonfinite amounts, oversized totals, invalid months, and allocations above the total. Show threshold progress, applicable cap, per-category rates, base amount, and estimated monthly cashback. Advertising full-payment and posted-instalment arithmetic is a separate estimate, excluded from the planner's eligible total, lifestyle cap and generic ranking. This conservative separation does not use advertising to satisfy a lifestyle minimum. October caps the combined lifestyle/base amount; revised terms cap category cashback separately from base cashback.

October arithmetic uses monthly category totals and rounds the estimate to cents. It cannot reproduce issuer per-transaction truncation without a transaction list; the estimate visibly states that actual cashback can be lower. November terms instead round the aggregate posted amount to two decimals.

Not modeled: merchant verification/MCC assignment, excluded payments, refunds, foreign-currency fees, petrol discounts, interest, annual fees, signup awards, or transaction posting delays. The visitor must enter eligible posted transactions only, classify each once, and check the linked terms. Advertising arithmetic assumes the issuer's eligible platforms/payment route; it is not an advertised maximum or a claim that every marketing purchase qualifies. No planner inputs are saved or shared. Pre-October 2026 months are unsupported.

Acceptance:

1. Disabled/blank planner leaves ranking and URL identical to the existing app.
2. October and November use their own published rates and caps; Watsons uses base from April 2027.
3. Below-threshold spend earns base; cap reduction is visible; allocations cannot double-count the total.
4. Invalid input replaces an old estimate with a clear error. Category/advertising results remain explicitly outside ranked net.
5. Real Chromium checks on desktop and 320px confirm opt-in, arithmetic, month changes, validation, and no horizontal overflow. Full existing gates remain green.

Next priorities: preserve the 2026-10-30 official catalog review; consider a transaction-level eligibility checklist before integrating category scenarios with saved/share URLs; evaluate forecast month-by-month categories only after posting dates and future term changes are represented explicitly.


Implementation shipped with version 2026.10.14.1. Validation: existing engine (285), freshness (19), workflow (14), app and site gates, the new planner arithmetic gate, individual JS syntax checks, and two real Chromium journeys at 1280px and 320px. Browser check command (with an existing Playwright install):

```bash
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/browser/category-planner.mjs
```

Serve the repo on port 8097, or set `CARDFIT_URL` to the local preview. The browser script covers unchanged ranked results, share URL and saved scenario, along with opt-in, posting-month changes, invalid allocations, advertising separation and viewport fit.
