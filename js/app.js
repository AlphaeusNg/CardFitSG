/**
 * CardFitSG — Singapore cashback card fit calculator.
 */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  let db = null;

  async function init() {
    try {
      const res = await fetch("data/cards.json", { cache: "no-cache" });
      db = await res.json();
    } catch {
      $("#fatal").hidden = false;
      $("#fatal").textContent = "Could not load card database.";
      return;
    }

    $("#asof-label").textContent = db.meta.asOf;
    $("#disclaimer").textContent = db.meta.disclaimer;
    renderExistingOptions();
    bind();
    run();
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
        <input type="checkbox" name="existing" value="${c.id}" />
        <span>${escapeHtml(c.name)}</span>
      </label>`
      )
      .join("");
  }

  function bind() {
    $("#form").addEventListener("submit", (e) => {
      e.preventDefault();
      run();
    });
    $$("#form input, #form select").forEach((el) => {
      el.addEventListener("change", run);
    });
    $("#oneOff").addEventListener("input", debounce(run, 200));
    $("#monthly").addEventListener("input", debounce(run, 200));
  }

  function scenarioFromForm() {
    const existing = $$('input[name="existing"]:checked').map((el) => el.value);
    const existingIssuers = [
      ...new Set(existing.map((id) => db.cards.find((c) => c.id === id)?.issuer).filter(Boolean)),
    ];
    const goal = $("#goal").value;
    return {
      oneOff: Number($("#oneOff").value) || 0,
      monthly: Number($("#monthly").value) || 0,
      months: Number($("#months").value) || 12,
      existingCardIds: existing,
      existingIssuers,
      preferFussFree: $("#fussFree").checked,
      optimizerMode: $("#optimizer").checked,
      amexOk: $("#amexOk").checked,
      intent: goal === "long_term" ? "long_term" : goal === "keep" ? "keep" : "acquire",
      weightLongTerm: goal === "long_term",
      asOf: "2026-07-19",
    };
  }

  function run() {
    if (!db) return;
    const scenario = scenarioFromForm();
    const result = CardFitEngine.recommend(db, scenario);
    renderResult(result);
  }

  function renderResult(result) {
    const p = result.primary;
    const primary = $("#primary");
    if (!p) {
      primary.innerHTML = "<p>No recommendation.</p>";
      return;
    }

    const c = p.card;
    primary.innerHTML = `
      <p class="eyebrow">Top fit for your inputs</p>
      <h2 class="card-title">${escapeHtml(c.name)}</h2>
      <p class="issuer">${escapeHtml(c.issuer)} · ${escapeHtml(c.network)} · ${styleLabel(c.style)}</p>
      <div class="metrics">
        <div class="metric"><b>S$${fmt(p.net)}</b><span>Est. net value (${result.scenario.months} mo)</span></div>
        <div class="metric"><b>${(p.effectiveRate * 100).toFixed(2)}%</b><span>Effective rate on spend</span></div>
        <div class="metric"><b>S$${fmt(p.signupCash)}</b><span>Signup cash (if any)</span></div>
        <div class="metric"><b>${c.fussFreeScore}</b><span>Fuss-free score / 100</span></div>
      </div>
      <ul class="reasons">
        ${p.rankReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
        ${c.pros.slice(0, 3).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
      ${p.warnings.length ? `<div class="warn">${p.warnings.map((w) => `<p>${escapeHtml(w)}</p>`).join("")}</div>` : ""}
      ${p.notes.length ? `<div class="notes">${p.notes.map((n) => `<p>${escapeHtml(n)}</p>`).join("")}</div>` : ""}
      <p class="muted tiny">Estimate only — excludes overseas FX markups, non-qualifying MCC codes, and promo clawbacks. Data as of ${escapeHtml(db.meta.asOf)}.</p>
    `;

    const list = $("#ranked");
    list.innerHTML = result.ranked
      .map((r, i) => {
        const card = r.card;
        return `
        <article class="rank-card ${r === p ? "is-top" : ""} ${r.alreadyHold ? "is-held" : ""}">
          <div class="rank-num">${i + 1}</div>
          <div class="rank-body">
            <header>
              <h3>${escapeHtml(card.name)}</h3>
              <span class="pill">${(card.flatRate ? card.flatRate * 100 : 0).toFixed(1)}% base</span>
              ${r.alreadyHold ? '<span class="pill pill-held">In wallet</span>' : ""}
            </header>
            <p class="rank-meta">${escapeHtml(card.issuer)} · fuss ${card.fussFreeScore} · accept ${card.acceptanceScore}</p>
            <p class="rank-value"><strong>S$${fmt(r.net)}</strong> est. net · signup S$${fmt(r.signupCash)} · rate cash S$${fmt(r.cashFromRate)}</p>
            ${r.warnings.length ? `<p class="warn-inline">${escapeHtml(r.warnings[0])}</p>` : ""}
          </div>
        </article>`;
      })
      .join("");

    // Plan steps for top pick
    $("#plan").innerHTML = buildPlan(p, result.scenario);
  }

  function buildPlan(p, scenario) {
    const c = p.card;
    const steps = [];
    if (p.alreadyHold) {
      steps.push(`Keep using <strong>${escapeHtml(c.name)}</strong> for this spend profile.`);
      steps.push("Before a large booking, confirm MCC / airline exclusions do not zero your cashback.");
      if (scenario.oneOff >= 500) {
        steps.push("For a large ticket: pay in merchant currency; avoid dynamic currency conversion.");
      }
      steps.push("Re-run this tool if your monthly mix becomes category-heavy (dining/petrol).");
    } else {
      steps.push(`Apply for <strong>${escapeHtml(c.name)}</strong> only after reading the live T&amp;Cs on the issuer site.`);
      steps.push("Screenshot the promo page on application day (offers expire).");
      if (c.signup?.minSpend) {
        steps.push(`Plan qualifying spend ≥ <strong>S$${c.signup.minSpend}</strong> inside the promo window (${c.signup.windowDays || "see T&Cs"} days if stated).`);
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
    return Number(n || 0).toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  window.CardFitApp = { run, scenarioFromForm };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
