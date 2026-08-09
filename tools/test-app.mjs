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
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    offsetHeight: 64,
    addEventListener() {},
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

function makeDocument() {
  const elements = Object.fromEntries(
    [
      "fatal",
      "asof-label",
      "disclaimer",
      "rates-note",
      "existing-cards",
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
        if (selector === 'input[name="existing"]:checked') return [];
        return [];
      },
    },
  };
}

async function boot(response) {
  const { document, elements } = makeDocument();
  const errors = [];
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
  vm.runInContext(appSource, sandbox, { filename: "js/app.js" });
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  return { elements, errors, sandbox };
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
  assert.match(result.elements.primary.innerHTML, /Top fit for your inputs/, "primary recommendation renders");
  assert.equal(
    (result.elements.ranked.innerHTML.match(/<article/g) || []).length,
    catalog.cards.length,
    "every catalog card renders in the ranking"
  );
  assert.match(result.elements.plan.innerHTML, /plan-steps/, "action plan renders");
  assert.equal(result.elements["site-version"].textContent, "test-version", "version renders");
  assert.equal(typeof result.sandbox.window.CardFitApp.run, "function", "app API is exposed");
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

console.log("test-app.mjs: 16 startup and render assertions passed");
