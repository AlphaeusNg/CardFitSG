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
    },
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
    ].map((id) => [id, makeElement()])
  );
  elements.fatal.hidden = true;
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
  const checkedExisting = existingCardIds.map((value) => ({ value }));
  const checkedRecentIssuers = recentIssuers.map((value) => ({ value }));

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
        if (selector === 'input[name="existing"]:checked') return checkedExisting;
        if (selector === 'input[name="recent-issuer"]:checked') return checkedRecentIssuers;
        return [];
      },
    },
  };
}

async function boot(response, { existingCardIds = [], recentIssuers = [] } = {}) {
  const { document, elements } = makeDocument(existingCardIds, recentIssuers);
  const errors = [];
  const scenarios = [];
  const recommendations = [];
  const sandbox = {
    window: {
      scrollY: 0,
      addEventListener() {},
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
  return { elements, errors, sandbox, scenarios, recommendations };
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
  assert.equal(
    (result.elements.ranked.innerHTML.match(/<article/g) || []).length,
    catalog.cards.length,
    "every catalog card renders in the ranking"
  );
  assert.match(result.elements.plan.innerHTML, /plan-steps/, "action plan renders");
  assert.equal(result.elements["site-version"].textContent, "test-version", "version renders");
  assert.equal(typeof result.sandbox.window.CardFitApp.run, "function", "app API is exposed");

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

console.log("test-app.mjs: 31 startup, event, eligibility, and render assertions passed");
