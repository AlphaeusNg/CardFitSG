// Run against a local server; PLAYWRIGHT_MODULE may point to an existing install.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Freeze the current Singapore month without replacing browser Date behavior.
    await page.clock.setFixedTime(new Date("2026-10-14T04:00:00Z"));
    await page.goto(process.env.CARDFIT_URL || "http://127.0.0.1:8097/");
    await page.locator("#primary .card-title").waitFor();
    await page.locator("#ranked .rank-card").first().waitFor();
    const ranking = await page.locator("#ranked").innerHTML();
    const url = page.url();
    const savedActive = await page.evaluate(() => localStorage.getItem("cardfitsg-last-scenario-v1"));
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async () => { throw new Error("clipboard denied"); },
      } });
    });
    await page.locator("#copy-link").click();
    await page.locator("#share-copy-recovery").waitFor({ state: "visible" });
    assert.equal(await page.locator("#share-copy-text").inputValue(), url);
    assert.equal(await page.locator("#share-copy-text").evaluate(node => node === document.activeElement), true);
    await page.locator("#primary-more-toggle").click();
    await page.locator("#copy-result").click();
    assert.match(await page.locator("#share-copy-text").inputValue(), /^CardFitSG top fit:/);
    assert.match(await page.locator("#share-copy-text").inputValue(), /not financial advice/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator("#primary-more-toggle").click();
    await page.evaluate(() => window.CardFitApp.run());
    assert.equal(await page.locator("#share-copy-recovery").isVisible(), false, "recalculation clears old copy recovery");

    assert.equal(await page.locator("#category-enable").isChecked(), false);
    assert.equal(await page.locator("#category-controls").isVisible(), false);
    await page.locator("#category-planner > details > summary").click();
    assert.equal(await page.locator("#category-month").inputValue(), "2026-10");
    await page.locator("#category-enable").check();
    await page.locator("#category-total").fill("800");
    await page.locator("#category-dining").fill("500");
    await page.locator("#category-groceries").fill("300");
    assert.equal(await page.locator("[data-category-cashback]").getAttribute("data-category-cashback"), "3400");
    await page.locator("#category-month").fill("2026-11");
    assert.equal(await page.locator("[data-category-cashback]").getAttribute("data-category-cashback"), "4800");
    await page.locator("#category-groceries").fill("301");
    assert.match(await page.locator("#category-out [role=alert]").innerText(), /exceed/);
    assert.equal(await page.locator("[data-category-cashback]").count(), 0);
    await page.locator("#category-groceries").fill("300");
    await page.locator("#category-controls details > summary").click();
    await page.locator("#category-ad-full").fill("2000");
    await page.locator("#category-ad-instalment").fill("1000");
    assert.equal(await page.locator("[data-advertising-cashback]").getAttribute("data-advertising-cashback"), "2500");
    assert.equal(await page.locator("[data-category-cashback]").getAttribute("data-category-cashback"), "4800");
    assert.equal(await page.locator("#ranked").innerHTML(), ranking, "planner leaves ranked nets unchanged");
    assert.equal(page.url(), url, "planner leaves share URL unchanged");
    assert.equal(await page.evaluate(() => localStorage.getItem("cardfitsg-last-scenario-v1")), savedActive, "planner leaves saved scenario unchanged");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px layout fits viewport`);
    await page.locator("#category-enable").uncheck();
    assert.equal(await page.locator("#category-controls").isVisible(), false);
    assert.deepEqual(errors, []);
    // An automatic Singapore date refresh should not collapse the explanation
    // a reader opened or drop keyboard focus when its controls are replaced.
    await page.locator("#primary-details-toggle").click();
    await page.locator("#primary-more-toggle").click();
    await page.locator("#copy-result").focus();
    await page.clock.setFixedTime(new Date("2026-10-15T04:00:00Z"));
    assert.equal(await page.evaluate(() => window.CardFitApp.refreshIfMarketDateChanged()), true);
    assert.equal(await page.locator("#primary-details").isVisible(), true, "automatic date refresh retains the open explanation");
    assert.equal(await page.locator("#primary-more").isVisible(), true, "automatic date refresh retains open offer tools");
    assert.equal(await page.locator("#primary-details-toggle").getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#primary-more-toggle").getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#copy-result").evaluate(node => node === document.activeElement), true, "automatic refresh retains keyboard focus");
    await page.close();
    console.log(`Category planner Chromium journey passed at ${width}px`);
  }
} finally { await browser.close(); }
