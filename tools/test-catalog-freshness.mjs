import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateCatalogFreshness } from "./catalog-freshness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
const workflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
let assertions = 0;

function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const beforeDeadline = evaluateCatalogFreshness(catalog, "2026-09-24");
check(beforeDeadline.ok, "catalog remains current before its review deadline");
check(beforeDeadline.earliestOfferEnd === "2026-09-30", "earliest dated offer is reported");

const onDeadline = evaluateCatalogFreshness(catalog, "2026-09-25");
check(!onDeadline.ok, "catalog audit becomes due on the review date");
check(onDeadline.errors.some((error) => /review is due/i.test(error)), "due-date failure is actionable");

const invalidToday = evaluateCatalogFreshness(catalog, "2026-02-30");
check(!invalidToday.ok, "impossible evaluation dates fail closed");

const missingDeadline = structuredClone(catalog);
delete missingDeadline.meta.reviewBy;
check(!evaluateCatalogFreshness(missingDeadline, "2026-09-01").ok, "missing review deadline fails closed");

const lateDeadline = structuredClone(catalog);
lateDeadline.meta.reviewBy = "2026-09-30";
const lateResult = evaluateCatalogFreshness(lateDeadline, "2026-09-01");
check(!lateResult.ok, "review must precede offer expiry");
check(lateResult.errors.some((error) => /must precede earliest dated offer end/i.test(error)), "late review failure names the offer boundary");

const predatesSnapshot = structuredClone(catalog);
predatesSnapshot.meta.reviewBy = "2026-08-31";
const predatesResult = evaluateCatalogFreshness(predatesSnapshot, "2026-09-01");
check(!predatesResult.ok, "review cannot predate the snapshot");
check(predatesResult.errors.some((error) => /cannot predate catalog snapshot/i.test(error)), "predated review failure names the snapshot boundary");

check(/^\s*schedule:/m.test(workflow), "CI includes a scheduled freshness check");
check(/cron:\s*["']17 0 \* \* \*["']/.test(workflow), "CI checks freshness daily");
check(/^\s*workflow_dispatch:/m.test(workflow), "freshness workflow can be run manually");
check(
  /run:\s*node tools\/test-catalog-freshness\.mjs/.test(workflow),
  "CI runs deterministic freshness policy tests"
);
check(/run:\s*node tools\/catalog-freshness\.mjs/.test(workflow), "CI enforces the live review deadline");
check(/uses:\s*actions\/checkout@v7/.test(workflow), "CI uses the current checkout action runtime");
check(/uses:\s*actions\/setup-node@v7/.test(workflow), "CI uses the current setup-node action runtime");
check(/node-version:\s*["']24["']/.test(workflow), "CI tests on the supported Node 24 LTS line");
check(!/uses:\s*actions\/(?:checkout|setup-node)@v4/.test(workflow), "deprecated Node 20 action runtimes stay removed");

console.log(`test-catalog-freshness.mjs: ${assertions} assertions passed`);
