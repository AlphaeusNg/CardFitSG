/**
 * Node tests for CardFitSG engine.
 * Run: node tools/test-engine.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(readFileSync(join(root, "data/cards.json"), "utf8"));
const src = readFileSync(join(root, "js/engine.js"), "utf8");

const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const E = sandbox.window.CardFitEngine;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("  OK ", msg);
  } else {
    failed++;
    console.error("  FAIL", msg);
  }
}

console.log("CardFitSG engine tests\n");

assert(db.cards.length >= 5, "has card catalog");

// Catalog validation rejects snapshots that could corrupt or crash ranking
{
  assert(typeof E.validateCatalog === "function", "exports catalog validator");
  if (typeof E.validateCatalog === "function") {
    const valid = E.validateCatalog(db);
    assert(valid.valid && valid.errors.length === 0, "current catalog satisfies engine contract");

    const duplicate = JSON.parse(JSON.stringify(db));
    duplicate.cards[1].id = duplicate.cards[0].id;
    const duplicateResult = E.validateCatalog(duplicate);
    assert(
      !duplicateResult.valid && duplicateResult.errors.some((error) => /duplicate card id/i.test(error)),
      "duplicate card IDs are rejected"
    );

    const badRate = JSON.parse(JSON.stringify(db));
    badRate.cards[0].flatRate = 1.5;
    const rateResult = E.validateCatalog(badRate);
    assert(
      !rateResult.valid && rateResult.errors.some((error) => /flatRate/.test(error)),
      "out-of-range rates are rejected"
    );

    const badDate = JSON.parse(JSON.stringify(db));
    badDate.cards[0].signup.activeThrough = "2026-02-30";
    const dateResult = E.validateCatalog(badDate);
    assert(
      !dateResult.valid && dateResult.errors.some((error) => /activeThrough/.test(error)),
      "malformed signup dates are rejected"
    );
  }
}

// Large one-off fuss-free: should prefer flat with signup (OCBC INFINITY if promo window)
{
  const r = E.recommend(db, {
    oneOff: 4000,
    monthly: 800,
    months: 12,
    existingCardIds: ["sc-simply"],
    existingIssuers: ["Standard Chartered"],
    preferFussFree: true,
    optimizerMode: false,
    amexOk: false,
    intent: "acquire",
    asOf: "2026-06-20",
  });
  assert(r.primary, "has primary");
  assert(r.primary.card.style === "flat" || r.primary.card.style === "intro_then_flat", "fuss-free picks flat-ish");
  assert(r.primary.card.fussFreeScore >= 85, "high fuss score primary");
  // With promo active and large one-off, OCBC INFINITY should rank very high
  const topIds = r.ranked.slice(0, 3).map((x) => x.card.id);
  assert(topIds.includes("ocbc-infinity") || topIds.includes("uob-absolute"), "top3 includes Infinity or Absolute");
  console.log("    top:", r.ranked.slice(0, 3).map((x) => `${x.card.id}=${x.net}`).join(", "));
}

// Long-term simple: UOB Absolute should win on rate among flats
{
  const r = E.recommend(db, {
    oneOff: 0,
    monthly: 1500,
    months: 12,
    existingCardIds: [],
    preferFussFree: true,
    intent: "long_term",
    weightLongTerm: true,
    amexOk: true,
    asOf: "2026-07-19",
  });
  assert(r.primary.card.id === "uob-absolute", "long-term primary is UOB Absolute");
}

// Long-term during active Infinity promo: still prefer Absolute (no promo chasing)
{
  const r = E.recommend(db, {
    oneOff: 4000,
    monthly: 800,
    months: 12,
    preferFussFree: true,
    intent: "long_term",
    weightLongTerm: true,
    amexOk: false,
    asOf: "2026-06-20",
  });
  assert(r.primary.card.id === "uob-absolute", "long-term ignores Infinity signup chase");
  assert(r.ranked[0].card.id === "uob-absolute", "long-term rank#1 is Absolute");
}

// Category cards penalised in fuss-free mode
{
  const r = E.recommend(db, {
    oneOff: 500,
    monthly: 2000,
    months: 12,
    preferFussFree: true,
    optimizerMode: false,
    intent: "acquire",
    asOf: "2026-07-19",
  });
  const uobOne = r.ranked.find((x) => x.card.id === "uob-one");
  const absolute = r.ranked.find((x) => x.card.id === "uob-absolute");
  assert(uobOne && absolute, "both cards scored");
  assert(absolute.score > uobOne.score, "Absolute beats UOB One in fuss-free mode");
  // Category cards must not sit in top 2 under fuss-free defaults
  const top2 = r.ranked.slice(0, 2).map((x) => x.card.style);
  assert(
    top2.every((s) => s === "flat" || s === "intro_then_flat"),
    "fuss-free top2 are flat-ish, not category"
  );
}

// Already holding: signup cash zeroed
{
  const card = db.cards.find((c) => c.id === "ocbc-infinity");
  const s = E.scoreCard(card, {
    oneOff: 5000,
    monthly: 0,
    months: 12,
    existingCardIds: ["ocbc-infinity"],
    asOf: "2026-06-20",
  });
  assert(s.signupCash === 0, "no signup when already holding");
  assert(s.alreadyHold === true, "alreadyHold flag");
}

// Amex deprioritised when not accepted
{
  const rNo = E.recommend(db, {
    oneOff: 5000,
    monthly: 0,
    months: 6,
    amexOk: false,
    preferFussFree: true,
    intent: "acquire",
    asOf: "2026-07-19",
  });
  const rYes = E.recommend(db, {
    oneOff: 5000,
    monthly: 0,
    months: 6,
    amexOk: true,
    preferFussFree: true,
    intent: "acquire",
    asOf: "2026-07-19",
  });
  const amexNo = rNo.ranked.findIndex((x) => x.card.id === "amex-true");
  const amexYes = rYes.ranked.findIndex((x) => x.card.id === "amex-true");
  assert(amexYes <= amexNo, "Amex ranks better when amexOk");
}

// Math: 1.7% of 10000 = 170
{
  const card = db.cards.find((c) => c.id === "uob-absolute");
  const s = E.scoreCard(card, {
    oneOff: 10000,
    monthly: 0,
    months: 12,
    existingCardIds: ["uob-absolute"],
    asOf: "2026-07-19",
  });
  assert(Math.abs(s.cashFromRate - 170) < 0.01, "1.7% of 10k = 170");
}

// Zero spend flagged
{
  const r = E.recommend(db, {
    oneOff: 0,
    monthly: 0,
    months: 12,
    preferFussFree: true,
    intent: "acquire",
    asOf: "2026-07-19",
  });
  assert(r.zeroSpend === true, "zeroSpend flag");
  assert(r.primary && r.primary.net === 0, "zero spend net is 0");
}

// Hold all cards under acquire
{
  const all = db.cards.map((c) => c.id);
  const r = E.recommend(db, {
    oneOff: 3500,
    monthly: 1200,
    months: 12,
    existingCardIds: all,
    preferFussFree: true,
    amexOk: false,
    intent: "acquire",
    asOf: "2026-07-19",
  });
  assert(r.noNewCard === true, "noNewCard when all held");
  assert(r.primary.alreadyHold === true, "primary is a held card");
}

// Clamp absurd spend
{
  const s = E.scoreCard(db.cards.find((c) => c.id === "uob-absolute"), {
    oneOff: 1e20,
    monthly: -50,
    months: 12,
    existingCardIds: ["uob-absolute"],
    asOf: "2026-07-19",
  });
  assert(Number.isFinite(s.net) && s.net > 0, "clamped huge spend stays finite");
  assert(s.totalSpend <= 1e8 + 1, "spend clamped to MAX");
}

// Invalid horizons fall back to the documented 12-month default
{
  const r = E.recommend(db, {
    oneOff: 0,
    monthly: 100,
    months: -6,
    existingCardIds: db.cards.map((card) => card.id),
    asOf: "2026-07-19",
  });
  assert(r.scenario.months === 12, "negative horizon normalizes to 12 months");
  assert(r.ranked.every((card) => card.totalSpend === 1200), "normalized horizon drives spend math");
  assert(r.ranked.every((card) => card.cashFromRate >= 0), "invalid horizon cannot create negative rewards");
}

// Malformed calendar dates fail closed instead of qualifying a signup offer
{
  const card = JSON.parse(JSON.stringify(db.cards.find((c) => c.id === "ocbc-infinity")));
  card.signup.activeThrough = "2026-02-30";
  const s = E.scoreCard(card, {
    oneOff: 4000,
    monthly: 800,
    months: 12,
    existingCardIds: [],
    asOf: "2026-02-20",
  });
  assert(E.daysUntil("2026-02-30", "2026-02-20") === null, "impossible calendar date is rejected");
  assert(s.signupCash === 0, "invalid promo date yields no signup value");
  assert(s.warnings.some((w) => /could not be validated/i.test(w)), "invalid promo date is explained");
}

// Expired promo: no signup cash
{
  const s = E.scoreCard(db.cards.find((c) => c.id === "ocbc-infinity"), {
    oneOff: 4000,
    monthly: 800,
    months: 12,
    existingCardIds: [],
    asOf: "2026-07-19",
  });
  assert(s.signupCash === 0, "expired Infinity promo yields 0 signup");
  assert(s.warnings.some((w) => /ended/i.test(w)), "warns about ended promo window");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
