/**
 * CardFitSG recommendation engine — pure functions, no network.
 */
(function (global) {
  "use strict";

  /** Cap absurd inputs so metrics stay finite. */
  const MAX_SPEND = 1e8;
  const MAX_HORIZON_MONTHS = 120;

  function clampSpend(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return 0;
    return Math.min(MAX_SPEND, v);
  }

  function normalizeMonths(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return 12;
    return Math.min(MAX_HORIZON_MONTHS, Math.floor(v));
  }

  function parseYmd(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function daysUntil(isoDate, asOfYmd) {
    const a = parseYmd(asOfYmd);
    const b = parseYmd(isoDate);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function validateCatalog(db) {
    const errors = [];
    const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    const requireString = (value, path) => {
      if (typeof value !== "string" || !value.trim()) errors.push(`${path} must be a non-empty string`);
    };
    const requireNumber = (value, path, options = {}) => {
      const { min = 0, max = MAX_SPEND, integer = false, nullable = false } = options;
      if (value == null && nullable) return;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < min ||
        value > max ||
        (integer && !Number.isInteger(value))
      ) {
        errors.push(`${path} must be ${integer ? "an integer" : "a finite number"} from ${min} to ${max}`);
      }
    };
    const requireRate = (value, path) => requireNumber(value, path, { min: 0, max: 1 });

    if (!isRecord(db)) return { valid: false, errors: ["catalog must be an object"] };
    if (!isRecord(db.meta)) {
      errors.push("meta must be an object");
    } else {
      if (!parseYmd(db.meta.asOf)) errors.push("meta.asOf must be a valid YYYY-MM-DD date");
      requireString(db.meta.disclaimer, "meta.disclaimer");
    }
    if (!Array.isArray(db.cards) || db.cards.length === 0) {
      errors.push("cards must be a non-empty array");
      return { valid: false, errors };
    }

    const ids = new Set();
    const styles = new Set(["flat", "intro_then_flat", "category", "category_tiered"]);
    db.cards.forEach((card, index) => {
      const path = `cards[${index}]`;
      if (!isRecord(card)) {
        errors.push(`${path} must be an object`);
        return;
      }

      ["id", "name", "issuer", "network", "style"].forEach((key) =>
        requireString(card[key], `${path}.${key}`)
      );
      if (typeof card.id === "string" && card.id.trim()) {
        if (ids.has(card.id)) errors.push(`${path}.id has duplicate card ID "${card.id}"`);
        ids.add(card.id);
      }
      if (!styles.has(card.style)) errors.push(`${path}.style is not supported`);

      requireRate(card.flatRate, `${path}.flatRate`);
      requireNumber(card.annualFee, `${path}.annualFee`);
      requireNumber(card.feeWaiverYears, `${path}.feeWaiverYears`, {
        min: 0,
        max: 10,
        integer: true,
      });
      requireNumber(card.minMonthlySpend, `${path}.minMonthlySpend`);
      requireNumber(card.earnCap, `${path}.earnCap`, { nullable: true });
      if (card.qualifyingPeriodMonths != null) {
        requireNumber(card.qualifyingPeriodMonths, `${path}.qualifyingPeriodMonths`, {
          min: 1,
          max: 12,
          integer: true,
        });
      }
      requireNumber(card.fussFreeScore, `${path}.fussFreeScore`, { max: 100 });
      requireNumber(card.acceptanceScore, `${path}.acceptanceScore`, { max: 100 });
      if (typeof card.firstYearFeeWaived !== "boolean") {
        errors.push(`${path}.firstYearFeeWaived must be a boolean`);
      } else if (Number.isInteger(card.feeWaiverYears)) {
        if (card.firstYearFeeWaived !== (card.feeWaiverYears > 0)) {
          errors.push(`${path}.firstYearFeeWaived must agree with feeWaiverYears`);
        }
      }
      if (!Array.isArray(card.pros) || !card.pros.every((item) => typeof item === "string")) {
        errors.push(`${path}.pros must be an array of strings`);
      }

      if (card.style === "intro_then_flat") {
        requireRate(card.introRate, `${path}.introRate`);
        requireNumber(card.introCapCash, `${path}.introCapCash`);
        requireNumber(card.introCapSpend, `${path}.introCapSpend`);
        requireNumber(card.introMonths, `${path}.introMonths`, { min: 1, max: 120, integer: true });
      }
      if (card.style === "category") {
        if (!isRecord(card.categoryRates) || Object.keys(card.categoryRates).length === 0) {
          errors.push(`${path}.categoryRates must be a non-empty object`);
        } else {
          Object.entries(card.categoryRates).forEach(([category, rate]) =>
            requireRate(rate, `${path}.categoryRates.${category}`)
          );
        }
      }
      if (card.earnCapTiers != null) {
        if (!Array.isArray(card.earnCapTiers) || card.earnCapTiers.length === 0) {
          errors.push(`${path}.earnCapTiers must be a non-empty array`);
        } else {
          card.earnCapTiers.forEach((tier, tierIndex) => {
            const tierPath = `${path}.earnCapTiers[${tierIndex}]`;
            if (!isRecord(tier)) {
              errors.push(`${tierPath} must be an object`);
              return;
            }
            requireNumber(tier.minSpend, `${tierPath}.minSpend`);
            requireNumber(tier.cap, `${tierPath}.cap`);
          });
        }
      }
      if (card.style === "category_tiered") {
        if (!Array.isArray(card.tieredRates) || card.tieredRates.length === 0) {
          errors.push(`${path}.tieredRates must be a non-empty array`);
        } else {
          card.tieredRates.forEach((tier, tierIndex) => {
            const tierPath = `${path}.tieredRates[${tierIndex}]`;
            if (!isRecord(tier)) {
              errors.push(`${tierPath} must be an object`);
              return;
            }
            requireNumber(tier.minSpend, `${tierPath}.minSpend`);
            requireRate(tier.rate, `${tierPath}.rate`);
            requireString(tier.note, `${tierPath}.note`);
          });
        }
      }

      if (card.signup != null) {
        if (!isRecord(card.signup)) {
          errors.push(`${path}.signup must be an object or null`);
        } else {
          const signupPath = `${path}.signup`;
          if (card.signup.activeThrough != null && !parseYmd(card.signup.activeThrough)) {
            errors.push(`${signupPath}.activeThrough must be null or a valid YYYY-MM-DD date`);
          }
          requireNumber(card.signup.minSpend, `${signupPath}.minSpend`);
          requireNumber(card.signup.windowDays, `${signupPath}.windowDays`, {
            min: 1,
            max: 3650,
            integer: true,
            nullable: true,
          });
          requireNumber(card.signup.cashReward, `${signupPath}.cashReward`);
          if (card.signup.giftValueEst != null) {
            requireNumber(card.signup.giftValueEst, `${signupPath}.giftValueEst`);
          }
        }
      }
    });

    return { valid: errors.length === 0, errors };
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
  function scoreCard(card, scenario = {}) {
    const months = normalizeMonths(scenario.months);
    const oneOff = clampSpend(scenario.oneOff);
    const monthly = clampSpend(scenario.monthly);
    const asOf = scenario.asOf || todayYmd();
    const existing = new Set(scenario.existingCardIds || []);
    const alreadyHold = existing.has(card.id);
    const longTerm = !!(scenario.weightLongTerm || scenario.intent === "long_term");
    // Optimizer is opt-in; when both toggles are on, optimizer scoring wins for cash math
    // but fuss-free still applies soft penalties unless preferFussFree is explicitly false.
    const preferFuss = scenario.preferFussFree !== false && !scenario.optimizerMode;

    const ongoingSpend = monthly * months;
    // Put one-off in month 1 of the horizon
    const totalSpend = oneOff + ongoingSpend;

    let cashFromRate = 0;
    let signupCash = 0;
    let notes = [];
    let warnings = [];

    if (card.style === "flat") {
      cashFromRate = totalSpend * (card.flatRate || 0);
    } else if (card.style === "intro_then_flat") {
      const introSpend = Math.min(totalSpend, card.introCapSpend || 0);
      const introCash = Math.min(introSpend * (card.introRate || 0), card.introCapCash || Infinity);
      const rest = Math.max(0, totalSpend - introSpend);
      cashFromRate = introCash + rest * (card.flatRate || 0);
      notes.push(
        `Intro ${((card.introRate || 0) * 100).toFixed(1)}% up to S$${card.introCapCash} on first S$${card.introCapSpend}.`
      );
    } else if (card.style === "category" || card.style === "category_tiered") {
      // Conservative: assume only base rate unless user opts into optimizer mode
      if (scenario.optimizerMode) {
        const selectedTier = card.categoryRates ? null : tierForSpend(card, monthly);
        const top = card.categoryRates
          ? Math.max(...Object.values(card.categoryRates))
          : selectedTier?.rate ?? card.flatRate ?? 0.003;
        // Apply the eligible spend-tier cap, or the card-wide monthly cap.
        let monthlyEarn = monthly * top;
        const monthlyCap = earnCapFor(card, monthly);
        if (monthlyCap != null) monthlyEarn = Math.min(monthlyEarn, monthlyCap);
        const qualifyingPeriodMonths =
          Number.isInteger(card.qualifyingPeriodMonths) && card.qualifyingPeriodMonths > 0
          ? card.qualifyingPeriodMonths
          : 1;
        const qualifyingMonths =
          Math.floor(months / qualifyingPeriodMonths) * qualifyingPeriodMonths;
        // one-off at base rate only (tickets rarely in dining)
        cashFromRate = monthlyEarn * qualifyingMonths + oneOff * (card.flatRate ?? 0.003);
        notes.push("Optimizer mode: optimistic category rates on monthly spend only; one-off at base rate.");
        if (card.minMonthlySpend && monthly < card.minMonthlySpend) {
          warnings.push(`Needs ~S$${card.minMonthlySpend}/mo minimum spend — you entered S$${monthly}.`);
          cashFromRate = totalSpend * (card.flatRate ?? 0.003);
        } else {
          if (qualifyingMonths < months) {
            warnings.push(
              `Only ${qualifyingMonths} of ${months} horizon months form complete ` +
              `${qualifyingPeriodMonths}-month qualifying periods; incomplete months earn no modeled category cashback.`
            );
          }
          if (selectedTier?.note) warnings.push(selectedTier.note);
        }
      } else {
        cashFromRate = totalSpend * (card.flatRate ?? 0.003);
        notes.push("Category cards scored at base rate in fuss-free mode (not optimised).");
        warnings.push("Category optimisation requires monthly tracking — poor fuss-free fit.");
      }
    } else {
      cashFromRate = totalSpend * (card.flatRate || 0);
    }

    // Signup cash if not already holding
    if (!alreadyHold && card.signup) {
      const su = card.signup;
      const promoDays = su.activeThrough ? daysUntil(su.activeThrough, asOf) : null;
      const invalidPromoWindow = !!su.activeThrough && promoDays === null;
      const promoOk = !su.activeThrough || (!invalidPromoWindow && promoDays >= 0);
      const hasSignupValue = su.cashReward > 0 || su.giftValueEst;
      if (promoOk && hasSignupValue) {
        const need = su.minSpend || 0;
        const qualifyingSpend = signupQualifyingSpend(oneOff, monthly, months, su.windowDays);
        if (qualifyingSpend >= need) {
          if (su.cashReward > 0) {
            signupCash = su.cashReward;
            notes.push(`Signup cash ~S$${su.cashReward} (if promo still valid).`);
          }
          if (su.giftValueEst) {
            notes.push(`Possible non-cash gift (est. ~S$${su.giftValueEst} retail; actual value varies).`);
          }
        } else {
          warnings.push(`Signup needs ≥ S$${need} qualifying spend within the offer window.`);
        }
      } else if (invalidPromoWindow && hasSignupValue) {
        warnings.push("Listed signup window could not be validated — verify live offers.");
      } else if (!promoOk && hasSignupValue) {
        warnings.push(`Listed signup window ended ${su.activeThrough} — verify live offers.`);
      }
    }

    if (alreadyHold) {
      notes.push("You already hold this card — scored as keep/use, not new acquisition.");
      signupCash = 0;
    }

    // Each started card year beyond the waiver incurs a fee. For cards without
    // a waiver, the optional first-year fee is counted separately.
    const feeWaiverYears = Number.isInteger(card.feeWaiverYears)
      ? card.feeWaiverYears
      : card.firstYearFeeWaived
        ? 1
        : 0;
    const renewalFeePeriods = Math.max(0, Math.ceil(months / 12) - Math.max(1, feeWaiverYears));
    const firstYearFeePeriods = scenario.includeFeeYear1 && feeWaiverYears === 0 ? 1 : 0;
    const feeDrag = (card.annualFee || 0) * (renewalFeePeriods + firstYearFeePeriods);

    // Acceptance / Amex filter — default conservative (Amex not assumed accepted)
    let acceptancePenalty = 0;
    if (card.network === "Amex" && scenario.amexOk !== true) {
      acceptancePenalty = 80;
      warnings.push("Amex acceptance may fail for your merchant — deprioritised.");
    }

    // Fuss-free preference (disabled when optimizer mode is on)
    let fussPenalty = 0;
    if (preferFuss) {
      if (card.fussFreeScore < 80) fussPenalty = (80 - card.fussFreeScore) * 2;
      if (card.minMonthlySpend > 0) fussPenalty += 40;
    }

    // Same-bank overlap soft penalty for acquisition
    if (!alreadyHold && scenario.existingIssuers?.includes(card.issuer)) {
      notes.push(`You already bank with ${card.issuer} — new-card signup may be weaker.`);
      fussPenalty += 10;
    }

    // Long-term goal: rank on ongoing rate economics, not promo chasing
    const signupForNet = longTerm ? 0 : signupCash;
    if (longTerm && signupCash > 0) {
      notes.push("Long-term mode: signup cash shown separately, not used for ranking.");
    }

    const gross = cashFromRate + signupForNet;
    const net = gross - feeDrag;
    // Full first-year-style value still reported for transparency
    const netWithSignup = cashFromRate + signupCash - feeDrag;
    const score =
      net * 1.0 +
      card.fussFreeScore * 0.35 +
      card.acceptanceScore * 0.15 -
      fussPenalty -
      acceptancePenalty +
      (longTerm ? (card.flatRate || 0) * 10000 : 0);

    return {
      card,
      cashFromRate: round2(cashFromRate),
      signupCash: round2(signupCash),
      feeDrag: round2(feeDrag),
      net: round2(longTerm ? net : netWithSignup),
      netWithSignup: round2(netWithSignup),
      totalSpend: round2(totalSpend),
      effectiveRate: totalSpend > 0 ? round4((longTerm ? net : netWithSignup) / totalSpend) : 0,
      score: round2(score),
      alreadyHold,
      notes,
      warnings,
      rankReasons: buildReasons(card, {
        cashFromRate,
        signupCash,
        net: longTerm ? net : netWithSignup,
        alreadyHold,
        scenario,
        longTerm,
      }),
    };
  }

  /** Highest threshold tier the monthly spend reaches; else lowest published tier. */
  function tierForSpend(card, monthly) {
    if (!card.tieredRates || !card.tieredRates.length) return null;
    let selected = null;
    for (const t of card.tieredRates) {
      if (monthly >= (t.minSpend || 0)) {
        if (selected == null || t.minSpend > selected.minSpend) selected = t;
      }
    }
    return selected || card.tieredRates[0];
  }

  function earnCapFor(card, monthly) {
    if (!Array.isArray(card.earnCapTiers) || card.earnCapTiers.length === 0) {
      return card.earnCap;
    }
    let selected = null;
    for (const tier of card.earnCapTiers) {
      if (monthly >= tier.minSpend && (!selected || tier.minSpend > selected.minSpend)) {
        selected = tier;
      }
    }
    return selected ? selected.cap : card.earnCap;
  }

  function signupQualifyingSpend(oneOff, monthly, months, windowDays) {
    const offerMonths =
      Number.isFinite(windowDays) && windowDays > 0 ? Math.max(1, windowDays / 30) : 1;
    return oneOff + monthly * Math.min(months, offerMonths);
  }

  function buildReasons(card, ctx) {
    const r = [];
    if (!ctx.longTerm && ctx.signupCash > 0) r.push(`~S$${ctx.signupCash} signup value if promo qualifies`);
    if (card.style === "flat") r.push(`${((card.flatRate || 0) * 100).toFixed(1)}% flat cashback`);
    if (card.fussFreeScore >= 90) r.push("High fuss-free score (no category juggling)");
    if (ctx.alreadyHold) r.push("Already in wallet — compare as keep vs replace");
    if (ctx.longTerm && (card.flatRate || 0) >= 0.017) r.push("Strong long-term flat rate");
    return r;
  }

  function recommend(db, scenario = {}) {
    const normalizedScenario = { ...scenario, months: normalizeMonths(scenario.months) };
    const results = db.cards.map((c) => scoreCard(c, normalizedScenario));
    results.sort((a, b) => b.score - a.score || b.net - a.net);

    // Primary pick: best not already held if acquisition intent
    let primary = results[0];
    let noNewCard = false;
    if (normalizedScenario.intent === "acquire") {
      const fresh = results.find((r) => !r.alreadyHold);
      if (fresh) {
        primary = fresh;
      } else {
        primary = results[0];
        noNewCard = results.length > 0 && results.every((r) => r.alreadyHold);
      }
    }
    if (normalizedScenario.intent === "long_term") {
      const flat = results
        .filter(
          (r) =>
            r.card.style === "flat" &&
            r.card.fussFreeScore >= 90 &&
            (r.card.network !== "Amex" || normalizedScenario.amexOk === true)
        )
        .sort((a, b) => b.card.flatRate - a.card.flatRate || b.net - a.net);
      if (flat.length) primary = flat[0];
    }

    // Zero-spend: still rank by fuss-free quality, but flag empty inputs
    const zeroSpend =
      clampSpend(normalizedScenario.oneOff) === 0 && clampSpend(normalizedScenario.monthly) === 0;

    return {
      primary,
      ranked: results,
      scenario: normalizedScenario,
      asOf: normalizedScenario.asOf,
      disclaimer: db.meta.disclaimer,
      noNewCard,
      zeroSpend,
    };
  }

  function todayYmd() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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
    validateCatalog,
    daysUntil,
    clampSpend,
    normalizeMonths,
    todayYmd,
  };
})(typeof window !== "undefined" ? window : globalThis);
