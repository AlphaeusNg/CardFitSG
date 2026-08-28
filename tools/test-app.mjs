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
      "review-by-label",
      "review-by-line",
      "catalog-review-banner",
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
  elements["catalog-review-banner"].hidden = true;
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
  { existingCardIds = [], recentIssuers = [], savedScenario, search = "", todayYmd } = {}
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
  if (todayYmd) {
    sandbox.CardFitEngine.todayYmd = () => todayYmd;
    sandbox.window.CardFitEngine.todayYmd = sandbox.CardFitEngine.todayYmd;
  }
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
