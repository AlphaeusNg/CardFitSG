# AGENTS.md — CardFitSG

Visitor-facing docs live in [README.md](README.md). This file is for agents and local workflow.

**Live:** https://alphaeusng.github.io/CardFitSG/  
**Local:** `/home/alph/projects/CardFitSG`  
**Hub:** `/home/alph/projects/AGENTS.md`

## Purpose

Singapore fuss-free cashback card fit calculator. Educational, not financial advice. Encodes decision logic client-side from `data/cards.json`.

## Structure

```text
index.html
css/style.css
js/version.js
js/engine.js       # pure scoring
js/app.js
data/cards.json    # dated catalog — update meta.asOf when rates change
tools/test-engine.mjs
```

## Product contracts (from the former README)

- One-off + monthly spend horizon (6 / 12 / 24 months)
- Existing cards, issuer overlap, and official new-to-issuer signup lookbacks
- Current or recent principal-card history by issuer for unlisted and cancelled cards
- Fuss-free preference vs optimizer mode
- New-member intro rates bounded by their declared month/spend caps
- Signup cash and gifts excluded for known same-issuer holdings when official new-to-issuer rules apply
- Singapore-market date boundaries for expiring offers, independent of device timezone
- Selected-tier fixed awards, spend/transaction conditions, and complete-quarter reward modeling
- Amex acceptance toggle
- Ranked estimates + concrete next-step plan
- Style-aware side-by-side card comparison with official issuer links
- Direct official promotion terms beside dated top recommendations
- Local restore of the last spend scenario (no account or server)
- Copyable scenario URLs restore spend, flags, held cards, and recent issuers
- Full disclaimer: rates change; not financial advice

## Commands

```bash
cd /home/alph/projects/CardFitSG
python3 -m http.server 8092
node tools/test-engine.mjs
node tools/test-catalog-freshness.mjs
node tools/catalog-freshness.mjs
node tools/test-site.mjs
node tools/test-app.mjs
node --check js/*.js
```

## Updating rates

Verify each changed fact against the issuer's official product page and terms, then edit `data/cards.json`, update `meta.sources`, dated `signup.termsUrl` values, `meta.asOf`, and `meta.reviewBy`, bump `js/version.js`, and re-run the full suite. Set `reviewBy` before the earliest dated offer ends; daily CI fails on that date so a stale snapshot cannot age silently. Do not use comparison or affiliate sites as catalog sources.

## Conventions

- Keep fuss-free bias as default; optimizer mode is opt-in
- Always show disclaimer
- Collect issuer-level current/recent principal-card history separately from the six catalog wallet checkboxes
- Scenario share URLs encode spend, flags, held catalog cards (`hold=`), and extra recent issuers (`issuers=`)
- Bump version on deploy
