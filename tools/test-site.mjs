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
const runtimeScripts = ["js/version.js", "js/engine.js", "js/app.js"];
let previousScriptIndex = -1;
for (const script of runtimeScripts) {
  const scriptIndex = index.indexOf(`src="${script}"`);
  assert(scriptIndex >= 0, `index.html must load ${script}`);
  assert(scriptIndex > previousScriptIndex, `${script} loads out of order`);
  previousScriptIndex = scriptIndex;
}

const app = readFileSync(resolve(root, "js/app.js"), "utf8");
const catalogPath = /fetch\(["']([^"']+cards\.json)["']/.exec(app)?.[1];
assert(catalogPath, "app.js must fetch the card catalog");
assertLocalTarget("js/app.js", catalogPath, "index.html");

console.log(
  `test-site.mjs: ${referenceCount} local references and ${fragmentCount} fragments verified`
);
