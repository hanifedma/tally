// ============================================================
//  A realistic ledger, for screenshots and for looking at the app before
//  there is anything real in it.
//
//  It takes the money module rather than importing it, because it is used
//  from two places that reach money.js differently: the browser, over HTTP
//  with a cache-busting query, and Node, off the disk. One copy of the data
//  means the phone and the laptop are photographed holding the same money.
//
//  Every id here is built the way the app builds ids — the starter
//  categories and accounts through derivedId, everything else a UUID — so
//  what this writes is indistinguishable from what a person would have
//  typed.
// ============================================================

/**
 * @param M the money.js module
 * @returns {Promise<{settings, accounts, categories, transactions, budgets}>}
 */
export async function buildDemoLedger(M) {
  const UID = "local";

  const cat = {};
  for (const s of M.SEED_CATEGORIES) cat[s.slug] = await M.derivedId(UID, "category:" + s.slug);
  const acc = {};
  for (const s of M.SEED_ACCOUNTS) acc[s.slug] = await M.derivedId(UID, "account:" + s.slug);
  // Two accounts beyond the starter set, one of them in another currency —
  // the case the whole app exists for.
  acc.gopay = M.uuid();
  acc.old = M.uuid();

  // Dates are worked out from the month rather than counted back from today.
  // Ten days back from the 5th is last month, and a ledger built that way
  // opens on an almost empty screen for the first nine days of every month —
  // which is exactly when someone new is most likely to be looking at it.
  const now = new Date();
  const iso = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  };
  // Days of this month already gone. The demo keeps month_start at 1, so this
  // is also how much room the current period has.
  const elapsed = now.getDate() - 1;
  /** `back` days ago, squeezed to fit when the month is only a few days old. */
  const day = (back) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (elapsed >= 9 ? back : Math.round((back * elapsed) / 9)));
    return iso(d);
  };
  /** The `n`th of last month. Every month has an 11th, so nothing to clamp. */
  const lastMonth = (n) => iso(new Date(now.getFullYear(), now.getMonth() - 1, n));
  /** So the salary rows are not still called August's in November. */
  const monthName = (offset) =>
    new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleString("en-US", {
      month: "long",
    });

  const categories = M.SEED_CATEGORIES.map((s, i) =>
    M.normalizeCategory({
      id: cat[s.slug],
      user_id: UID,
      name: s.en,
      kind: s.kind,
      icon: s.icon,
      color: s.color,
      position: i,
    })
  );

  // Every amount below is written the way a person would say it — 3300 is
  // three thousand three hundred won — and scaled to storage units here, in
  // one place, rather than being typed out in thousandths twenty-five times.
  const units = (n) => Math.round(n * M.minorPerUnit());

  const accounts = [
    { id: acc.cash, name: "Cash", kind: "cash", currency: "KRW", opening_minor: 180000, color: "green", position: 0 },
    { id: acc.bank, name: "KB Bank", kind: "bank", currency: "KRW", opening_minor: 7420000, color: "indigo", position: 1 },
    { id: acc.gopay, name: "GoPay", kind: "ewallet", currency: "IDR", opening_minor: 1450000, color: "sky", position: 2 },
    { id: acc.old, name: "Old wallet", kind: "cash", currency: "KRW", opening_minor: 0, color: "gray", position: 3, archived: true },
  ].map((a) => M.normalizeAccount({ ...a, user_id: UID, opening_minor: units(a.opening_minor) }));

  // What one rupiah was worth in won on the day each row was entered. It is
  // frozen onto the row, which is why `rate_base` is the main currency and
  // never the transaction's own.
  const IDR = 0.0876;
  const tx = (o) =>
    M.normalizeTx({
      id: M.uuid(),
      user_id: UID,
      rate_base: "KRW",
      rate: 1,
      currency: "KRW",
      ...o,
      amount_minor: units(o.amount_minor || 0),
      to_amount_minor: o.to_amount_minor == null ? null : units(o.to_amount_minor),
      fee_minor: o.fee_minor == null ? 0 : units(o.fee_minor),
    });

  const transactions = [
    tx({ kind: "income", amount_minor: 3120000, account_id: acc.bank, category_id: cat.salary, note: monthName(0) + " salary", occurred_on: day(9), occurred_min: 545 }),
    tx({ kind: "transfer", amount_minor: 400000, account_id: acc.bank, to_account_id: acc.cash, note: "Cash for the month", occurred_on: day(9), occurred_min: 600 }),
    tx({ kind: "transfer", amount_minor: 250000, account_id: acc.bank, to_account_id: acc.gopay, to_amount_minor: 2853881, note: "Top up rupiah", occurred_on: day(8), occurred_min: 615 }),
    tx({ kind: "expense", amount_minor: 68000, account_id: acc.bank, category_id: cat.education, note: "Korean class", occurred_on: day(8), occurred_min: 1080 }),
    tx({ kind: "expense", amount_minor: 236800, currency: "IDR", rate: IDR, account_id: acc.gopay, category_id: cat.groceries, note: "Hypermart", occurred_on: day(7), occurred_min: 1325 }),
    tx({ kind: "expense", amount_minor: 12400, account_id: acc.cash, category_id: cat.food, note: "Kimbap", occurred_on: day(6), occurred_min: 745 }),
    tx({ kind: "expense", amount_minor: 4900, account_id: acc.cash, category_id: cat.transport, note: "Subway", occurred_on: day(6), occurred_min: 505 }),
    tx({ kind: "expense", amount_minor: 118200, currency: "IDR", rate: IDR, account_id: acc.gopay, category_id: cat.food, note: "Bebek, GoFood", occurred_on: day(5), occurred_min: 1215 }),
    tx({ kind: "expense", amount_minor: 43000, account_id: acc.bank, category_id: cat.shopping, note: "Uniqlo socks", occurred_on: day(4), occurred_min: 1400 }),
    tx({ kind: "expense", amount_minor: 15000, account_id: acc.cash, category_id: cat.fun, note: "Cinema", occurred_on: day(4), occurred_min: 1265 }),
    tx({ kind: "expense", amount_minor: 75000, currency: "IDR", rate: IDR, account_id: acc.gopay, category_id: cat.household, note: "Haircut at Bejo", occurred_on: day(3), occurred_min: 1100 }),
    tx({ kind: "expense", amount_minor: 38000, account_id: acc.cash, category_id: cat.social, note: "Dinner with Minjun", occurred_on: day(2), occurred_min: 1230 }),
    tx({ kind: "expense", amount_minor: 9800, account_id: acc.cash, category_id: cat.food, note: "Coffee", occurred_on: day(1), occurred_min: 610 }),
    tx({ kind: "expense", amount_minor: 22500, account_id: acc.bank, category_id: cat.health, note: "Pharmacy", occurred_on: day(1), occurred_min: 1140 }),
    tx({ kind: "expense", amount_minor: 6200, account_id: acc.cash, category_id: cat.food, note: "Gimbap Cheonguk", occurred_on: day(0), occurred_min: 730 }),
    tx({ kind: "expense", amount_minor: 3300, account_id: acc.cash, category_id: cat.transport, note: "Bus", occurred_on: day(0), occurred_min: 1085 }),
    // Last month, so the period arrows and the trend chart have something.
    tx({ kind: "income", amount_minor: 3120000, account_id: acc.bank, category_id: cat.salary, note: monthName(-1) + " salary", occurred_on: lastMonth(3), occurred_min: 545 }),
    tx({ kind: "expense", amount_minor: 412000, account_id: acc.bank, category_id: cat.household, note: "Rent share", occurred_on: lastMonth(4), occurred_min: 600 }),
    tx({ kind: "expense", amount_minor: 91000, account_id: acc.cash, category_id: cat.food, note: "Groceries week 1", occurred_on: lastMonth(7), occurred_min: 1200 }),
    tx({ kind: "expense", amount_minor: 64000, account_id: acc.bank, category_id: cat.fun, note: "Concert", occurred_on: lastMonth(11), occurred_min: 1290 }),
  ];

  const budgets = [
    M.normalizeBudget({ id: M.uuid(), user_id: UID, category_id: null, amount_minor: units(1200000), currency: "KRW" }),
    M.normalizeBudget({ id: M.uuid(), user_id: UID, category_id: cat.food, amount_minor: units(300000), currency: "KRW" }),
    M.normalizeBudget({ id: M.uuid(), user_id: UID, category_id: cat.transport, amount_minor: units(60000), currency: "KRW" }),
  ];

  const settings = M.normalizeSettings({
    user_id: UID,
    main_currency: "KRW",
    theme: "dark",
    lang: "en",
    month_start: 1,
    rates: { IDR },
  });

  return { settings, accounts, categories, transactions, budgets };
}
