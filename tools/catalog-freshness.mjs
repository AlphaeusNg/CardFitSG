import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DAY_MS = 86_400_000;

function parseYmd(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

function singaporeTodayYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function evaluateCatalogFreshness(catalog, todayYmd = singaporeTodayYmd()) {
  const errors = [];
  const meta = catalog && typeof catalog === "object" && !Array.isArray(catalog) ? catalog.meta : null;
  const asOf = meta?.asOf;
  const reviewBy = meta?.reviewBy;
  const today = parseYmd(todayYmd);
  const snapshotDate = parseYmd(asOf);
  const reviewDate = parseYmd(reviewBy);

  if (!today) errors.push(`evaluation date must be a valid YYYY-MM-DD date (received ${JSON.stringify(todayYmd)})`);
  if (!snapshotDate) errors.push("meta.asOf must be a valid YYYY-MM-DD date");
  if (!reviewDate) errors.push("meta.reviewBy must be a valid YYYY-MM-DD date");

  const offerEnds = [];
  if (Array.isArray(catalog?.cards)) {
    catalog.cards.forEach((card, index) => {
      const activeThrough = card?.signup?.activeThrough;
      if (activeThrough == null) return;
      if (!parseYmd(activeThrough)) {
        errors.push(`cards[${index}].signup.activeThrough must be null or a valid YYYY-MM-DD date`);
        return;
      }
      offerEnds.push(activeThrough);
    });
  }
  const earliestOfferEnd = offerEnds.sort()[0] ?? null;

  if (snapshotDate && reviewDate && reviewDate < snapshotDate) {
    errors.push(`meta.reviewBy ${reviewBy} cannot predate catalog snapshot ${asOf}`);
  }
  if (reviewDate && earliestOfferEnd && reviewDate >= parseYmd(earliestOfferEnd)) {
    errors.push(`meta.reviewBy ${reviewBy} must precede earliest dated offer end ${earliestOfferEnd}`);
  }
  if (today && snapshotDate && snapshotDate > today) {
    errors.push(`catalog snapshot ${asOf} is in the future relative to ${todayYmd}`);
  }
  if (today && reviewDate && today >= reviewDate) {
    errors.push(`catalog review is due: ${reviewBy} reached on ${todayYmd}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    asOf: snapshotDate ? asOf : null,
    reviewBy: reviewDate ? reviewBy : null,
    earliestOfferEnd,
    daysUntilReview: today && reviewDate ? Math.round((reviewDate - today) / DAY_MS) : null,
  };
}

function parseArgs(argv) {
  if (argv.length === 0) return {};
  if (argv.length === 2 && argv[0] === "--as-of") return { asOf: argv[1] };
  throw new Error("usage: node tools/catalog-freshness.mjs [--as-of YYYY-MM-DD]");
}

function run() {
  const { asOf } = parseArgs(process.argv.slice(2));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
  const result = evaluateCatalogFreshness(catalog, asOf);

  if (!result.ok) {
    result.errors.forEach((error) => console.error(`catalog-freshness: ${error}`));
    process.exitCode = 1;
    return;
  }

  const offer = result.earliestOfferEnd ? `; earliest dated offer ends ${result.earliestOfferEnd}` : "";
  console.log(
    `catalog-freshness: current as of ${result.asOf}; review due ${result.reviewBy} ` +
      `(${result.daysUntilReview} days remaining${offer})`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(`catalog-freshness: ${error.message}`);
    process.exitCode = 1;
  }
}
