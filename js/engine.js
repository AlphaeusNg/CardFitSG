/**
 * CardFitSG recommendation engine — pure functions, no network.
 */
(function (global) {
  "use strict";

  /** Cap absurd inputs so metrics stay finite. */
  const MAX_SPEND = 1e8;
  const MAX_HORIZON_MONTHS = 120;
  const OFFICIAL_ISSUER_DOMAINS = Object.freeze({
    OCBC: "ocbc.com",
    UOB: "uob.com.sg",
    "American Express": "americanexpress.com",
    "Standard Chartered": "sc.com",
  });

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
    const requireOfficialUrl = (value, path, issuer) => {
      let parsed;
      try {
        parsed = new URL(value);
      } catch {
        errors.push(`${path} must be an absolute HTTPS URL`);
        return;
      }
      if (parsed.protocol !== "https:") {
        errors.push(`${path} must use HTTPS`);
        return;
      }
      if (parsed.username || parsed.password) {
        errors.push(`${path} must not contain URL credentials`);
      }
      const domain = OFFICIAL_ISSUER_DOMAINS[issuer];
      const hostname = parsed.hostname.toLowerCase();
      if (!domain || (hostname !== domain && !hostname.endsWith(`.${domain}`))) {
        errors.push(
          `${path} must use the official ${issuer || "issuer"} domain${domain ? ` (${domain})` : ""}`
        );
      }
    };

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
    if (!Array.isArray(db.meta?.sources) || db.meta.sources.length !== db.cards.length) {
      errors.push("meta.sources must contain one official URL per card");
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
      if (Array.isArray(db.meta?.sources)) {
        requireOfficialUrl(db.meta.sources[index], `meta.sources[${index}]`, card.issuer);
      }
      if (card.officialUrl != null) {
        requireOfficialUrl(card.officialUrl, `${path}.officialUrl`, card.issuer);
      }
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
            if (Object.prototype.hasOwnProperty.call(tier, "periodCashback")) {
              requireNumber(tier.periodCashback, `${tierPath}.periodCashback`);
            }
          });
          const hasFixedPeriodCashback = card.tieredRates.some(
            (tier) =>
              isRecord(tier) &&
              Object.prototype.hasOwnProperty.call(tier, "periodCashback")
          );
          const hasValidQualifyingPeriod =
            Number.isInteger(card.qualifyingPeriodMonths) &&
            card.qualifyingPeriodMonths >= 1 &&
            card.qualifyingPeriodMonths <= 12;
          if (hasFixedPeriodCashback && !hasValidQualifyingPeriod) {
            errors.push(
              `${path}.tieredRates periodCashback requires a valid ${path}.qualifyingPeriodMonths`
            );
          }
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
          if (card.signup.activeThrough != null || card.signup.termsUrl != null) {
            requireOfficialUrl(card.signup.termsUrl, `${signupPath}.termsUrl`, card.issuer);
          }
          requireNumber(card.signup.minSpend, `${signupPath}.minSpend`);
          requireNumber(card.signup.windowDays, `${signupPath}.windowDays`, {
            min: 1,
            max: 3650,
            integer: true,
            nullable: true,
          });
          if (Object.prototype.hasOwnProperty.call(card.signup, "newToIssuerMonths")) {
            requireNumber(
              card.signup.newToIssuerMonths,
              `${signupPath}.newToIssuerMonths`,
              { min: 1, max: 120, integer: true }
            );
          }
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
   *   - existingIssuers: string[] current or recent principal-card issuers
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
    const existingIssuers = new Set(
      Array.isArray(scenario.existingIssuers) ? scenario.existingIssuers : []
    );
    const knownSameIssuerHolder = existingIssuers.has(card.issuer);
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
    let cashPlan = { kind: "flat", rate: card.flatRate || 0 };
    let separateGift = 0;
    let signupStatus = "No signup cash is modeled for this card.";
    let signupMonthIndex = 0;

    if (card.style === "flat") {
      cashFromRate = totalSpend * (card.flatRate || 0);
      cashPlan = { kind: "flat", rate: card.flatRate || 0 };
    } else if (card.style === "intro_then_flat") {
      const validIntroMonths =
        Number.isInteger(card.introMonths) &&
        card.introMonths >= 1 &&
        card.introMonths <= MAX_HORIZON_MONTHS;
      if (alreadyHold) {
        cashFromRate = totalSpend * (card.flatRate || 0);
        cashPlan = { kind: "flat", rate: card.flatRate || 0 };
        notes.push("Existing card: new-member intro rate excluded from the estimate.");
      } else if (!validIntroMonths) {
        cashFromRate = totalSpend * (card.flatRate || 0);
        cashPlan = { kind: "flat", rate: card.flatRate || 0 };
        warnings.push("Intro window metadata is invalid — modeled at the standard rate.");
      } else {
        const introWindowMonths = Math.min(months, card.introMonths);
        const introWindowSpend = oneOff + monthly * introWindowMonths;
        const introSpend = Math.min(introWindowSpend, card.introCapSpend || 0);
        const introCash = Math.min(
          introSpend * (card.introRate || 0),
          card.introCapCash || Infinity
        );
        const rest = Math.max(0, totalSpend - introSpend);
        cashFromRate = introCash + rest * (card.flatRate || 0);
        cashPlan = {
          kind: "intro",
          rate: card.flatRate || 0,
          introSpend,
          introCash,
          introWindowMonths,
        };
        notes.push(
          `Intro ${((card.introRate || 0) * 100).toFixed(1)}% up to S$${card.introCapCash} ` +
          `on first S$${card.introCapSpend} during the first ${card.introMonths} months.`
        );
      }
    } else if (card.style === "category" || card.style === "category_tiered") {
      // Conservative: assume only base rate unless user opts into optimizer mode
      if (scenario.optimizerMode) {
        const selectedTier = card.categoryRates ? null : tierForSpend(card, monthly);
        const top = card.categoryRates
          ? Math.max(...Object.values(card.categoryRates))
          : selectedTier?.rate ?? card.flatRate ?? 0.003;
        const validQualifyingPeriod =
          Number.isInteger(card.qualifyingPeriodMonths) &&
          card.qualifyingPeriodMonths >= 1 &&
          card.qualifyingPeriodMonths <= 12;
        const qualifyingPeriodMonths = validQualifyingPeriod
          ? card.qualifyingPeriodMonths
          : 1;
        const qualifyingMonths =
          Math.floor(months / qualifyingPeriodMonths) * qualifyingPeriodMonths;
        const completePeriods = qualifyingMonths / qualifyingPeriodMonths;
        const declaresFixedPeriodCashback =
          selectedTier &&
          Object.prototype.hasOwnProperty.call(selectedTier, "periodCashback");
        const validFixedPeriodCashback =
          declaresFixedPeriodCashback &&
          Number.isFinite(selectedTier.periodCashback) &&
          selectedTier.periodCashback >= 0 &&
          validQualifyingPeriod;
        const invalidFixedPeriodCashback =
          declaresFixedPeriodCashback && !validFixedPeriodCashback;
        // One-off spend remains at the base rate because category qualification
        // is modeled only from recurring monthly spend.
        const oneOffCashback = oneOff * (card.flatRate ?? 0.003);
        if (validFixedPeriodCashback) {
          cashFromRate = selectedTier.periodCashback * completePeriods + oneOffCashback;
          cashPlan = {
            kind: "quarterly",
            award: selectedTier.periodCashback,
            period: qualifyingPeriodMonths,
            periods: completePeriods,
            oneOffRate: card.flatRate ?? 0.003,
          };
          notes.push(
            "Optimizer mode: fixed tier cashback on complete qualifying periods; one-off at base rate."
          );
        } else if (invalidFixedPeriodCashback) {
          cashFromRate = oneOffCashback;
          cashPlan = { kind: "oneOff", rate: card.flatRate ?? 0.003 };
          notes.push("Optimizer mode: invalid fixed tier metadata; one-off at base rate only.");
        } else {
          // Apply the eligible spend-tier cap, or the card-wide monthly cap.
          let monthlyEarn = monthly * top;
          const monthlyCap = earnCapFor(card, monthly);
          if (monthlyCap != null) monthlyEarn = Math.min(monthlyEarn, monthlyCap);
          cashFromRate = monthlyEarn * qualifyingMonths + oneOffCashback;
          cashPlan = {
            kind: "category",
            monthlyEarn,
            qualifyingMonths,
            oneOffRate: card.flatRate ?? 0.003,
          };
          notes.push(
            "Optimizer mode: optimistic category rates on monthly spend only; one-off at base rate."
          );
        }
        if (card.minMonthlySpend && monthly < card.minMonthlySpend) {
          warnings.push(`Needs ~S$${card.minMonthlySpend}/mo minimum spend — you entered S$${monthly}.`);
          cashFromRate = totalSpend * (card.flatRate ?? 0.003);
          cashPlan = { kind: "flat", rate: card.flatRate ?? 0.003 };
        } else {
          if (qualifyingMonths < months) {
            warnings.push(
              `Only ${qualifyingMonths} of ${months} horizon months form complete ` +
              `${qualifyingPeriodMonths}-month qualifying periods; incomplete months earn no modeled category cashback.`
            );
          }
          if (invalidFixedPeriodCashback) {
            warnings.push("Fixed tier cashback metadata is invalid — no category cashback modeled.");
          } else if (selectedTier?.note) {
            warnings.push(selectedTier.note);
          }
        }
      } else {
        cashFromRate = totalSpend * (card.flatRate ?? 0.003);
        cashPlan = { kind: "flat", rate: card.flatRate ?? 0.003 };
        notes.push("Category cards scored at base rate in fuss-free mode (not optimised).");
        warnings.push("Category optimisation requires monthly tracking — poor fuss-free fit.");
      }
    } else {
      cashFromRate = totalSpend * (card.flatRate || 0);
      cashPlan = { kind: "flat", rate: card.flatRate || 0 };
    }

    // Signup cash if not already holding
    if (!alreadyHold && card.signup) {
      const su = card.signup;
      const promoDays = su.activeThrough ? daysUntil(su.activeThrough, asOf) : null;
      const invalidPromoWindow = !!su.activeThrough && promoDays === null;
      const promoOk = !su.activeThrough || (!invalidPromoWindow && promoDays >= 0);
      const hasSignupValue = su.cashReward > 0 || su.giftValueEst;
      const declaresIssuerLookback = Object.prototype.hasOwnProperty.call(
        su,
        "newToIssuerMonths"
      );
      const validIssuerLookback =
        declaresIssuerLookback &&
        Number.isInteger(su.newToIssuerMonths) &&
        su.newToIssuerMonths >= 1 &&
        su.newToIssuerMonths <= MAX_HORIZON_MONTHS;
      const invalidIssuerLookback = declaresIssuerLookback && !validIssuerLookback;
      const knownIssuerSignupExclusion =
        validIssuerLookback && knownSameIssuerHolder;
      if (invalidIssuerLookback && hasSignupValue) {
        signupStatus = "Issuer eligibility metadata is invalid — no signup value modeled.";
        warnings.push("Issuer eligibility metadata is invalid — no signup value modeled.");
      } else if (knownIssuerSignupExclusion && hasSignupValue) {
        signupStatus =
          `Signup excluded: a current or recent ${card.issuer} principal card fails the ` +
          `${su.newToIssuerMonths}-month new-to-issuer rule.`;
        warnings.push(
          `New-to-${card.issuer} signup requires no ${card.issuer} principal card now or ` +
          `in the previous ${su.newToIssuerMonths} months — signup value excluded because ` +
          `you marked a current or recent ${card.issuer} card.`
        );
      } else if (promoOk && hasSignupValue) {
        const need = su.minSpend || 0;
        const qualifyingSpend = signupQualifyingSpend(oneOff, monthly, months, su.windowDays);
        if (qualifyingSpend >= need) {
          if (su.cashReward > 0) {
            signupCash = su.cashReward;
            if (longTerm) {
              signupStatus = "Long-term mode: signup cash is shown separately and is not in the ranked net.";
            } else {
              signupStatus = "Signup cash qualifies and is included in the ranked net.";
              signupMonthIndex = signupAwardMonthIndex(oneOff, monthly, months, su.windowDays, need);
            }
            notes.push(`Signup cash ~S$${su.cashReward} (if promo still valid).`);
          } else {
            signupStatus = "No signup cash; any qualifying gift stays outside the ranked net.";
          }
          if (su.giftValueEst) {
            separateGift = su.giftValueEst;
            notes.push(`Possible non-cash gift (est. ~S$${su.giftValueEst} retail; actual value varies).`);
          }
          if (validIssuerLookback) {
            notes.push(
              `Requires no ${card.issuer} principal card now or in the previous ` +
              `${su.newToIssuerMonths} months.`
            );
          }
        } else {
          signupStatus = `Signup needs at least S$${need} qualifying spend within the offer window.`;
          warnings.push(`Signup needs ≥ S$${need} qualifying spend within the offer window.`);
        }
      } else if (invalidPromoWindow && hasSignupValue) {
        signupStatus = "Listed signup window could not be validated — verify live offers.";
        warnings.push("Listed signup window could not be validated — verify live offers.");
      } else if (!promoOk && hasSignupValue) {
        signupStatus = `Listed signup window ended ${su.activeThrough}.`;
        warnings.push(`Listed signup window ended ${su.activeThrough} — verify live offers.`);
      }
    }

    if (alreadyHold) {
      notes.push("You already hold this card — scored as keep/use, not new acquisition.");
      signupCash = 0;
      separateGift = 0;
      signupStatus = "Already held — scored as keep/use, with no new-card signup.";
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
    if (!alreadyHold && knownSameIssuerHolder) {
      const hasDefinitiveIssuerRule =
        Number.isInteger(card.signup?.newToIssuerMonths) &&
        card.signup.newToIssuerMonths >= 1 &&
        card.signup.newToIssuerMonths <= MAX_HORIZON_MONTHS;
      if (!hasDefinitiveIssuerRule) {
        notes.push(`You already bank with ${card.issuer} — new-card signup may be weaker.`);
      }
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
    const signupInNet = longTerm ? 0 : signupCash;
    const breakdown = buildBreakdown({
      months,
      oneOff,
      monthly,
      cashPlan,
      cashFromRate,
      signupInNet,
      signupCash,
      feeDrag,
      annualFee: card.annualFee || 0,
      feeWaiverYears,
      includeFirstYear: !!(scenario.includeFeeYear1 && feeWaiverYears === 0),
      separateGift,
      signupStatus,
      signupMonthIndex,
      longTerm,
      calculatedOn: asOf,
    });
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
      breakdown,
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

  function zeros(count) {
    return Array.from({ length: count }, () => 0);
  }

  function spendInMonth(oneOff, monthly, index) {
    return (index === 0 ? oneOff : 0) + monthly;
  }

  function allocateCash(plan, oneOff, monthly, months) {
    const base = zeros(months);
    const intro = zeros(months);
    const category = zeros(months);
    const quarterly = zeros(months);
    if (plan.kind === "flat") {
      for (let i = 0; i < months; i++) base[i] = spendInMonth(oneOff, monthly, i) * plan.rate;
    } else if (plan.kind === "intro") {
      let leftSpend = plan.introSpend;
      let leftCash = plan.introCash;
      for (let i = 0; i < months; i++) {
        const spend = spendInMonth(oneOff, monthly, i);
        const take = i < plan.introWindowMonths ? Math.min(spend, Math.max(0, leftSpend)) : 0;
        let introPart = 0;
        if (take > 0) {
          if (leftSpend - take <= 1e-9) introPart = leftCash;
          else introPart = plan.introSpend > 0 ? plan.introCash * (take / plan.introSpend) : 0;
          leftSpend -= take;
          leftCash -= introPart;
        }
        base[i] = spend * plan.rate;
        intro[i] = introPart - take * plan.rate;
      }
    } else if (plan.kind === "oneOff") {
      base[0] = oneOff * plan.rate;
    } else if (plan.kind === "quarterly") {
      base[0] = oneOff * plan.oneOffRate;
      for (let period = 1; period <= plan.periods; period++) {
        const idx = period * plan.period - 1;
        if (idx >= 0 && idx < months) quarterly[idx] += plan.award;
      }
    } else if (plan.kind === "category") {
      base[0] = oneOff * plan.oneOffRate;
      const qualified = Math.min(months, plan.qualifyingMonths);
      for (let i = 0; i < qualified; i++) category[i] += plan.monthlyEarn;
    }
    return { base, intro, category, quarterly };
  }

  function feeByMonth(months, annualFee, feeWaiverYears, includeFirstYear) {
    const fees = zeros(months);
    const yearsStarted = Math.ceil(months / 12);
    const waiver = Number.isInteger(feeWaiverYears) ? feeWaiverYears : 0;
    const firstWaivedThrough = Math.max(1, waiver);
    for (let year = 1; year <= yearsStarted; year++) {
      const charge = year === 1 ? includeFirstYear && waiver === 0 : year > firstWaivedThrough;
      if (!charge) continue;
      fees[Math.min(months - 1, (year - 1) * 12)] += annualFee || 0;
    }
    return fees;
  }

  function signupAwardMonthIndex(oneOff, monthly, months, windowDays, need) {
    const offerMonths =
      Number.isFinite(windowDays) && windowDays > 0 ? Math.max(1, windowDays / 30) : 1;
    const windowMonths = Math.min(months, offerMonths);
    let cumulative = 0;
    const whole = Math.floor(windowMonths);
    const frac = windowMonths - whole;
    for (let i = 0; i < whole; i++) {
      cumulative += spendInMonth(oneOff, monthly, i);
      if (cumulative + 1e-9 >= need) return i;
    }
    if (frac > 1e-9) {
      const index = Math.min(months - 1, whole);
      cumulative += (whole === 0 ? oneOff : 0) + monthly * frac;
      if (cumulative + 1e-9 >= need) return index;
    }
    return 0;
  }

  function buildBreakdown(input) {
    const months = input.months;
    let base;
    let intro;
    let category;
    let quarterly;
    let fees;
    let signup;
    if (months < 1) {
      base = [input.cashFromRate];
      intro = [0];
      category = [0];
      quarterly = [0];
      fees = [input.feeDrag];
      signup = [input.signupInNet];
    } else {
      const allocated = allocateCash(input.cashPlan, input.oneOff, input.monthly, months);
      base = allocated.base;
      intro = allocated.intro;
      category = allocated.category;
      quarterly = allocated.quarterly;
      fees = feeByMonth(months, input.annualFee, input.feeWaiverYears, input.includeFirstYear);
      signup = zeros(months);
      if (input.signupInNet) {
        const idx = Math.min(months - 1, Math.max(0, input.signupMonthIndex || 0));
        signup[idx] = input.signupInNet;
      }
      const cashSum = base.reduce((sum, value, index) => sum + value + intro[index] + category[index] + quarterly[index], 0);
      base[base.length - 1] += input.cashFromRate - cashSum;
      const feeSum = fees.reduce((sum, value) => sum + value, 0);
      fees[fees.length - 1] += input.feeDrag - feeSum;
      const signupSum = signup.reduce((sum, value) => sum + value, 0);
      signup[signup.length - 1] += input.signupInNet - signupSum;
    }

    const cent = (value) => Math.round(value * 100);
    const rows = base.map((_, index) => ({
      month: index + 1,
      base: cent(base[index] || 0),
      intro: cent(intro[index] || 0),
      category: cent(category[index] || 0),
      quarterly: cent(quarterly[index] || 0),
      signup: cent(signup[index] || 0),
      fee: cent(fees[index] || 0),
    }));
    const netCents = cent(input.cashFromRate + input.signupInNet - input.feeDrag);
    const signed = (row) => row.base + row.intro + row.category + row.quarterly + row.signup - row.fee;
    const drift = netCents - rows.reduce((sum, row) => sum + signed(row), 0);
    rows[rows.length - 1].base += drift;
    const totals = { base: 0, intro: 0, category: 0, quarterly: 0, signup: 0, fee: 0, net: netCents };
    for (const row of rows) {
      totals.base += row.base;
      totals.intro += row.intro;
      totals.category += row.category;
      totals.quarterly += row.quarterly;
      totals.signup += row.signup;
      totals.fee += row.fee;
    }
    return {
      months: rows,
      totals,
      giftValueEst: input.separateGift > 0 ? input.separateGift : 0,
      signupAside: input.longTerm ? input.signupCash : 0,
      signupStatus: input.signupStatus,
      calculatedOn: input.calculatedOn,
    };
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

  function issuersWithSignupLookback(db) {
    const byIssuer = new Map();
    const cards = Array.isArray(db?.cards) ? db.cards : [];
    for (const card of cards) {
      const issuer = typeof card?.issuer === "string" ? card.issuer.trim() : "";
      const months = card?.signup?.newToIssuerMonths;
      if (!issuer) continue;
      if (!Number.isInteger(months) || months < 1 || months > MAX_HORIZON_MONTHS) continue;
      const existing = byIssuer.get(issuer);
      if (!existing || months > existing.months) {
        byIssuer.set(issuer, { issuer, months });
      }
    }
    return [...byIssuer.values()].sort((left, right) => left.issuer.localeCompare(right.issuer));
  }

  function todayYmd(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }

  global.CardFitEngine = {
    MAX_SPEND,
    scoreCard,
    recommend,
    validateCatalog,
    daysUntil,
    clampSpend,
    normalizeMonths,
    issuersWithSignupLookback,
    todayYmd,
  };
})(typeof window !== "undefined" ? window : globalThis);
