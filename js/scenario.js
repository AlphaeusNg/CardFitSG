/**
 * CardFitSG scenario URL and local persistence. No DOM and no scoring.
 */
(function (global) {
  "use strict";

  const SCENARIO_KEY = "cardfitsg-last-scenario-v1";
  const NAMED_KEY = "cardfitsg-named-scenarios-v1";
  const MAX_NAMED = 12;
  const MAX_NAME = 40;
  const SCENARIO_PARAM_KEYS = new Set([
    "oneOff",
    "monthly",
    "months",
    "goal",
    "fuss",
    "opt",
    "amex",
    "hold",
    "issuers",
  ]);

  function create(deps) {
    const clampSpend = deps.clampSpend;
    const maxSpend = deps.maxSpend;
    let pendingSpendCapNotice = false;
    let namedSeq = 1;

    function parseFiniteAmount(value) {
      if (typeof value !== "number" && typeof value !== "string") return null;
      if (value == null || (typeof value === "string" && value.trim() === "")) return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      if (n > maxSpend) pendingSpendCapNotice = true;
      return clampSpend(n);
    }

    function consumeSpendCapNotice() {
      const pending = pendingSpendCapNotice;
      pendingSpendCapNotice = false;
      return pending;
    }

    function csvList(value) {
      if (!value || typeof value !== "string") return [];
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    function asSet(value) {
      if (value && typeof value.has === "function" && typeof value.size === "number") return value;
      return new Set(Array.isArray(value) ? value : []);
    }

    function allowedList(values, known) {
      const set = asSet(known);
      if (!Array.isArray(values) || !set.size) return [];
      return [...new Set(values.filter((item) => set.has(item)))].sort();
    }

    function scenarioFromSearch(search, known = {}) {
      if (!search || typeof search !== "string") return null;
      const params = new URLSearchParams(search[0] === "?" ? search.slice(1) : search);
      if (![...params.keys()].some((key) => SCENARIO_PARAM_KEYS.has(key))) return null;
      const record = {};
      const oneOff = parseFiniteAmount(params.get("oneOff"));
      const monthly = parseFiniteAmount(params.get("monthly"));
      const months = Number(params.get("months"));
      if (oneOff != null) record.oneOff = oneOff;
      if (monthly != null) record.monthly = monthly;
      if (months === 6 || months === 12 || months === 24) record.months = months;
      const goal = params.get("goal");
      if (goal === "long_term" || goal === "keep" || goal === "acquire") record.intent = goal;
      if (params.get("fuss") === "0" || params.get("fuss") === "1") {
        record.preferFussFree = params.get("fuss") === "1";
      }
      if (params.get("opt") === "0" || params.get("opt") === "1") {
        record.optimizerMode = params.get("opt") === "1";
      }
      if (params.get("amex") === "0" || params.get("amex") === "1") {
        record.amexOk = params.get("amex") === "1";
      }
      const hold = allowedList(csvList(params.get("hold")), known.cardIds);
      if (hold.length) record.existingCardIds = hold;
      const issuers = allowedList(csvList(params.get("issuers")), known.issuers);
      if (issuers.length) record.recentIssuers = issuers;
      return record;
    }

    function scenarioSearch(scenario, known = {}) {
      const params = new URLSearchParams();
      params.set("oneOff", String(parseFiniteAmount(scenario.oneOff) ?? 0));
      params.set("monthly", String(parseFiniteAmount(scenario.monthly) ?? 0));
      params.set("months", String(scenario.months === 6 || scenario.months === 24 ? scenario.months : 12));
      params.set("goal", scenario.intent === "long_term" || scenario.intent === "keep" ? scenario.intent : "acquire");
      params.set("fuss", scenario.preferFussFree ? "1" : "0");
      params.set("opt", scenario.optimizerMode ? "1" : "0");
      params.set("amex", scenario.amexOk ? "1" : "0");
      const hold = allowedList(scenario.existingCardIds, known.cardIds);
      if (hold.length) params.set("hold", hold.join(","));
      const issuers = allowedList(scenario.recentIssuers, known.issuers);
      if (issuers.length) params.set("issuers", issuers.join(","));
      return params.toString();
    }

    function activeRecord(scenario) {
      return {
        oneOff: scenario.oneOff,
        monthly: scenario.monthly,
        months: scenario.months,
        intent: scenario.intent,
        preferFussFree: scenario.preferFussFree,
        optimizerMode: scenario.optimizerMode,
        amexOk: scenario.amexOk,
        existingCardIds: scenario.existingCardIds || [],
        recentIssuers: scenario.recentIssuers || [],
      };
    }

    function readActive(storage) {
      const raw = storage?.getItem?.(SCENARIO_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
      return saved;
    }

    function writeActive(storage, scenario) {
      storage?.setItem?.(SCENARIO_KEY, JSON.stringify(activeRecord(scenario)));
    }

    function readNamed(storage) {
      const raw = storage?.getItem?.(NAMED_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          item.record &&
          typeof item.record === "object" &&
          !Array.isArray(item.record)
      );
    }

    function cleanName(name) {
      if (typeof name !== "string") return "";
      return name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
    }

    function nextId(existing) {
      let id = "";
      do {
        id = "n" + namedSeq++;
      } while (existing.some((item) => item.id === id));
      return id;
    }

    function saveNamed(storage, name, scenario) {
      const label = cleanName(name);
      if (!label) return { ok: false, reason: "name" };
      let list = [];
      try {
        list = readNamed(storage);
      } catch {
        list = [];
      }
      const existing = list.find((item) => item.name === label);
      const id = existing ? existing.id : nextId(list);
      const next = [{ id, name: label, record: activeRecord(scenario) }, ...list.filter((item) => item.id !== id)];
      const capped = next.slice(0, MAX_NAMED);
      try {
        storage.setItem(NAMED_KEY, JSON.stringify(capped));
      } catch {
        return { ok: false, reason: "storage" };
      }
      return { ok: true, id, name: label, scenarios: capped };
    }

    return {
      SCENARIO_KEY,
      NAMED_KEY,
      maxSpend,
      parseFiniteAmount,
      consumeSpendCapNotice,
      scenarioFromSearch,
      scenarioSearch,
      activeRecord,
      readActive,
      writeActive,
      readNamed,
      saveNamed,
      explainAssumptionChange,
    };
  }

  function sgd(n) {
    const v = Math.round(Number(n) * 100) / 100;
    if (!Number.isFinite(v)) return "S$0";
    const sign = v < 0 ? "-" : "";
    const [whole, frac] = Math.abs(v).toFixed(2).split(".");
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const tail = frac === "00" ? "" : frac.endsWith("0") ? `.${frac[0]}` : `.${frac}`;
    return `${sign}S$${withCommas}${tail}`;
  }

  function joined(value) {
    return Array.isArray(value) ? [...value].filter((item) => typeof item === "string").sort().join(", ") : "";
  }

  function onOff(value) {
    return value ? "on" : "off";
  }

  function assumptionDiffs(left, right) {
    const rows = [
      ["oneOff", "one-off spend", (value) => sgd(value)],
      ["monthly", "monthly spend", (value) => sgd(value)],
      ["months", "horizon", (value) => `${value} months`],
      ["intent", "goal", (value) => String(value || "acquire")],
      ["preferFussFree", "fuss-free mode", onOff],
      ["optimizerMode", "optimizer mode", onOff],
      ["amexOk", "Amex acceptance", onOff],
    ];
    const diffs = [];
    for (const [key, label, format] of rows) {
      if (left[key] !== right[key]) diffs.push(`${label} ${format(left[key])} → ${format(right[key])}`);
    }
    if (joined(left.existingCardIds) !== joined(right.existingCardIds)) {
      diffs.push(
        `held cards ${joined(left.existingCardIds) || "none"} → ${joined(right.existingCardIds) || "none"}`
      );
    }
    if (joined(left.recentIssuers) !== joined(right.recentIssuers)) {
      diffs.push(
        `recent issuers ${joined(left.recentIssuers) || "none"} → ${joined(right.recentIssuers) || "none"}`
      );
    }
    return diffs;
  }

  function findScore(result, id) {
    return result?.ranked?.find((score) => score.card.id === id) || null;
  }

  function componentShift(before, after) {
    if (!before || !after) return "that card is not in both rankings";
    const parts = [];
    if (before.cashFromRate !== after.cashFromRate) {
      parts.push(`rate cash ${sgd(before.cashFromRate)} → ${sgd(after.cashFromRate)}`);
    }
    if (before.signupCash !== after.signupCash) {
      parts.push(`signup cash ${sgd(before.signupCash)} → ${sgd(after.signupCash)}`);
    }
    if (before.feeDrag !== after.feeDrag) {
      parts.push(`fees ${sgd(before.feeDrag)} → ${sgd(after.feeDrag)}`);
    }
    if (!parts.length) {
      return before.net === after.net
        ? "the ranked net is unchanged, so mode or acceptance penalties moved the order"
        : `ranked net ${sgd(before.net)} → ${sgd(after.net)}`;
    }
    return parts.join("; ");
  }

  function explainAssumptionChange(left, right) {
    const lines = [];
    const leftPrimary = left?.result?.primary;
    const rightPrimary = right?.result?.primary;
    const leftName = left?.name || "Assumption A";
    const rightName = right?.name || "Assumption B";
    if (!leftPrimary || !rightPrimary) {
      return { lines: ["Both saved assumptions need a ranking before they can be compared."], samePrimary: false };
    }
    if (leftPrimary.card.id === rightPrimary.card.id) {
      if (leftPrimary.net === rightPrimary.net) {
        lines.push(
          `${leftName} and ${rightName} both rank ${leftPrimary.card.name} first at ${sgd(leftPrimary.net)} net.`
        );
      } else {
        lines.push(
          `${leftName} and ${rightName} both rank ${leftPrimary.card.name} first. The ranked net changes from ${sgd(leftPrimary.net)} to ${sgd(rightPrimary.net)} because ${componentShift(leftPrimary, rightPrimary)}.`
        );
      }
    } else {
      lines.push(
        `${leftName} ranks ${leftPrimary.card.name} first at ${sgd(leftPrimary.net)} net. ${rightName} ranks ${rightPrimary.card.name} first at ${sgd(rightPrimary.net)} net.`
      );
    }

    const leftOrder = left.result.ranked.map((score) => score.card.id);
    const rightOrder = right.result.ranked.map((score) => score.card.id);
    const movers = leftOrder
      .map((id) => {
        const from = leftOrder.indexOf(id);
        const to = rightOrder.indexOf(id);
        return {
          id,
          from,
          to,
          distance: Math.abs(to - from),
          before: findScore(left.result, id),
          after: findScore(right.result, id),
        };
      })
      .filter((move) => move.from !== move.to && move.before && move.after)
      .sort((a, b) => b.distance - a.distance || Math.abs(b.after.net - b.before.net) - Math.abs(a.after.net - a.before.net));

    for (const move of movers.slice(0, 3)) {
      if (leftPrimary.card.id === rightPrimary.card.id && move.id === leftPrimary.card.id) continue;
      lines.push(
        `${move.before.card.name} moves from #${move.from + 1} to #${move.to + 1} because ${componentShift(move.before, move.after)}.`
      );
    }

    const diffs = assumptionDiffs(left.result.scenario || {}, right.result.scenario || {});
    if (diffs.length) lines.push(`Assumptions that differ: ${diffs.join("; ")}.`);
    else lines.push("The saved spending assumptions match, so this comparison is not changing the inputs.");
    return {
      lines,
      samePrimary: leftPrimary.card.id === rightPrimary.card.id,
    };
  }

  global.CardFitScenario = {
    SCENARIO_KEY,
    NAMED_KEY,
    create,
    explainAssumptionChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
