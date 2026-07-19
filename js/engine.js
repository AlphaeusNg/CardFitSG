/**
 * CardFitSG recommendation engine — pure functions, no network.
 */
(function (global) {
  "use strict";

  function daysUntil(isoDate, asOfYmd) {
    if (!isoDate) return null;
    const a = new Date(asOfYmd + "T00:00:00Z");
    const b = new Date(isoDate + "T00:00:00Z");
    return Math.round((b - a) / 86400000);
  }

  /**
   * Estimate first-year cash value for a scenario.
   * @param {object} card
   * @param {object} scenario
   *   - oneOff: number (SGD large purchase soon)
   *   - monthly: number (ongoing monthly card spend)
   *   - months: number (horizon, default 12)
   *   - existingCardIds: string[]
   *   - preferFussFree: boolean
   *   - amexOk: boolean
   *   - asOf: YYYY-MM-DD
   */
  function scoreCard(card, scenario) {
    const months = scenario.months || 12;
    const oneOff = Math.max(0, Number(scenario.oneOff) || 0);
    const monthly = Math.max(0, Number(scenario.monthly) || 0);
    const asOf = scenario.asOf || "2026-07-19";
    const existing = new Set(scenario.existingCardIds || []);
    const alreadyHold = existing.has(card.id);

    let ongoingSpend = monthly * months;
    // Put one-off in month 1 of the horizon
    const totalSpend = oneOff + ongoingSpend;

    let cashFromRate = 0;
    let signupCash = 0;
    let notes = [];
    let warnings = [];

    if (card.style === "flat") {
      cashFromRate = totalSpend * card.flatRate;
    } else if (card.style === "intro_then_flat") {
      const introSpend = Math.min(totalSpend, card.introCapSpend || 0);
      const introCash = Math.min(introSpend * (card.introRate || 0), card.introCapCash || Infinity);
      const rest = Math.max(0, totalSpend - introSpend);
      cashFromRate = introCash + rest * (card.flatRate || 0);
      notes.push(`Intro ${((card.introRate || 0) * 100).toFixed(1)}% up to S$${card.introCapCash} on first S$${card.introCapSpend}.`);
    } else if (card.style === "category" || card.style === "category_tiered") {
      // Conservative: assume only base rate unless user opts into optimizer mode
      if (scenario.optimizerMode) {
        const top = card.categoryRates
          ? Math.max(...Object.values(card.categoryRates))
          : (card.tieredRates && card.tieredRates[0]?.rate) || card.flatRate || 0.003;
        // Cap monthly earn if earnCap is monthly-ish (SGD)
        let monthlyEarn = monthly * top;
        if (card.earnCap) monthlyEarn = Math.min(monthlyEarn, card.earnCap);
        // one-off at base rate only (tickets rarely in dining)
        cashFromRate = monthlyEarn * months + oneOff * (card.flatRate || 0.003);
        notes.push("Optimizer mode: optimistic category rates on monthly spend only; one-off at base rate.");
        if (card.minMonthlySpend && monthly < card.minMonthlySpend) {
          warnings.push(`Needs ~S$${card.minMonthlySpend}/mo minimum spend — you entered S$${monthly}.`);
          cashFromRate = totalSpend * (card.flatRate || 0.003);
        }
      } else {
        cashFromRate = totalSpend * (card.flatRate || 0.003);
        notes.push("Category cards scored at base rate in fuss-free mode (not optimised).");
        warnings.push("Category optimisation requires monthly tracking — poor fuss-free fit.");
      }
    } else {
      cashFromRate = totalSpend * (card.flatRate || 0);
    }

    // Signup cash if not already holding
    if (!alreadyHold && card.signup) {
      const su = card.signup;
      const promoOk = !su.activeThrough || daysUntil(su.activeThrough, asOf) >= 0;
      if (promoOk && su.cashReward > 0) {
        const need = su.minSpend || 0;
        if (oneOff + monthly >= need) {
          signupCash = su.cashReward;
          notes.push(`Signup cash ~S$${su.cashReward} (if promo still valid).`);
        } else {
          warnings.push(`Signup needs ≥ S$${need} qualifying spend; raise one-off or monthly.`);
        }
      } else if (!promoOk && su.cashReward > 0) {
        warnings.push(`Listed signup window ended ${su.activeThrough} — verify live offers.`);
      } else if (!alreadyHold && su.giftValueEst) {
        notes.push(`Possible non-cash gift (est. ~S$${su.giftValueEst} retail; actual value varies).`);
      }
    }

    if (alreadyHold) {
      notes.push("You already hold this card — scored as keep/use, not new acquisition.");
      signupCash = 0;
    }

    // Fee drag after year 1 (first year waived)
    let feeDrag = 0;
    if (months > 12) {
      feeDrag = card.annualFee || 0;
    } else if (scenario.includeFeeYear1 && !card.firstYearFeeWaived) {
      feeDrag = card.annualFee || 0;
    }

    // Acceptance / Amex filter
    let acceptancePenalty = 0;
    if (card.network === "Amex" && scenario.amexOk === false) {
      acceptancePenalty = 80;
      warnings.push("Amex acceptance may fail for your merchant — deprioritised.");
    }

    // Fuss-free preference
    let fussPenalty = 0;
    if (scenario.preferFussFree !== false) {
      if (card.fussFreeScore < 80) fussPenalty = (80 - card.fussFreeScore) * 2;
      if (card.minMonthlySpend > 0 && !scenario.optimizerMode) fussPenalty += 40;
    }

    // Same-bank overlap soft penalty for acquisition
    if (!alreadyHold && scenario.existingIssuers?.includes(card.issuer)) {
      notes.push(`You already bank with ${card.issuer} — new-card signup may be weaker.`);
      fussPenalty += 10;
    }

    const gross = cashFromRate + signupCash;
    const net = gross - feeDrag;
    const score =
      net * 1.0 +
      card.fussFreeScore * 0.35 +
      card.acceptanceScore * 0.15 -
      fussPenalty -
      acceptancePenalty +
      (scenario.weightLongTerm ? card.flatRate * 10000 : 0);

    return {
      card,
      cashFromRate: round2(cashFromRate),
      signupCash: round2(signupCash),
      feeDrag: round2(feeDrag),
      net: round2(net),
      totalSpend: round2(totalSpend),
      effectiveRate: totalSpend > 0 ? round4(net / totalSpend) : 0,
      score: round2(score),
      alreadyHold,
      notes,
      warnings,
      rankReasons: buildReasons(card, { cashFromRate, signupCash, net, alreadyHold, scenario }),
    };
  }

  function buildReasons(card, ctx) {
    const r = [];
    if (ctx.signupCash > 0) r.push(`~S$${ctx.signupCash} signup value if promo qualifies`);
    if (card.style === "flat") r.push(`${(card.flatRate * 100).toFixed(1)}% flat cashback`);
    if (card.fussFreeScore >= 90) r.push("High fuss-free score (no category juggling)");
    if (ctx.alreadyHold) r.push("Already in wallet — compare as keep vs replace");
    if (ctx.scenario?.weightLongTerm && card.flatRate >= 0.017) r.push("Strong long-term flat rate");
    return r;
  }

  function recommend(db, scenario) {
    const results = db.cards.map((c) => scoreCard(c, scenario));
    results.sort((a, b) => b.score - a.score);

    // Primary pick: best not already held if acquisition intent
    let primary = results[0];
    if (scenario.intent === "acquire") {
      primary = results.find((r) => !r.alreadyHold) || results[0];
    }
    if (scenario.intent === "long_term") {
      const flat = results
        .filter((r) => r.card.style === "flat" && r.card.fussFreeScore >= 90)
        .sort((a, b) => b.card.flatRate - a.card.flatRate || b.net - a.net);
      if (flat.length) primary = flat[0];
    }

    return {
      primary,
      ranked: results,
      scenario,
      asOf: scenario.asOf,
      disclaimer: db.meta.disclaimer,
    };
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }

  global.CardFitEngine = {
    scoreCard,
    recommend,
    daysUntil,
  };
})(typeof window !== "undefined" ? window : globalThis);
