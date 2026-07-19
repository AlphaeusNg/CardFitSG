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
  const s = E.scoreCard(card, { oneOff: 10000, monthly: 0, months: 12, existingCardIds: ["uob-absolute"], asOf: "2026-07-19" });
  assert(Math.abs(s.cashFromRate - 170) < 0.01, "1.7% of 10k = 170");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
