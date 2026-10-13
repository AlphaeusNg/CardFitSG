/** Optional OCBC 365 monthly arithmetic; never changes the generic ranking. */
(function (global) {
  "use strict";
  const fields = [
    ["dining", "Eligible dining"], ["groceries", "Groceries"],
    ["transport", "Land transport"], ["petrol", "Petrol after discounts"],
    ["watsons", "Watsons direct purchases"], ["utilities", "Recurring SG telco / electricity"],
    ["streaming", "Eligible streaming"], ["ev_charging", "EV charging"],
  ];
  const currentTerms = "https://www.ocbc.com/iwov-resources/sg/ocbc/personal/pdf/cards/tncs-governing-365-cc-cashback-programme.pdf";
  const revisedTerms = "https://www.ocbc.com/iwov-resources/sg/ocbc/personal/pdf/cards/tncs-governing-365-cc-cashback-programme-wef1nov26.pdf";

  function amount(value) {
    if (value === "" || value == null) return 0;
    if (typeof value !== "number" && typeof value !== "string") throw new Error("Enter valid non-negative amounts.");
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 100000000) throw new Error("Enter amounts from S$0 to S$100,000,000.");
    const cents = Math.round(number * 100);
    if (Math.abs(number * 100 - cents) > 0.000001) throw new Error("Use at most two decimal places for each amount.");
    return cents;
  }

  function calculate(card, input, engine) {
    const month = input.month;
    if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < "2026-10" || month > "2099-12") {
      throw new Error("Choose a posting month from October 2026 onwards.");
    }
    const terms = engine.cardAsOf(card, month + "-01");
    const total = amount(input.total);
    const rows = fields.map(([key, label]) => ({ key, label, spend: amount(input.categories?.[key]) }));
    const allocated = rows.reduce((sum, row) => sum + row.spend, 0);
    if (allocated > total) throw new Error("Category amounts exceed your eligible monthly total. Count each purchase once.");
    const qualifies = total >= Math.round(terms.minMonthlySpend * 100);
    let categoryRaw = 0;
    let baseSpend = total - allocated;
    for (const row of rows) {
      row.rate = qualifies ? (terms.categoryRates[row.key] ?? terms.flatRate) : terms.flatRate;
      row.cashBeforeCap = Math.round(row.spend * row.rate);
      if (qualifies && terms.categoryRates[row.key] != null) categoryRaw += row.spend * row.rate;
      else baseSpend += row.spend;
    }
    const tiers = (terms.earnCapTiers || []).filter((tier) => total >= Math.round(tier.minSpend * 100));
    const cap = qualifies ? Math.round((tiers.at(-1)?.cap ?? terms.earnCap) * 100) : null;
    const categoryCash = Math.round(categoryRaw);
    const baseCash = Math.round(baseSpend * terms.flatRate);
    const revised = month >= "2026-11";
    const beforeCap = categoryCash + baseCash;
    const cashback = !qualifies ? baseCash : revised ? Math.min(categoryCash, cap) + baseCash : Math.min(beforeCap, cap);
    const advertisingFull = amount(input.advertisingFull);
    const advertisingInstalment = amount(input.advertisingInstalment);
    return { month, total, rows, allocated, baseSpend, baseCash, categoryCash, cap,
      cashback, capReduction: beforeCap - cashback, qualifies,
      shortfall: Math.max(0, Math.round(terms.minMonthlySpend * 100) - total),
      advertisingCash: Math.round(advertisingFull * 0.01 + advertisingInstalment * 0.005),
      revised, termsUrl: revised ? revisedTerms : currentTerms };
  }
  global.CardFitCategoryPlanner = { fields, calculate };
})(typeof window !== "undefined" ? window : globalThis);
