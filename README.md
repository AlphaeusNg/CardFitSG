# CardFitSG

**Singapore cashback card fit calculator** — rank fuss-free flat cashback cards for real spend scenarios (honeymoon tickets, monthly burn, “I already have bank X”).

**Live (after GitHub Pages):** https://alphaeusng.github.io/CardFitSG/  
**Author:** [Alphaeus Ng](https://alphaeusng.github.io/)

## Why this exists

SG card content is dominated by miles maximisers and category optimisers. Many people want:

- cashback, not miles  
- no monthly minimum drama  
- a clear answer for a **large near-term purchase**  
- honesty when a category card is the *wrong* tool  

CardFitSG encodes that decision logic client-side with a dated card catalog (`data/cards.json`).

## Features

- One-off + monthly spend horizon (6 / 12 / 24 months)
- Existing cards & issuer soft-penalties
- Fuss-free preference vs optimizer mode
- Selected-tier spend, transaction-count, and quarter-condition warnings
- Amex acceptance toggle
- Ranked estimates + concrete next-step plan
- Full disclaimer: rates change; not financial advice

## Stack

Zero-build static HTML / CSS / JS. No backend.

## Local

```bash
cd /home/alph/projects/CardFitSG
python3 -m http.server 8092
# http://127.0.0.1:8092/

node tools/test-engine.mjs
node tools/test-catalog-freshness.mjs
node tools/catalog-freshness.mjs
node tools/test-site.mjs
node tools/test-app.mjs
node --check js/*.js
```

## Updating rates

Verify each changed fact against the issuer's official product page, then edit `data/cards.json`, update `meta.sources`, `meta.asOf`, and `meta.reviewBy`, bump `js/version.js`, and re-run the full suite. Set `reviewBy` before the earliest dated offer ends; daily CI fails on that date so a stale snapshot cannot age silently. Do not use comparison or affiliate sites as catalog sources.

## License

MIT © 2026 Alphaeus Ng
