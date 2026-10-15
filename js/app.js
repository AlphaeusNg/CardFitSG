/**
 * CardFitSG — Singapore cashback card fit calculator.
 */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  let db = null;
  let lastResult = null;
  let rankedPaintFrame = 0;
  let scoredMarketYmd = "";
  const store = CardFitScenario.create({
    clampSpend: (n) => CardFitEngine.clampSpend(n),
    maxSpend: CardFitEngine.MAX_SPEND,
  });

  function marketTodayYmd() {
    if (typeof CardFitEngine !== "undefined" && typeof CardFitEngine.todayYmd === "function") {
      return CardFitEngine.todayYmd();
    }
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
      return `${values.year}-${values.month}-${values.day}`;
    } catch {
      return "";
    }
  }

  function isYmd(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function earliestSignupActiveThrough(cards) {
    let earliest = null;
    for (const card of cards || []) {
      const end = card?.signup?.activeThrough;
      if (!isYmd(end)) continue;
      if (earliest == null || end < earliest) earliest = end;
    }
    return earliest;
  }

  function renderCatalogDates() {
    const asOf = db?.meta?.asOf || "";
    const reviewBy = db?.meta?.reviewBy || "";
    const today = marketTodayYmd();
    const asofEl = $("#asof-label");
    if (asofEl) asofEl.textContent = asOf;
    const lastChecked = $("#last-checked-label");
    if (lastChecked) {
      lastChecked.textContent = asOf;
      lastChecked.setAttribute("datetime", asOf);
    }

    const reviewLine = $("#review-by-line");
    const reviewLabel = $("#review-by-label");
    const banner = $("#catalog-review-banner");
    if (reviewLabel) reviewLabel.textContent = reviewBy;

    const overdue = isYmd(today) && isYmd(reviewBy) && today >= reviewBy;
    let softEndingSoon = false;
    let softCopy = "";
    if (!overdue && isYmd(today) && Array.isArray(db?.cards)) {
      const earliestEnd = earliestSignupActiveThrough(db.cards);
      if (earliestEnd && typeof CardFitEngine !== "undefined" && CardFitEngine.daysUntil) {
        const daysLeft = CardFitEngine.daysUntil(earliestEnd, today);
        if (daysLeft != null && daysLeft >= 0 && daysLeft <= 10) {
          softEndingSoon = true;
          const dayWord = daysLeft === 1 ? "day" : "days";
          softCopy =
            `Some listed signup windows end soon (earliest ${earliestEnd} SGT · ${daysLeft} ${dayWord} left). ` +
            `Rates were last verified ${asOf} — confirm issuer pages if you plan to apply.`;
        }
      }
    }
    if (banner) {
      if (overdue) {
        banner.hidden = false;
        banner.textContent =
          `Rates last verified ${asOf}. The catalog review date (${reviewBy}) has passed — check issuer pages before applying.`;
      } else if (softEndingSoon) {
        banner.hidden = false;
        banner.textContent = softCopy;
      } else {
        banner.hidden = true;
        banner.textContent = "";
      }
    }
    if (reviewLine) reviewLine.hidden = overdue || softEndingSoon || !isYmd(reviewBy);
  }

  function syncTopbarOffset() {
    const header = $(".topbar");
    const root = document.documentElement;
    if (!header || !root || !root.style || typeof root.style.setProperty !== "function") return;
    root.style.setProperty("--topbar-h", `${header.offsetHeight}px`);
  }

  function bindAutoHideHeader() {
    const header = $(".topbar");
    if (!header) return;
    let lastY = Math.max(0, window.scrollY);
    let ticking = false;
    syncTopbarOffset();

    function update() {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      if (y <= 16 || delta < 0 || header.matches(":focus-within")) {
        header.classList.remove("is-scroll-hidden");
      } else if (delta > 0 && y > header.offsetHeight) {
        header.classList.add("is-scroll-hidden");
      }
      lastY = y;
      ticking = false;
    }

    header.addEventListener("focusin", () => header.classList.remove("is-scroll-hidden"));
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener("resize", syncTopbarOffset, { passive: true });
  }

  async function init() {
    bindAutoHideHeader();
    try {
      const catalogUrl = $("#catalog-preload")?.getAttribute("href") || "data/cards.json";
      const res = await fetch(catalogUrl);
      if (!res.ok) throw new Error("HTTP " + res.status);
      db = await res.json();
      const validation = CardFitEngine.validateCatalog(db);
      if (!validation.valid) {
        throw new Error(`invalid catalog: ${validation.errors.join("; ")}`);
      }
    } catch (error) {
      console.error("CardFitSG initialization failed", error);
      $("#fatal").hidden = false;
      $("#fatal").textContent = "Could not load card database.";
      return;
    }

    renderCatalogDates();
    $("#disclaimer").textContent = db.meta.disclaimer;
    if (db.meta.ratesNote && $("#rates-note")) {
      $("#rates-note").textContent = db.meta.ratesNote;
    }
    renderExistingOptions();
    renderIssuerHistoryOptions();
    populateCompareSelects();
    bind();
    restoreScenario();
    bindCategoryPlanner();
    run();
    armMarketDateWatch();
    if (typeof SITE_VERSION !== "undefined") {
      $("#site-version").textContent = SITE_VERSION.id;
    }
  }

  function renderExistingOptions() {
    const box = $("#existing-cards");
    box.innerHTML = db.cards
      .map(
        (c) => `
      <label class="check">
        <input type="checkbox" name="existing" value="${escapeAttr(c.id)}" />
        <span>${escapeHtml(c.name)}</span>
      </label>`
      )
      .join("");
  }

  function renderIssuerHistoryOptions() {
    const box = $("#recent-issuers");
    if (!box || typeof CardFitEngine.issuersWithSignupLookback !== "function") return;
    box.innerHTML = CardFitEngine.issuersWithSignupLookback(db)
      .map(
        (entry) => `
      <label class="check">
        <input type="checkbox" name="recent-issuer" value="${escapeAttr(entry.issuer)}" />
        <span>${escapeHtml(entry.issuer)} principal card now or in the last ${entry.months} months</span>
      </label>`
      )
      .join("");
  }

  function bind() {
    $("#form").addEventListener("submit", (e) => {
      e.preventDefault();
      run();
    });

    // Fuss-free vs optimizer are opposing biases. Register these before the
    // generic change handler so ranking reads the corrected checkbox state.
    const fuss = $("#fussFree");
    const opt = $("#optimizer");
    fuss.addEventListener("change", () => {
      if (fuss.checked && opt.checked) opt.checked = false;
    });
    opt.addEventListener("change", () => {
      if (opt.checked && fuss.checked) fuss.checked = false;
    });

    $$("#form input, #form select").forEach((el) => {
      if (el.id === "scenario-name") return;
      el.addEventListener("change", run);
    });
    const rerankAmounts = debounce(run, 120);
    $("#oneOff").addEventListener("input", rerankAmounts);
    $("#monthly").addEventListener("input", rerankAmounts);

    $$("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyPreset(btn);
      });
    });
    $("#compare-a")?.addEventListener("change", renderCompare);
    $("#compare-b")?.addEventListener("change", renderCompare);
    $("#copy-assumptions")?.addEventListener("click", copyAssumptionComparison);
    $("#assumption-a")?.addEventListener("change", renderAssumptionComparison);
    $("#assumption-b")?.addEventListener("change", renderAssumptionComparison);
    $("#save-named-scenario")?.addEventListener("click", () => {
      saveNamedScenario($("#scenario-name")?.value);
    });
    document.addEventListener("click", (event) => {
      const copyResult = event.target && event.target.closest && event.target.closest("#copy-result");
      if (copyResult) {
        copyTopFit(copyResult);
        return;
      }
      const copyLink = event.target && event.target.closest && event.target.closest("#copy-link");
      if (copyLink) {
        copyScenarioLink(copyLink);
        return;
      }
      const removeSaved = event.target && event.target.closest && event.target.closest("[data-remove-scenario]");
      if (removeSaved) {
        deleteNamedScenario(removeSaved.getAttribute("data-remove-scenario"));
        return;
      }
      const useSaved = event.target && event.target.closest && event.target.closest("[data-use-scenario]");
      if (useSaved) useNamedScenario(useSaved.getAttribute("data-use-scenario"));
    });
    markActivePreset();
  }

  function parseFiniteAmount(value) {
    return store.parseFiniteAmount(value);
  }

  function spendCapStatusNode() {
    return $("#spend-status");
  }

  function flushSpendCapNotice() {
    const pending = store.consumeSpendCapNotice();
    const status = spendCapStatusNode();
    if (status) {
      status.textContent = pending
        ? `Amounts above S$${fmt(CardFitEngine.MAX_SPEND)} are capped at S$${fmt(CardFitEngine.MAX_SPEND)}.`
        : "";
    }
  }

  function amountFromInput(input) {
    const amount = parseFiniteAmount(input?.value);
    const normalized = amount == null ? 0 : amount;
    if (input) input.value = String(normalized);
    return normalized;
  }

  function knownCardIds() {
    return new Set((db?.cards || []).map((card) => card.id).filter(Boolean));
  }

  function knownIssuers() {
    return new Set((db?.cards || []).map((card) => card.issuer).filter(Boolean));
  }

  function knownSets() {
    return { cardIds: knownCardIds(), issuers: knownIssuers() };
  }

  function scenarioFromSearch(search) {
    return store.scenarioFromSearch(search, knownSets());
  }

  function scenarioSearch(scenario) {
    return store.scenarioSearch(scenario, knownSets());
  }

  function scenarioPageUrl(scenario) {
    try {
      const url = new URL(String(location.href || "https://alphaeusng.github.io/CardFitSG/"));
      url.search = scenarioSearch(scenario);
      url.hash = "";
      return url.toString();
    } catch {
      return String(location.href || "").split("#")[0] || "https://alphaeusng.github.io/CardFitSG/";
    }
  }

  function writeScenarioLink(scenario) {
    try {
      const url = new URL(String(location.href || "https://alphaeusng.github.io/CardFitSG/"));
      url.search = scenarioSearch(scenario);
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${location.pathname || ""}${location.search || ""}${location.hash || ""}`;
      if (next !== current && typeof history.replaceState === "function") {
        history.replaceState(null, "", next);
      }
    } catch {
      /* fail closed */
    }
  }

  function applyScenarioRecord(saved) {
    if (!saved || typeof saved !== "object") return;
    const oneOff = parseFiniteAmount(saved.oneOff);
    const monthly = parseFiniteAmount(saved.monthly);
    if (oneOff !== null && $("#oneOff")) $("#oneOff").value = oneOff;
    if (monthly !== null && $("#monthly")) $("#monthly").value = monthly;
    if (Number.isFinite(saved.months) && $("#months")) $("#months").value = String(saved.months);
    if ($("#goal")) {
      if (saved.intent === "long_term") $("#goal").value = "long_term";
      else if (saved.intent === "keep") $("#goal").value = "keep";
      else if (saved.intent === "acquire") $("#goal").value = "acquire";
    }
    if (typeof saved.preferFussFree === "boolean" && $("#fussFree")) $("#fussFree").checked = saved.preferFussFree;
    if (typeof saved.optimizerMode === "boolean" && $("#optimizer")) $("#optimizer").checked = saved.optimizerMode;
    if (typeof saved.amexOk === "boolean" && $("#amexOk")) $("#amexOk").checked = saved.amexOk;
    if ($("#fussFree")?.checked && $("#optimizer")?.checked) $("#optimizer").checked = false;
    if (Array.isArray(saved.existingCardIds)) {
      const allowed = new Set(listedTokens("hold", saved.existingCardIds, "existingCardIds"));
      $$('input[name="existing"]').forEach((el) => {
        el.checked = allowed.has(el.value);
      });
    }
    if (Array.isArray(saved.recentIssuers)) {
      const issuers = new Set(listedTokens("issuers", saved.recentIssuers, "recentIssuers"));
      $$('input[name="recent-issuer"]').forEach((el) => {
        el.checked = issuers.has(el.value);
      });
    }
  }

  function listedTokens(param, values, field) {
    const parsed = store.scenarioFromSearch(`?${param}=${values.join(",")}`, knownSets());
    return parsed && Array.isArray(parsed[field]) ? parsed[field] : [];
  }

  function signupExpiryLine(card, asOfYmd) {
    const end = card?.signup?.activeThrough;
    if (!end || typeof CardFitEngine === "undefined" || !CardFitEngine.daysUntil) {
      if (!end) return "";
      const days = Math.round((Date.parse(end + "T00:00:00+08:00") - Date.parse(asOfYmd + "T00:00:00+08:00")) / 86400000);
      if (!Number.isFinite(days) || days < 0) return "";
      return `Signup ends ${end} SGT · ${days} day${days === 1 ? "" : "s"} left`;
    }
    const days = CardFitEngine.daysUntil(end, asOfYmd);
    if (days == null || days < 0) return "";
    return `Signup ends ${end} SGT · ${days} day${days === 1 ? "" : "s"} left`;
  }

  function setIconFeedback(btn, label) {
    btn.setAttribute("aria-label", label);
    btn.setAttribute("data-tooltip", label);
    btn.setAttribute("title", label);
  }

  function copyTopFit(btn) {
    if (!db) return;
    const scenario = scenarioFromForm();
    const result = CardFitEngine.recommend(db, scenario);
    const p = result?.primary;
    if (!p) return;
    const line = `CardFitSG top fit: ${p.card.name} · S$${fmt(p.net)} est. net over ${result.scenario.months} months. Educational only, not financial advice. ${scenarioPageUrl(scenario)}`;
    const done = () => {
      setIconFeedback(btn, "Copied");
      setTimeout(() => { setIconFeedback(btn, "Copy result"); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(line).then(done).catch(() => {
        setIconFeedback(btn, "Copy failed");
      });
      return;
    }
    setIconFeedback(btn, "Copy failed");
  }

  function copyScenarioLink(btn) {
    if (!db) return;
    const url = scenarioPageUrl(scenarioFromForm());
    const done = () => {
      setIconFeedback(btn, "Link copied");
      setTimeout(() => { setIconFeedback(btn, "Copy link"); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => {
        setIconFeedback(btn, "Copy failed");
      });
      return;
    }
    setIconFeedback(btn, "Copy failed");
  }

  function applyPreset(btn) {
    const oneOff = btn.getAttribute ? btn.getAttribute("data-one-off") : btn.dataset?.oneOff;
    const monthly = btn.getAttribute ? btn.getAttribute("data-monthly") : btn.dataset?.monthly;
    $("#oneOff").value = oneOff == null || oneOff === "" ? "0" : String(oneOff);
    $("#monthly").value = monthly == null || monthly === "" ? "0" : String(monthly);
    markActivePreset();
    run();
  }

  function markActivePreset() {
    const oneOff = String(Number($("#oneOff")?.value) || 0);
    const monthly = String(Number($("#monthly")?.value) || 0);
    $$("[data-preset]").forEach((btn) => {
      const presetOff = String(Number(btn.getAttribute ? btn.getAttribute("data-one-off") : btn.dataset?.oneOff) || 0);
      const presetMonthly = String(Number(btn.getAttribute ? btn.getAttribute("data-monthly") : btn.dataset?.monthly) || 0);
      const active = presetOff === oneOff && presetMonthly === monthly;
      if (btn.classList) {
        if (typeof btn.classList.toggle === "function") btn.classList.toggle("is-active", active);
        else if (active) btn.classList.add("is-active");
        else btn.classList.remove("is-active");
      }
      if (typeof btn.setAttribute === "function") btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function scenarioFromForm() {
    const existing = $$('input[name="existing"]:checked').map((el) => el.value);
    const recentIssuers = $$('input[name="recent-issuer"]:checked').map((el) => el.value);
    const existingIssuers = [
      ...new Set([
        ...existing.map((id) => db.cards.find((c) => c.id === id)?.issuer).filter(Boolean),
        ...recentIssuers,
      ]),
    ];
    const goal = $("#goal").value;
    const asOf =
      (typeof CardFitEngine !== "undefined" && CardFitEngine.todayYmd
        ? CardFitEngine.todayYmd()
        : null) || db.meta.asOf;
    return {
      oneOff: amountFromInput($("#oneOff")),
      monthly: amountFromInput($("#monthly")),
      months: Number($("#months").value) || 12,
      existingCardIds: existing,
      recentIssuers,
      existingIssuers,
      preferFussFree: $("#fussFree").checked,
      optimizerMode: $("#optimizer").checked,
      amexOk: $("#amexOk").checked,
      intent: goal === "long_term" ? "long_term" : goal === "keep" ? "keep" : "acquire",
      weightLongTerm: goal === "long_term",
      asOf,
    };
  }

  function officialUrl(card) {
    if (!card || !db) return "";
    if (typeof card.officialUrl === "string" && card.officialUrl) return card.officialUrl;
    const idx = db.cards.findIndex((c) => c.id === card.id);
    return (idx >= 0 && db.meta.sources && db.meta.sources[idx]) || "";
  }

  function offerTermsUrl(card) {
    return typeof card?.signup?.termsUrl === "string" ? card.signup.termsUrl : "";
  }

  function persistScenario(scenario) {
    try {
      store.writeActive(globalThis.localStorage, scenario);
    } catch {
      /* fail closed */
    }
  }

  function restoreScenario() {
    try {
      const fromUrl = scenarioFromSearch(location.search);
      if (fromUrl) {
        applyScenarioRecord(fromUrl);
        return;
      }
      const saved = store.readActive(globalThis.localStorage);
      if (saved) applyScenarioRecord(saved);
    } catch {
      /* fail closed */
    }
  }

  function populateCompareSelects() {
    ["compare-a", "compare-b"].forEach((id, i) => {
      const el = $("#" + id);
      if (!el || !db?.cards?.length) return;
      el.innerHTML = db.cards
        .map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)}</option>`)
        .join("");
      if (db.cards[i]) el.value = db.cards[i].id;
    });
  }

  function publishedRateSummary(card) {
    const percent = (rate) => {
      const value = Number(rate || 0) * 100;
      const decimals = Math.abs(value * 10 - Math.round(value * 10)) < 1e-9 ? 1 : 2;
      return `${value.toFixed(decimals)}%`;
    };
    if (card.style === "flat") return `${percent(card.flatRate)} flat`;
    if (card.style === "intro_then_flat") {
      return (
        `${percent(card.introRate)} intro on first S$${fmt(card.introCapSpend)} ` +
        `within ${card.introMonths} months · then ${percent(card.flatRate)} flat`
      );
    }
    if (card.style === "category") {
      const topRate = Math.max(...Object.values(card.categoryRates || {}));
      const conditional = Number.isFinite(topRate) ? ` · category rates up to ${percent(topRate)}` : "";
      const threshold = card.minMonthlySpend ? ` from S$${fmt(card.minMonthlySpend)}/month` : "";
      return `${percent(card.flatRate)} base${conditional}${threshold}`;
    }
    if (card.style === "category_tiered" && Array.isArray(card.tieredRates)) {
      const fixedTiers = card.tieredRates.filter(
        (tier) => Number.isFinite(tier.minSpend) && Number.isFinite(tier.periodCashback)
      );
      if (fixedTiers.length) {
        const awards = fixedTiers.map((tier) => tier.periodCashback);
        const thresholds = fixedTiers.map((tier) => tier.minSpend);
        return (
          `S$${fmt(Math.min(...awards))}–S$${fmt(Math.max(...awards))} per ` +
          `${card.qualifyingPeriodMonths}-month qualifying period from ` +
          `S$${fmt(Math.min(...thresholds))}–S$${fmt(Math.max(...thresholds))}/month`
        );
      }
    }
    return `${percent(card.flatRate)} base`;
  }

  function renderCompare() {
    const out = $("#compare-out");
    if (!out || !db) return;
    // Compare shows the published terms in force on the scored market day.
    const compareYmd = scoredMarketYmd || marketTodayYmd() || db.meta.asOf;
    const termsOn = (card) =>
      card && typeof CardFitEngine.cardAsOf === "function" ? CardFitEngine.cardAsOf(card, compareYmd) : card;
    const a = termsOn(db.cards.find((c) => c.id === $("#compare-a")?.value));
    const b = termsOn(db.cards.find((c) => c.id === $("#compare-b")?.value));
    if (!a || !b) {
      out.innerHTML = "";
      return;
    }
    if (a.id === b.id) {
      out.innerHTML = `<p class="muted">Pick two different cards to compare published rates.</p>`;
      return;
    }
    const ranked = lastResult?.ranked || [];
    const ra = ranked.find((r) => r.card.id === a.id);
    const rb = ranked.find((r) => r.card.id === b.id);
    const linkA = officialUrl(a);
    const linkB = officialUrl(b);
    out.innerHTML = `
      <div class="metrics">
        <div class="metric"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(publishedRateSummary(a))} · fuss ${a.fussFreeScore}${ra ? ` · est. S$${fmt(ra.net)}` : ""}</span>${linkA ? `<a href="${escapeAttr(linkA)}" target="_blank" rel="noopener">Official page</a>` : ""}</div>
        <div class="metric"><b>${escapeHtml(b.name)}</b><span>${escapeHtml(publishedRateSummary(b))} · fuss ${b.fussFreeScore}${rb ? ` · est. S$${fmt(rb.net)}` : ""}</span>${linkB ? `<a href="${escapeAttr(linkB)}" target="_blank" rel="noopener">Official page</a>` : ""}</div>
      </div>`;
  }

  function bindCategoryPlanner() {
    const root = $("#category-planner");
    if (!root) return;
    $("#category-month").value = (marketTodayYmd() || db.meta.asOf).slice(0, 7);
    $("#category-total").value = $("#monthly").value;
    $("#category-fields").innerHTML = CardFitCategoryPlanner.fields.map(([key, label]) =>
      `<label class="field"><span>${escapeHtml(label)} (SGD)</span><input type="number" id="category-${key}" min="0" max="100000000" step="0.01" inputmode="decimal" /></label>`
    ).join("");
    root.addEventListener("input", renderCategoryPlanner);
    root.addEventListener("change", renderCategoryPlanner);
  }

  function renderCategoryPlanner() {
    const controls = $("#category-controls");
    if (!controls) return;
    const enabled = $("#category-enable").checked;
    controls.hidden = !enabled;
    const out = $("#category-out");
    out.innerHTML = "";
    if (!enabled) return;
    const money = (cents) => `S$${(cents / 100).toFixed(2)}`;
    try {
      const estimate = CardFitCategoryPlanner.calculate(db.cards.find((card) => card.id === "ocbc-365"), {
        month: $("#category-month").value, total: $("#category-total").value,
        categories: Object.fromEntries(CardFitCategoryPlanner.fields.map(([key]) => [key, $("#category-" + key).value])),
        advertisingFull: $("#category-ad-full").value, advertisingInstalment: $("#category-ad-instalment").value,
      }, CardFitEngine);
      const rows = estimate.rows.filter((row) => row.spend > 0).map((row) =>
        `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${money(row.spend)}</td><td>${(row.rate * 100).toFixed(2)}%</td><td>${money(row.cashBeforeCap)}</td></tr>`
      ).join("");
      out.innerHTML = `<p><strong data-category-cashback="${estimate.cashback}">${money(estimate.cashback)} estimated monthly cashback</strong> · ${escapeHtml(estimate.month)} posted spend</p>
        <p>${estimate.qualifies ? `Minimum met. Applicable ${estimate.revised ? "category" : "monthly"} cap: ${money(estimate.cap)}.` : `Below minimum by ${money(estimate.shortfall)}. All lifestyle spend earns base cashback.`}</p>
        ${rows ? `<div class="month-scroll"><table class="month-table"><caption>Category arithmetic before any cap reduction</caption><thead><tr><th scope="col">Category</th><th scope="col">Spend</th><th scope="col">Rate</th><th scope="col">Cash</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
        <p>Spend earning base: ${money(estimate.baseSpend)} → ${money(estimate.baseCash)}. Category cashback before cap: ${money(estimate.categoryCash)}. Cap reduction: ${money(estimate.capReduction)}.</p>
        <p data-advertising-cashback="${estimate.advertisingCash}">Separate advertising arithmetic: ${money(estimate.advertisingCash)} (1% full payment; 0.5% posted instalments). Outside the lifestyle total and ranked net.</p>
        ${!estimate.revised ? `<p class="muted tiny">October estimate uses monthly totals. OCBC computes each transaction to two decimals without rounding; individual transaction amounts can make actual cashback lower than this estimate.</p>` : ""}
        <p><a href="${escapeAttr(estimate.termsUrl)}" target="_blank" rel="noopener">Verify eligibility in OCBC’s posting-month terms</a></p>`;
    } catch (error) {
      out.innerHTML = `<p role="alert">${escapeHtml(error.message)}</p>`;
    }
  }

  function cancelRankedPaint() {
    if (!rankedPaintFrame) return;
    cancelAnimationFrame(rankedPaintFrame);
    rankedPaintFrame = 0;
  }

  function run() {
    if (!db) return;
    cancelRankedPaint();
    const scenario = scenarioFromForm();
    flushSpendCapNotice();
    persistScenario(scenario);
    writeScenarioLink(scenario);
    const result = CardFitEngine.recommend(db, scenario);
    lastResult = result;
    scoredMarketYmd = scenario.asOf || "";
    renderResult(result);
    renderCompare();
    renderNamedScenarioList();
    renderAssumptionComparison();
  }

  function updateTopFitDock(result) {
    const dock = $("#top-fit-dock");
    if (!dock) return;
    const p = result?.primary;
    if (!p || !result.ranked?.length || result.zeroSpend) {
      dock.hidden = true;
      dock.textContent = "Top fit";
      if (typeof dock.removeAttribute === "function") dock.removeAttribute("aria-label");
      return;
    }
    const label = `Top fit · ${p.card.name} · S$${fmt(p.net)} · ${(p.effectiveRate * 100).toFixed(2)}%`;
    dock.hidden = false;
    dock.textContent = label;
    if (typeof dock.setAttribute === "function") dock.setAttribute("aria-label", `Jump to top fit: ${p.card.name}`);
  }

  function paintRankedList(result) {
    const p = result.primary;
    const list = $("#ranked");
    if (!list || !p) return;
    const maxNet = Math.max(0, ...result.ranked.map((r) => Number(r.net) || 0));
    list.innerHTML = result.ranked
      .map((r, i) => {
        const card = r.card;
        const barPct = maxNet > 0 ? Math.min(100, Math.max(0, (Number(r.net) / maxNet) * 100)) : 0;
        const reasons = Array.isArray(r.rankReasons) ? r.rankReasons : [];
        const whyItems = [
          ...reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`),
          `<li>Signup S$${fmt(r.signupCash)}</li>`,
          `<li>Rate cash S$${fmt(r.cashFromRate)}</li>`,
        ].join("");
        return `
        <article class="rank-card ${r === p ? "is-top" : ""} ${r.alreadyHold ? "is-held" : ""}">
          <div class="rank-num">${i + 1}</div>
          <div class="rank-body">
            <header>
              <h3>${escapeHtml(card.name)}</h3>
              <span class="pill">${escapeHtml(publishedRateSummary(card))}</span>
              ${r.alreadyHold ? '<span class="pill pill-held">In wallet</span>' : ""}
              ${r === p ? '<span class="pill pill-top">Top fit</span>' : ""}
            </header>
            <p class="rank-hero"><strong>S$${fmt(r.net)}</strong> est. net</p>
            <div class="rank-bar" aria-hidden="true"><span class="rank-bar-fill" style="width:${barPct.toFixed(1)}%"></span></div>
            <p class="rank-meta">${escapeHtml(card.issuer)} · fuss ${card.fussFreeScore} · accept ${card.acceptanceScore}</p>
            <details class="rank-why">
              <summary>Why this rank</summary>
              <ul>${whyItems}</ul>
            </details>
            ${r.warnings.length ? `<p class="warn-inline">${escapeHtml(r.warnings[0])}</p>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  function renderResult(result) {
    cancelRankedPaint();
    const p = result.primary;
    const primary = $("#primary");
    markActivePreset();
    if (!p) {
      primary.innerHTML = "<p>No recommendation.</p>";
      $("#plan").innerHTML = "";
      $("#ranked").innerHTML = "";
      updateTopFitDock(null);
      return;
    }

    if (result.zeroSpend) {
      primary.innerHTML = `
        <p class="eyebrow">Enter a spend scenario</p>
        <h2 class="card-title">Add a one-off or monthly amount</h2>
        <p class="issuer">Estimates need at least some card spend to rank cash value.</p>
        <p class="muted">Try a large booking (S$3,500) plus typical monthly spend. Fuss-free mode still ranks simple flat cards with no spend. Numbers are S$0.</p>
      `;
    } else {
      const c = p.card;
      const expiry = signupExpiryLine(c, result.scenario.asOf);
      const termsUrl = offerTermsUrl(c);
      const banners = [];
      if (result.noNewCard) {
        banners.push(
          `<div class="warn"><p>You marked every catalog card as already held. Showing the best <em>keep / use</em> fit.</p></div>`
        );
      }
      primary.innerHTML = `
      <p class="eyebrow">Top fit for your inputs</p>
      <h2 class="card-title">${escapeHtml(c.name)}</h2>
      <p class="issuer">${escapeHtml(c.issuer)} · ${escapeHtml(c.network)} · ${styleLabel(c.style)}</p>
      ${banners.join("")}
      <div class="metrics">
        <div class="metric"><b>S$${fmt(p.net)}</b><span>Est. net value (${result.scenario.months} mo)</span></div>
        <div class="metric"><b>${(p.effectiveRate * 100).toFixed(2)}%</b><span>Effective rate on spend</span></div>
        <div class="metric"><b>S$${fmt(p.signupCash)}</b><span>Signup cash (if any)</span></div>
        <div class="metric"><b>${c.fussFreeScore}</b><span>Fuss-free score / 100</span></div>
      </div>
      ${expiry ? `<p class="muted tiny">${escapeHtml(expiry)}</p>` : ""}
      ${officialUrl(c) ? `<div class="result-actions"><a class="btn" href="${escapeAttr(officialUrl(c))}" target="_blank" rel="noopener">Official product page</a></div>` : ""}
      <div class="icon-toolbar" role="toolbar" aria-label="Top fit actions">
        <button type="button" class="icon-btn disclosure-toggle" id="primary-details-toggle" aria-expanded="false" aria-controls="primary-details" aria-label="Why this card" data-tooltip="Why this card" title="Why this card"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg></button>
        <button type="button" class="icon-btn disclosure-toggle" id="primary-more-toggle" aria-expanded="false" aria-controls="primary-more" aria-label="More" data-tooltip="More" title="More"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg></button>
        <button type="button" class="icon-btn" id="copy-result" aria-label="Copy result" data-tooltip="Copy result" title="Copy result"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg></button>
        <button type="button" class="icon-btn" id="copy-link" aria-label="Copy link" data-tooltip="Copy link" title="Copy link"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><path d="M8 12h8" /></svg></button>
      </div>
      <div id="primary-details" hidden>
      <ul class="reasons">
        ${p.rankReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
        ${c.pros.slice(0, 3).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
      ${p.warnings.length ? `<div class="warn">${p.warnings.map((w) => `<p>${escapeHtml(w)}</p>`).join("")}</div>` : ""}
      ${p.notes.length ? `<div class="notes">${p.notes.map((n) => `<p>${escapeHtml(n)}</p>`).join("")}</div>` : ""}
      ${renderBreakdown(p, result)}
      <p class="muted tiny">Estimate only — excludes overseas FX markups, non-qualifying MCC codes, and promo clawbacks. Rates as of ${escapeHtml(db.meta.asOf)}.</p>
      </div>
      <div id="primary-more" hidden>${termsUrl ? `<div class="result-actions"><a class="btn" href="${escapeAttr(termsUrl)}" target="_blank" rel="noopener">Offer terms</a></div>` : ""}</div>
    `;
    }

    // Primary, plan, and dock paint this turn; ranked list waits one frame.
    updateTopFitDock(result);
    $("#plan").innerHTML = result.zeroSpend
      ? `<p class="muted">Enter one-off and/or monthly spend. Then recalculate fit.</p>`
      : buildPlan(p, result.scenario, result);

    // Keep any prior ranked HTML visible until the next frame paints the new list
    // so amount edits do not flash an empty ranking. First paint stays empty until rAF.
    rankedPaintFrame = requestAnimationFrame(() => {
      rankedPaintFrame = 0;
      paintRankedList(result);
    });
  }

  function signedCents(row, key) {
    return key === "fee" ? -row.fee : row[key];
  }

  function renewalFeeLine(breakdown) {
    const month = breakdown?.renewalMonth;
    const horizon = breakdown?.months?.length;
    if (!Number.isInteger(month) || !Number.isInteger(horizon)) return "";
    const sentence =
      month <= horizon
        ? `Renewal fee lands in month ${month}.`
        : `Renewal fee lands in month ${month}, after this ${horizon}-month view.`;
    return `<p class="muted tiny" data-renewal-month="${month}">${sentence}</p>`;
  }

  function renderBreakdown(score, result) {
    const breakdown = score?.breakdown;
    if (!breakdown || !Array.isArray(breakdown.months) || !breakdown.totals) return "";
    const visible = [
      ["base", "Base cashback"],
      ["intro", "Intro effect"],
      ["category", "Category cashback"],
      ["quarterly", "Quarterly award"],
      ["signup", "Signup cash"],
      ["fee", "Fee"],
    ].filter(([key]) => breakdown.months.some((row) => row[key] !== 0) || breakdown.totals[key] !== 0);
    const head = visible.map(([, label]) => `<th scope="col">${escapeHtml(label)}</th>`).join("");
    const body = breakdown.months
      .map((row) => {
        const cells = visible
          .map(([key]) => {
            const cents = signedCents(row, key);
            return `<td data-component-cents="${cents}">${escapeHtml(fmt(cents / 100))}</td>`;
          })
          .join("");
        const rowNet = visible.reduce((sum, [key]) => sum + signedCents(row, key), 0);
        return `<tr><th scope="row">Month ${row.month}</th>${cells}<td>${escapeHtml(fmt(rowNet / 100))}</td></tr>`;
      })
      .join("");
    const foot = visible
      .map(([key]) => `<td>${escapeHtml(fmt(signedCents(breakdown.totals, key) / 100))}</td>`)
      .join("");
    const gift =
      breakdown.giftValueEst > 0
        ? `<p class="gift-aside" data-gift-cents="${Math.round(breakdown.giftValueEst * 100)}">Non-cash gift, not included in the ranked net: about S$${fmt(breakdown.giftValueEst)} retail.</p>`
        : "";
    const aside =
      breakdown.signupAside
        ? `<p class="signup-aside" data-signup-aside-cents="${Math.round(breakdown.signupAside * 100)}">Signup cash S$${fmt(breakdown.signupAside)} is not in the ranked net. ${escapeHtml(breakdown.signupStatus || "")}</p>`
        : "";
    const calculatedOn = breakdown.calculatedOn || result?.scenario?.asOf || "";
    return `
      ${gift}
      ${aside}
      <p class="muted tiny calc-stamp" data-calculated-on="${escapeAttr(calculatedOn)}">Calculated on the Singapore market date ${escapeHtml(calculatedOn)}. Promo eligibility uses that date, not the device timezone.</p>
      <details class="month-math">
        <summary>Month-by-month</summary>
        <p class="muted tiny">${escapeHtml(breakdown.signupStatus || "")}</p>
        ${renewalFeeLine(breakdown)}
        <div class="month-scroll">
          <table class="month-table">
            <caption>These lines add up to the ranked net of S$${fmt(score.net)}.</caption>
            <thead><tr><th scope="col">Month</th>${head}<th scope="col">Net</th></tr></thead>
            <tbody>${body}</tbody>
            <tfoot><tr><th scope="row">Total</th>${foot}<td data-net-cents="${breakdown.totals.net}">${escapeHtml(fmt(breakdown.totals.net / 100))}</td></tr></tfoot>
          </table>
        </div>
      </details>`;
  }

  function readNamedScenarios() {
    try {
      return store.readNamed(globalThis.localStorage);
    } catch {
      return [];
    }
  }

  function renderNamedScenarioList() {
    const list = $("#named-scenario-list");
    if (!list) return;
    const saved = readNamedScenarios();
    list.innerHTML = saved
      .map(
        (item) => `
        <li>
          <span>${escapeHtml(item.name)}</span>
          <div class="named-actions icon-toolbar" role="toolbar" aria-label="Saved scenario actions">
            <button type="button" class="icon-btn" data-use-scenario="${escapeAttr(item.id)}" aria-label="Use scenario “${escapeAttr(item.name)}”" data-tooltip="Use" title="Use scenario “${escapeAttr(item.name)}”"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></button>
            <button type="button" class="icon-btn" data-remove-scenario="${escapeAttr(item.id)}" aria-label="Remove scenario “${escapeAttr(item.name)}”" data-tooltip="Remove" title="Remove scenario “${escapeAttr(item.name)}”"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg></button>
          </div>
        </li>`
      )
      .join("");
  }

  function renderAssumptionSelects() {
    const saved = readNamedScenarios();
    ["assumption-a", "assumption-b"].forEach((id, index) => {
      const el = $("#" + id);
      if (!el) return;
      const previous = el.value;
      const placeholder = saved.length ? "" : `<option value="">Save a scenario first</option>`;
      el.innerHTML =
        placeholder +
        saved.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      const keep = saved.some((item) => item.id === previous);
      if (keep) el.value = previous;
      else if (saved[index]) el.value = saved[index].id;
      else if (saved[0]) el.value = saved[0].id;
    });
  }

  function scenarioForSaved(record) {
    const existing = Array.isArray(record.existingCardIds) ? record.existingCardIds : [];
    const recentIssuers = Array.isArray(record.recentIssuers) ? record.recentIssuers : [];
    const existingIssuers = [
      ...new Set([
        ...existing.map((id) => db.cards.find((card) => card.id === id)?.issuer).filter(Boolean),
        ...recentIssuers,
      ]),
    ];
    return {
      oneOff: record.oneOff,
      monthly: record.monthly,
      months: record.months,
      existingCardIds: existing,
      recentIssuers,
      existingIssuers,
      preferFussFree: !!record.preferFussFree,
      optimizerMode: !!record.optimizerMode,
      amexOk: !!record.amexOk,
      intent: record.intent === "long_term" || record.intent === "keep" ? record.intent : "acquire",
      weightLongTerm: record.intent === "long_term",
      asOf: marketTodayYmd() || db.meta.asOf,
    };
  }

  let assumptionComparisonText = "";
  let assumptionCopyRevision = 0;

  async function copyAssumptionComparison() {
    if (!assumptionComparisonText) return;
    const revision = ++assumptionCopyRevision;
    const text = assumptionComparisonText;
    const status = $("#assumption-copy-status");
    try {
      await navigator.clipboard.writeText(text);
      if (revision !== assumptionCopyRevision) return;
      if (status) status.textContent = "Comparison copied.";
    } catch {
      if (revision !== assumptionCopyRevision) return;
      const fallback = $("#assumption-copy-fallback");
      if (fallback) {
        fallback.value = text;
        fallback.hidden = false;
        fallback.focus();
        fallback.select();
      }
      if (status) status.textContent = "Copy unavailable. Select the comparison text to copy it.";
    }
  }

  function renderAssumptionComparison() {
    const out = $("#assumption-out");
    if (!out || !db) return;
    assumptionCopyRevision++;
    assumptionComparisonText = "";
    const fallback = $("#assumption-copy-fallback");
    if (fallback) { fallback.hidden = true; fallback.value = ""; }
    const copyButton = $("#copy-assumptions");
    if (copyButton) copyButton.disabled = true;
    const status = $("#assumption-copy-status");
    if (status) status.textContent = "";
    renderAssumptionSelects();
    const saved = readNamedScenarios();
    const left = saved.find((item) => item.id === $("#assumption-a")?.value);
    const right = saved.find((item) => item.id === $("#assumption-b")?.value);
    if (saved.length < 2 || !left || !right) {
      out.innerHTML = `<p class="muted">Save two named scenarios to compare those spending assumptions.</p>`;
      return;
    }
    if (left.id === right.id) {
      out.innerHTML = `<p class="muted">Pick two different saved scenarios.</p>`;
      return;
    }
    const leftResult = CardFitEngine.recommend(db, scenarioForSaved(left.record));
    const rightResult = CardFitEngine.recommend(db, scenarioForSaved(right.record));
    const explained = CardFitScenario.explainAssumptionChange(
      { name: left.name, result: leftResult },
      { name: right.name, result: rightResult }
    );
    assumptionComparisonText = ["CardFitSG spending comparison", ...explained.lines,
      "Gifts are separate from estimated net cashback. Educational only, not financial advice."].join("\n");
    if (copyButton) copyButton.disabled = false;
    out.innerHTML = explained.lines.map((line) => `<p class="assumption-why">${escapeHtml(line)}</p>`).join("");
  }

  function saveNamedScenario(name) {
    if (!db) return { ok: false, reason: "catalog" };
    let result;
    try {
      result = store.saveNamed(globalThis.localStorage, name, scenarioFromForm());
    } catch {
      result = { ok: false, reason: "storage" };
    }
    const status = $("#named-scenario-status");
    if (status) {
      if (result.ok) {
        const evicted = result.evicted?.length ? ` Removed oldest saved scenario: ${result.evicted.join(", ")}.` : "";
        status.textContent = `${result.replaced ? "Updated" : "Saved"} “${result.name}”.${evicted}`;
      }
      else if (result.reason === "storage") {
        status.textContent = "Couldn’t save this scenario because browser storage is full or unavailable.";
      } else status.textContent = "Enter a name to save this scenario.";
    }
    renderNamedScenarioList();
    renderAssumptionComparison();
    return result;
  }

  function deleteNamedScenario(id) {
    let result;
    try {
      result = store.deleteNamed(globalThis.localStorage, id);
    } catch {
      result = { ok: false, reason: "storage" };
    }
    const status = $("#named-scenario-status");
    if (status) {
      if (result.ok) status.textContent = `Removed “${result.name}”.`;
      else if (result.reason === "storage") {
        status.textContent = "Couldn’t remove that scenario because browser storage is unavailable.";
      } else status.textContent = "That scenario was already removed.";
    }
    renderNamedScenarioList();
    renderAssumptionComparison();
    return result;
  }

  function useNamedScenario(id) {
    const found = readNamedScenarios().find((item) => item.id === id);
    if (!found) return;
    applyScenarioRecord(found.record);
    run();
  }

  function namedScenarios() {
    return readNamedScenarios();
  }

  function refreshIfMarketDateChanged() {
    if (!db) return false;
    const today = marketTodayYmd();
    if (!isYmd(today) || today === scoredMarketYmd) return false;
    renderCatalogDates();
    run();
    return true;
  }

  function msUntilNextSingaporeMidnight(now = new Date()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(marketTodayYmd() || "");
    if (!match) return 60 * 60 * 1000;
    const nextMidnightUtc =
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1) - 8 * 60 * 60 * 1000;
    const delay = nextMidnightUtc - now.getTime();
    if (!Number.isFinite(delay) || delay < 1000) return 60 * 1000;
    return Math.min(delay, 24 * 60 * 60 * 1000);
  }

  function armMarketDateWatch() {
    const tick = () => {
      refreshIfMarketDateChanged();
      arm();
    };
    const arm = () => {
      const handle = setTimeout(tick, msUntilNextSingaporeMidnight());
      if (handle && typeof handle.unref === "function") handle.unref();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") return;
      refreshIfMarketDateChanged();
    });
    window.addEventListener("focus", () => refreshIfMarketDateChanged());
    arm();
  }

  function buildPlan(p, scenario, result) {
    const c = p.card;
    const steps = [];
    if (result?.noNewCard) {
      steps.push("Use the ranking to decide which held card to prioritise for this spend.");
    }
    if (p.alreadyHold) {
      steps.push(`Keep using <strong>${escapeHtml(c.name)}</strong> for this spend profile.`);
      steps.push("Confirm MCC / airline exclusions do not zero your cashback before a large booking.");
      if (scenario.oneOff >= 500) {
        steps.push("Pay in merchant currency. Decline dynamic currency conversion.");
      }
      steps.push("Re-run this tool if your monthly mix becomes category-heavy (dining/petrol).");
    } else {
      steps.push(`Apply for <strong>${escapeHtml(c.name)}</strong> only after reading the live T&amp;Cs on the issuer site.`);
      steps.push("Screenshot the promo page on application day (offers expire).");
      if (c.signup?.minSpend) {
        steps.push(
          `Plan qualifying spend ≥ <strong>S$${c.signup.minSpend}</strong> inside the promo window (${c.signup.windowDays || "see T&Cs"} days if stated).`
        );
      }
      if (scenario.oneOff > 0) {
        steps.push(`Charge the ~S$${fmt(scenario.oneOff)} one-off after approval — not before.`);
      }
      steps.push("Set a calendar reminder ~10 months out to decide keep vs cancel before annual fee.");
      if (c.network === "Amex") {
        steps.push("Confirm merchant accepts Amex before relying on this for airfare.");
      }
    }
    steps.push("This is not financial advice; card offers change without notice.");
    return `<ol class="plan-steps">${steps.map((s) => `<li>${s}</li>`).join("")}</ol>`;
  }

  function styleLabel(s) {
    return (
      {
        flat: "Flat cashback",
        intro_then_flat: "Intro then flat",
        category: "Category",
        category_tiered: "Tiered category",
      }[s] || s
    );
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-SG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  let tapTipTimer = 0;
  let tapTipToken = 0;
  let tapTipButton = null;

  function wantsTapLabel(event) {
    if (event && event.pointerType === "touch") return true;
    if (typeof matchMedia !== "function") return false;
    try {
      return !!matchMedia("(hover: none)").matches;
    } catch {
      return false;
    }
  }

  function showTapLabel(button) {
    if (!button || !button.classList) return;
    const token = ++tapTipToken;
    if (tapTipTimer) {
      globalThis.clearTimeout(tapTipTimer);
      tapTipTimer = 0;
    }
    if (tapTipButton && tapTipButton !== button && tapTipButton.classList) {
      tapTipButton.classList.remove("show-tip");
    }
    if (typeof document.querySelectorAll === "function") {
      const tipped = document.querySelectorAll(".icon-btn.show-tip");
      for (let index = 0; index < tipped.length; index += 1) {
        const el = tipped[index];
        if (el !== button && el.classList) el.classList.remove("show-tip");
      }
    }
    button.classList.add("show-tip");
    tapTipButton = button;
    tapTipTimer = globalThis.setTimeout(() => {
      tapTipTimer = 0;
      if (token !== tapTipToken) return;
      if (button.classList) button.classList.remove("show-tip");
      if (tapTipButton === button) tapTipButton = null;
    }, 1500);
  }

  window.CardFitApp = {
    run,
    parseFiniteAmount,
    scenarioFromForm,
    scenarioSearch,
    scenarioFromSearch,
    scenarioPageUrl,
    saveNamedScenario,
    deleteNamedScenario,
    useNamedScenario,
    namedScenarios,
    renderAssumptionComparison,
    refreshIfMarketDateChanged,
    showTapLabel,
  };

  function bindTapLabels() {
    document.addEventListener("pointerup", (event) => {
      if (!wantsTapLabel(event)) return;
      const target = event.target;
      const button = target && typeof target.closest === "function" ? target.closest(".icon-btn") : null;
      if (button) showTapLabel(button);
    });
  }

  function bindDisclosureToggles() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      const button = target && typeof target.closest === "function" ? target.closest(".disclosure-toggle") : null;
      if (!button || typeof button.getAttribute !== "function" || typeof document.getElementById !== "function") return;
      const region = document.getElementById(button.getAttribute("aria-controls") || "");
      if (!region) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", expanded ? "false" : "true");
      region.hidden = expanded;
    });
  }

  bindDisclosureToggles();
  bindTapLabels();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
