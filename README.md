# CardFitSG

Singapore **fuss-free cashback card** fit calculator. Rank flat cashback cards for a real spend scenario (a big trip, monthly burn, or "I already have bank X").

**[Open CardFitSG](https://alphaeusng.github.io/CardFitSG/)** · [Alphaeus Ng](https://alphaeusng.github.io/)

The live site *is* the demo. Type a spend mix, get a ranked list. Not financial advice. Rates change; check the issuer.

## Why it exists

SG card content is mostly miles maximisers. Many people want cashback, no monthly-minimum drama, a clear answer for a large near-term purchase, and honesty when a category card is the wrong tool. CardFitSG encodes that client-side from `data/cards.json`.

## Try it

1. Open **[CardFitSG](https://alphaeusng.github.io/CardFitSG/)**.
2. Enter a one-off (for example honeymoon flights) plus a monthly burn, and pick a 12-month horizon.
3. Mark cards you already hold, and whether Amex is accepted where you shop.
4. Read the ranked estimates and the next-step plan. Open the official issuer terms beside the top picks before you apply.

Last scenario restores locally. Copyable URLs restore spend, flags, held cards, and recent issuers. No account, no server.

## Develop

Zero-build HTML/CSS/JS. No backend.

```bash
python3 -m http.server 8092
# http://127.0.0.1:8092/

node tools/test-engine.mjs
node tools/test-site.mjs
node tools/test-app.mjs
```

To update rates: verify each fact on the issuer's official product page, edit `data/cards.json`, update `meta.sources`, dated `signup.termsUrl` values, `meta.asOf`, and `meta.reviewBy`, bump `js/version.js`, and re-run the suite. Do not use comparison or affiliate sites as catalog sources.

MIT © 2026 Alphaeus Ng
