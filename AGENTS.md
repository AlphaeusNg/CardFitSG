# AGENTS.md — CardFitSG

**Live:** https://alphaeusng.github.io/CardFitSG/  
**Local:** `/home/alph/projects/CardFitSG`  
**Hub:** `/home/alph/projects/AGENTS.md`

## Purpose

Singapore fuss-free cashback card fit calculator. Educational, not financial advice.

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

## Commands

```bash
python3 -m http.server 8092
node tools/test-engine.mjs
node --check js/engine.js && node --check js/app.js
```

## Conventions

- Keep fuss-free bias as default; optimizer mode is opt-in
- Always show disclaimer
- Collect issuer-level current/recent principal-card history separately from the six catalog wallet checkboxes
- Bump version on deploy
