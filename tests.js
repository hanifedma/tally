// ============================================================
//  Tally — tests for money.js.
//
//  Everything in money.js is pure, so all of it is testable without a
//  browser, a network or a database. Open tests.html to run these in the
//  browser, or `node tools/run-tests.mjs` to run them in a terminal —
//  both import this same file.
//
//  What is worth a test here is not "does formatMoney call Intl". It is
//  the handful of places where money quietly goes wrong: rounding, a
//  currency with no decimals, a transfer between two currencies, a month
//  that starts on the 25th, and a rate that was frozen against a main
//  currency you have since changed.
// ============================================================

import * as M from "./money.js?v=1";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function assert(cond, message) {
  if (!cond) throw new Error(message || "expected true");
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error((message ? message + ": " : "") + "expected " + b + ", got " + a);
  }
}

function near(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error((message ? message + ": " : "") + "expected ~" + expected + ", got " + actual);
  }
}

// ------------------------------------------------------------
//  Formatting
// ------------------------------------------------------------

test("won and rupiah are whole numbers, dollars are not", () => {
  eq(M.formatMoney(755297, "KRW"), "₩755,297");
  eq(M.formatMoney(118200, "IDR"), "Rp118,200");
  eq(M.formatMoney(1240, "USD"), "$12.40");
  eq(M.formatMoney(0, "KRW"), "₩0");
});

test("negatives use a real minus sign, not a hyphen", () => {
  const s = M.formatMoney(-427726, "KRW");
  eq(s, "−₩427,726");
  assert(!s.includes("-"), "should not contain an ASCII hyphen");
});

test("sign: always adds a plus, never drops the minus", () => {
  eq(M.formatMoney(500, "KRW", { sign: "always" }), "+₩500");
  eq(M.formatMoney(-500, "KRW", { sign: "always" }), "−₩500");
  eq(M.formatMoney(-500, "KRW", { sign: "never" }), "₩500");
  eq(M.formatMoney(0, "KRW", { sign: "always" }), "₩0");
});

test("some currencies put the symbol after the number", () => {
  // A non-breaking space, so the amount and its symbol stay one word.
  eq(M.formatMoney(120000, "VND"), "120,000 ₫");
  eq(M.formatMoney(12345, "SEK"), "123.45 kr");
});

test("an unknown currency still formats rather than throwing", () => {
  eq(M.formatMoney(1234, "XYZ"), "12.34");
});

test("compact form only kicks in where it earns its place", () => {
  eq(M.formatCompact(8400, "KRW"), "₩8,400");
  eq(M.formatCompact(755297, "KRW"), "₩755K", "three significant figures is enough");
  eq(M.formatCompact(2260452, "KRW"), "₩2.3M");
  eq(M.formatCompact(-2260452, "KRW"), "−₩2.3M");
});

// ------------------------------------------------------------
//  The amount field
// ------------------------------------------------------------

test("arithmetic in the amount field", () => {
  eq(M.evalExpression("12000+3400"), 15400);
  eq(M.evalExpression("2*3+4"), 10);
  eq(M.evalExpression("2+3*4"), 14);
  eq(M.evalExpression("(2+3)*4"), 20);
  eq(M.evalExpression("10/4"), 2.5);
  eq(M.evalExpression("100 - 20 - 30"), 50);
  eq(M.evalExpression("-5+8"), 3);
  eq(M.evalExpression("1,200"), 1200);
  eq(M.evalExpression("12×3"), 36);
  eq(M.evalExpression("12÷4"), 3);
});

test("an unfinished or malformed sum is null, not a guess", () => {
  eq(M.evalExpression("12+"), null);
  eq(M.evalExpression("(12"), null);
  eq(M.evalExpression("12)"), null);
  eq(M.evalExpression("1.2.3"), null);
  eq(M.evalExpression("10/0"), null);
  eq(M.evalExpression(""), null);
  eq(M.evalExpression("abc"), null);
  eq(M.evalExpression(null), null);
});

test("the amount field is not an eval() in disguise", () => {
  // Anything that is not digits and arithmetic is refused before parsing.
  eq(M.evalExpression("alert(1)"), null);
  eq(M.evalExpression("globalThis"), null);
  eq(M.evalExpression("1;2"), null);
  eq(M.evalExpression("[].constructor"), null);
});

test("amounts become whole minor units", () => {
  eq(M.parseAmountToMinor("12000", "KRW"), 12000);
  eq(M.parseAmountToMinor("12.40", "USD"), 1240);
  eq(M.parseAmountToMinor("12.345", "USD"), 1235, "rounds to the nearest cent");
  eq(M.parseAmountToMinor("118200.4", "IDR"), 118200, "rupiah has no fractions to keep");
  eq(M.parseAmountToMinor("-500", "KRW"), 500, "direction is the kind's job");
  eq(M.parseAmountToMinor("1e20", "KRW"), null, "beyond what can be stored");
  eq(M.parseAmountToMinor("", "KRW"), null);
});

test("minorToInput round-trips", () => {
  for (const [minor, code] of [[755297, "KRW"], [1240, "USD"], [118200, "IDR"], [5, "USD"]]) {
    eq(M.parseAmountToMinor(M.minorToInput(minor, code), code), minor, code);
  }
});

// ------------------------------------------------------------
//  Dates
// ------------------------------------------------------------

test("day arithmetic crosses months and years", () => {
  eq(M.addDays("2026-08-31", 1), "2026-09-01");
  eq(M.addDays("2026-01-01", -1), "2025-12-31");
  eq(M.addDays("2024-02-28", 1), "2024-02-29", "2024 is a leap year");
  eq(M.addDays("2026-02-28", 1), "2026-03-01");
});

test("adding months clamps to a shorter month", () => {
  eq(M.addMonths("2026-01-31", 1), "2026-02-28");
  eq(M.addMonths("2026-03-31", -1), "2026-02-28");
  eq(M.addMonths("2026-12-15", 1), "2027-01-15");
  eq(M.addMonths("2026-01-15", -1), "2025-12-15");
  eq(M.addMonths("2026-08-30", 0), "2026-08-30");
});

test("weekdays and spans", () => {
  eq(M.weekdayOf("2026-08-30"), 0, "30 August 2026 is a Sunday");
  eq(M.weekdayOf("2024-01-07"), 0);
  eq(M.daysBetween("2026-08-01", "2026-08-31"), 30);
  eq(M.daysBetween("2026-08-31", "2026-08-01"), -30);
});

test("a calendar month is the default period", () => {
  eq(M.periodOf("2026-08-15", 1), { start: "2026-08-01", end: "2026-08-31" });
  eq(M.periodOf("2026-02-05", 1), { start: "2026-02-01", end: "2026-02-28" });
  eq(M.periodOf("2026-12-31", 1), { start: "2026-12-01", end: "2026-12-31" });
});

test("a month can start on payday instead", () => {
  // Paid on the 25th: the 24th is still last month's money.
  eq(M.periodOf("2026-08-24", 25), { start: "2026-07-25", end: "2026-08-24" });
  eq(M.periodOf("2026-08-25", 25), { start: "2026-08-25", end: "2026-09-24" });
  eq(M.periodOf("2026-01-03", 25), { start: "2025-12-25", end: "2026-01-24" });
});

test("periods step forward and back without drifting", () => {
  let p = M.periodOf("2026-08-15", 25);
  for (let i = 0; i < 14; i++) p = M.shiftPeriod(p, 1, 25);
  for (let i = 0; i < 14; i++) p = M.shiftPeriod(p, -1, 25);
  eq(p, M.periodOf("2026-08-15", 25), "fourteen months out and back is where it started");
});

test("consecutive periods touch with no gap and no overlap", () => {
  for (const startDay of [1, 15, 25, 28]) {
    let p = M.periodOf("2026-01-10", startDay);
    for (let i = 0; i < 24; i++) {
      const next = M.shiftPeriod(p, 1, startDay);
      eq(M.addDays(p.end, 1), next.start, "day " + startDay + " period " + i);
      p = next;
    }
  }
});

test("a day key is validated, not trusted", () => {
  assert(M.isDayKey("2026-08-30"));
  assert(!M.isDayKey("2026-8-30"));
  assert(!M.isDayKey("2026-13-01"));
  assert(!M.isDayKey("nope"));
  assert(!M.isDayKey(null));
});

// ------------------------------------------------------------
//  Exchange
// ------------------------------------------------------------

const CTX = { main_currency: "KRW", rates: { IDR: 0.0875, USD: 1380 } };

const tx = (over = {}) =>
  M.normalizeTx({
    id: over.id || "t" + Math.random(),
    kind: "expense",
    amount_minor: 0,
    currency: "KRW",
    rate: 1,
    rate_base: "KRW",
    occurred_on: "2026-08-30",
    occurred_min: 600,
    ...over,
  });

test("same currency needs no conversion", () => {
  eq(M.toMain(tx({ amount_minor: 12400, currency: "KRW" }), CTX), 12400);
});

test("rupiah converts into won at the rate frozen on the row", () => {
  const row = tx({ amount_minor: 118200, currency: "IDR", rate: 0.0875, rate_base: "KRW" });
  eq(M.toMain(row, CTX), Math.round(118200 * 0.0875));
});

test("an old row keeps the price it was recorded at", () => {
  const old = tx({ amount_minor: 100000, currency: "IDR", rate: 0.09, rate_base: "KRW" });
  const now = { main_currency: "KRW", rates: { IDR: 0.07 } };
  eq(M.toMain(old, now), 9000, "today's rate must not rewrite last March");
});

test("changing the main currency re-expresses old rows through settings", () => {
  // Recorded when won was the main currency: 100,000 IDR at 0.0875 = 8,750 KRW.
  const row = tx({ amount_minor: 100000, currency: "IDR", rate: 0.0875, rate_base: "KRW" });
  // Main currency is now the dollar; one won is worth 1/1380 of a dollar.
  const usdCtx = { main_currency: "USD", rates: { KRW: 1 / 1380, IDR: 0.0875 / 1380 } };
  // 8,750 KRW ≈ $6.34 → 634 cents.
  near(M.toMain(row, usdCtx), 634, 1);
});

test("decimals differ between the two currencies", () => {
  // $12.40 into won, at 1380 won to the dollar.
  const row = tx({ amount_minor: 1240, currency: "USD", rate: 1380, rate_base: "KRW" });
  eq(M.toMain(row, CTX), 17112);
});

test("a currency with no rate cannot be saved in the first place", () => {
  // The alternative — save it and guess 1:1 — files 50 baht as 50 won and
  // never mentions it again. Better to ask for the rate once.
  assert(M.rateMissing("THB", "KRW", CTX.rates));
  const draft = {
    kind: "expense", amount: "5000", currency: "THB",
    account_id: "a1", category_id: "c1",
  };
  eq(M.validateTransaction(draft, CTX), "tx.needRate");
  eq(M.validateTransaction({ ...draft, currency: "IDR" }, CTX), null, "IDR has a rate");
  eq(M.validateTransaction({ ...draft, currency: "KRW" }, CTX), null, "the main currency needs none");
});

test("what else stops a transaction being saved", () => {
  const base = { kind: "expense", amount: "1000", currency: "KRW", account_id: "a1", category_id: "c1" };
  eq(M.validateTransaction(base, CTX), null);
  eq(M.validateTransaction({ ...base, amount: "" }, CTX), "tx.needAmount");
  eq(M.validateTransaction({ ...base, amount: "0" }, CTX), "tx.needAmount");
  eq(M.validateTransaction({ ...base, amount: "12+" }, CTX), "tx.calcBad");
  eq(M.validateTransaction({ ...base, account_id: null }, CTX), "tx.needAccount");
  eq(M.validateTransaction({ ...base, category_id: null }, CTX), "tx.needCategory");

  const move = { ...base, kind: "transfer", category_id: null };
  eq(M.validateTransaction(move, CTX), "tx.needToAccount");
  eq(M.validateTransaction({ ...move, to_account_id: "a1" }, CTX), "tx.sameAccount");
  eq(M.validateTransaction({ ...move, to_account_id: "a2" }, CTX), null);
});

test("converting between two non-main currencies", () => {
  // 1,000,000 IDR = 87,500 KRW = $63.41 → 6341 cents.
  near(M.convertMinor(1000000, "IDR", "USD", CTX), 6341, 2);
  eq(M.convertMinor(500, "KRW", "KRW", CTX), 500);
});

// ------------------------------------------------------------
//  Balances and totals
// ------------------------------------------------------------

const accounts = [
  M.normalizeAccount({ id: "a1", name: "Cash", currency: "KRW", opening_minor: 100000, position: 0 }),
  M.normalizeAccount({ id: "a2", name: "Gopay", currency: "IDR", opening_minor: 50000, position: 1 }),
  M.normalizeAccount({ id: "a3", name: "Card", kind: "card", currency: "KRW", opening_minor: -20000, position: 2 }),
];

test("a balance is opening, plus what came in, minus what went out", () => {
  const rows = [
    tx({ kind: "expense", amount_minor: 12000, currency: "KRW", account_id: "a1" }),
    tx({ kind: "income", amount_minor: 500000, currency: "KRW", account_id: "a1" }),
    tx({ kind: "expense", amount_minor: 118200, currency: "IDR", account_id: "a2", rate: 0.0875, rate_base: "KRW" }),
  ];
  const b = M.accountBalances(accounts, rows);
  eq(b.get("a1"), 100000 - 12000 + 500000);
  eq(b.get("a2"), 50000 - 118200);
  eq(b.get("a3"), -20000, "an untouched account keeps its opening balance");
});

test("a transfer leaves one account and lands in the other", () => {
  const rows = [
    tx({ kind: "transfer", amount_minor: 30000, currency: "KRW", account_id: "a1", to_account_id: "a3" }),
  ];
  const b = M.accountBalances(accounts, rows);
  eq(b.get("a1"), 70000);
  eq(b.get("a3"), 10000);
});

test("a cross-currency transfer lands the amount that actually arrived", () => {
  const rows = [
    tx({
      kind: "transfer",
      amount_minor: 100000,
      currency: "KRW",
      account_id: "a1",
      to_account_id: "a2",
      to_amount_minor: 1142857,
    }),
  ];
  const b = M.accountBalances(accounts, rows);
  eq(b.get("a1"), 0, "won left the won account");
  eq(b.get("a2"), 50000 + 1142857, "rupiah arrived in the rupiah account");
});

test("a transfer is neither income nor spending", () => {
  const rows = [
    tx({ kind: "income", amount_minor: 1832726, currency: "KRW", account_id: "a1" }),
    tx({ kind: "expense", amount_minor: 260452, currency: "KRW", account_id: "a1" }),
    tx({ kind: "transfer", amount_minor: 5444798, currency: "KRW", account_id: "a1", to_account_id: "a3" }),
  ];
  const totals = M.totals(rows, CTX);
  eq(totals.income, 1832726);
  eq(totals.expense, 260452);
  eq(totals.net, 1832726 - 260452);
});

test("net worth converts every account into one currency", () => {
  const rows = [];
  // 100,000 KRW + (50,000 IDR × 0.0875 = 4,375 KRW) + (−20,000 KRW)
  eq(M.netWorth(accounts, rows, CTX), 100000 + 4375 - 20000);
});

test("an archived account is not part of net worth", () => {
  const withArchived = [
    ...accounts,
    M.normalizeAccount({ id: "a4", name: "Old", currency: "KRW", opening_minor: 999999, archived: true }),
  ];
  eq(M.netWorth(withArchived, [], CTX), M.netWorth(accounts, [], CTX));
});

// ------------------------------------------------------------
//  Breakdowns
// ------------------------------------------------------------

test("spending splits by category, largest first, and the shares add to one", () => {
  const rows = [
    tx({ kind: "expense", amount_minor: 30000, category_id: "c1" }),
    tx({ kind: "expense", amount_minor: 10000, category_id: "c2" }),
    tx({ kind: "expense", amount_minor: 60000, category_id: "c3" }),
    tx({ kind: "income", amount_minor: 999999, category_id: "c9" }),
  ];
  const { rows: slices, total } = M.byCategory(rows, "expense", CTX);
  eq(total, 100000);
  eq(slices.map((s) => s.category_id), ["c3", "c1", "c2"]);
  near(slices.reduce((s, r) => s + r.share, 0), 1, 1e-9);
});

test("money with no category is still counted", () => {
  const rows = [
    tx({ kind: "expense", amount_minor: 5000, category_id: null }),
    tx({ kind: "expense", amount_minor: 5000, category_id: "c1" }),
  ];
  const { rows: slices, total } = M.byCategory(rows, "expense", CTX);
  eq(total, 10000);
  eq(slices.length, 2);
  assert(slices.some((s) => s.category_id === null), "an uncategorised slice exists");
});

test("budgets report how far over, not just that they are over", () => {
  const categories = [M.normalizeCategory({ id: "c1", name: "Food", kind: "expense" })];
  const budgets = [
    M.normalizeBudget({ id: "b0", category_id: null, amount_minor: 300000, currency: "KRW" }),
    M.normalizeBudget({ id: "b1", category_id: "c1", amount_minor: 200000, currency: "KRW" }),
  ];
  const rows = [
    tx({ kind: "expense", amount_minor: 500000, category_id: "c1" }),
    tx({ kind: "expense", amount_minor: 55297, category_id: "c2" }),
  ];
  const progress = M.budgetProgress(budgets, rows, categories, CTX);
  eq(progress[0].category_id, null, "the overall budget comes first");
  eq(progress[0].spent, 555297);
  eq(progress[0].limit, 300000);
  eq(progress[0].remaining, -255297);
  near(progress[0].ratio, 1.85099, 0.0001);
  const food = progress.find((p) => p.category_id === "c1");
  eq(food.spent, 500000, "a category budget counts only that category");
});

test("a budget set in another currency is converted", () => {
  const budgets = [M.normalizeBudget({ id: "b", category_id: null, amount_minor: 100, currency: "USD" })];
  const progress = M.budgetProgress(budgets, [], [], CTX);
  eq(progress[0].limit, 1380, "$1.00 is 1,380 won");
});

// ------------------------------------------------------------
//  Ordering and grouping
// ------------------------------------------------------------

test("the log runs newest first, within the day as well as across days", () => {
  const rows = [
    tx({ id: "x", occurred_on: "2026-08-29", occurred_min: 900 }),
    tx({ id: "y", occurred_on: "2026-08-30", occurred_min: 480 }),
    tx({ id: "z", occurred_on: "2026-08-30", occurred_min: 1200 }),
  ];
  const days = M.groupByDay(rows, CTX);
  eq(days.map((d) => d.key), ["2026-08-30", "2026-08-29"]);
  eq(days[0].items.map((i) => i.id), ["z", "y"]);
});

test("a day carries its own two totals", () => {
  const rows = [
    tx({ kind: "expense", amount_minor: 38100, occurred_on: "2026-08-30" }),
    tx({ kind: "income", amount_minor: 100, occurred_on: "2026-08-30" }),
    tx({ kind: "transfer", amount_minor: 500000, occurred_on: "2026-08-30", account_id: "a1", to_account_id: "a2" }),
  ];
  const [day] = M.groupByDay(rows, CTX);
  eq(day.expense, 38100);
  eq(day.income, 100);
});

test("categories and accounts sort by position, then by name", () => {
  const list = [
    M.normalizeCategory({ id: "1", name: "Zebra", kind: "expense", position: 0 }),
    M.normalizeCategory({ id: "2", name: "Apple", kind: "expense", position: 0 }),
    M.normalizeCategory({ id: "3", name: "Middle", kind: "expense", position: -1 }),
  ];
  eq([...list].sort(M.byPosition).map((c) => c.name), ["Middle", "Apple", "Zebra"]);
});

// ------------------------------------------------------------
//  Notes and search
// ------------------------------------------------------------

test("note suggestions match anywhere in the note, not just the start", () => {
  const rows = [
    tx({ id: "1", note: "Coupang many things", occurred_on: "2026-08-30" }),
    tx({ id: "2", note: "Jinlo, food and fruit", occurred_on: "2026-08-29" }),
    tx({ id: "3", note: "Coupang many things", occurred_on: "2026-08-28" }),
  ];
  const s = M.noteSuggestions(rows, "coup");
  eq(s.length, 1, "the same note is offered once");
  eq(s[0].note, "Coupang many things");
  eq(M.noteSuggestions(rows, "food").length, 1);
  eq(M.noteSuggestions(rows, "").length, 2, "with no query, every distinct note");
});

test("search reaches notes, categories and accounts", () => {
  const categories = [M.normalizeCategory({ id: "c1", name: "Food", kind: "expense" })];
  const rows = [
    tx({ id: "1", note: "Bebek, gofood", account_id: "a2", category_id: "c1" }),
    tx({ id: "2", note: "Haircut", account_id: "a1", category_id: null }),
  ];
  eq(M.searchTransactions(rows, "gofood", categories, accounts).length, 1);
  eq(M.searchTransactions(rows, "cash", categories, accounts).map((r) => r.id), ["2"]);
  eq(M.searchTransactions(rows, "food", categories, accounts).map((r) => r.id), ["1"],
     "one row matches on its note, its category, or both");
  eq(M.searchTransactions(rows, "", categories, accounts).length, 2, "an empty query filters nothing");
});

// ------------------------------------------------------------
//  Rows arriving damaged
// ------------------------------------------------------------

test("a row with nothing in it still produces a usable object", () => {
  const t0 = M.normalizeTx(null);
  eq(t0.kind, "expense");
  eq(t0.amount_minor, 0);
  eq(t0.currency, "KRW");
  assert(M.isDayKey(t0.occurred_on));
  eq(M.normalizeAccount(null).name, "—");
  eq(M.normalizeCategory(undefined).kind, "expense");
});

test("nonsense values are clamped rather than believed", () => {
  const t1 = M.normalizeTx({
    id: "x",
    kind: "sideways",
    amount_minor: -500,
    currency: "NOPE",
    rate: -3,
    occurred_min: 99999,
    note: "n".repeat(400),
  });
  eq(t1.kind, "expense");
  eq(t1.amount_minor, 0);
  eq(t1.currency, "KRW");
  eq(t1.rate, 1);
  eq(t1.occurred_min, 1439);
  eq(t1.note.length, 280);
});

test("a transfer cannot smuggle in a category, and an expense cannot smuggle a destination", () => {
  const move = M.normalizeTx({ id: "1", kind: "transfer", category_id: "c1", to_account_id: "a2" });
  eq(move.category_id, null);
  eq(move.to_account_id, "a2");
  const spend = M.normalizeTx({ id: "2", kind: "expense", to_account_id: "a2", to_amount_minor: 5 });
  eq(spend.to_account_id, null);
  eq(spend.to_amount_minor, null);
});

test("settings keep only rates that are real numbers for real currencies", () => {
  const s = M.normalizeSettings({
    main_currency: "IDR",
    theme: "sideways",
    lang: "fr",
    month_start: 99,
    week_start: -4,
    rates: { KRW: "11.4", NOPE: 2, USD: 0, EUR: "abc", JPY: -1 },
  });
  eq(s.main_currency, "IDR");
  eq(s.theme, "dark");
  eq(s.lang, "en");
  eq(s.month_start, 28);
  eq(s.week_start, 0);
  eq(s.rates, { KRW: 11.4 });
});

// ------------------------------------------------------------
//  Export
// ------------------------------------------------------------

test("the CSV escapes anything that would break a column", () => {
  const categories = [M.normalizeCategory({ id: "c1", name: 'Food, "real"', kind: "expense" })];
  const rows = [
    tx({ id: "1", amount_minor: 118200, currency: "IDR", rate: 0.0875, rate_base: "KRW",
         account_id: "a2", category_id: "c1", note: 'He said "hi", then left', occurred_min: 725 }),
  ];
  const csv = M.toCsv(rows, { accounts, categories, ctx: CTX });
  const lines = csv.split("\r\n");
  assert(csv.charCodeAt(0) === 0xfeff, "starts with a byte order mark for Excel");
  assert(lines[0].includes("krw_value"), "names the main currency column");
  assert(lines[1].includes('"He said ""hi"", then left"'), "quotes are doubled");
  assert(lines[1].includes('"Food, ""real"""'), "a comma inside a field is quoted");
  assert(lines[1].startsWith("2026-08-30,12:05,expense,"), "date and time lead the row");
});

test("the CSV carries both what was paid and what it was worth", () => {
  const rows = [tx({ id: "1", amount_minor: 118200, currency: "IDR", rate: 0.0875, rate_base: "KRW" })];
  const line = M.toCsv(rows, { accounts, categories: [], ctx: CTX }).split("\r\n")[1];
  assert(line.includes(",IDR,118200,"), "the original amount, in its own currency");
  assert(line.endsWith("," + Math.round(118200 * 0.0875)), "and its value in won");
});

// ------------------------------------------------------------
//  Ids
// ------------------------------------------------------------

test("random ids look like UUIDs and do not repeat", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const id = M.uuid();
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id), id);
    assert(!seen.has(id), "collision");
    seen.add(id);
  }
});

test("a derived id is the same everywhere, and different per user and per name", async () => {
  const a = await M.derivedId("user-1", "category:food");
  const b = await M.derivedId("user-1", "category:food");
  const c = await M.derivedId("user-2", "category:food");
  const d = await M.derivedId("user-1", "category:transport");
  eq(a, b, "the same inputs always give the same id");
  assert(a !== c, "a different user gets a different id");
  assert(a !== d, "a different name gets a different id");
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a), a);
});

test("the seed set covers both sides of the ledger and has no duplicate slugs", () => {
  const slugs = new Set(M.SEED_CATEGORIES.map((s) => s.slug));
  eq(slugs.size, M.SEED_CATEGORIES.length);
  assert(M.SEED_CATEGORIES.some((s) => s.kind === "income"));
  assert(M.SEED_CATEGORIES.some((s) => s.kind === "expense"));
  for (const s of M.SEED_CATEGORIES) {
    assert(s.en && s.ko, s.slug + " needs both languages");
  }
  for (const s of M.SEED_ACCOUNTS) {
    assert(s.en && s.ko, s.slug + " needs both languages");
  }
});

// ------------------------------------------------------------
//  Runner
// ------------------------------------------------------------

export async function runTests() {
  const results = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e.message });
    }
  }
  return {
    results,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}
