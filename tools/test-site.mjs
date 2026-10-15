import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = ["index.html", "404.html"];
const cssFiles = ["css/style.css"];
let referenceCount = 0;
let fragmentCount = 0;

function isExternal(reference) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference);
}

function assertLocalTarget(sourceFile, reference, baseFile = sourceFile) {
  const pathOnly = reference.split(/[?#]/, 1)[0];
  if (!pathOnly || isExternal(pathOnly)) return;
  assert(!pathOnly.startsWith("/"), `${sourceFile} uses root-absolute local path ${reference}`);

  const target = resolve(root, dirname(baseFile), pathOnly);
  const escapedRoot = relative(root, target).startsWith(`..${sep}`) || relative(root, target) === "..";
  assert(!escapedRoot, `${sourceFile} reference escapes repository root: ${reference}`);
  assert(existsSync(target), `${sourceFile} references missing ${reference}`);
  referenceCount++;
}

for (const htmlFile of htmlFiles) {
  const source = readFileSync(resolve(root, htmlFile), "utf8");
  const ids = new Set([...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
  for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
    const reference = match[1];
    if (reference.startsWith("#")) {
      assert(ids.has(reference.slice(1)), `${htmlFile} references missing fragment ${reference}`);
      fragmentCount++;
    } else {
      assertLocalTarget(htmlFile, reference);
    }
  }

  const refresh = /http-equiv=["']refresh["'][^>]*content=["'][^"']*?url=([^"';\s]+)[^"']*["']/i.exec(
    source
  );
  if (refresh) assertLocalTarget(htmlFile, refresh[1]);
}

for (const cssFile of cssFiles) {
  const source = readFileSync(resolve(root, cssFile), "utf8");
  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    assertLocalTarget(cssFile, match[1]);
  }
}

const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.start_url, "./", "manifest start_url must remain project-relative");
assert.equal(manifest.display, "standalone", "manifest must use standalone display mode");
assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i, "manifest theme_color must be a hex colour");

const index = readFileSync(resolve(root, "index.html"), "utf8");
assert.match(index, /id="asof-label"/, "as-of date label remains for the catalog stamp");
assert.match(index, /id="review-by-label"/, "review-by date sits next to the as-of stamp");
assert.match(index, /id="catalog-review-banner"/, "overdue catalog review banner exists");
assert.doesNotMatch(index, /Most SG card blogs/, "hero no longer carries the manifesto lede");
assert.match(
  index,
  /<nav class="top-nav"[^>]*>\s*<a href="https:\/\/alphaeusng\.github\.io\/">Portfolio<\/a>\s*<\/nav>/,
  "desktop top-nav keeps Portfolio only"
);
assert.match(index, /<a href="#method">Method<\/a>/, "Method remains reachable from the footer");
assert.match(
  index,
  /<a href="#disclaimer-block">Disclaimer<\/a>/,
  "Disclaimer remains reachable from the footer"
);
const runtimeScripts = ["js/version.js", "js/engine.js", "js/scenario.js", "js/category-planner.js", "js/app.js"];
const loadedScripts = [...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
let previousScriptIndex = -1;
for (const script of runtimeScripts) {
  const scriptIndex = loadedScripts.findIndex((src) => src.split(/[?#]/, 1)[0] === script);
  assert(scriptIndex >= 0, `index.html must load ${script}`);
  assert(scriptIndex > previousScriptIndex, `${script} loads out of order`);
  previousScriptIndex = scriptIndex;
}

const app = readFileSync(resolve(root, "js/app.js"), "utf8");
const preloadTag = /<link\b[^>]*\bid=["']catalog-preload["'][^>]*>/i.exec(index)?.[0];
assert(preloadTag, "the card catalog has a dedicated preload");
const catalogPath = /\bhref=["']([^"']+)["']/.exec(preloadTag)?.[1];
assert(catalogPath, "catalog preload must have an href");
assertLocalTarget("index.html", catalogPath);
assert.match(preloadTag, /\brel=["']preload["']/i, "catalog hint is a preload");
assert.match(preloadTag, /\bas=["']fetch["']/i, "catalog preload has fetch semantics");
const versionSource = readFileSync(resolve(root, "js/version.js"), "utf8");
const siteVersion = /\bid:\s*["']([^"']+)["']/.exec(versionSource)?.[1];
assert(siteVersion, "version.js must declare a site version");
const stylesheet = /<link\b[^>]*href="(css\/style\.css[^"]*)"/.exec(index)?.[1];
assert(stylesheet, "the local stylesheet is loaded");
for (const asset of [stylesheet, ...loadedScripts.filter((src) => src.startsWith("js/"))]) {
  assert.equal(new URL(asset, "https://example.test/").searchParams.get("v"), siteVersion,
    `${asset} refreshes cached assets for this deployment`);
}
assert.equal(
  new URL(catalogPath, "https://example.test/").searchParams.get("v"),
  siteVersion,
  "catalog preload query matches the deploy version"
);
assert.match(app, /catalog-preload[\s\S]*getAttribute\(["']href["']\)/, "fetch reuses the exact preload URL");
assert.doesNotMatch(app, /cache:\s*["']no-cache["']/, "catalog fetch may reuse HTTP cache between deploys");
assert.match(app, /function paintRankedList/, "ranking is split from the top-fit panel");
assert.match(app, /function cancelRankedPaint/, "stale ranked paints cancel on newer runs");
assert.match(app, /rankedPaintFrame = requestAnimationFrame/, "ranked list waits one animation frame");
assert.match(app, /\$\(["']#plan["']\)\.innerHTML = result\.zeroSpend/, "plan paints with primary before ranked frame");
const engine = readFileSync(resolve(root, "js/engine.js"), "utf8");
const scenario = readFileSync(resolve(root, "js/scenario.js"), "utf8");
const maxSpend = /const MAX_SPEND\s*=\s*([\deE+.-]+)/.exec(engine)?.[1];
assert(maxSpend, "engine declares a maximum supported spend");
assert.match(
  scenario,
  /function parseFiniteAmount[\s\S]*?return clampSpend\(n\)/,
  "URL and saved amounts normalize through the shared spend boundary"
);
assert.match(
  app,
  /CardFitEngine\.clampSpend/,
  "scenario parsing is wired to the engine spend boundary"
);
for (const inputId of ["oneOff", "monthly"]) {
  const input = new RegExp(`<input\\b[^>]*\\bid=["']${inputId}["'][^>]*>`, "i").exec(index)?.[0];
  assert(input, `${inputId} amount input exists`);
  assert.equal(
    /\bmax=["']([^"']+)["']/i.exec(input)?.[1],
    String(Number(maxSpend)),
    `${inputId} exposes the same maximum enforced by the engine`
  );
}

const disclosureSpecs = [
  { id: "more-options-toggle", region: "more-options", label: "More options (cards held, preferences)", source: index },
  { id: "saved-scenarios-toggle", region: "saved-scenarios-panel", label: "Saved scenarios", source: index },
  { id: "compare-tools-toggle", region: "compare-tools", label: "Compare cards and scenarios", source: index },
  { id: "method-details-toggle", region: "method-details", label: "How scoring works: details", source: index },
  { id: "primary-details-toggle", region: "primary-details", label: "Why this card", source: app },
  { id: "primary-more-toggle", region: "primary-more", label: "More", source: app },
];

function visibleLabel(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

for (const spec of disclosureSpecs) {
  const button = new RegExp(`<button\\b[^>]*\\bid=["']${spec.id}["'][^>]*>[\\s\\S]*?<\\/button>`).exec(spec.source);
  assert(button, `${spec.id} exists`);
  const open = /^<button\b[^>]*>/.exec(button[0])?.[0] || "";
  assert.match(open, /\btype=["']button["']/, `${spec.id} is a real button`);
  assert.match(open, /\bclass=["'][^"']*\bdisclosure-toggle\b/, `${spec.id} uses the disclosure class`);
  assert.match(open, /\baria-expanded=["']false["']/, `${spec.id} starts collapsed`);
  assert.match(open, new RegExp(`\\baria-controls=["']${spec.region}["']`), `${spec.id} points at ${spec.region}`);
  assert.doesNotMatch(open, /\baria-label=/, `${spec.id} does not hide its label in aria-label`);
  assert.equal(visibleLabel(button[0]), spec.label, `${spec.id} shows its label`);
  const region = new RegExp(`<(?:div|section)\\b[^>]*\\bid=["']${spec.region}["'][^>]*>`).exec(spec.source);
  assert(region, `${spec.region} exists`);
  assert.match(region[0], /\bhidden\b/, `${spec.region} is hidden until opened`);
}

function sliceById(html, id) {
  const open = new RegExp(`<(div|section)\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i").exec(html);
  assert(open, `${id} can be sliced`);
  const tag = open[1].toLowerCase();
  const rest = html.slice(open.index + open[0].length);
  const token = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  let depth = 1;
  let match;
  while ((match = token.exec(rest))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(open.index, open.index + open[0].length + match.index + match[0].length);
  }
  assert.fail(`${id} is unclosed`);
}

const moreOptions = sliceById(index, "more-options");
assert.match(moreOptions, /id="existing-cards"/, "held cards stay inside more options");
assert.match(moreOptions, /id="recent-issuers"/, "recent issuers stay inside more options");
assert.match(moreOptions, /id="fussFree"/, "fuss-free stays inside more options");
assert.match(moreOptions, /id="amexOk"/, "Amex acceptance stays inside more options");
assert.match(moreOptions, /id="optimizer"/, "optimizer stays inside more options");
assert.doesNotMatch(moreOptions, /id="oneOff"/, "one-off spend stays outside more options");
assert.doesNotMatch(moreOptions, /id="monthly"/, "monthly spend stays outside more options");
assert.doesNotMatch(moreOptions, /id="months"/, "horizon stays outside more options");
assert.doesNotMatch(moreOptions, /id="goal"/, "goal stays outside more options");
assert.doesNotMatch(moreOptions, /id="scenario-presets"/, "presets stay outside more options");

const savedPanel = sliceById(index, "saved-scenarios-panel");
assert.match(savedPanel, /id="scenario-name"/, "scenario name stays in the saved panel");
assert.match(savedPanel, /id="save-named-scenario"/, "save stays in the saved panel");
assert.match(savedPanel, /id="named-scenario-status"/, "save status stays in the saved panel");
assert.match(savedPanel, /id="named-scenario-list"/, "saved list stays in the saved panel");
assert.doesNotMatch(savedPanel, /Recalculate fit/, "Recalculate fit stays outside the saved panel");
assert.match(index, /<button type="submit" class="btn">Recalculate fit<\/button>/, "Recalculate fit remains the submit control");

const compareTools = sliceById(index, "compare-tools");
assert.match(compareTools, /aria-label="Compare two cards"/, "card comparison is inside compare tools");
assert.match(compareTools, /aria-label="Compare two spending assumptions"/, "assumption comparison is inside compare tools");
assert.match(compareTools, /id="compare-a"/, "card comparison controls stay wired");
assert.match(compareTools, /id="assumption-b"/, "assumption comparison controls stay wired");
assert.doesNotMatch(compareTools, /id="category-planner"/, "the category planner stays outside compare tools");
assert.doesNotMatch(compareTools, /id="ranked"/, "the full ranking stays outside compare tools");

const method = sliceById(index, "method");
const methodDetails = sliceById(index, "method-details");
const methodVisible = method.replace(methodDetails, "");
assert.match(methodDetails, /Estimates cash from published/, "scoring bullets move into the details");
assert.match(methodVisible, /id="asof-label"/, "the rates-as-of line stays visible");
assert.match(methodVisible, /id="review-by-line"/, "the review-by line stays visible");
assert.match(methodVisible, /id="review-by-label"/, "the review-by date stays visible");
assert.doesNotMatch(methodVisible, /Estimates cash from published/, "scoring bullets are not left beside the rates line");
assert.match(index, /id="catalog-review-banner"/, "catalog review banner stays in the page");

assert.match(app, /closest\(\s*["']\.disclosure-toggle["']\s*\)/, "one delegated handler finds disclosure toggles");
assert.match(app, /setAttribute\(\s*["']aria-expanded["']/, "the handler flips aria-expanded");
assert.match(app, /region\.hidden\s*=\s*expanded/, "the handler flips the region's hidden state");
assert.match(app, /id="primary-details" hidden/, "rendered top-fit details start hidden");
assert.match(app, /id="primary-more" hidden/, "rendered top-fit extra actions start hidden");
assert.match(app, /Official product page[\s\S]*primary-details-toggle/, "the official link stays ahead of Why this card");

const css = readFileSync(resolve(root, "css/style.css"), "utf8");
const toggleRule = /\.disclosure-toggle\s*\{([^}]+)\}/.exec(css);
assert(toggleRule, "disclosure toggles have a style rule");
assert.match(toggleRule[1], /min-height:\s*32px/, "disclosure toggles meet the 32px target height");
assert.match(toggleRule[1], /min-width:\s*32px/, "disclosure toggles meet the 32px target width");
assert.match(css, /\.disclosure-toggle::after\s*\{[^}]*transform:\s*rotate\(/, "disclosure toggles show a chevron");
const expandedChevron = /\.disclosure-toggle\[aria-expanded="true"\]::after\s*\{([^}]+)\}/.exec(css);
assert(expandedChevron, "the chevron has an expanded state");
assert.match(expandedChevron[1], /transform:\s*rotate\(/, "the chevron rotates when aria-expanded is true");

console.log(
  `test-site.mjs: ${referenceCount} local references and ${fragmentCount} fragments verified`
);
