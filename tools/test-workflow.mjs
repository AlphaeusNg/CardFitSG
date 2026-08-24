import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

assert.match(workflow, /^name:\s*ci$/m, "workflow keeps the stable CI identity");
assert.match(workflow, /^\s{2}push:\s*$/m, "main pushes trigger CI");
assert.match(workflow, /^\s{2}pull_request:\s*$/m, "pull requests trigger CI");
assert.match(workflow, /^\s{2}schedule:\s*$/m, "the catalog deadline has a scheduled gate");
assert.match(workflow, /^\s{2}workflow_dispatch:\s*$/m, "CI remains manually dispatchable");
assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/, "CI has read-only repository access");
assert.match(
  workflow,
  /group:\s*cardfitsg-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/,
  "duplicate and stale runs share a ref-scoped group",
);
assert.match(workflow, /cancel-in-progress:\s*true/, "new work cancels stale work on the same ref");
assert.match(workflow, /timeout-minutes:\s*5/, "the hosted gate has a five-minute bound");
assert.match(workflow, /actions\/checkout@v7/, "CI uses checkout v7");
assert.match(workflow, /actions\/setup-node@v7/, "CI uses setup-node v7");
assert.match(workflow, /node-version:\s*["']?24["']?/, "CI uses Node 24");
assert.match(
  workflow,
  /Workflow policy[\s\S]*run:\s*node tools\/test-workflow\.mjs[\s\S]*Recommendation engine tests/,
  "CI executes its own policy before product tests",
);
assert.match(workflow, /run:\s*node tools\/catalog-freshness\.mjs/, "CI enforces the live catalog deadline");

console.log("test-workflow.mjs: 14 CI policy assertions passed");
