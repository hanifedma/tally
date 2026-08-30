// ============================================================
//  Tally — the money itself.
//
//  Everything in this file is pure: given the same rows it returns the same
//  answer, touches no DOM and knows nothing about Supabase. That is what
//  makes it testable (tests.html runs the lot in a browser) and what makes
//  it safe to mirror line for line in the Android app's core/ package —
//  the two have to agree on every number they show.
//
//  Field names are the database's, in snake_case, all the way through the
//  app. A camelCase layer in between would read a little nicer and would be
//  one more place for a typo to become a silently missing value.
// ============================================================

// ------------------------------------------------------------
//  Currencies
//
//  `decimals` is what Tally shows, which is not always what the standard
//  says. IDR is formally a two-decimal currency; nobody has priced anything
//  in sen for decades, and "Rp 118,200.00" is two characters of noise on
//  every row. Same reasoning, same answer, for KRW, JPY and VND.
//
//  Amounts are stored as integers of the smallest unit shown here, so a
//  currency's `decimals` must not change once you have entered anything in
//  it — it is the scale of every number already saved.
// ------------------------------------------------------------
export const CURRENCIES = {
  KRW: { symbol: "₩", decimals: 0, name: { en: "Korean won", ko: "대한민국 원" } },
  IDR: { symbol: "Rp", decimals: 0, name: { en: "Indonesian rupiah", ko: "인도네시아 루피아" } },
  USD: { symbol: "$", decimals: 2, name: { en: "US dollar", ko: "미국 달러" } },
  EUR: { symbol: "€", decimals: 2, name: { en: "Euro", ko: "유로" } },
  JPY: { symbol: "¥", decimals: 0, name: { en: "Japanese yen", ko: "일본 엔" } },
  GBP: { symbol: "£", decimals: 2, name: { en: "Pound sterling", ko: "영국 파운드" } },
  CNY: { symbol: "CN¥", decimals: 2, name: { en: "Chinese yuan", ko: "중국 위안" } },
  SGD: { symbol: "S$", decimals: 2, name: { en: "Singapore dollar", ko: "싱가포르 달러" } },
  MYR: { symbol: "RM", decimals: 2, name: { en: "Malaysian ringgit", ko: "말레이시아 링깃" } },
  THB: { symbol: "฿", decimals: 2, name: { en: "Thai baht", ko: "태국 바트" } },
  PHP: { symbol: "₱", decimals: 2, name: { en: "Philippine peso", ko: "필리핀 페소" } },
  VND: { symbol: "₫", decimals: 0, name: { en: "Vietnamese dong", ko: "베트남 동" } },
  INR: { symbol: "₹", decimals: 2, name: { en: "Indian rupee", ko: "인도 루피" } },
  HKD: { symbol: "HK$", decimals: 2, name: { en: "Hong Kong dollar", ko: "홍콩 달러" } },
  TWD: { symbol: "NT$", decimals: 0, name: { en: "New Taiwan dollar", ko: "신 타이완 달러" } },
  AUD: { symbol: "A$", decimals: 2, name: { en: "Australian dollar", ko: "호주 달러" } },
  CAD: { symbol: "C$", decimals: 2, name: { en: "Canadian dollar", ko: "캐나다 달러" } },
  CHF: { symbol: "CHF", decimals: 2, name: { en: "Swiss franc", ko: "스위스 프랑" } },
  NZD: { symbol: "NZ$", decimals: 2, name: { en: "New Zealand dollar", ko: "뉴질랜드 달러" } },
  AED: { symbol: "AED", decimals: 2, name: { en: "UAE dirham", ko: "아랍에미리트 디르함" } },
  SAR: { symbol: "SAR", decimals: 2, name: { en: "Saudi riyal", ko: "사우디 리얄" } },
  TRY: { symbol: "₺", decimals: 2, name: { en: "Turkish lira", ko: "튀르키예 리라" } },
  BRL: { symbol: "R$", decimals: 2, name: { en: "Brazilian real", ko: "브라질 헤알" } },
  MXN: { symbol: "MX$", decimals: 2, name: { en: "Mexican peso", ko: "멕시코 페소" } },
  ZAR: { symbol: "R", decimals: 2, name: { en: "South African rand", ko: "남아프리카 랜드" } },
  SEK: { symbol: "kr", decimals: 2, name: { en: "Swedish krona", ko: "스웨덴 크로나" } },
  NOK: { symbol: "kr", decimals: 2, name: { en: "Norwegian krone", ko: "노르웨이 크로네" } },
  DKK: { symbol: "kr", decimals: 2, name: { en: "Danish krone", ko: "덴마크 크로네" } },
  PLN: { symbol: "zł", decimals: 2, name: { en: "Polish złoty", ko: "폴란드 즈워티" } },
  RUB: { symbol: "₽", decimals: 2, name: { en: "Russian rouble", ko: "러시아 루블" } },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);
export const DEFAULT_CURRENCY = "KRW";

/** Currencies whose symbol reads better after the number than before it. */
const SUFFIX_SYMBOL = new Set(["SEK", "NOK", "DKK", "PLN", "VND"]);

/** U+00A0. See formatMoney. */
const NBSP = " ";

const UNKNOWN = { symbol: "", decimals: 2, name: { en: "", ko: "" } };

export function currencyOf(code) {
  return CURRENCIES[code] || UNKNOWN;
}

/** How many minor units make one of the currency's major units. */
export function minorPerUnit(code) {
  return Math.pow(10, currencyOf(code).decimals);
}

// ------------------------------------------------------------
//  Formatting
// ------------------------------------------------------------

// Intl.NumberFormat is expensive to construct and gets called once per row,
// so keep the ones we have made.
const nfCache = new Map();
function numberFormat(locale, decimals, grouping = true) {
  const key = locale + "|" + decimals + "|" + grouping;
  let nf = nfCache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: grouping,
    });
    nfCache.set(key, nf);
  }
  return nf;
}

/**
 * An amount, as a person reads it: "₩12,400", "Rp 118,200", "$12.40".
 *
 * Only the digits come from Intl — the symbol and its side are ours, so that
 * the same amount looks identical in Korean and in English. A ledger where
 * switching language moves the currency symbol is a ledger you have to
 * re-read.
 *
 * @param minor  integer, in the currency's smallest shown unit
 * @param code   ISO 4217 code
 * @param opts.locale    BCP-47 tag for digit grouping (default en-US)
 * @param opts.sign      "auto" (default, a minus when negative) | "always" | "never"
 * @param opts.symbol    false to omit the currency symbol entirely
 */
export function formatMoney(minor, code, opts = {}) {
  const { locale = "en-US", sign = "auto", symbol = true } = opts;
  const cur = currencyOf(code);
  const n = Number(minor) || 0;
  const abs = Math.abs(n) / Math.pow(10, cur.decimals);
  const digits = numberFormat(locale, cur.decimals).format(abs);

  let prefix = "";
  if (n < 0 && sign !== "never") prefix = "−";        // U+2212, not a hyphen
  else if (n > 0 && sign === "always") prefix = "+";
  else if (n === 0 && sign === "always") prefix = "";

  if (!symbol || !cur.symbol) return prefix + digits;
  // NBSP: "120,000" and "₫" are one word to a reader, and must not be
  // split across a line break in a narrow column.
  return SUFFIX_SYMBOL.has(code)
    ? prefix + digits + NBSP + cur.symbol
    : prefix + cur.symbol + digits;
}

/**
 * A short form for chart labels and tight columns: 1.2M, 843K.
 * Below 10,000 major units it is just the ordinary format — abbreviating
 * "₩8,400" to "₩8.4K" costs a reader more than it saves.
 */
export function formatCompact(minor, code, opts = {}) {
  const cur = currencyOf(code);
  const units = Math.abs(Number(minor) || 0) / Math.pow(10, cur.decimals);
  if (units < 10000) return formatMoney(minor, code, opts);
  const neg = Number(minor) < 0 ? "−" : "";
  const sym = opts.symbol === false ? "" : cur.symbol;
  const tiers = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [div, suffix] of tiers) {
    if (units >= div) {
      const v = units / div;
      const s = (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toString();
      return SUFFIX_SYMBOL.has(code)
        ? neg + s + suffix + NBSP + sym
        : neg + sym + s + suffix;
    }
  }
  return formatMoney(minor, code, opts);
}

// ------------------------------------------------------------
//  Reading an amount someone typed
// ------------------------------------------------------------

/**
 * Evaluate the small arithmetic the amount field allows: + − × ÷ and
 * parentheses, over decimal numbers. It exists because splitting a bill is
 * the single most common thing anyone does with a calculator while entering
 * an expense, and making them leave the app to do it is absurd.
 *
 * Hand-written rather than `eval` or `new Function`: this string comes from
 * a text field that also accepts pasted text, and handing that to a JS
 * parser is how a note becomes code.
 *
 * @returns a finite number, or null if the expression is incomplete or
 *          malformed — the caller shows the field as unfinished, not wrong.
 */
export function evalExpression(input) {
  const src = String(input == null ? "" : input)
    .replace(/[×xX*]/g, "*")
    .replace(/[÷/]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/[,\s]/g, "");
  if (!src) return null;
  if (!/^[0-9.()+\-*/]+$/.test(src)) return null;

  let i = 0;
  const peek = () => src[i];
  const eat = (c) => (src[i] === c ? (i++, true) : false);

  function parseExpr() {
    let v = parseTerm();
    if (v === null) return null;
    for (;;) {
      if (eat("+")) {
        const r = parseTerm();
        if (r === null) return null;
        v += r;
      } else if (eat("-")) {
        const r = parseTerm();
        if (r === null) return null;
        v -= r;
      } else return v;
    }
  }

  function parseTerm() {
    let v = parseUnary();
    if (v === null) return null;
    for (;;) {
      if (eat("*")) {
        const r = parseUnary();
        if (r === null) return null;
        v *= r;
      } else if (eat("/")) {
        const r = parseUnary();
        if (r === null || r === 0) return null;
        v /= r;
      } else return v;
    }
  }

  function parseUnary() {
    if (eat("-")) {
      const v = parseUnary();
      return v === null ? null : -v;
    }
    if (eat("+")) return parseUnary();
    return parseAtom();
  }

  function parseAtom() {
    if (eat("(")) {
      const v = parseExpr();
      if (v === null || !eat(")")) return null;
      return v;
    }
    const start = i;
    while (i < src.length && /[0-9.]/.test(peek())) i++;
    if (i === start) return null;
    const text = src.slice(start, i);
    // "1.2.3" parses as 1.2 under parseFloat; reject it rather than guess.
    if ((text.match(/\./g) || []).length > 1) return null;
    const n = parseFloat(text);
    return Number.isFinite(n) ? n : null;
  }

  const value = parseExpr();
  if (value === null || i !== src.length || !Number.isFinite(value)) return null;
  return value;
}

/** The largest amount Tally will accept, in major units. */
export const MAX_AMOUNT = 1e13;

/**
 * Turn what is in the amount field into minor units.
 * @returns integer ≥ 0, or null if it is not a usable amount.
 */
export function parseAmountToMinor(input, code) {
  const value = evalExpression(input);
  if (value === null) return null;
  const abs = Math.abs(value);
  if (abs > MAX_AMOUNT) return null;
  const minor = Math.round(abs * minorPerUnit(code));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units back into something the amount field can show and re-parse. */
export function minorToInput(minor, code) {
  const cur = currencyOf(code);
  const v = (Number(minor) || 0) / Math.pow(10, cur.decimals);
  return cur.decimals === 0 ? String(Math.round(v)) : v.toFixed(cur.decimals);
}

// ------------------------------------------------------------
//  Exchange
//
//  `rates` maps a currency to what one of its major units is worth in the
//  main currency: { IDR: 0.0875 } means one rupiah is 0.0875 won.
// ------------------------------------------------------------

/** What one major unit of `code` is worth in `main`. */
export function rateOf(code, main, rates) {
  if (code === main) return 1;
  const r = rates && rates[code];
  const n = typeof r === "number" ? r : parseFloat(r);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** True when we have no way to express `code` in the main currency. */
export function rateMissing(code, main, rates) {
  return rateOf(code, main, rates) === 0;
}

/**
 * A transaction's value in the main currency, in that currency's minor units.
 *
 * The rate frozen on the row is used first — it is what this cost on the day
 * it happened. It was frozen against whatever the main currency was back
 * then, so if that has since changed, the settings table carries the result
 * the rest of the way.
 */
export function toMain(tx, ctx) {
  const main = ctx.main_currency;
  const txCur = tx.currency || main;
  const major = (Number(tx.amount_minor) || 0) / minorPerUnit(txCur);

  const base = tx.rate_base || main;
  const rate = Number(tx.rate);
  const frozen = Number.isFinite(rate) && rate > 0 ? rate : rateOf(txCur, base, ctx.rates);

  let valueInBase = major * frozen;
  if (base !== main) valueInBase *= rateOf(base, main, ctx.rates);

  return Math.round(valueInBase * minorPerUnit(main));
}

/**
 * The rate to freeze on a row being written now: what one unit of `code` is
 * worth in the current main currency. Falls back to 1 for an unknown pair,
 * which keeps the row storable — the app flags the missing rate in the UI
 * rather than refusing to record the expense.
 */
export function rateForNew(code, ctx) {
  const r = rateOf(code, ctx.main_currency, ctx.rates);
  return r > 0 ? r : 1;
}

/** Convert an amount in `from` to minor units of `to`, via the main currency. */
export function convertMinor(minor, from, to, ctx) {
  if (from === to) return Number(minor) || 0;
  const inMain = toMain(
    { amount_minor: minor, currency: from, rate: rateForNew(from, ctx), rate_base: ctx.main_currency },
    ctx
  );
  const back = rateOf(to, ctx.main_currency, ctx.rates);
  if (back === 0) return 0;
  const majorMain = inMain / minorPerUnit(ctx.main_currency);
  return Math.round((majorMain / back) * minorPerUnit(to));
}

// ------------------------------------------------------------
//  Dates
//
//  A day key is "YYYY-MM-DD" and never anything else. All arithmetic goes
//  through UTC so that adding a day near a daylight-saving boundary cannot
//  land on the same date twice or skip one.
// ------------------------------------------------------------

const pad2 = (n) => (n < 10 ? "0" + n : String(n));

export function keyOf(y, m, d) {
  return y + "-" + pad2(m) + "-" + pad2(d);
}

export function todayKey(now = new Date()) {
  return keyOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function minuteOfDay(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

export function isDayKey(k) {
  return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(Date.parse(k + "T00:00:00Z"));
}

/** A day key as a UTC Date, for arithmetic only — never for display. */
export function dateOf(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function keyOfDate(date) {
  return keyOf(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(key, n) {
  const d = dateOf(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOfDate(d);
}

/** Add months, clamping to the end of a shorter month (31 Jan + 1 → 28 Feb). */
export function addMonths(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return keyOf(ny, nm + 1, Math.min(d, last));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key) {
  return dateOf(key).getUTCDay();
}

export function daysBetween(a, b) {
  return Math.round((dateOf(b) - dateOf(a)) / 86400000);
}

/**
 * The budget period containing `key`.
 *
 * With month_start = 1 this is the calendar month. Set it to a payday and
 * the period runs payday to payday instead — which is how anyone paid
 * monthly actually thinks about "this month's money".
 */
export function periodOf(key, monthStart = 1) {
  const ms = Math.min(28, Math.max(1, Math.round(monthStart) || 1));
  const [y, m, d] = key.split("-").map(Number);
  let start;
  if (d >= ms) start = keyOf(y, m, ms);
  else {
    const prev = m === 1 ? keyOf(y - 1, 12, ms) : keyOf(y, m - 1, ms);
    start = prev;
  }
  const end = addDays(addMonths(start, 1), -1);
  return { start, end };
}

/** Step a period forward or back by `n` whole periods. */
export function shiftPeriod(period, n, monthStart = 1) {
  return periodOf(addMonths(period.start, n), monthStart);
}

/** The calendar month a period is filed under: the month it starts in. */
export function periodMonthKey(period) {
  return period.start.slice(0, 7);
}

export function inRange(key, start, end) {
  return key >= start && key <= end;
}

// ------------------------------------------------------------
//  Normalising rows
//
//  Everything that comes back from the network or out of the local cache
//  goes through one of these first, so the rest of the app can index a
//  field without asking whether the row is old, partial, or damaged.
// ------------------------------------------------------------

const clampStr = (v, max, fallback = "") => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : fallback;
};

const ACCOUNT_KINDS = ["cash", "bank", "card", "ewallet", "savings"];
export const COLORS = [
  "indigo", "blue", "sky", "teal", "green", "lime",
  "amber", "orange", "rose", "pink", "purple", "gray",
];

const intOr = (v, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeAccount(raw) {
  const r = raw || {};
  return {
    id: String(r.id || ""),
    name: clampStr(r.name, 60, "—"),
    kind: ACCOUNT_KINDS.includes(r.kind) ? r.kind : "cash",
    currency: CURRENCIES[r.currency] ? r.currency : DEFAULT_CURRENCY,
    opening_minor: intOr(r.opening_minor, 0),
    color: COLORS.includes(r.color) ? r.color : "indigo",
    archived: Boolean(r.archived),
    position: intOr(r.position, 0),
    created_at: r.created_at || null,
    updated_at: r.updated_at || null,
    deleted_at: r.deleted_at || null,
  };
}

export function normalizeCategory(raw) {
  const r = raw || {};
  return {
    id: String(r.id || ""),
    name: clampStr(r.name, 60, "—"),
    kind: r.kind === "income" ? "income" : "expense",
    icon: clampStr(r.icon, 8, "•"),
    color: COLORS.includes(r.color) ? r.color : "gray",
    archived: Boolean(r.archived),
    position: intOr(r.position, 0),
    created_at: r.created_at || null,
    updated_at: r.updated_at || null,
    deleted_at: r.deleted_at || null,
  };
}

export function normalizeTx(raw) {
  const r = raw || {};
  const kind = r.kind === "income" || r.kind === "transfer" ? r.kind : "expense";
  const rate = Number(r.rate);
  return {
    id: String(r.id || ""),
    kind,
    amount_minor: Math.max(0, intOr(r.amount_minor, 0)),
    currency: CURRENCIES[r.currency] ? r.currency : DEFAULT_CURRENCY,
    rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    rate_base: CURRENCIES[r.rate_base] ? r.rate_base : DEFAULT_CURRENCY,
    account_id: r.account_id || null,
    to_account_id: kind === "transfer" ? r.to_account_id || null : null,
    to_amount_minor:
      kind === "transfer" && r.to_amount_minor != null
        ? Math.max(0, intOr(r.to_amount_minor, 0))
        : null,
    category_id: kind === "transfer" ? null : r.category_id || null,
    note: clampStr(r.note, 280, ""),
    occurred_on: isDayKey(r.occurred_on) ? r.occurred_on : todayKey(),
    occurred_min: Math.min(1439, Math.max(0, intOr(r.occurred_min, 0))),
    created_at: r.created_at || null,
    updated_at: r.updated_at || null,
    deleted_at: r.deleted_at || null,
  };
}

export function normalizeBudget(raw) {
  const r = raw || {};
  return {
    id: String(r.id || ""),
    category_id: r.category_id || null,
    amount_minor: Math.max(0, intOr(r.amount_minor, 0)),
    currency: CURRENCIES[r.currency] ? r.currency : DEFAULT_CURRENCY,
    created_at: r.created_at || null,
    updated_at: r.updated_at || null,
    deleted_at: r.deleted_at || null,
  };
}

export function normalizeSettings(raw) {
  const r = raw || {};
  const rates = {};
  if (r.rates && typeof r.rates === "object") {
    for (const [k, v] of Object.entries(r.rates)) {
      const n = typeof v === "number" ? v : parseFloat(v);
      if (CURRENCIES[k] && Number.isFinite(n) && n > 0) rates[k] = n;
    }
  }
  return {
    main_currency: CURRENCIES[r.main_currency] ? r.main_currency : DEFAULT_CURRENCY,
    theme: r.theme === "light" ? "light" : "dark",
    lang: r.lang === "ko" ? "ko" : "en",
    week_start: Math.min(6, Math.max(0, intOr(r.week_start, 1))),
    month_start: Math.min(28, Math.max(1, intOr(r.month_start, 1))),
    rates,
    updated_at: r.updated_at || null,
  };
}

// ------------------------------------------------------------
//  Sorting and lookup
// ------------------------------------------------------------

/** Newest first: by day, then by time of day, then by when it was written. */
export function compareTx(a, b) {
  if (a.occurred_on !== b.occurred_on) return a.occurred_on < b.occurred_on ? 1 : -1;
  if (a.occurred_min !== b.occurred_min) return b.occurred_min - a.occurred_min;
  const ca = a.created_at || "";
  const cb = b.created_at || "";
  if (ca !== cb) return ca < cb ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function byPosition(a, b) {
  if (a.position !== b.position) return a.position - b.position;
  return a.name.localeCompare(b.name);
}

export function indexById(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.id, r);
  return m;
}

// ------------------------------------------------------------
//  What the screens actually show
// ------------------------------------------------------------

/**
 * Every account's balance, in its own currency.
 *
 * A transaction is always denominated in its account's currency, so no
 * conversion happens here — a balance in won stays a number of won. The one
 * exception is a transfer between accounts of different currencies, which
 * carries what actually landed in `to_amount_minor`.
 *
 * @returns Map of account id → balance in minor units
 */
export function accountBalances(accounts, transactions) {
  const out = new Map();
  for (const a of accounts) out.set(a.id, a.opening_minor);

  for (const t of transactions) {
    if (t.kind === "income") {
      if (out.has(t.account_id)) out.set(t.account_id, out.get(t.account_id) + t.amount_minor);
    } else if (t.kind === "expense") {
      if (out.has(t.account_id)) out.set(t.account_id, out.get(t.account_id) - t.amount_minor);
    } else {
      if (out.has(t.account_id)) out.set(t.account_id, out.get(t.account_id) - t.amount_minor);
      if (out.has(t.to_account_id)) {
        const landed = t.to_amount_minor != null ? t.to_amount_minor : t.amount_minor;
        out.set(t.to_account_id, out.get(t.to_account_id) + landed);
      }
    }
  }
  return out;
}

/**
 * Everything added up, in the main currency.
 *
 * Transfers are deliberately absent from all three figures. Moving your own
 * money between your own accounts is not income and not spending, and the
 * reference app counting it as both is exactly why its monthly totals never
 * matched the bank.
 */
export function totals(transactions, ctx) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.kind === "income") income += toMain(t, ctx);
    else if (t.kind === "expense") expense += toMain(t, ctx);
  }
  return { income, expense, net: income - expense };
}

/** Net worth: every live account converted into the main currency. */
export function netWorth(accounts, transactions, ctx) {
  const balances = accountBalances(accounts, transactions);
  let total = 0;
  for (const a of accounts) {
    if (a.archived) continue;
    const bal = balances.get(a.id) || 0;
    total += toMain(
      { amount_minor: bal, currency: a.currency, rate: rateForNew(a.currency, ctx), rate_base: ctx.main_currency },
      ctx
    );
  }
  return total;
}

/**
 * Spending (or income) split by category, largest first, in the main
 * currency. Uncategorised rows collect under a null id rather than being
 * dropped — money you did not label is still money you spent.
 */
export function byCategory(transactions, kind, ctx) {
  const sums = new Map();
  let total = 0;
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    const v = toMain(t, ctx);
    const key = t.category_id || "";
    sums.set(key, (sums.get(key) || 0) + v);
    total += v;
  }
  const rows = [...sums.entries()].map(([category_id, amount]) => ({
    category_id: category_id || null,
    amount,
    share: total > 0 ? amount / total : 0,
  }));
  rows.sort((a, b) => b.amount - a.amount);
  return { rows, total };
}

/** Totals per period, oldest first — the bar chart's data. */
export function byPeriod(transactions, anchorKey, count, monthStart, ctx) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const period = periodOf(addMonths(anchorKey, -i), monthStart);
    const rows = transactions.filter((t) => inRange(t.occurred_on, period.start, period.end));
    out.push({ period, ...totals(rows, ctx) });
  }
  return out;
}

/**
 * Budget progress for one period.
 *
 * `spent` counts expenses only, in the main currency, and a per-category
 * budget counts only that category. Over 100% is reported as it is rather
 * than clamped: how far over matters more than the fact of it.
 */
export function budgetProgress(budgets, transactions, categories, ctx) {
  const spentByCat = new Map();
  let spentTotal = 0;
  for (const t of transactions) {
    if (t.kind !== "expense") continue;
    const v = toMain(t, ctx);
    spentTotal += v;
    const k = t.category_id || "";
    spentByCat.set(k, (spentByCat.get(k) || 0) + v);
  }

  const cats = indexById(categories);
  const rows = [];
  for (const b of budgets) {
    const limit = toMain(
      {
        amount_minor: b.amount_minor,
        currency: b.currency,
        rate: rateForNew(b.currency, ctx),
        rate_base: ctx.main_currency,
      },
      ctx
    );
    const spent = b.category_id ? spentByCat.get(b.category_id) || 0 : spentTotal;
    rows.push({
      id: b.id,
      category_id: b.category_id,
      category: b.category_id ? cats.get(b.category_id) || null : null,
      limit,
      spent,
      ratio: limit > 0 ? spent / limit : 0,
      remaining: limit - spent,
    });
  }
  // The overall budget first, then the tightest categories.
  rows.sort((a, b) => {
    if (!a.category_id) return -1;
    if (!b.category_id) return 1;
    return b.ratio - a.ratio;
  });
  return rows;
}

/** Group transactions into days, newest day first. */
export function groupByDay(transactions, ctx) {
  const days = new Map();
  for (const t of transactions) {
    let day = days.get(t.occurred_on);
    if (!day) {
      day = { key: t.occurred_on, items: [], income: 0, expense: 0 };
      days.set(t.occurred_on, day);
    }
    day.items.push(t);
    if (t.kind === "income") day.income += toMain(t, ctx);
    else if (t.kind === "expense") day.expense += toMain(t, ctx);
  }
  const out = [...days.values()];
  out.sort((a, b) => (a.key < b.key ? 1 : -1));
  for (const d of out) d.items.sort(compareTx);
  return out;
}

/**
 * Notes seen before, most recent first, for the note field's suggestions.
 *
 * Matching is a substring, case-insensitively, on purpose: typing "coup"
 * should find "Coupang, many things", which a prefix match never would.
 */
export function noteSuggestions(transactions, query, limit = 8) {
  const q = String(query || "").trim().toLowerCase();
  const seen = new Set();
  const out = [];
  const sorted = [...transactions].sort(compareTx);
  for (const t of sorted) {
    const note = t.note.trim();
    if (!note) continue;
    const key = note.toLowerCase();
    if (seen.has(key)) continue;
    if (q && !key.includes(q)) continue;
    seen.add(key);
    out.push({ note, category_id: t.category_id, account_id: t.account_id, kind: t.kind });
    if (out.length >= limit) break;
  }
  return out;
}

/** Free-text search across notes, category names and account names. */
export function searchTransactions(transactions, query, categories, accounts) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return transactions;
  const cats = indexById(categories);
  const accs = indexById(accounts);
  return transactions.filter((t) => {
    if (t.note.toLowerCase().includes(q)) return true;
    const c = t.category_id && cats.get(t.category_id);
    if (c && c.name.toLowerCase().includes(q)) return true;
    const a = t.account_id && accs.get(t.account_id);
    if (a && a.name.toLowerCase().includes(q)) return true;
    const b = t.to_account_id && accs.get(t.to_account_id);
    if (b && b.name.toLowerCase().includes(q)) return true;
    return false;
  });
}

// ------------------------------------------------------------
//  Export
// ------------------------------------------------------------

/**
 * A spreadsheet of everything, one row per transaction.
 *
 * Both the original amount and its main-currency value are included: the
 * first is what was actually paid, the second is what makes a column of
 * mixed currencies add up.
 */
export function toCsv(transactions, { accounts, categories, ctx }) {
  const accs = indexById(accounts);
  const cats = indexById(categories);
  const main = ctx.main_currency;

  const head = [
    "date", "time", "type", "category", "account", "to_account",
    "note", "currency", "amount", "rate", main.toLowerCase() + "_value",
  ];
  const rows = [head];

  for (const t of [...transactions].sort(compareTx)) {
    const hh = String(Math.floor(t.occurred_min / 60)).padStart(2, "0");
    const mm = String(t.occurred_min % 60).padStart(2, "0");
    rows.push([
      t.occurred_on,
      hh + ":" + mm,
      t.kind,
      t.category_id && cats.get(t.category_id) ? cats.get(t.category_id).name : "",
      t.account_id && accs.get(t.account_id) ? accs.get(t.account_id).name : "",
      t.to_account_id && accs.get(t.to_account_id) ? accs.get(t.to_account_id).name : "",
      t.note,
      t.currency,
      minorToInput(t.amount_minor, t.currency),
      t.rate,
      t.kind === "transfer" ? "" : minorToInput(toMain(t, ctx), main),
    ]);
  }

  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // A byte order mark, so Excel opens Korean notes as UTF-8 rather than
  // mojibake. Every other reader ignores it.
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

// ------------------------------------------------------------
//  Is this transaction storable?
//
//  This lives here rather than in the editor because it is the one place
//  that decides whether a number about to be written down means anything,
//  and because a rule you cannot test is a rule you find out about later.
// ------------------------------------------------------------

/**
 * @param draft  the editor's working copy: { kind, amount (text), currency,
 *               account_id, to_account_id, category_id }
 * @param ctx    { main_currency, rates }
 * @returns null when it can be saved, otherwise a translation key naming
 *          the first thing wrong with it.
 */
export function validateTransaction(draft, ctx) {
  const minor = parseAmountToMinor(draft.amount, draft.currency);
  if (minor === null) return String(draft.amount || "").trim() ? "tx.calcBad" : "tx.needAmount";
  if (minor <= 0) return "tx.needAmount";
  if (!draft.account_id) return "tx.needAccount";

  if (draft.kind === "transfer") {
    if (!draft.to_account_id) return "tx.needToAccount";
    if (draft.to_account_id === draft.account_id) return "tx.sameAccount";
  } else if (!draft.category_id) {
    return "tx.needCategory";
  }

  // Without a rate there is no honest way to put this amount into a total.
  // Guessing 1:1 would quietly file 50 baht as 50 won and never say so, so
  // the rate is asked for now — once — rather than corrupting every total
  // that includes this row.
  if (draft.currency !== ctx.main_currency && rateMissing(draft.currency, ctx.main_currency, ctx.rates)) {
    return "tx.needRate";
  }
  return null;
}

// ------------------------------------------------------------
//  Ids
// ------------------------------------------------------------

/** A random v4 UUID. Rows are keyed by ids the client makes, so a
 *  transaction written with no connection has its final identity from the
 *  moment it is saved — and replaying it later cannot duplicate it. */
export function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) +
    "-" + hex.slice(16, 20) + "-" + hex.slice(20)
  );
}

/**
 * A UUID derived from a user id and a name — the same inputs always give
 * the same id, on any device, in either app.
 *
 * This is what makes seeding a brand-new account safe. A phone and a laptop
 * opening Tally for the first time within the same minute both try to
 * create "Food"; because both compute the same primary key, the second
 * write lands on the first row instead of beside it.
 *
 * RFC 4122 §4.3, name-based with SHA-1 replaced by SHA-256 truncated to 16
 * bytes — the version nibble says 5, which is a small untruth that keeps
 * every UUID parser happy and costs nothing.
 */
export async function derivedId(userId, name) {
  const data = new TextEncoder().encode("tally:" + userId + ":" + name);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", data));
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) +
    "-" + hex.slice(16, 20) + "-" + hex.slice(20)
  );
}

// ------------------------------------------------------------
//  What a new account starts with
//
//  Names are stored in whichever language was on screen at sign-up, and are
//  editable afterwards — a category is the user's word for something, so
//  translating it under them later would be wrong.
// ------------------------------------------------------------
export const SEED_CATEGORIES = [
  { slug: "food", icon: "🍜", color: "orange", kind: "expense", en: "Food", ko: "식비" },
  { slug: "transport", icon: "🚌", color: "teal", kind: "expense", en: "Transport", ko: "교통" },
  { slug: "household", icon: "🏠", color: "amber", kind: "expense", en: "Household", ko: "생활" },
  { slug: "groceries", icon: "🛒", color: "lime", kind: "expense", en: "Groceries", ko: "장보기" },
  { slug: "social", icon: "🥂", color: "pink", kind: "expense", en: "Social", ko: "모임" },
  { slug: "health", icon: "🧘", color: "teal", kind: "expense", en: "Health", ko: "건강" },
  { slug: "shopping", icon: "🛍️", color: "rose", kind: "expense", en: "Shopping", ko: "쇼핑" },
  { slug: "education", icon: "📘", color: "blue", kind: "expense", en: "Education", ko: "교육" },
  { slug: "fun", icon: "🎬", color: "purple", kind: "expense", en: "Fun", ko: "여가" },
  { slug: "fees", icon: "🧾", color: "gray", kind: "expense", en: "Fees", ko: "수수료" },
  { slug: "other-expense", icon: "•", color: "gray", kind: "expense", en: "Other", ko: "기타" },

  { slug: "salary", icon: "💼", color: "green", kind: "income", en: "Salary", ko: "급여" },
  { slug: "bonus", icon: "✨", color: "lime", kind: "income", en: "Bonus", ko: "상여" },
  { slug: "gift-in", icon: "🎁", color: "pink", kind: "income", en: "Gift", ko: "선물" },
  { slug: "refund", icon: "↩️", color: "teal", kind: "income", en: "Refund", ko: "환급" },
  { slug: "other-income", icon: "•", color: "gray", kind: "income", en: "Other", ko: "기타" },
];

export const SEED_ACCOUNTS = [
  { slug: "cash", kind: "cash", color: "green", en: "Cash", ko: "현금" },
  { slug: "bank", kind: "bank", color: "indigo", en: "Bank", ko: "은행" },
];
