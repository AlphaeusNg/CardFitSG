import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(resolve(root, "data/cards.json"), "utf8"));
const engineSource = readFileSync(resolve(root, "js/engine.js"), "utf8");
const appSource = readFileSync(resolve(root, "js/app.js"), "utf8");

function makeElement(initial = {}) {
  const classes = new Set();
  const listeners = new Map();
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    offsetHeight: 64,
    addEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    dispatch(type, event = {}) {
      const dispatched = {
        preventDefault() {},
        ...event,
      };
      for (const listener of listeners.get(type) || []) listener(dispatched);
    },
    matches() {
      return false;
    },
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : !!force;
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
    },
    getAttribute() {
      return null;
    },
    setAttribute() {},
    removeAttribute() {},
    ...initial,
  };
}

function makeDocument(existingCardIds = [], recentIssuers = []) {
  const elements = Object.fromEntries(
    [
      "fatal",
      "asof-label",
      "disclaimer",
      "rates-note",
      "existing-cards",
      "recent-issuers",
      "form",
      "oneOff",
      "monthly",
      "months",
      "goal",
      "fussFree",
      "optimizer",
      "amexOk",
      "primary",
      "plan",
      "ranked",
      "site-version",
      "top-fit-dock",
      "compare-a",
      "compare-b",
      "compare-out",
    ].map((id) => [id, makeElement()])
  );
  elements.fatal.hidden = true;
  elements["top-fit-dock"].hidden = true;
  elements["top-fit-dock"].textContent = "Top fit";
  elements.oneOff.value = "3500";
  elements.monthly.value = "1200";
  elements.months.value = "12";
  elements.goal.value = "acquire";
  elements.fussFree.checked = true;

  const topbar = makeElement();
  const formControls = [
    elements.oneOff,
    elements.monthly,
    elements.months,
    elements.goal,
    elements.fussFree,
    elements.optimizer,
    elements.amexOk,
  ];
  const existingBoxes = catalog.cards.map((card) =>
    makeElement({ value: card.id, checked: existingCardIds.includes(card.id) })
  );
  const recentIssuerBoxes = [...new Set(catalog.cards.map((card) => card.issuer))].map((issuer) =>
    makeElement({ value: issuer, checked: recentIssuers.includes(issuer) })
  );
  const presetButtons = [
    makePresetButton("3500", "1200"),
    makePresetButton("0", "1200"),
    makePresetButton("8000", "1200"),
  ];
  elements.presets = presetButtons;
  elements.existingBoxes = existingBoxes;
  elements.recentIssuerBoxes = recentIssuerBoxes;

  return {
    elements,
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector(selector) {
        if (selector === ".topbar") return topbar;
        const id = /^#([\w-]+)$/.exec(selector)?.[1];
        return id ? elements[id] || null : null;
      },
      querySelectorAll(selector) {
        if (selector === "#form input, #form select") return formControls;
        if (selector === 'input[name="existing"]') return existingBoxes;
        if (selector === 'input[name="existing"]:checked') {
          return existingBoxes.filter((box) => box.checked);
        }
        if (selector === 'input[name="recent-issuer"]') return recentIssuerBoxes;
        if (selector === 'input[name="recent-issuer"]:checked') {
          return recentIssuerBoxes.filter((box) => box.checked);
        }
        if (selector === "[data-preset]") return presetButtons;
        return [];
      },
    },
  };
}

function makePresetButton(oneOff, monthly) {
  const attrs = {
    "data-preset": "",
    "data-one-off": String(oneOff),
    "data-monthly": String(monthly),
    "aria-pressed": "false",
  };
  return makeElement({
    dataset: { oneOff: String(oneOff), monthly: String(monthly) },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
  });
}

function makeStorage(initialValue) {
  const values = new Map();
  if (initialValue !== undefined) values.set("cardfitsg-last-scenario-v1", initialValue);
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

async function boot(
  response,
  { existingCardIds = [], recentIssuers = [], savedScenario, search = "" } = {}
) {
  const { document, elements } = makeDocument(existingCardIds, recentIssuers);
  const errors = [];
  const scenarios = [];
  const recommendations = [];
  const replacedUrls = [];
  const localStorage = makeStorage(savedScenario);
  const location = {
    href: `https://alphaeusng.github.io/CardFitSG/${search}`,
    pathname: "/CardFitSG/",
    search,
    hash: "",
  };
  const sandbox = {
    window: {
      scrollY: 0,
      addEventListener() {},
    },
    location,
    history: {
      replaceState(_state, _title, url) {
        replacedUrls.push(String(url));
        const next = new URL(String(url), "https://alphaeusng.github.io");
        location.href = next.toString();
        location.pathname = next.pathname;
        location.search = next.search;
        location.hash = next.hash;
      },
    },
    document,
    fetch: async () => response,
    console: {
      log() {},
      warn() {},
      error(...args) {
        errors.push(args.map(String).join(" "));
      },
    },
    requestAnimationFrame(callback) {
      callback();
    },
    URL,
    URLSearchParams,
    localStorage,
    setTimeout,
    clearTimeout,
    SITE_VERSION: { id: "test-version" },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(engineSource, sandbox, { filename: "js/engine.js" });
  sandbox.CardFitEngine = sandbox.window.CardFitEngine;
  const recommend = sandbox.CardFitEngine.recommend;
  sandbox.CardFitEngine.recommend = (database, scenario) => {
    scenarios.push({ ...scenario });
    const recommendation = recommend(database, scenario);
    recommendations.push(recommendation);
    return recommendation;
  };
  vm.runInContext(appSource, sandbox, { filename: "js/app.js" });
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  return { elements, errors, localStorage, sandbox, scenarios, recommendations, replacedUrls };
}

{
  const result = await boot(
    {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(catalog));
      },
    },
    { existingCardIds: ["ocbc-infinity"] }
  );
  assert.equal(
    result.scenarios[0].existingIssuers.join(","),
    "OCBC",
    "wallet selections derive issuer-level eligibility input"
  );
  assert.equal(
    result.recommendations[0].ranked.find((score) => score.card.id === "ocbc-365").signupCash,
    0,
    "composed app ranking excludes same-issuer OCBC signup cash"
  );
}

{
  const result = await boot(
    {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(catalog));
      },
    },
    { recentIssuers: ["UOB"] }
  );
  assert.equal(
    result.scenarios[0].existingIssuers.join(","),
    "UOB",
    "unlisted or recent issuer history reaches the recommendation scenario"
  );
  assert.equal(
    result.recommendations[0].ranked.find((score) => score.card.id === "uob-absolute").signupCash,
    0,
    "composed app ranking excludes UOB signup value from recent issuer history"
  );
  assert.match(
    result.elements.ranked.innerHTML,
    /current or recent UOB card/i,
    "recent issuer exclusion is visible in the ranking"
  );
}

{
  const unsafeCatalog = JSON.parse(JSON.stringify(catalog));
  unsafeCatalog.meta.sources[0] = "javascript:alert('unsafe')";
  const result = await boot({
    ok: true,
    status: 200,
    async json() {
      return unsafeCatalog;
    },
  });
  assert.equal(result.elements.fatal.hidden, false, "unsafe official links fail startup closed");
  assert(
    result.errors.some((error) => /meta\.sources\[0\].*HTTPS/i.test(error)),
    "unsafe link details are logged"
  );
  assert.equal(result.elements.primary.innerHTML, "", "unsafe links never reach recommendation markup");
}

{
  const result = await boot({
    ok: true,
    status: 200,
    async json() {
      return JSON.parse(JSON.stringify(catalog));
    },
  });
  assert.equal(result.elements.fatal.hidden, true, "valid startup keeps fatal state hidden");
  assert.equal(result.errors.length, 0, "valid startup logs no errors");
  assert.equal(result.elements["asof-label"].textContent, catalog.meta.asOf, "audit date renders");
  assert.match(result.elements["existing-cards"].innerHTML, /ocbc-infinity/, "wallet options render");
  assert.match(
    result.elements["recent-issuers"].innerHTML,
    /name="recent-issuer"[\s\S]*OCBC[\s\S]*Standard Chartered[\s\S]*UOB/,
    "issuer-history options render official lookback banks"
  );
  assert.match(result.elements.primary.innerHTML, /Top fit for your inputs/, "primary recommendation renders");
  assert.match(result.elements.primary.innerHTML, /Official product page/, "top fit links to the official issuer page");
  assert.match(result.elements["compare-a"].innerHTML, /ocbc-infinity/, "compare lists catalog cards");
  assert.match(result.elements["compare-out"].innerHTML, /Official page/, "compare surfaces official product links");
  assert.match(result.elements["compare-out"].innerHTML, /1\.6% flat/, "flat comparison labels the flat rate");
  assert.match(appSource, /cardfitsg-last-scenario-v1/, "app remembers the last scenario locally");
  assert.equal(
    (result.elements.ranked.innerHTML.match(/<article/g) || []).length,
    catalog.cards.length,
    "every catalog card renders in the ranking"
  );
  assert.match(result.elements.ranked.innerHTML, /rank-hero/, "ranking makes S$ net the hero number");
  assert.match(result.elements.ranked.innerHTML, /rank-bar-fill/, "ranking includes glanceable net bars");
  assert.match(result.elements.ranked.innerHTML, /<details class="rank-why">[\s\S]*Why this rank/, "ranking tucks reasons into details");
  assert.equal(result.elements["top-fit-dock"].hidden, false, "top-fit dock shows when a ranking exists");
  assert.match(
    result.elements["top-fit-dock"].textContent,
    new RegExp(`Top fit · ${result.recommendations[0].primary.card.name} · S\\$.+ · .+%`),
    "dock summarizes the top card, net, and rate"
  );
  assert.match(result.elements.plan.innerHTML, /plan-steps/, "action plan renders");
  assert.equal(result.elements["site-version"].textContent, "test-version", "version renders");
  assert.equal(typeof result.sandbox.window.CardFitApp.run, "function", "app API is exposed");
  assert.equal(
    result.elements.presets[0].classList.contains("is-active"),
    true,
    "default honeymoon amounts mark the matching preset"
  );

  const presetRuns = result.scenarios.length;
  result.elements.presets[1].dispatch("click");
  assert.equal(result.elements.oneOff.value, "0", "monthly-only preset clears the one-off amount");
  assert.equal(result.elements.monthly.value, "1200", "monthly-only preset keeps monthly spend");
  assert.equal(result.scenarios.length, presetRuns + 1, "preset click triggers a live ranking update");
  assert.equal(result.scenarios.at(-1).oneOff, 0, "preset ranking uses the one-off amount");
  assert.equal(result.scenarios.at(-1).monthly, 1200, "preset ranking uses the monthly amount");
  assert.equal(result.elements.presets[1].classList.contains("is-active"), true, "selected preset is marked active");
  assert.equal(result.elements.presets[0].classList.contains("is-active"), false, "unselected presets are not active");

  result.elements.presets[2].dispatch("click");
  assert.equal(result.elements.oneOff.value, "8000", "big-trip preset sets the one-off amount");
  assert.equal(result.scenarios.at(-1).oneOff, 8000, "big-trip ranking uses the one-off amount");

  result.elements["compare-a"].value = "uob-one";
  result.elements["compare-a"].dispatch("change");
  result.elements["compare-b"].value = "ocbc-365";
  result.elements["compare-b"].dispatch("change");
  assert.match(result.elements["compare-out"].innerHTML, /<b>UOB One<\/b>/, "compare selection renders card A");
  assert.match(result.elements["compare-out"].innerHTML, /<b>OCBC 365<\/b>/, "compare selection renders card B");
  assert.match(
    result.elements["compare-out"].innerHTML,
    /S\$60–S\$200 per 3-month qualifying period from S\$600–S\$2,000\/month/,
    "tiered comparison describes fixed published awards instead of a zero base rate"
  );
  assert.match(
    result.elements["compare-out"].innerHTML,
    /0\.25% base · category rates up to 6\.0% from S\$800\/month/,
    "category comparison distinguishes the base and conditional category rates"
  );
  assert.doesNotMatch(
    result.elements["compare-out"].innerHTML,
    /UOB One[\s\S]*0\.0% base/,
    "tiered comparison never presents the card as a zero-rate product"
  );
  result.elements["compare-a"].value = "amex-true";
  result.elements["compare-a"].dispatch("change");
  assert.match(
    result.elements["compare-out"].innerHTML,
    /3\.0% intro on first S\$5,000 within 6 months · then 1\.5% flat/,
    "intro comparison distinguishes the capped acquisition rate from the ongoing rate"
  );

  const startupRuns = result.scenarios.length;
  result.elements.optimizer.checked = true;
  result.elements.optimizer.dispatch("change");
  assert.equal(result.elements.fussFree.checked, false, "optimizer mode disables fuss-free mode");
  assert.equal(result.scenarios.length, startupRuns + 1, "optimizer change renders exactly once");
  assert.equal(result.scenarios.at(-1).preferFussFree, false, "optimizer render uses corrected fuss-free state");
  assert.equal(result.scenarios.at(-1).optimizerMode, true, "optimizer render enables optimizer scoring");

  const optimizerRuns = result.scenarios.length;
  result.elements.fussFree.checked = true;
  result.elements.fussFree.dispatch("change");
  assert.equal(result.elements.optimizer.checked, false, "fuss-free mode disables optimizer mode");
  assert.equal(result.scenarios.length, optimizerRuns + 1, "fuss-free change renders exactly once");
  assert.equal(result.scenarios.at(-1).preferFussFree, true, "fuss-free render enables simple scoring");
  assert.equal(result.scenarios.at(-1).optimizerMode, false, "fuss-free render uses corrected optimizer state");

  result.elements.oneOff.value = "0";
  result.elements.monthly.value = "1000";
  result.elements.fussFree.checked = false;
  result.elements.optimizer.checked = true;
  result.sandbox.window.CardFitApp.run();
  assert.match(
    result.elements.ranked.innerHTML,
    /S\$100 quarterly cashback[^<]*10 eligible purchases[^<]*each statement month/i,
    "optimizer ranking renders UOB One's selected-tier conditions"
  );

  result.elements.oneOff.value = "0";
  result.elements.monthly.value = "0";
  result.sandbox.window.CardFitApp.run();
  assert.equal(result.elements["top-fit-dock"].hidden, true, "dock hides when spend is empty");
}

{
  const saved = JSON.stringify({
    oneOff: 900,
    monthly: 1800,
    months: 24,
    intent: "long_term",
    preferFussFree: true,
    optimizerMode: true,
    amexOk: true,
  });
  const result = await boot(
    {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(catalog));
      },
    },
    { savedScenario: saved }
  );
  assert.equal(result.elements.oneOff.value, 900, "saved one-off spend is restored");
  assert.equal(result.elements.monthly.value, 1800, "saved monthly spend is restored");
  assert.equal(result.elements.months.value, "24", "saved horizon is restored");
  assert.equal(result.elements.goal.value, "long_term", "saved goal is restored");
  assert.equal(result.elements.fussFree.checked, true, "saved fuss-free preference is restored");
  assert.equal(result.elements.optimizer.checked, false, "conflicting saved modes recover to fuss-free");
  assert.equal(result.elements.amexOk.checked, true, "saved Amex preference is restored");
  assert.equal(result.scenarios.at(-1).monthly, 1800, "first ranking uses the recovered scenario");
}

{
  const result = await boot(
    {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(catalog));
      },
    },
    { savedScenario: "{not-json" }
  );
  assert.equal(result.elements.oneOff.value, "3500", "malformed saved state preserves default one-off spend");
  assert.equal(result.scenarios.at(-1).monthly, 1200, "malformed saved state still produces the default ranking");
  assert.doesNotThrow(
    () => JSON.parse(result.localStorage.getItem("cardfitsg-last-scenario-v1")),
    "the next run replaces malformed saved state with valid JSON"
  );
}

{
  const result = await boot({
    ok: true,
    status: 200,
    async json() {
      return { meta: catalog.meta, cards: [] };
    },
  });
  assert.equal(result.elements.fatal.hidden, false, "invalid catalog shows fatal state");
  assert.equal(result.elements.fatal.textContent, "Could not load card database.", "invalid catalog is user-safe");
  assert(result.errors.some((error) => /invalid catalog/.test(error)), "invalid catalog details are logged");
  assert.equal(result.elements["existing-cards"].innerHTML, "", "invalid catalog does not partially render");
}

{
  const result = await boot({ ok: false, status: 503 });
  assert.equal(result.elements.fatal.hidden, false, "HTTP failure shows fatal state");
  assert.equal(result.elements.fatal.textContent, "Could not load card database.", "HTTP failure is user-safe");
  assert(result.errors.some((error) => /HTTP 503/.test(error)), "HTTP status is logged for diagnosis");
}

{
  const result = await boot(
    {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(catalog));
      },
    },
    {
      savedScenario: JSON.stringify({
        oneOff: 900,
        monthly: 1800,
        months: 24,
        intent: "long_term",
        preferFussFree: true,
        optimizerMode: false,
        amexOk: true,
      }),
      search: "?oneOff=8000&monthly=0&months=6",
    }
  );
  assert.equal(result.elements.oneOff.value, 8000, "shared URL one-off overrides saved scenario");
  assert.equal(result.elements.monthly.value, 0, "shared URL monthly overrides saved scenario");
  assert.equal(result.elements.months.value, "6", "shared URL horizon overrides saved scenario");
  assert.equal(result.elements.goal.value, "acquire", "shared URL goal overrides saved scenario");
  assert.equal(result.elements.amexOk.checked, false, "shared URL Amex flag overrides saved scenario");
  assert.match(
    result.sandbox.window.CardFitApp.scenarioSearch(result.scenarios.at(-1)),
    /oneOff=8000/,
    "live ranking is encoded back into the share query"
  );
  assert(
    result.replacedUrls.some((url) => url.includes("oneOff=8000") && url.includes("months=6")),
    "boot writes the canonical share URL"
  );
  assert.match(
    result.elements.primary.innerHTML,
    /id="copy-link"/,
    "top fit exposes a copy-link control"
  );
}

{
  const result = await boot(
    {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(catalog));
      },
    },
    { search: "?oneOff=3500&monthly=1200&hold=ocbc-infinity&issuers=UOB" }
  );
  assert.deepEqual(
    result.elements.existingBoxes.filter((box) => box.checked).map((box) => box.value),
    ["ocbc-infinity"],
    "shared URL restores held catalog cards"
  );
  assert.deepEqual(
    result.elements.recentIssuerBoxes.filter((box) => box.checked).map((box) => box.value),
    ["UOB"],
    "shared URL restores recent issuer history"
  );
  assert.equal(
    result.scenarios.at(-1).existingCardIds.join(","),
    "ocbc-infinity",
    "restored wallet reaches ranking"
  );
  assert.equal(
    result.scenarios.at(-1).recentIssuers.join(","),
    "UOB",
    "restored issuer history reaches ranking"
  );
  assert.equal(
    result.recommendations.at(-1).ranked.find((score) => score.card.id === "ocbc-365").signupCash,
    0,
    "shared OCBC wallet excludes same-issuer signup cash"
  );
  assert.equal(
    result.recommendations.at(-1).ranked.find((score) => score.card.id === "uob-absolute").signupCash,
    0,
    "shared UOB history excludes UOB signup cash"
  );
  const encoded = result.sandbox.window.CardFitApp.scenarioSearch(result.scenarios.at(-1));
  assert.match(encoded, /hold=ocbc-infinity/, "canonical share URL keeps held cards");
  assert.match(encoded, /issuers=UOB/, "canonical share URL keeps recent issuers");
}

{
  const result = await boot(
    {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(catalog));
      },
    }
  );
  const parsed = result.sandbox.window.CardFitApp.scenarioFromSearch(
    "?oneOff=3500&hold=not-a-card&issuers=NotABank"
  );
  assert.equal(parsed.oneOff, 3500, "spend still parses when wallet tokens are junk");
  assert.equal(parsed.existingCardIds, undefined, "unknown held cards are dropped");
  assert.equal(parsed.recentIssuers, undefined, "unknown issuers are dropped");
}

console.log("test-app.mjs: 85 startup, event, persistence, compare, preset, dock, share-link, and render assertions passed");
