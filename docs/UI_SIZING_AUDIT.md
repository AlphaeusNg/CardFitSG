# UI sizing audit — 2026-10-14

Audited the real rendered calculator at 320, 375, 768 and 1280 CSS-pixel
widths, each at default and 200% root text size (eight configurations). This
text-resize check is distinct from native browser zoom. Desktop defaults remain
compact; bigger controls are retained where they support primary actions.

## Coverage and findings

- Scenario fields, presets, wallet/issuer checkboxes, two saved scenarios with
  long names, Use/Remove actions and comparison selectors.
- Top-fit actions, copy labels, expanded month breakdown, action plan, full
  ranking and rank disclosures.
- Expanded category planner and advertising inputs, method, footer and sticky
  top-fit navigation. External fonts/support were blocked to exercise fallback
  fonts without injecting third-party UI into measurements.

At 320/375px with doubled text, initial document width was 534px. Named actions,
minimum-content grid tracks and native month-input sizing contributed. After
fixes, document width equals viewport width in all eight configurations. Saved
scenario names and actions wrap, fields can shrink, and long currency/word
content stays within its card. Scenario-name input now matches the other form
fields instead of the native 21px-high unstyled input.

Checkbox labels are at least 28px high; month/rank disclosures and footer
navigation are at least 24px. Top-fit secondary actions retain the requested
32px compact style at default text size. Full-width primary form actions are
intentional. Inputs/checkboxes retain native interaction and label activation.

The sticky dock deliberately ellipsizes its compact recap; its full title and
linked top-fit card remain available. The month table deliberately scrolls in
its own container. Neither is treated as page overflow. Inline official links
remain readable inline links rather than being turned into oversized buttons.

## Verification and limits

All existing app/storage, engine, freshness, deadline, site, planner and workflow
gates passed. Render measurements covered 67 visible controls in the expanded
scenario state. Final 320px and enlarged-text screenshots were inspected.
Measurements and screenshots: `/tmp/sizing-20261014-CardFitSG-*`; these are local
audit artifacts, not deployed assets. Physical-device usability, every possible
saved name/merchant string and formal accessibility conformance are not claimed.

The audit uses [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and
[text resizing guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
These guide contextual target size/spacing and text reflow rather than impose
one size on every control.
