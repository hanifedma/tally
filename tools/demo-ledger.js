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

  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  };

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

  const accounts = [
    { id: acc.cash, name: "Cash", kind: "cash", currency: "KRW", opening_minor: 180000, color: "green", position: 0 },
    { id: acc.bank, name: "KB Bank", kind: "bank", currency: "KRW", opening_minor: 7420000, color: "indigo", position: 1 },
    { id: acc.gopay, name: "GoPay", kind: "ewallet", currency: "IDR", opening_minor: 1450000, color: "sky", position: 2 },
    { id: acc.old, name: "Old wallet", kind: "cash", currency: "KRW", opening_minor: 0, color: "gray", position: 3, archived: true },
  ].map((a) => M.normalizeAccount({ ...a, user_id: UID }));

  // What one rupiah was worth in won on the day each row was entered. It is
  // frozen onto the row, which is why `rate_base` is the main currency and
  // never the transaction's own.
  const IDR = 0.0876;
  const tx = (o) =>
    M.normalizeTx({ id: M.uuid(), user_id: UID, rate_base: "KRW", rate: 1, currency: "KRW", ...o });

  const transactions = [
    tx({ kind: "income", amount_minor: 3120000, account_id: acc.bank, category_id: cat.salary, note: "August salary", occurred_on: day(9), occurred_min: 545 }),
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
    tx({ kind: "income", amount_minor: 3120000, account_id: acc.bank, category_id: cat.salary, note: "July salary", occurred_on: day(39), occurred_min: 545 }),
    tx({ kind: "expense", amount_minor: 412000, account_id: acc.bank, category_id: cat.household, note: "Rent share", occurred_on: day(38), occurred_min: 600 }),
    tx({ kind: "expense", amount_minor: 91000, account_id: acc.cash, category_id: cat.food, note: "Groceries week 1", occurred_on: day(35), occurred_min: 1200 }),
    tx({ kind: "expense", amount_minor: 64000, account_id: acc.bank, category_id: cat.fun, note: "Concert", occurred_on: day(31), occurred_min: 1290 }),
  ];

  const budgets = [
    M.normalizeBudget({ id: M.uuid(), user_id: UID, category_id: null, amount_minor: 1200000, currency: "KRW" }),
    M.normalizeBudget({ id: M.uuid(), user_id: UID, category_id: cat.food, amount_minor: 300000, currency: "KRW" }),
    M.normalizeBudget({ id: M.uuid(), user_id: UID, category_id: cat.transport, amount_minor: 60000, currency: "KRW" }),
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
