// ============================================================
//  Tally — the interface.
//
//  store.js decides what is true and money.js decides what the numbers
//  are; this file is only ever about putting them on screen and taking
//  input back. It keeps no ledger state of its own — every render reads
//  the latest snapshot, so a change made on a phone and a change made
//  here go down exactly the same path.
//
//  Rendering is deliberately plain: build DOM nodes, replace a subtree.
//  A month of transactions is a hundred rows, and a hundred rows is
//  cheaper to rebuild than to diff.
// ============================================================

import {
  isConfigured,
  hasSupabaseUrl,
  hasSupabaseKey,
  hasGoogleClientId,
} from "./supabase-config.js?v=18";
import * as S from "./store.js?v=18";
import * as M from "./money.js?v=18";
import {
  t,
  setLang,
  getLang,
  locale,
  formatMonthYear,
  formatDayLong,
  formatDayShort,
  formatTime,
  formatPercent,
  weekdayShort,
} from "./i18n.js?v=18";

// ------------------------------------------------------------
//  Tiny DOM helpers
// ------------------------------------------------------------

const $ = (id) => document.getElementById(id);

/**
 * Build an element. Children may be nodes, strings, or nested arrays;
 * strings become text nodes, never markup — every name and note in this
 * app is something a person typed.
 */
function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "dataset") Object.assign(node.dataset, v);
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    }
  }
  add(node, children);
  return node;
}

function add(node, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) add(node, c);
    else node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

const show = (node, on = true) => {
  node.hidden = !on;
  node.classList.toggle("hidden", !on);
};

const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};

/** A stroked 24×24 icon. Markup only, no user data. */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.9 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.9H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.1 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.4" fill="currentColor" stroke="none"/>',
  list: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  download: '<path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/>',
  signout: '<path d="M15 5V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1M19 12H9m10 0-3-3m3 3-3 3"/>',
  empty: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M8 15h4"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1.5"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
};

function icon(name, cls) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (cls) svg.setAttribute("class", cls);
  svg.innerHTML = ICONS[name] || "";
  return svg;
}

/**
 * Make a text field group its digits as they are typed: 310575 turns into
 * 310,575 under the person's hands, without the caret leaving where they
 * were writing.
 *
 * The field's value is the grouped text from the first keystroke on, and
 * that is what `onInput` is handed. Nothing downstream needs to know: every
 * reader of an amount strips the separators before parsing it, the same way
 * the calculator always has.
 *
 * @param input    an <input type="text"> holding money
 * @param onInput  called with the grouped text after each change
 */
function groupsDigits(input, onInput) {
  let was = (input.value = M.groupAmount(input.value));
  input.addEventListener("input", (e) => {
    const at = input.selectionStart == null ? input.value.length : input.selectionStart;
    const g = M.groupAmountEdit(was, input.value, at, e.inputType === "deleteContentForward");
    if (g.text !== input.value) {
      input.value = g.text;
      // Only a focused field has a caret to put back, and setSelectionRange
      // on an unfocused one is a no-op either way.
      try {
        input.setSelectionRange(g.caret, g.caret);
      } catch {
        /* a field type that keeps no selection */
      }
    }
    was = g.text;
    if (onInput) onInput(g.text);
  });
  return input;
}

/** Append to a grouped field as if it had been typed, separators and all. */
function typeInto(input, text) {
  input.value += text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// ------------------------------------------------------------
//  State
// ------------------------------------------------------------

const state = {
  session: null,
  ledger: null,
  /** True when this ledger lives on this device and goes nowhere else. */
  local: false,
  data: {
    settings: M.normalizeSettings(null),
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    pending: 0,
    status: "syncing",
  },
  view: "log",
  /** Any day inside the period being shown. */
  anchor: M.todayKey(),
  search: "",
  searching: false,
  insightsSide: "expense",
  showArchived: false,
  logLimit: 300,
  /** Showing one account only, by id — see visibleTransactions. */
  accountFilter: null,
};

/** Everything the money functions need to convert into the main currency. */
function ctx() {
  return {
    main_currency: state.data.settings.main_currency,
    rates: state.data.settings.rates,
  };
}

const fmt = (minor, code, opts) =>
  M.formatMoney(minor, code || state.data.settings.main_currency, { locale: locale(), ...opts });

const fmtShort = (minor, code, opts) =>
  M.formatCompact(minor, code || state.data.settings.main_currency, { locale: locale(), ...opts });

function period() {
  return M.periodOf(state.anchor, state.data.settings.month_start);
}

/** Live categories, ordered, optionally only one side of the ledger. */
function categoriesOf(kind, includeArchived = false) {
  return state.data.categories
    .filter((c) => (!kind || c.kind === kind) && (includeArchived || !c.archived))
    .sort(M.byPosition);
}

function accountsList(includeArchived = false) {
  return state.data.accounts
    .filter((a) => includeArchived || !a.archived)
    .sort(M.byPosition);
}

const catById = (id) => state.data.categories.find((c) => c.id === id) || null;
const accById = (id) => state.data.accounts.find((a) => a.id === id) || null;

// ------------------------------------------------------------
//  Theme and language
// ------------------------------------------------------------

function applyTheme(theme) {
  const value = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", value);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", value === "light" ? "#fbfbfd" : "#0f0f10");
  try {
    localStorage.setItem("tally.theme", value);
  } catch (e) {
    /* private mode; the theme just will not be remembered */
  }
}

function applyLang(lang) {
  setLang(lang);
  document.documentElement.setAttribute("lang", getLang());
  try {
    localStorage.setItem("tally.lang", getLang());
  } catch (e) {
    /* as above */
  }
}

/** Change a setting that lives on the account, and follow it locally too. */
async function setSetting(patch) {
  if (patch.theme) applyTheme(patch.theme);
  if (patch.lang) applyLang(patch.lang);
  if (state.ledger) {
    await state.ledger.writeSettings(patch);
  } else {
    state.data.settings = M.normalizeSettings({ ...state.data.settings, ...patch });
    renderAll();
  }
}

// ------------------------------------------------------------
//  Toasts
// ------------------------------------------------------------

/**
 * Keep the toast layer somewhere it can actually be seen and pressed.
 *
 * Two separate problems, and only doing both fixes it. A sheet is a
 * `<dialog>` opened with showModal(), which (a) makes everything outside it
 * **inert** — a toast at body level is then unclickable no matter what layer
 * it is in — and (b) is promoted to the top layer, which paints above every
 * z-index in the document. So the layer is parked inside the topmost open
 * sheet, which answers inertness, and shown as a manual popover, which puts
 * it in the top layer without a backdrop and without stealing focus. Being
 * in the top layer also means no ancestor's overflow or transform can clip
 * or move it, so `position: fixed` still means the viewport.
 *
 * Until this, the Undo after deleting a category or an account was drawn
 * behind the sheet it was raised from: visible for four seconds in the
 * corner of a screenshot, and impossible to press.
 *
 * Called on every change to either side — a toast added or removed, a sheet
 * opened or closed — because the top layer is ordered by arrival, so a sheet
 * opened after a toast would otherwise cover it.
 */
// Held by reference rather than looked up each time: closing a sheet the
// layer was parked in detaches it for an instant, and an id lookup then
// finds nothing.
let toastLayer = null;
const toastWrap = () => (toastLayer ||= $("toasts"));

function placeToasts(wrap) {
  if (!wrap) return;
  const sheets = document.querySelectorAll("dialog.sheet[open]");
  const host = wrap.children.length && sheets.length ? sheets[sheets.length - 1] : document.body;
  if (wrap.parentNode !== host) host.append(wrap);
  if (typeof wrap.showPopover !== "function") return;
  try {
    if (wrap.matches(":popover-open")) wrap.hidePopover();
    if (wrap.children.length) wrap.showPopover();
  } catch {
    /* An engine without the popover API, or a state we cannot change. The
       toast is still in the right parent, which is the half that matters. */
  }
}

function toast(message, { action, onAction, danger = false, ms = 4200 } = {}) {
  const wrap = toastWrap();
  const node = el(
    "div",
    { class: "toast" + (danger ? " danger" : "") },
    el("span", { text: message }),
    action
      ? el("button", {
          type: "button",
          text: action,
          onClick: () => {
            dismiss();
            if (onAction) onAction();
          },
        })
      : null
  );
  wrap.append(node);
  placeToasts(wrap);
  let timer = setTimeout(dismiss, ms);
  function dismiss() {
    clearTimeout(timer);
    if (!node.isConnected) return;
    node.classList.add("leaving");
    setTimeout(() => {
      node.remove();
      placeToasts(wrap);
    }, 200);
  }
  return dismiss;
}

// ------------------------------------------------------------
//  Sheets
// ------------------------------------------------------------

/**
 * Sheets that follow the ledger instead of freezing at the moment they
 * opened. `renderAll` rebuilds every one of them.
 *
 * Only sheets that *list* things belong here. An editor must not be in it:
 * rebuilding one mid-edit would take the caret out of whatever was being
 * typed, and its own contents are a draft, not the ledger.
 */
const liveSheets = new Set();

function rebuildLiveSheets() {
  for (const sheet of liveSheets) sheet.rebuild();
}

/**
 * Open a sheet.
 *
 * A <dialog> is created for each one and removed when it closes, rather
 * than reusing a fixed set of them. Sheets genuinely nest — the editor
 * opens a category picker, which opens the category manager, which asks
 * a question before deleting — and a fixed pool means two of those
 * eventually land on the same element and one silently erases the other.
 * The browser stacks the top layer in open order, so nesting is free.
 *
 * `build(inner, close)` fills the card in. The returned handle can
 * rebuild that content in place, keeping the sheet, its scroll position
 * and its place in the stack.
 *
 * @param live  re-render this sheet whenever the ledger changes — because a
 *              list left open is a claim about what exists, and it goes
 *              stale the moment anything is added from a sheet on top of it
 *              or, just as easily, from the phone in the other pocket.
 */
/**
 * @param unsaved Asked, every time something tries to close this sheet,
 *   whether there is anything in it worth keeping. A sheet that says yes is
 *   not closed by a stray click on the backdrop or a press of Escape without
 *   a question first — the same rule the phone applies, for the same reason:
 *   a form is easy to dismiss by accident and expensive to retype.
 */
function openSheet(build, { onClose, live = false, unsaved = null } = {}) {
  const inner = el("div", { class: "sheet-inner" });
  const dlg = el("dialog", { class: "sheet" }, inner);
  const opener = document.activeElement;
  let cleaned = false;
  /** Set below, once there is something to hand back. */
  let handle = null;

  document.body.append(dlg);

  const close = () => {
    if (dlg.open) dlg.close();
    else cleanup();
  };

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    if (handle) liveSheets.delete(handle);
    dlg.remove();
    // The toast layer may have been parked in this sheet, in which case it
    // has just been removed along with it. Put it back where it belongs now.
    placeToasts(toastWrap());
    // Only the last sheet standing gives the page its scrolling back.
    if (!document.querySelector("dialog[open]")) document.body.style.overflow = "";
    if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
    if (onClose) onClose();
  }

  /** Close, unless there is unsaved work in here and it is not wanted gone. */
  const askThenClose = async () => {
    if (unsaved && unsaved()) {
      const ok = await confirmSheet({
        title: t("discard.title"),
        body: t("discard.body"),
        confirmLabel: t("discard.confirm"),
        cancelLabel: t("discard.keep"),
        danger: true,
      });
      if (!ok) return;
    }
    close();
  };

  dlg.addEventListener("close", cleanup);
  // A click on the backdrop — the dialog itself rather than the card inside
  // it — closes. Anything mid-edit stays put, because the card is in the way.
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) askThenClose();
  });
  // Escape closes a <dialog> on its own, which is right for a sheet you are
  // reading and wrong for one you are filling in. Refusing the event leaves
  // the sheet where it is and asks instead.
  dlg.addEventListener("cancel", (e) => {
    if (unsaved && unsaved()) {
      e.preventDefault();
      askThenClose();
    }
  });

  const fill = (fn) => {
    const bodyBefore = inner.querySelector(".sheet-body");
    const scroll = bodyBefore ? bodyBefore.scrollTop : 0;
    clear(inner);
    fn(inner, close, askThenClose);
    const bodyAfter = inner.querySelector(".sheet-body");
    if (bodyAfter && scroll) bodyAfter.scrollTop = scroll;
    const first = inner.querySelector("[data-autofocus]");
    if (first) setTimeout(() => first.isConnected && first.focus(), 60);
  };

  fill(build);
  document.body.style.overflow = "hidden";
  dlg.showModal();
  // A toast already on screen would be left outside — and inert — behind
  // the sheet that just opened over it.
  placeToasts(toastWrap());

  handle = { close, rebuild: (fn) => fill(typeof fn === "function" ? fn : build) };
  if (live) liveSheets.add(handle);
  return handle;
}

function sheetHead(title, close, extra) {
  return el(
    "div",
    { class: "sheet-head" },
    el("h2", { text: title }),
    extra || null,
    el(
      "button",
      { class: "icon-btn", type: "button", "aria-label": t("close"), onClick: close },
      icon("close")
    )
  );
}

/** A yes/no question. Resolves true only if the confirming button is used. */
function confirmSheet({ title, body, confirmLabel, cancelLabel, danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const sheet = openSheet(
      (inner, close) => {
        inner.append(
          sheetHead(title, close),
          el(
            "div",
            { class: "sheet-body" },
            el("p", { class: "help", style: { fontSize: "14px", margin: 0 }, text: body })
          ),
          el(
            "div",
            { class: "sheet-foot" },
            el("button", {
              class: "btn btn-ghost",
              type: "button",
              text: cancelLabel || t("cancel"),
              onClick: close,
            }),
            el("button", {
              class: "btn " + (danger ? "btn-danger" : "btn-primary"),
              type: "button",
              text: confirmLabel,
              "data-autofocus": "",
              onClick: () => {
                answer = true;
                close();
              },
            })
          )
        );
      },
      // Escape and the backdrop both land here too, which is why the answer
      // is read on close rather than set by the buttons alone.
      { onClose: () => resolve(answer) }
    );
    void sheet;
  });
}

// ============================================================
//  Boot
// ============================================================

let bootDone = false;

function finishBoot() {
  if (bootDone) return;
  bootDone = true;
  clearTimeout(window.__tallyBootWatchdog);
  show($("boot"), false);
  requestAnimationFrame(() => document.documentElement.classList.remove("preload"));
}

async function boot() {
  applyTheme(localStorage.getItem("tally.theme") === "light" ? "light" : "dark");
  applyLang(localStorage.getItem("tally.lang") === "ko" ? "ko" : "en");

  // Someone who chose to work without an account is not asked again every
  // morning, and never waits on a network they said they did not want.
  if (S.getMode() === "local") {
    startLocal();
    return;
  }

  if (!isConfigured) {
    renderSetup();
    finishBoot();
    return;
  }

  await startAuth();
}

let authStarted = false;

async function startAuth() {
  if (authStarted) return;
  authStarted = true;
  wireChrome();
  try {
    await S.watchAuth(onSession);
  } catch (e) {
    console.error("Auth failed to start:", e);
    authStarted = false;
    renderSetup();
    finishBoot();
  }
}

/** The device's current appearance, as a settings patch for a new ledger. */
function deviceDefaults() {
  return {
    theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
    lang: getLang(),
  };
}

/**
 * Open a ledger and point the screens at it. The only difference between a
 * signed-in ledger and a device-only one is `local` — everything below,
 * including every callback, is the same either way.
 */
function attachLedger({ uid, local }) {
  if (state.ledger) {
    state.ledger.close();
    state.ledger = null;
  }
  state.local = local;
  state.anchor = M.todayKey();
  state.ledger = S.openLedger({
    uid,
    local,
    defaults: deviceDefaults(),
    onChange: (snapshot) => {
      state.data = snapshot;
      // The account's own appearance settings win over this device's, so
      // that changing the theme on a laptop changes it on the phone.
      if (snapshot.settings.theme !== document.documentElement.getAttribute("data-theme")) {
        applyTheme(snapshot.settings.theme);
      }
      if (snapshot.settings.lang !== getLang()) applyLang(snapshot.settings.lang);
      renderAll();
      finishBoot();
    },
    onStatus: (status) => {
      state.data.pending = status.pending;
      state.data.status = status.state;
      renderStatus();
    },
    onError: (err, key) => {
      console.error(err);
      toast(t(key || "err.generic"), { danger: true });
    },
  });

  renderAll();
  // Never leave the splash up on a slow first sync — the cached ledger,
  // or an honest empty state, is better than a spinner.
  setTimeout(finishBoot, 2500);
}

// ------------------------------------------------------------
//  Without an account
// ------------------------------------------------------------

/** Work on this device only, with nothing to set up and nothing sent. */
function startLocal() {
  S.setMode("local");
  wireChrome();
  state.session = null;
  show($("login"), false);
  show($("setup"), false);
  show($("app"), true);
  attachLedger({ uid: S.LOCAL_UID, local: true });
}

/**
 * Leave device-only mode for a real account. The local ledger is left
 * exactly where it is — signing in offers to copy it, and refusing that
 * offer must not be the same as throwing it away.
 */
async function leaveLocal() {
  S.setMode("cloud");
  if (state.ledger) {
    state.ledger.close();
    state.ledger = null;
  }
  state.local = false;
  show($("app"), false);
  if (!isConfigured) {
    renderSetup();
    return;
  }
  renderLogin();
  await startAuth();
}

/**
 * Offer to bring a device-only ledger into an account that has just been
 * signed into. Asked once per account, and never without being asked.
 */
async function offerMigration(uid) {
  if (!S.canOfferMigration(uid)) return;
  const n = S.localLedgerSize();
  const ok = await confirmSheet({
    title: t("migrate.title"),
    body: t("migrate.body", { n: t("migrate.count", { n }) }),
    confirmLabel: t("migrate.yes"),
    cancelLabel: t("migrate.no"),
  });
  if (!ok) {
    S.declineMigration(uid);
    return;
  }
  toast(t("migrate.working"));
  try {
    await S.migrateLocalInto(state.ledger, uid);
    renderAll();
    toast(t("migrate.done"));
  } catch (e) {
    console.error("Couldn't copy the local ledger:", e);
    toast(t("migrate.failed"), { danger: true });
  }
}

function onSession(session) {
  const previous = state.session;
  state.session = session;

  if (!session) {
    if (state.ledger) {
      state.ledger.close();
      state.ledger = null;
    }
    state.local = false;
    state.data = {
      settings: M.normalizeSettings({
        theme: document.documentElement.getAttribute("data-theme"),
        lang: getLang(),
      }),
      accounts: [],
      categories: [],
      transactions: [],
      budgets: [],
      pending: 0,
      status: "syncing",
    };
    show($("app"), false);
    show($("setup"), false);
    renderLogin();
    finishBoot();
    return;
  }

  // The same session arriving twice (a token refresh, a second tab) must
  // not tear the ledger down and build it again.
  if (previous && previous.user && previous.user.id === session.user.id && state.ledger) {
    return;
  }

  show($("login"), false);
  show($("setup"), false);
  show($("app"), true);

  attachLedger({ uid: session.user.id, local: false });

  // After the splash, so the question is not asked behind it.
  setTimeout(() => offerMigration(session.user.id), 700);
}

// ============================================================
//  Setup screen
// ============================================================

function renderSetup() {
  show($("login"), false);
  show($("app"), false);
  show($("setup"), true);
  $("setupTitle").textContent = t("setup.h1");
  $("setupP1").innerHTML = t("setup.p1");
  $("setupP2").innerHTML = t("setup.p2");
  const list = clear($("setupList"));
  if (!hasSupabaseUrl) list.append(el("li", { text: t("setup.missingUrl") }));
  if (!hasSupabaseKey) list.append(el("li", { text: t("setup.missingKey") }));
  if (!hasGoogleClientId) list.append(el("li", { text: t("setup.missingClient") }));

  // None of the above is needed to keep a ledger on this device, so the
  // setup screen is a place to start rather than only a place to wait.
  $("setupLocal").textContent = t("setup.tryLocal");
  $("setupLocalHelp").textContent = t("setup.tryLocalHelp");
  $("setupLocal").onclick = startLocal;
}

// ============================================================
//  Sign-in screen
// ============================================================

let loginRendered = false;

function renderLogin() {
  show($("login"), true);
  $("loginH1").textContent = t("login.h1");
  $("loginSub").textContent = t("login.sub");
  $("loginWait").textContent = t("login.wait");
  $("loginOr").textContent = t("login.or");
  $("loginLocal").textContent = t("login.local");
  $("loginLocalSub").textContent = t("login.localSub");
  $("loginLocal").onclick = startLocal;

  const themeBtn = $("loginTheme");
  clear(themeBtn).append(
    icon(document.documentElement.getAttribute("data-theme") === "light" ? "moon" : "sun")
  );
  themeBtn.title = t("theme.toggle");
  themeBtn.onclick = () => {
    applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
    // The Google button is painted by Google in one theme or the other and
    // cannot be restyled afterwards, so it has to be asked for again.
    loginRendered = false;
    renderLogin();
  };

  const langBtn = $("loginLang");
  langBtn.textContent = getLang() === "ko" ? "EN" : "한국어";
  langBtn.title = t("lang.toggle");
  langBtn.onclick = () => {
    applyLang(getLang() === "ko" ? "en" : "ko");
    loginRendered = false;
    renderLogin();
  };

  if (loginRendered) return;
  loginRendered = true;

  const fallback = $("loginFallback");
  fallback.textContent = t("login.google");
  fallback.onclick = async () => {
    try {
      await S.signInWithRedirect();
    } catch (e) {
      console.error(e);
      showLoginError(t("err.auth.generic"));
    }
  };

  S.renderGoogleButton($("googleSlot"), {
    locale: getLang(),
    dark: document.documentElement.getAttribute("data-theme") !== "light",
    onSignIn: () => show($("loginError"), false),
    onError: () => showLoginError(t("err.auth.generic")),
  })
    .then((ok) => {
      show($("loginWait"), false);
      if (!ok) show(fallback, true);
    })
    .catch(() => {
      show($("loginWait"), false);
      show(fallback, true);
    });
}

function showLoginError(message) {
  const node = $("loginError");
  node.textContent = message;
  show(node, true);
}

// ============================================================
//  Chrome — header, tabs, period, search
// ============================================================

let chromeWired = false;

function wireChrome() {
  // Called on whichever way in was taken, and again if the other is used
  // later. The listeners below are not all idempotent, so wire once.
  if (chromeWired) return;
  chromeWired = true;

  $("btnTheme").onclick = () =>
    setSetting({
      theme: document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light",
    });
  $("btnLang").onclick = () => setSetting({ lang: getLang() === "ko" ? "en" : "ko" });
  $("btnMenu").onclick = openSettings;
  $("fab").onclick = () => openTransaction(null);

  $("btnPrev").onclick = () => {
    state.anchor = M.shiftPeriod(period(), -1, state.data.settings.month_start).start;
    renderAll();
  };
  $("btnNext").onclick = () => {
    state.anchor = M.shiftPeriod(period(), 1, state.data.settings.month_start).start;
    renderAll();
  };
  $("periodLabel").onclick = () => {
    state.anchor = M.todayKey();
    renderAll();
  };

  $("btnSearch").onclick = () => setSearching(true);
  $("btnSearchClose").onclick = () => setSearching(false);
  $("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderLog();
  });

  for (const id of ["tabLog", "tabInsights", "tabAccounts"]) {
    $(id).onclick = () => {
      state.view = $(id).dataset.view;
      renderAll();
    };
  }

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "n") {
      e.preventDefault();
      openTransaction(null);
    } else if (e.key === "/") {
      e.preventDefault();
      setSearching(true);
    } else if (e.key === "ArrowLeft") {
      $("btnPrev").click();
    } else if (e.key === "ArrowRight") {
      $("btnNext").click();
    }
  });
}

function setSearching(on) {
  state.searching = on;
  state.search = on ? state.search : "";
  show($("searchBar"), on);
  show($("periodNav"), !on);
  show($("summary"), !on);
  const input = $("searchInput");
  input.placeholder = t("search.placeholder");
  if (on) {
    state.view = "log";
    input.value = state.search;
    setTimeout(() => input.focus(), 20);
  }
  renderAll();
}

function renderStatus() {
  const node = $("syncStatus");
  const { status, pending } = state.data;
  const label = node.querySelector("span");
  node.className = "status " + status;
  if (status === "live" && !pending) {
    show(node, false);
    return;
  }
  show(node, true);
  if (status === "local") {
    // Not a problem to fix, so it does not read like one — but it is the
    // one fact about this ledger someone must never be surprised by.
    label.textContent = t("local.status");
    node.onclick = openSettings;
    return;
  }
  if (status === "offline") label.textContent = t("sync.offline");
  else if (status === "error") label.textContent = t("sync.reconnecting");
  else if (pending) label.textContent = t("sync.pending", { n: pending });
  else label.textContent = t("sync.syncing");
  node.onclick = () => {
    if (state.ledger) state.ledger.retry();
  };
}

// ============================================================
//  Render
// ============================================================

function renderAll() {
  if (!state.session && !state.local) return;
  renderChrome();
  renderStatus();
  if (state.view === "log") renderLog();
  else if (state.view === "insights") renderInsights();
  else renderAccounts();

  show($("viewLog"), state.view === "log");
  show($("viewInsights"), state.view === "insights");
  show($("viewAccounts"), state.view === "accounts");

  // A list sheet open over all of this is showing the same ledger, and has
  // to be told too.
  rebuildLiveSheets();
}

function renderChrome() {
  $("tabLog").textContent = t("tab.log");
  $("tabInsights").textContent = t("tab.insights");
  $("tabAccounts").textContent = t("tab.accounts");
  for (const id of ["tabLog", "tabInsights", "tabAccounts"]) {
    $(id).setAttribute("aria-selected", String($(id).dataset.view === state.view));
  }

  const dark = document.documentElement.getAttribute("data-theme") !== "light";
  clear($("btnTheme")).append(icon(dark ? "sun" : "moon"));
  $("btnTheme").title = t("theme.toggle");
  $("btnLang").textContent = getLang() === "ko" ? "EN" : "KO";
  $("btnLang").title = t("lang.toggle");
  $("btnSearch").title = t("search.open");
  $("btnMenu").title = t("menu.open");
  $("fab").title = t("add.new");
  $("btnPrev").title = t("nav.prevPeriod");
  $("btnNext").title = t("nav.nextPeriod");

  const avatarUrl = state.session?.user?.user_metadata?.avatar_url;
  const av = $("avatar");
  if (avatarUrl) {
    av.src = avatarUrl;
    av.referrerPolicy = "no-referrer";
    show(av, true);
    show($("menuIcon"), false);
  } else {
    show(av, false);
    show($("menuIcon"), true);
  }

  const p = period();
  const label = $("periodLabel");
  clear(label).append(document.createTextNode(formatMonthYear(p.start)));
  if (state.data.settings.month_start !== 1) {
    label.append(
      el("span", {
        class: "period-range",
        text: t("sum.periodRange", { start: formatDayShort(p.start), end: formatDayShort(p.end) }),
      })
    );
  }
  label.title = t("nav.thisPeriod");

  renderFilterBar();

  const rows = periodTransactions();
  const sums = M.totals(rows, ctx());
  $("sumInLabel").textContent = t("sum.income");
  $("sumOutLabel").textContent = t("sum.expenses");
  $("sumNetLabel").textContent = t("sum.net");
  $("sumIn").textContent = fmt(sums.income);
  $("sumOut").textContent = fmt(sums.expense);
  $("sumNet").textContent = fmt(sums.net, null, { sign: "always" });
  $("sumNet").classList.toggle("neg", sums.net < 0);

  renderBanner();
}

/**
 * The one line that says the ledger is being read through an account.
 *
 * It sits in the header rather than in the log, because it governs the
 * totals above it and the chart on the next tab as well: wherever you are,
 * this says whose money you are looking at. Tapping it gives everything
 * back — one control, one meaning, and no way to end up filtered without
 * being able to see it.
 */
function renderFilterBar() {
  const bar = clear($("filterBar"));
  const account = accById(state.accountFilter);
  // An account deleted while its filter was on would otherwise leave the
  // log looking empty for no visible reason.
  if (state.accountFilter && !account) state.accountFilter = null;
  show(bar, !!account);
  if (!account) return;

  const balance = M.accountBalances([account], state.data.transactions).get(account.id) || 0;
  bar.append(
    el(
      "button",
      {
        class: "filter-chip",
        type: "button",
        title: t("filter.clear"),
        onClick: () => filterByAccount(null),
      },
      el("span", {
        class: "chip-icon",
        style: { background: colorSoft(account.color), color: colorVar(account.color) },
        text: accountGlyph(account.kind),
      }),
      el("span", { class: "filter-name", text: account.name }),
      el("span", { class: "filter-bal num", text: fmt(balance, account.currency) }),
      el("span", { class: "filter-x", text: "✕", "aria-hidden": "true" })
    )
  );
}

function renderBanner() {
  const node = $("banner");
  const missing = missingRates();
  node.className = "banner" + (state.local && !missing.length ? " quiet" : "");
  if (state.data.status === "offline") {
    clear(node).append(el("span", { text: t("sync.offlineHelp") }));
    show(node, true);
  } else if (missing.length) {
    clear(node).append(
      el("span", { text: t("tx.rateMissing", { code: missing.join(", ") }) }),
      el("button", { type: "button", text: t("tx.rateFix"), onClick: openRates })
    );
    show(node, true);
  } else if (state.local) {
    // A ledger that exists in one browser and nowhere else is worth saying
    // out loud, every time — clearing site data is a normal thing to do,
    // and nobody should discover this afterwards.
    // Element.append() stringifies null — "…this device only.null" — where
    // the el() helper skips it. Build the list, then spread it.
    const parts = [el("span", { text: t("local.banner") })];
    if (isConfigured) {
      parts.push(el("button", { type: "button", text: t("local.bannerAction"), onClick: leaveLocal }));
    }
    clear(node).append(...parts);
    show(node, true);
  } else {
    show(node, false);
  }
}

/** Currencies in use that have no rate, so their money silently vanishes. */
function missingRates() {
  const c = ctx();
  const seen = new Set();
  for (const a of state.data.accounts) {
    if (!a.archived && M.rateMissing(a.currency, c.main_currency, c.rates)) seen.add(a.currency);
  }
  for (const tx of state.data.transactions) {
    if (tx.rate_base !== c.main_currency && M.rateMissing(tx.rate_base, c.main_currency, c.rates)) {
      seen.add(tx.rate_base);
    }
  }
  return [...seen];
}

/**
 * The ledger as it is currently being looked at.
 *
 * One account at a time when a filter is on, which is the whole of what
 * "show me this account" means: the log, the totals in the header, the
 * chart and the six-month trend all read from here, so they can never
 * disagree about which money is being counted.
 */
function visibleTransactions() {
  return M.forAccount(state.data.transactions, state.accountFilter);
}

/**
 * @param source  the ledger to cut the period from. Defaults to what is
 *   being looked at; budgets pass the whole thing, because a limit is set
 *   across every account and filtering it would quietly understate it.
 */
function periodTransactions(source) {
  const p = period();
  const rows = source || visibleTransactions();
  return rows.filter((tx) => M.inRange(tx.occurred_on, p.start, p.end));
}

/** Show one account's money and nothing else, or all of it again. */
function filterByAccount(id) {
  state.accountFilter = id || null;
  // A fresh list, not the middle of the last one.
  state.logLimit = 300;
  if (id) state.view = "log";
  renderAll();
}

// ------------------------------------------------------------
//  The log
// ------------------------------------------------------------

function renderLog() {
  const root = clear($("viewLog"));
  const c = ctx();

  let rows;
  if (state.searching && state.search.trim()) {
    rows = M.searchTransactions(
      visibleTransactions(),
      state.search,
      state.data.categories,
      state.data.accounts
    );
    root.append(
      el("p", {
        class: "help",
        style: { margin: "0 0 10px", textAlign: "center" },
        text: t("search.results", { n: rows.length }),
      })
    );
    if (!rows.length) {
      root.append(
        el(
          "div",
          { class: "empty" },
          icon("empty"),
          el("p", { text: t("search.none", { q: state.search.trim() }) })
        )
      );
      return;
    }
  } else {
    rows = periodTransactions();
    if (!rows.length) {
      const filtered = accById(state.accountFilter);
      const anyAtAll = visibleTransactions().length > 0;
      const p = period();
      root.append(
        el(
          "div",
          { class: "empty" },
          icon("empty"),
          el("h3", {
            text: filtered
              ? t("log.emptyAccount.h", { name: filtered.name })
              : anyAtAll
                ? t("log.emptyMonth.h")
                : t("log.empty.h"),
          }),
          el("p", {
            text: !anyAtAll && filtered
              ? // Not "nothing here yet" — there is a ledger, this account
                // simply has no part in it.
                t("log.emptyAccount.p", { name: filtered.name })
              : anyAtAll
                ? t("log.emptyMonth.p", {
                    start: formatDayShort(p.start),
                    end: formatDayShort(p.end),
                  })
                : t("log.empty.p"),
          }),
          anyAtAll
            ? null
            : el(
                "button",
                { class: "btn btn-primary", type: "button", onClick: () => openTransaction(null) },
                icon("plus"),
                t("log.empty.cta")
              )
        )
      );
      return;
    }
  }

  const days = M.groupByDay(rows, c);
  let shown = 0;
  for (const day of days) {
    if (shown >= state.logLimit) {
      root.append(
        el("button", {
          class: "btn btn-ghost btn-block",
          type: "button",
          text: t("log.showMore", { n: rows.length - shown }),
          onClick: () => {
            state.logLimit += 300;
            renderLog();
          },
        })
      );
      break;
    }
    shown += day.items.length;
    root.append(renderDay(day));
  }
}

function renderDay(day) {
  const wd = M.weekdayOf(day.key);
  const head = el(
    "div",
    { class: "day-head" },
    el("span", { class: "day-date", text: formatDayLong(day.key) }),
    el("span", {
      class: "day-weekday" + (wd === 0 ? " sun" : wd === 6 ? " sat" : ""),
      text: weekdayShort(wd),
    }),
    el(
      "span",
      { class: "day-totals" },
      day.income ? el("span", { class: "in num", text: fmt(day.income) }) : null,
      day.expense ? el("span", { class: "out num", text: fmt(day.expense) }) : null
    )
  );
  const rows = el("div", { class: "rows" }, day.items.map(renderTxRow));
  return el("section", { class: "day" }, head, rows);
}

function renderTxRow(tx) {
  const cat = catById(tx.category_id);
  const from = accById(tx.account_id);
  const to = accById(tx.to_account_id);
  const isTransfer = tx.kind === "transfer";
  const c = ctx();

  const title = tx.note || (isTransfer ? t("tx.transfer") : cat ? cat.name : t("log.uncategorised"));
  const subParts = [];
  if (isTransfer) {
    subParts.push(
      t("log.transferTo", {
        from: from ? from.name : t("log.noAccount"),
        to: to ? to.name : t("log.noAccount"),
      })
    );
  } else {
    if (tx.note && cat) subParts.push(cat.name);
    subParts.push(from ? from.name : t("log.noAccount"));
  }

  const amountClass = isTransfer ? "move" : tx.kind === "income" ? "in" : "out";
  const sign = isTransfer ? "" : tx.kind === "income" ? "+" : "−";
  const primary = sign + fmt(tx.amount_minor, tx.currency, { sign: "never" });
  // The converted figure only earns its line when it says something new —
  // and on a transfer the one thing worth saying is what it cost.
  const alt = isTransfer
    ? tx.fee_minor
      ? t("tx.feeOf", { amount: fmt(tx.fee_minor, tx.currency, { sign: "never" }) })
      : null
    : tx.currency !== c.main_currency
      ? t("tx.converted", { amount: fmt(M.toMain(tx, c)) })
      : null;

  return el(
    "button",
    { class: "tx", type: "button", onClick: () => openTransaction(tx) },
    el("span", {
      class: "chip-icon",
      style: cat ? { background: colorSoft(cat.color) } : null,
      text: isTransfer ? "⇄" : cat ? cat.icon : "•",
    }),
    el(
      "span",
      { class: "tx-body" },
      el("span", { class: "tx-title", text: title }),
      el(
        "span",
        { class: "tx-sub" },
        formatTime(tx.occurred_min),
        " · ",
        subParts.join(" · ")
      )
    ),
    el(
      "span",
      null,
      el("span", { class: "tx-amount " + amountClass, text: primary }),
      alt ? el("span", { class: "tx-alt", text: alt }) : null
    )
  );
}

const colorVar = (name) => "var(--c-" + (M.COLORS.includes(name) ? name : "gray") + ")";
const colorSoft = (name) =>
  "color-mix(in srgb, " + colorVar(name) + " 22%, transparent)";

// ------------------------------------------------------------
//  Insights
// ------------------------------------------------------------

function renderInsights() {
  const root = clear($("viewInsights"));
  const c = ctx();
  const p = period();
  const rows = periodTransactions();

  // Budgets are set across every account, so they are counted across every
  // account: cutting them to one would show a limit half spent that is
  // really all spent.
  root.append(renderBudgetCard(periodTransactions(state.data.transactions), p));

  // --- where it went ---
  const side = state.insightsSide;
  const { rows: slices, total } = M.byCategory(rows, side, c);
  const card = el("div", { class: "card" });
  card.append(
    el(
      "div",
      { class: "card-head" },
      el("h2", { text: side === "expense" ? t("ins.breakdown") : t("ins.breakdownIncome") }),
      el(
        "div",
        { class: "seg", style: { padding: "2px", gap: "2px" } },
        el("button", {
          type: "button",
          text: t("ins.showExpense"),
          "aria-pressed": String(side === "expense"),
          style: { fontSize: "12px", padding: "5px 10px" },
          onClick: () => {
            state.insightsSide = "expense";
            renderInsights();
          },
        }),
        el("button", {
          type: "button",
          text: t("ins.showIncome"),
          "aria-pressed": String(side === "income"),
          style: { fontSize: "12px", padding: "5px 10px" },
          onClick: () => {
            state.insightsSide = "income";
            renderInsights();
          },
        })
      )
    )
  );

  if (!slices.length) {
    card.append(el("p", { class: "help", style: { textAlign: "center", padding: "18px 0" }, text: t("ins.empty") }));
  } else {
    card.append(renderDonut(slices, total, side));
  }
  root.append(card);

  if (!rows.length) return;

  // --- the shape of the month ---
  root.append(renderStats(rows, p));

  // --- six months ---
  root.append(renderTrend());
}

function renderDonut(slices, total, side) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 140 140");
  svg.setAttribute("class", "donut");
  svg.setAttribute("role", "img");

  const track = document.createElementNS(svgNS, "circle");
  track.setAttribute("cx", "70");
  track.setAttribute("cy", "70");
  track.setAttribute("r", String(R));
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "var(--track)");
  track.setAttribute("stroke-width", "16");
  svg.append(track);

  let offset = 0;
  const top = slices.slice(0, 9);
  const rest = slices.slice(9);
  const drawn = rest.length
    ? [...top, { category_id: null, amount: rest.reduce((s, r) => s + r.amount, 0), share: rest.reduce((s, r) => s + r.share, 0), lumped: true }]
    : top;

  for (const slice of drawn) {
    const cat = catById(slice.category_id);
    const arc = document.createElementNS(svgNS, "circle");
    arc.setAttribute("cx", "70");
    arc.setAttribute("cy", "70");
    arc.setAttribute("r", String(R));
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", cat ? colorVar(cat.color) : "var(--c-gray)");
    arc.setAttribute("stroke-width", "16");
    // A hair of gap between neighbours, so two similar colours still read
    // as two slices.
    const len = Math.max(0, slice.share * C - 1.5);
    arc.setAttribute("stroke-dasharray", len + " " + (C - len));
    arc.setAttribute("stroke-dashoffset", String(-offset * C));
    arc.setAttribute("transform", "rotate(-90 70 70)");
    arc.setAttribute("class", "donut-seg");
    svg.append(arc);
    offset += slice.share;
  }

  const value = document.createElementNS(svgNS, "text");
  value.setAttribute("x", "70");
  value.setAttribute("y", "72");
  value.setAttribute("text-anchor", "middle");
  value.setAttribute("class", "donut-hole-value");
  value.textContent = fmtShort(total);
  const label = document.createElementNS(svgNS, "text");
  label.setAttribute("x", "70");
  label.setAttribute("y", "86");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("class", "donut-hole-label");
  label.textContent = side === "expense" ? t("sum.expenses") : t("sum.income");
  svg.append(value, label);

  const legend = el("div", { class: "legend" });
  for (const slice of slices.slice(0, 12)) {
    const isFee = slice.category_id === M.FEE_CATEGORY;
    const cat = isFee ? null : catById(slice.category_id);
    const name = isFee
      ? "🏦  " + t("tx.fees")
      : cat
        ? cat.icon + "  " + cat.name
        : t("log.uncategorised");
    legend.append(
      el(
        "button",
        {
          class: "legend-row",
          type: "button",
          onClick: () => {
            state.searching = true;
            state.search = cat ? cat.name : "";
            setSearching(true);
          },
        },
        el("span", { class: "swatch", style: { background: cat ? colorVar(cat.color) : "var(--c-gray)" } }),
        el("span", { class: "legend-name", text: name }),
        el("span", { class: "legend-share", text: formatPercent(slice.share) }),
        el("span", { class: "legend-amount", text: fmt(slice.amount) })
      )
    );
  }

  return el("div", { class: "donut-wrap" }, svg, legend);
}

function renderStats(rows, p) {
  const c = ctx();
  const sums = M.totals(rows, c);
  const today = M.todayKey();
  const daysInPeriod = M.daysBetween(p.start, p.end) + 1;
  const elapsed =
    today > p.end ? daysInPeriod : today < p.start ? 0 : M.daysBetween(p.start, today) + 1;
  const perDay = elapsed > 0 ? Math.round(sums.expense / elapsed) : 0;

  const expenses = rows.filter((x) => x.kind === "expense");
  let biggest = null;
  for (const x of expenses) {
    const v = M.toMain(x, c);
    if (!biggest || v > biggest.value) biggest = { tx: x, value: v };
  }

  const card = el("div", { class: "card" });
  card.append(
    el(
      "dl",
      { class: "stat-grid" },
      el("div", { class: "stat" }, el("dt", { text: t("ins.avgDay") }), el("dd", { text: fmt(perDay) })),
      biggest
        ? el(
            "div",
            { class: "stat" },
            el("dt", { text: t("ins.biggest") }),
            el("dd", { text: fmt(biggest.value) }),
            el("p", {
              class: "help",
              style: { margin: "2px 0 0" },
              text: biggest.tx.note || (catById(biggest.tx.category_id)?.name ?? ""),
            })
          )
        : null
    )
  );
  return card;
}

function renderTrend() {
  const c = ctx();
  const months = M.byPeriod(
    visibleTransactions(),
    state.anchor,
    6,
    state.data.settings.month_start,
    c
  );
  const peak = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));

  const chart = el("div", { class: "trend" });
  for (const m of months) {
    const isNow = m.period.start === period().start;
    chart.append(
      el(
        "div",
        { class: "trend-col" + (isNow ? " now" : "") },
        el(
          "div",
          { class: "trend-stack" },
          el("div", {
            class: "trend-bar in",
            style: { height: Math.max(2, (m.income / peak) * 100) + "%" },
            title: t("sum.income") + " " + fmt(m.income),
          }),
          el("div", {
            class: "trend-bar out",
            style: { height: Math.max(2, (m.expense / peak) * 100) + "%" },
            title: t("sum.expenses") + " " + fmt(m.expense),
          })
        ),
        el("button", {
          class: "trend-label",
          type: "button",
          text: formatMonthYear(m.period.start).replace(/\s*\d{4}년?\s*/, " ").trim(),
          onClick: () => {
            state.anchor = m.period.start;
            renderAll();
          },
        })
      )
    );
  }

  return el(
    "div",
    { class: "card" },
    el("div", { class: "card-head" }, el("h2", { text: t("ins.trend") })),
    chart,
    el(
      "div",
      { class: "legend-key" },
      el("span", null, el("i", { style: { background: "var(--income)" } }), t("ins.trendIncome")),
      el("span", null, el("i", { style: { background: "var(--expense)" } }), t("ins.trendExpense"))
    )
  );
}

function renderBudgetCard(rows, p) {
  const c = ctx();
  const progress = M.budgetProgress(state.data.budgets, rows, state.data.categories, c);
  const card = el("div", { class: "card" });
  card.append(
    el(
      "div",
      { class: "card-head" },
      el("h2", { text: t("ins.budget") }),
      el("button", {
        class: "card-action",
        type: "button",
        text: progress.length ? t("ins.budgetEdit") : t("ins.budgetSet"),
        onClick: openBudgets,
      })
    )
  );

  if (!progress.length) {
    card.append(
      el("p", { class: "help", style: { margin: 0 }, text: t("ins.budgetNone.p") })
    );
    return card;
  }

  const filtered = accById(state.accountFilter);
  if (filtered) {
    card.append(
      el("p", {
        class: "help",
        style: { margin: "0 0 12px" },
        text: t("ins.budgetAllAccounts", { name: filtered.name }),
      })
    );
  }

  // Where "today" sits in the period, so a bar can be read as ahead or behind
  // rather than just full or not.
  const today = M.todayKey();
  const days = M.daysBetween(p.start, p.end) + 1;
  const elapsed = today > p.end ? days : today < p.start ? 0 : M.daysBetween(p.start, today) + 1;
  const pace = days > 0 ? elapsed / days : 1;

  for (const b of progress) {
    const over = b.ratio > 1;
    const warn = !over && b.ratio > pace + 0.1;
    const cat = b.category;
    card.append(
      el(
        "div",
        { class: "budget" },
        el(
          "div",
          { class: "budget-top" },
          el(
            "span",
            { class: "budget-name" },
            cat ? el("span", { text: cat.icon }) : null,
            el("span", { text: cat ? cat.name : t("ins.budgetTotal") })
          ),
          el("span", {
            class: "budget-figure num",
            text: t("ins.spentOf", { spent: fmt(b.spent), limit: fmt(b.limit) }),
          })
        ),
        el(
          "div",
          { class: "bar" },
          el("div", {
            class: "bar-fill" + (over ? " over" : warn ? " warn" : ""),
            style: { width: Math.min(100, b.ratio * 100) + "%" },
          }),
          elapsed > 0 && elapsed < days
            ? el("div", { class: "bar-today", style: { left: pace * 100 + "%" }, title: formatDayShort(today) })
            : null
        ),
        el(
          "div",
          { class: "budget-foot" },
          el("span", { text: formatPercent(b.ratio) }),
          el("span", {
            class: over ? "over" : "left",
            text: over
              ? t("ins.budgetOver", { amount: fmt(-b.remaining) })
              : t("ins.budgetLeft", { amount: fmt(b.remaining) }),
          })
        )
      )
    );
  }
  return card;
}

// ------------------------------------------------------------
//  Accounts
// ------------------------------------------------------------

function renderAccounts() {
  const root = clear($("viewAccounts"));
  const c = ctx();
  const all = accountsList(true);
  const live = all.filter((a) => !a.archived);
  const balances = M.accountBalances(all, state.data.transactions);

  root.append(
    el(
      "dl",
      { class: "networth" },
      el("dt", { text: t("acc.netWorth") }),
      el("dd", { text: fmt(M.netWorth(all, state.data.transactions, c)) })
    )
  );

  if (!all.length) {
    root.append(
      el(
        "div",
        { class: "empty" },
        icon("wallet"),
        el("h3", { text: t("acc.empty.h") }),
        el("p", { text: t("acc.empty.p") }),
        el(
          "button",
          { class: "btn btn-primary", type: "button", onClick: () => openAccount(null) },
          icon("plus"),
          t("acc.add")
        )
      )
    );
    return;
  }

  const list = el("div", { class: "rows" });
  const visible = state.showArchived ? all : live;
  for (const a of visible) {
    const bal = balances.get(a.id) || 0;
    const converted =
      a.currency !== c.main_currency
        ? M.toMain(
            { amount_minor: bal, currency: a.currency, rate: M.rateForNew(a.currency, c), rate_base: c.main_currency },
            c
          )
        : null;
    const row = el(
      "button",
      {
        // Tapping an account shows its money — the thing anyone opens this
        // screen to do. Editing it is the pencil beside it, one tap either
        // way.
        class: "acct" + (a.archived ? " is-archived" : ""),
        type: "button",
        title: t("acc.seeTransactions", { name: a.name }),
        onClick: () => filterByAccount(a.id),
      },
      el("span", {
        class: "chip-icon",
        style: { background: colorSoft(a.color), color: colorVar(a.color) },
        text: accountGlyph(a.kind),
      }),
      el(
        "span",
        null,
        el("span", { class: "acct-name", text: a.name }),
        el("span", {
          class: "acct-sub",
          text:
            t("acc.kind." + a.kind) +
            " · " +
            a.currency +
            (a.archived ? " · " + t("acc.archived") : ""),
        })
      ),
      el(
        "span",
        null,
        el("span", { class: "acct-bal num" + (bal < 0 ? " neg" : ""), text: fmt(bal, a.currency) }),
        converted != null
          ? el("span", { class: "tx-alt", text: t("acc.inMain", { amount: fmt(converted) }) })
          : null
      )
    );
    list.append(
      el(
        "div",
        { class: "acct-row" },
        row,
        el(
          "button",
          {
            class: "icon-btn acct-edit",
            type: "button",
            title: t("acc.edit"),
            "aria-label": t("acc.edit") + " · " + a.name,
            onClick: () => openAccount(a),
          },
          icon("edit")
        )
      )
    );
  }
  root.append(list);

  const actions = el("div", { style: { display: "flex", gap: "8px", marginTop: "12px" } });
  actions.append(
    el(
      "button",
      { class: "btn btn-ghost", type: "button", style: { flex: "1" }, onClick: () => openAccount(null) },
      icon("plus"),
      t("acc.add")
    )
  );
  if (all.length !== live.length) {
    actions.append(
      el("button", {
        class: "btn btn-ghost",
        type: "button",
        text: state.showArchived ? t("close") : t("acc.showArchived"),
        onClick: () => {
          state.showArchived = !state.showArchived;
          renderAccounts();
        },
      })
    );
  }
  root.append(actions);
}

const ACCOUNT_GLYPH = { cash: "💵", bank: "🏦", card: "💳", ewallet: "📱", savings: "🐖" };
const accountGlyph = (kind) => ACCOUNT_GLYPH[kind] || "💰";

// ============================================================
//  The transaction editor
// ============================================================

function openTransaction(existing) {
  const c = ctx();
  const accounts = accountsList();
  if (!accounts.length) {
    toast(t("tx.noAccounts"));
    openAccount(null);
    return;
  }

  const draft = existing
    ? {
        ...existing,
        amount: M.groupAmount(M.minorToInput(existing.amount_minor, existing.currency)),
        // Text, like the amount: blank means no fee, so an untouched
        // transfer does not come back reading "0".
        fee: existing.fee_minor
          ? M.groupAmount(M.minorToInput(existing.fee_minor, existing.currency))
          : "",
      }
    : {
        id: M.uuid(),
        kind: "expense",
        amount: "",
        fee: "",
        currency: accounts[0].currency,
        rate: M.rateForNew(accounts[0].currency, c),
        rate_base: c.main_currency,
        account_id: accounts[0].id,
        to_account_id: null,
        to_amount_minor: null,
        category_id: null,
        note: "",
        occurred_on: M.todayKey(),
        occurred_min: M.minuteOfDay(),
        deleted_at: null,
      };

  if (!existing) {
    // Open on the account and category used last, because the next thing
    // anyone records is overwhelmingly another of the same thing.
    const last = state.data.transactions
      .filter((x) => x.kind === "expense" && x.category_id)
      .sort(M.compareTx)[0];
    if (last) {
      draft.category_id = last.category_id;
      const acc = accById(last.account_id);
      if (acc && !acc.archived) {
        draft.account_id = acc.id;
        draft.currency = acc.currency;
        draft.rate = M.rateForNew(acc.currency, c);
      }
    }
    // Unless one account is being looked at, in which case that is
    // overwhelmingly the one being written down.
    const filtered = accById(state.accountFilter);
    if (filtered && !filtered.archived) {
      draft.account_id = filtered.id;
      draft.currency = filtered.currency;
      draft.rate = M.rateForNew(filtered.currency, c);
    }
  }

  // What the sheet needs to remember between rebuilds, and nothing more.
  // `feeTouched` is here rather than on the draft because it is a fact about
  // this editing session, not about the transaction: once the fee has been
  // typed in, no later change of account may overwrite it.
  const view = { errorKey: null, first: true, feeTouched: false };
  let sheet = null;
  const rerender = () => sheet && sheet.rebuild();

  // What this opened with, so that closing it can tell whether anything was
  // written. Only the parts a person puts there: the currency and rate follow
  // whichever account is chosen and nobody would miss them. Filing an entry
  // makes what is on screen the new starting point, so "save and another"
  // does not leave the sheet claiming to hold unsaved work.
  const typed = (d) => JSON.stringify([
    d.kind, d.amount, d.category_id, d.account_id, d.to_account_id,
    d.to_amount_minor, d.fee, d.note, d.occurred_on, d.occurred_min,
  ]);
  view.opened = typed(draft);
  view.filed = () => {
    view.opened = typed(draft);
  };

  sheet = openSheet(
    (inner, close, askThenClose) => {
      inner.append(
        ...transactionSheetContent(draft, existing, close, view, rerender, askThenClose)
      );
      view.first = false;
    },
    { unsaved: () => typed(draft) !== view.opened }
  );
}

function transactionSheetContent(draft, existing, closeIt, view, rerender, askThenClose) {
  const getError = () => view.errorKey;
  const setError = (k) => {
    view.errorKey = k;
  };
  const c = ctx();
  const accounts = accountsList();
  const isTransfer = draft.kind === "transfer";
  const account = accById(draft.account_id);
  const toAccount = accById(draft.to_account_id);
  const currency = account ? account.currency : c.main_currency;
  draft.currency = currency;

  /**
   * Fill the fee in from the last time this same move was made.
   *
   * Only for a new transfer, and only until the fee has been typed in: an
   * existing transaction already knows what it cost, and a number the
   * person put there themselves outranks anything the ledger remembers.
   * A pair with no history, or whose last transfer was free, leaves the
   * field blank rather than writing a nought into it.
   */
  const suggestFee = () => {
    if (existing || view.feeTouched) return;
    const was = M.lastTransferFee(
      state.data.transactions,
      draft.account_id,
      draft.to_account_id,
      draft.currency
    );
    draft.fee = was ? M.groupAmount(M.minorToInput(was, draft.currency)) : "";
  };

  const body = el("div", { class: "sheet-body" });

  // ---- kind ----
  const kinds = el("div", { class: "seg kinds", style: { marginBottom: "14px" } });
  for (const kind of ["expense", "income", "transfer"]) {
    kinds.append(
      el("button", {
        type: "button",
        text: t("tx." + kind),
        dataset: { kind },
        "aria-pressed": String(draft.kind === kind),
        onClick: () => {
          if (draft.kind === kind) return;
          draft.kind = kind;
          if (kind === "transfer") {
            draft.category_id = null;
            if (!draft.to_account_id) {
              const other = accounts.find((a) => a.id !== draft.account_id);
              draft.to_account_id = other ? other.id : null;
            }
            suggestFee();
          } else {
            draft.to_account_id = null;
            draft.to_amount_minor = null;
            draft.fee = "";
            // The typed fee went with it, so coming back to a transfer
            // starts from the ledger again rather than from a blank.
            view.feeTouched = false;
            // A category from the other side of the ledger would be wrong.
            const cat = catById(draft.category_id);
            if (!cat || cat.kind !== kind) draft.category_id = null;
          }
          setError(null);
          rerender();
        },
      })
    );
  }
  body.append(kinds);

  // ---- amount ----
  const amountInput = el("input", {
    class: "amount-input num",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: "0",
    value: draft.amount,
    "aria-label": t("tx.amount"),
    "data-autofocus": view.first && !existing ? "" : null,
  });
  const altLine = el("div", { class: "amount-alt" });

  const refreshAlt = () => {
    const raw = amountInput.value;
    const minor = M.parseAmountToMinor(raw, currency);
    altLine.className = "amount-alt";
    if (raw.trim() && minor === null) {
      altLine.textContent = t("tx.calcBad");
      altLine.classList.add("warn");
      return;
    }
    if (!minor) {
      altLine.textContent = t("tx.calcHint");
      return;
    }

    // Someone typing a sum should be able to see the answer while they type,
    // not have to save the transaction to find out what it came to.
    const parts = [];
    if (M.isExpression(raw)) {
      parts.push(t("tx.calcEquals", { amount: fmt(minor, currency) }));
      altLine.classList.add("total");
    }

    if (currency !== c.main_currency) {
      if (M.rateMissing(currency, c.main_currency, c.rates)) {
        altLine.textContent = t("tx.rateMissing", { code: currency });
        altLine.classList.add("warn");
        return;
      }
      const inMain = M.toMain(
        { amount_minor: minor, currency, rate: draft.rate, rate_base: draft.rate_base },
        c
      );
      parts.push(t("tx.converted", { amount: fmt(inMain) }));
    }

    altLine.textContent = parts.join("  ·  ");
  };

  groupsDigits(amountInput, (text) => {
    draft.amount = text;
    refreshAlt();
  });

  const ops = el("div", { class: "amount-ops" });
  for (const op of ["+", "−", "×", "÷", "000"]) {
    ops.append(
      el("button", {
        type: "button",
        text: op,
        "aria-label": op === "000" ? "000" : op,
        onClick: () => {
          // Through the field's own input path, so what the key adds is
          // grouped exactly as it would have been if it had been typed.
          typeInto(amountInput, op);
          amountInput.focus();
        },
      })
    );
  }

  body.append(
    el(
      "div",
      { class: "amount-field " + draft.kind },
      el("span", { class: "amount-cur", text: M.currencyOf(currency).symbol || currency }),
      amountInput
    ),
    ops,
    el(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
      altLine,
      currency !== c.main_currency
        ? el("button", {
            class: "card-action",
            type: "button",
            text: t("tx.rateFix"),
            style: { flex: "none" },
            onClick: () => openRateEditor(currency, (rate) => {
              draft.rate = rate;
              draft.rate_base = c.main_currency;
              refreshAlt();
            }),
          })
        : null
    )
  );
  refreshAlt();

  // ---- category ----
  if (!isTransfer) {
    const cat = catById(draft.category_id);
    body.append(
      el(
        "div",
        { class: "field", style: { marginTop: "14px" } },
        el("span", { class: "field-label", text: t("tx.category") }),
        el(
          "button",
          {
            class: "picker" + (getError() === "tx.needCategory" ? " invalid" : ""),
            type: "button",
            onClick: () =>
              openCategoryPicker(draft.kind, draft.category_id, (id) => {
                draft.category_id = id;
                setError(null);
                rerender();
              }),
          },
          el("span", { class: "chip-icon", style: { width: "26px", height: "26px", fontSize: "14px", borderRadius: "9px" }, text: cat ? cat.icon : "•" }),
          el("span", {
            class: "picker-value" + (cat ? "" : " placeholder"),
            text: cat ? cat.name : t("tx.categoryPick"),
          }),
          icon("chevron")
        )
      )
    );
  }

  // ---- accounts ----
  const accountField = (label, current, onPick, invalid) => {
    const a = accById(current);
    return el(
      "div",
      { class: "field" },
      el("span", { class: "field-label", text: label }),
      el(
        "button",
        {
          class: "picker" + (invalid ? " invalid" : ""),
          type: "button",
          onClick: () => openAccountPicker(current, onPick),
        },
        el("span", { class: "chip-icon", style: { width: "26px", height: "26px", fontSize: "13px", borderRadius: "9px" }, text: a ? accountGlyph(a.kind) : "•" }),
        el("span", {
          class: "picker-value" + (a ? "" : " placeholder"),
          text: a ? a.name + " · " + a.currency : t("tx.accountPick"),
        }),
        icon("chevron")
      )
    );
  };

  body.append(
    accountField(
      isTransfer ? t("tx.accountFrom") : t("tx.account"),
      draft.account_id,
      (id) => {
        draft.account_id = id;
        const acc = accById(id);
        if (acc) {
          draft.currency = acc.currency;
          // A new currency needs a new frozen rate; keeping the old one
          // would price rupiah at the won rate.
          draft.rate = M.rateForNew(acc.currency, c);
          draft.rate_base = c.main_currency;
        }
        suggestFee();
        setError(null);
        rerender();
      },
      getError() === "tx.needAccount"
    )
  );

  if (isTransfer) {
    body.append(
      accountField(
        t("tx.accountTo"),
        draft.to_account_id,
        (id) => {
          draft.to_account_id = id;
          suggestFee();
          setError(null);
          rerender();
        },
        getError() === "tx.needToAccount" || getError() === "tx.sameAccount"
      )
    );
    // What the bank kept. Blank almost always, so it is one short field
    // rather than a section: a transfer that cost nothing should not have
    // to say so.
    const feeInput = el("input", {
      class: "input num",
      type: "text",
      inputmode: "decimal",
      style: { textAlign: "right" },
      value: draft.fee || "",
      placeholder: M.minorToInput(0, currency),
    });
    groupsDigits(feeInput, (text) => {
      draft.fee = text;
      // From here on this transfer's fee is the person's, not the ledger's.
      view.feeTouched = true;
      setError(null);
    });
    const feeMinor = M.parseAmountToMinor(draft.fee || "", currency);
    const feeBad = String(draft.fee || "").trim() !== "" && feeMinor === null;
    body.append(
      el(
        "div",
        { class: "field" },
        el("span", { class: "field-label", text: t("tx.fee") + " · " + currency }),
        feeInput,
        el("p", {
          class: "help" + (feeBad ? " warn" : ""),
          text: feeBad ? t("tx.feeBad") : t("tx.feeHelp"),
        })
      )
    );

    // Only cross-currency transfers need to say what landed.
    if (account && toAccount && account.currency !== toAccount.currency) {
      const landedInput = el("input", {
        class: "input num",
        type: "text",
        inputmode: "decimal",
        style: { textAlign: "right" },
        value:
          draft.to_amount_minor != null
            ? M.groupAmount(M.minorToInput(draft.to_amount_minor, toAccount.currency))
            : "",
        placeholder: M.groupAmount(
          M.minorToInput(
            M.convertMinor(
              M.parseAmountToMinor(draft.amount, currency) || 0,
              currency,
              toAccount.currency,
              c
            ),
            toAccount.currency
          )
        ),
      });
      groupsDigits(landedInput, (text) => {
        const v = M.parseAmountToMinor(text, toAccount.currency);
        draft.to_amount_minor = text.trim() === "" ? null : v;
      });
      body.append(
        el(
          "div",
          { class: "field" },
          el("span", { class: "field-label", text: t("tx.receives") + " · " + toAccount.currency }),
          landedInput,
          el("p", { class: "help", text: t("tx.receivesHelp") })
        )
      );
    } else {
      // The field is gone, so what was typed into it must go too. Leaving it
      // on the draft would send a number of dollars into a won account and
      // there would be nothing on screen saying where it came from.
      draft.to_amount_minor = null;
    }
  }

  // ---- note ----
  const noteInput = el("input", {
    class: "input",
    type: "text",
    autocomplete: "off",
    maxlength: "280",
    value: draft.note,
    placeholder: t("tx.notePlaceholder"),
  });
  const suggestBox = el("div", { class: "suggest hidden", hidden: true });

  const refreshSuggestions = () => {
    const list = M.noteSuggestions(state.data.transactions, noteInput.value, 6);
    clear(suggestBox);
    const useful = list.filter((s) => s.note.toLowerCase() !== noteInput.value.trim().toLowerCase());
    if (!useful.length) {
      show(suggestBox, false);
      return;
    }
    for (const s of useful) {
      suggestBox.append(
        el("button", {
          type: "button",
          text: s.note,
          onClick: () => {
            draft.note = s.note;
            noteInput.value = s.note;
            // Reusing a note almost always means reusing what it was filed
            // under; it is still one tap to change.
            if (s.category_id && s.kind === draft.kind && !isTransfer) {
              draft.category_id = s.category_id;
            }
            show(suggestBox, false);
            rerender();
          },
        })
      );
    }
    show(suggestBox, true);
  };

  noteInput.addEventListener("input", () => {
    draft.note = noteInput.value;
    refreshSuggestions();
  });
  noteInput.addEventListener("focus", refreshSuggestions);
  noteInput.addEventListener("blur", () => setTimeout(() => show(suggestBox, false), 160));

  body.append(
    el(
      "div",
      { class: "field" },
      el("span", { class: "field-label", text: t("tx.note") }),
      noteInput,
      suggestBox
    )
  );

  // ---- when ----
  const dateInput = el("input", { class: "input", type: "date", value: draft.occurred_on });
  dateInput.addEventListener("change", () => {
    if (M.isDayKey(dateInput.value)) draft.occurred_on = dateInput.value;
    else dateInput.value = draft.occurred_on;
  });
  const timeInput = el("input", {
    class: "input",
    type: "time",
    value:
      String(Math.floor(draft.occurred_min / 60)).padStart(2, "0") +
      ":" +
      String(draft.occurred_min % 60).padStart(2, "0"),
  });
  timeInput.addEventListener("change", () => {
    const [h, m] = timeInput.value.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) draft.occurred_min = h * 60 + m;
  });

  body.append(
    el(
      "div",
      { class: "row-2" },
      el("div", { class: "field" }, el("span", { class: "field-label", text: t("tx.date") }), dateInput),
      el("div", { class: "field" }, el("span", { class: "field-label", text: t("tx.time") }), timeInput)
    ),
    el(
      "div",
      { style: { display: "flex", gap: "8px", marginTop: "-6px" } },
      el("button", {
        class: "btn",
        type: "button",
        text: t("tx.today"),
        style: { flex: "1", padding: "7px 0", fontSize: "13px" },
        onClick: () => {
          draft.occurred_on = M.todayKey();
          dateInput.value = draft.occurred_on;
        },
      }),
      el("button", {
        class: "btn",
        type: "button",
        text: t("tx.yesterday"),
        style: { flex: "1", padding: "7px 0", fontSize: "13px" },
        onClick: () => {
          draft.occurred_on = M.addDays(M.todayKey(), -1);
          dateInput.value = draft.occurred_on;
        },
      })
    )
  );

  const problem = getError();
  const errorNode = el(
    "p",
    { class: "error" + (problem ? "" : " hidden"), hidden: !problem },
    problem ? t(problem, { code: currency }) : "",
    problem === "tx.needRate"
      ? el("button", {
          class: "card-action",
          type: "button",
          style: { marginLeft: "8px" },
          text: t("tx.rateFix"),
          onClick: () =>
            openRateEditor(currency, (rate) => {
              draft.rate = rate;
              draft.rate_base = c.main_currency;
              setError(null);
              rerender();
            }),
        })
      : null
  );
  body.append(errorNode);

  // ---- footer ----
  const save = (andAnother) => {
    const problem = M.validateTransaction(draft, ctx());
    if (problem) {
      setError(problem);
      rerender();
      return;
    }
    setError(null);
    commit(draft);
    if (andAnother) {
      toast(t("tx.saved"));
      // Keep the shape of what was just entered — kind, account, category,
      // date — and clear only what changes each time.
      draft.id = M.uuid();
      draft.amount = "";
      draft.note = "";
      draft.fee = "";
      draft.to_amount_minor = null;
      draft.occurred_min = M.minuteOfDay();
      // The one just filed is now the last transfer between this pair, so
      // the next one starts from what this one cost — including when what
      // it cost was nothing. Typing a fee governs the transfer it was typed
      // for, not every transfer after it.
      view.feeTouched = false;
      suggestFee();
      // Filed, so this is the new starting point: closing now has nothing
      // left to ask about.
      if (view.filed) view.filed();
      rerender();
    } else {
      closeIt();
    }
  };

  const foot = el("div", { class: "sheet-foot" });
  if (existing) {
    foot.append(
      el(
        "button",
        {
          class: "btn btn-danger",
          type: "button",
          style: { flex: "0 0 auto" },
          "aria-label": t("tx.delete"),
          onClick: async () => {
            const ok = await confirmSheet({
              title: t("tx.deleteConfirm"),
              body: t("tx.deleteBody"),
              confirmLabel: t("delete"),
              danger: true,
            });
            if (!ok) return;
            const removed = state.ledger.remove("transactions", existing.id);
            closeIt();
            if (removed) {
              toast(t("tx.deleted"), {
                action: t("tx.undo"),
                onAction: () => state.ledger.restore("transactions", removed),
              });
            }
          },
        },
        icon("trash")
      )
    );
  }
  foot.append(
    el("button", { class: "btn btn-ghost", type: "button", text: t("tx.saveAnother"), onClick: () => save(true) }),
    el("button", { class: "btn btn-primary", type: "button", text: t("tx.save"), onClick: () => save(false) })
  );

  // Enter saves, from anywhere in the sheet that is not a button.
  body.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "button") {
      e.preventDefault();
      save(false);
    }
  });

  return [sheetHead(existing ? t("tx.edit") : t("tx.new"), askThenClose || closeIt), body, foot];
}

function commit(draft) {
  const minor = M.parseAmountToMinor(draft.amount, draft.currency);
  const row = {
    id: draft.id,
    kind: draft.kind,
    amount_minor: minor,
    currency: draft.currency,
    rate: draft.rate,
    rate_base: draft.rate_base,
    account_id: draft.account_id,
    to_account_id: draft.kind === "transfer" ? draft.to_account_id : null,
    to_amount_minor: draft.kind === "transfer" ? draft.to_amount_minor : null,
    fee_minor:
      draft.kind === "transfer"
        ? M.parseAmountToMinor(draft.fee || "", draft.currency) || 0
        : 0,
    category_id: draft.kind === "transfer" ? null : draft.category_id,
    note: (draft.note || "").trim().slice(0, 280),
    occurred_on: draft.occurred_on,
    occurred_min: draft.occurred_min,
    created_at: draft.created_at || new Date().toISOString(),
    deleted_at: null,
  };
  state.ledger.put("transactions", row);
  // Follow the entry: saving something dated last month and staying on this
  // one makes it look as though nothing happened.
  const p = period();
  if (!M.inRange(row.occurred_on, p.start, p.end)) {
    state.anchor = row.occurred_on;
    renderAll();
  }
}

// ============================================================
//  Pickers
// ============================================================

function openCategoryPicker(kind, current, onPick) {
  openSheet((inner, close) => {
    const list = categoriesOf(kind);
    const grid = el("div", { class: "chip-grid" });
    for (const cat of list) {
      grid.append(
        el(
          "button",
          {
            class: "chip",
            type: "button",
            "aria-pressed": String(cat.id === current),
            onClick: () => {
              onPick(cat.id);
              close();
            },
          },
          el("span", { class: "chip-emoji", text: cat.icon }),
          el("span", { class: "chip-label", text: cat.name })
        )
      );
    }
    inner.append(
      sheetHead(t("tx.categoryPick"), close),
      el(
        "div",
        { class: "sheet-body" },
        list.length ? grid : el("p", { class: "help", text: t("tx.noCategories") })
      ),
      el(
        "div",
        { class: "sheet-foot" },
        el(
          "button",
          {
            class: "btn btn-ghost",
            type: "button",
            onClick: () => {
              close();
              openManageCategories(kind);
            },
          },
          icon("settings"),
          t("cat.manage")
        )
      )
    );
  });
}

function openAccountPicker(current, onPick) {
  openSheet((inner, close) => {
    const list = accountsList();
    const grid = el("div", { class: "chip-grid" });
    for (const a of list) {
      grid.append(
        el(
          "button",
          {
            class: "chip",
            type: "button",
            "aria-pressed": String(a.id === current),
            onClick: () => {
              onPick(a.id);
              close();
            },
          },
          el("span", { class: "chip-emoji", text: accountGlyph(a.kind) }),
          el("span", { class: "chip-label", text: a.name }),
          el("span", { class: "chip-label", style: { color: "var(--faint)", fontSize: "11px" }, text: a.currency })
        )
      );
    }
    inner.append(
      sheetHead(t("tx.accountPick"), close),
      el("div", { class: "sheet-body" }, grid),
      el(
        "div",
        { class: "sheet-foot" },
        el(
          "button",
          {
            class: "btn btn-ghost",
            type: "button",
            onClick: () => {
              close();
              openAccount(null);
            },
          },
          icon("plus"),
          t("acc.add")
        )
      )
    );
  });
}

// ============================================================
//  Accounts and categories
// ============================================================

function openAccount(existing) {
  const c = ctx();
  const draft = existing
    ? {
        ...existing,
        // Zero is what the field means when it is empty, so it shows nothing
        // and lets the placeholder say "0". Writing the zero out puts a
        // character in the way: everyone who wants a starting balance has to
        // delete it before typing one.
        opening: existing.opening_minor
          ? M.groupAmount(M.minorToInput(existing.opening_minor, existing.currency))
          : "",
      }
    : {
        id: M.uuid(),
        name: "",
        kind: "cash",
        currency: c.main_currency,
        opening_minor: 0,
        opening: "",
        color: "indigo",
        archived: false,
        position: state.data.accounts.length,
        deleted_at: null,
      };

  let sheet = null;
  const rebuild = () => sheet && sheet.rebuild();

  function content(inner, close) {
    {
      const body = el("div", { class: "sheet-body" });
      const nameInput = el("input", {
        class: "input",
        type: "text",
        maxlength: "60",
        value: draft.name,
        placeholder: t("acc.namePlaceholder"),
        "data-autofocus": "",
      });
      nameInput.addEventListener("input", () => (draft.name = nameInput.value));

      const kindSelect = el("select", { class: "select" });
      for (const k of ["cash", "bank", "card", "ewallet", "savings"]) {
        kindSelect.append(el("option", { value: k, selected: draft.kind === k, text: t("acc.kind." + k) }));
      }
      kindSelect.addEventListener("change", () => (draft.kind = kindSelect.value));

      const curSelect = el("select", { class: "select" });
      for (const code of M.CURRENCY_CODES) {
        curSelect.append(
          el("option", {
            value: code,
            selected: draft.currency === code,
            text: code + " · " + M.currencyOf(code).name[getLang()],
          })
        );
      }
      curSelect.addEventListener("change", () => {
        draft.currency = curSelect.value;
        rebuild();
      });

      const openingInput = el("input", {
        class: "input num",
        type: "text",
        inputmode: "decimal",
        style: { textAlign: "right" },
        value: draft.opening,
        placeholder: "0",
      });
      groupsDigits(openingInput, (text) => (draft.opening = text));

      const colours = el("div", { class: "colours" });
      for (const name of M.COLORS) {
        colours.append(
          el("button", {
            class: "colour",
            type: "button",
            "aria-label": name,
            "aria-pressed": String(draft.color === name),
            style: { background: colorVar(name) },
            onClick: () => {
              draft.color = name;
              rebuild();
            },
          })
        );
      }

      const errorNode = el("p", { class: "error hidden", hidden: true });

      // add(), not body.append(): the archive row is null on a new one, and
      // native append stringifies that into the word "null" on the sheet.
      add(body, [
        el("div", { class: "field" }, el("span", { class: "field-label", text: t("acc.name") }), nameInput),
        el(
          "div",
          { class: "row-2" },
          el("div", { class: "field" }, el("span", { class: "field-label", text: t("acc.kind") }), kindSelect),
          el("div", { class: "field" }, el("span", { class: "field-label", text: t("acc.currency") }), curSelect)
        ),
        el(
          "div",
          { class: "field" },
          el("span", { class: "field-label", text: t("acc.opening") + " · " + draft.currency }),
          openingInput,
          el("p", { class: "help", text: t("acc.openingHelp") })
        ),
        el("div", { class: "field" }, el("span", { class: "field-label", text: t("acc.colour") }), colours),
        existing
          ? el(
              "label",
              { class: "inline", style: { marginTop: "8px" } },
              el("input", {
                type: "checkbox",
                checked: draft.archived,
                onChange: (e) => (draft.archived = e.target.checked),
              }),
              el(
                "span",
                null,
                el("span", { style: { fontSize: "14px" }, text: t("acc.archive") }),
                el("p", { class: "help", style: { margin: "2px 0 0" }, text: t("acc.archivedHelp") })
              )
            )
          : null,
        errorNode
      ]);

      const foot = el("div", { class: "sheet-foot" });
      if (existing) {
        foot.append(
          el(
            "button",
            {
              class: "btn btn-danger",
              type: "button",
              style: { flex: "0 0 auto" },
              "aria-label": t("acc.delete"),
              onClick: async () => {
                const n = state.data.transactions.filter(
                  (x) => x.account_id === existing.id || x.to_account_id === existing.id
                ).length;
                const ok = await confirmSheet({
                  title: t("acc.deleteConfirm", { name: existing.name }),
                  body: t("acc.deleteBody", { n }),
                  confirmLabel: t("delete"),
                  danger: true,
                });
                if (!ok) return;
                const removed = state.ledger.remove("accounts", existing.id);
                close();
                if (removed) {
                  toast(t("tx.deleted"), {
                    action: t("tx.undo"),
                    onAction: () => state.ledger.restore("accounts", removed),
                  });
                }
              },
            },
            icon("trash")
          )
        );
      }
      foot.append(
        el("button", {
          class: "btn btn-primary",
          type: "button",
          text: t("save"),
          onClick: async () => {
            const name = draft.name.trim();
            if (!name) {
              errorNode.textContent = t("acc.name");
              show(errorNode, true);
              nameInput.focus();
              return;
            }
            const clash = state.data.accounts.find(
              (a) => a.id !== draft.id && a.name.toLowerCase() === name.toLowerCase()
            );
            if (clash) {
              errorNode.textContent = t("err.nameTaken");
              show(errorNode, true);
              return;
            }
            const opening = M.parseAmountToMinor(draft.opening || "0", draft.currency);
            if (opening === null) {
              errorNode.textContent = t("tx.calcBad");
              show(errorNode, true);
              return;
            }
            // A starting balance can be negative — that is what a credit
            // card is — so take the sign from what was typed.
            const signed = /^\s*[-−]/.test(draft.opening || "") ? -opening : opening;

            // Changing the currency of an account that already holds money
            // does not convert anything: a balance adds minor units on the
            // promise that a transaction is always in its account's
            // currency, so ₩500,000 relabelled as rupiah becomes Rp500,000
            // and the rows underneath still say ₩. Sometimes that is exactly
            // what someone wants — they filed a month under the wrong flag —
            // so it is a question rather than a refusal, asked with the two
            // numbers in it.
            if (existing && existing.currency !== draft.currency) {
              const filed = state.data.transactions.filter(
                (x) => x.account_id === existing.id || x.to_account_id === existing.id
              ).length;
              if (filed > 0) {
                const bal = M.accountBalances(state.data.accounts, state.data.transactions).get(existing.id) || 0;
                const ok = await confirmSheet({
                  title: t("acc.currencyConfirm", { to: draft.currency }),
                  body: t("acc.currencyBody", {
                    from: existing.currency,
                    to: draft.currency,
                    was: fmt(bal, existing.currency),
                    now: fmt(bal, draft.currency),
                  }),
                  confirmLabel: t("acc.currencyKeep"),
                  danger: true,
                });
                if (!ok) return;
              }
            }

            state.ledger.put("accounts", {
              id: draft.id,
              name,
              kind: draft.kind,
              currency: draft.currency,
              opening_minor: signed,
              color: draft.color,
              archived: Boolean(draft.archived),
              position: draft.position,
              created_at: draft.created_at || new Date().toISOString(),
              deleted_at: null,
            });
            close();
          },
        })
      );

      inner.append(sheetHead(existing ? t("acc.edit") : t("acc.new"), close), body, foot);
    }
  }

  sheet = openSheet(content);
}

function openCategory(existing, kind) {
  const draft = existing
    ? { ...existing }
    : {
        id: M.uuid(),
        name: "",
        kind: kind || "expense",
        icon: "•",
        color: "gray",
        archived: false,
        position: state.data.categories.length,
        deleted_at: null,
      };

  let sheet = null;
  const rebuild = () => sheet && sheet.rebuild();

  function content(inner, close) {
    {
      const body = el("div", { class: "sheet-body" });
      const nameInput = el("input", {
        class: "input",
        type: "text",
        maxlength: "60",
        value: draft.name,
        placeholder: t("cat.namePlaceholder"),
        "data-autofocus": "",
      });
      nameInput.addEventListener("input", () => (draft.name = nameInput.value));

      const iconInput = el("input", {
        class: "input",
        type: "text",
        maxlength: "8",
        value: draft.icon,
        style: { textAlign: "center", fontSize: "22px" },
      });
      iconInput.addEventListener("input", () => (draft.icon = iconInput.value));

      const sides = el("div", { class: "seg" });
      for (const k of ["expense", "income"]) {
        sides.append(
          el("button", {
            type: "button",
            text: t("cat." + k),
            "aria-pressed": String(draft.kind === k),
            onClick: () => {
              draft.kind = k;
              rebuild();
            },
          })
        );
      }

      const colours = el("div", { class: "colours" });
      for (const name of M.COLORS) {
        colours.append(
          el("button", {
            class: "colour",
            type: "button",
            "aria-label": name,
            "aria-pressed": String(draft.color === name),
            style: { background: colorVar(name) },
            onClick: () => {
              draft.color = name;
              rebuild();
            },
          })
        );
      }

      const errorNode = el("p", { class: "error hidden", hidden: true });

      // add(), not body.append(): the archive row is null on a new one, and
      // native append stringifies that into the word "null" on the sheet.
      add(body, [
        el(
          "div",
          { class: "row-2", style: { gridTemplateColumns: "72px 1fr" } },
          el("div", { class: "field" }, el("span", { class: "field-label", text: t("cat.icon") }), iconInput),
          el("div", { class: "field" }, el("span", { class: "field-label", text: t("cat.name") }), nameInput)
        ),
        el("p", { class: "help", style: { marginTop: "-8px" }, text: t("cat.iconHelp") }),
        el("div", { class: "field", style: { marginTop: "14px" } }, el("span", { class: "field-label", text: t("cat.side") }), sides),
        el("div", { class: "field" }, el("span", { class: "field-label", text: t("cat.colour") }), colours),
        existing
          ? el(
              "label",
              { class: "inline" },
              el("input", {
                type: "checkbox",
                checked: draft.archived,
                onChange: (e) => (draft.archived = e.target.checked),
              }),
              el(
                "span",
                null,
                el("span", { style: { fontSize: "14px" }, text: t("cat.archive") }),
                el("p", { class: "help", style: { margin: "2px 0 0" }, text: t("cat.archivedHelp") })
              )
            )
          : null,
        errorNode
      ]);

      const foot = el("div", { class: "sheet-foot" });
      if (existing) {
        foot.append(
          el(
            "button",
            {
              class: "btn btn-danger",
              type: "button",
              style: { flex: "0 0 auto" },
              "aria-label": t("cat.delete"),
              onClick: async () => {
                const n = state.data.transactions.filter((x) => x.category_id === existing.id).length;
                const ok = await confirmSheet({
                  title: t("cat.deleteConfirm", { name: existing.name }),
                  body: t("cat.deleteBody", { n }),
                  confirmLabel: t("delete"),
                  danger: true,
                });
                if (!ok) return;
                const removed = state.ledger.remove("categories", existing.id);
                close();
                if (removed) {
                  toast(t("tx.deleted"), {
                    action: t("tx.undo"),
                    onAction: () => state.ledger.restore("categories", removed),
                  });
                }
              },
            },
            icon("trash")
          )
        );
      }
      foot.append(
        el("button", {
          class: "btn btn-primary",
          type: "button",
          text: t("save"),
          onClick: () => {
            const name = draft.name.trim();
            if (!name) {
              errorNode.textContent = t("cat.name");
              show(errorNode, true);
              nameInput.focus();
              return;
            }
            const clash = state.data.categories.find(
              (x) =>
                x.id !== draft.id &&
                x.kind === draft.kind &&
                x.name.toLowerCase() === name.toLowerCase()
            );
            if (clash) {
              errorNode.textContent = t("err.nameTaken");
              show(errorNode, true);
              return;
            }
            state.ledger.put("categories", {
              id: draft.id,
              name,
              kind: draft.kind,
              icon: (draft.icon || "•").trim().slice(0, 8) || "•",
              color: draft.color,
              archived: Boolean(draft.archived),
              position: draft.position,
              created_at: draft.created_at || new Date().toISOString(),
              deleted_at: null,
            });
            close();
          },
        })
      );

      inner.append(sheetHead(existing ? t("cat.edit") : t("cat.new"), close), body, foot);
    }
  }

  sheet = openSheet(content);
}

function openManageCategories(startKind) {
  let side = startKind || "expense";
  let showArchived = false;
  let sheet = null;
  const build = () => sheet && sheet.rebuild();

  function content(inner, close) {
    {
      const body = el("div", { class: "sheet-body" });

      const sides = el("div", { class: "seg", style: { marginBottom: "14px" } });
      for (const k of ["expense", "income"]) {
        sides.append(
          el("button", {
            type: "button",
            text: t("cat." + k),
            "aria-pressed": String(side === k),
            onClick: () => {
              side = k;
              build();
            },
          })
        );
      }
      body.append(sides);

      const list = categoriesOf(side, showArchived);
      if (!list.length) {
        body.append(el("p", { class: "help", text: t("cat.empty") }));
      }
      list.forEach((cat, i) => {
        body.append(
          el(
            "div",
            { class: "manage-row" + (cat.archived ? " is-archived" : "") },
            el("span", { class: "chip-icon", style: { background: colorSoft(cat.color), width: "30px", height: "30px", fontSize: "15px" }, text: cat.icon }),
            el("span", { class: "manage-name", text: cat.name }),
            cat.archived ? el("span", { class: "tag", text: t("cat.archived") }) : null,
            el(
              "button",
              {
                class: "icon-btn",
                type: "button",
                "aria-label": t("cat.moveUp"),
                disabled: i === 0,
                onClick: () => reorder(list, i, -1),
              },
              icon("up")
            ),
            el(
              "button",
              {
                class: "icon-btn",
                type: "button",
                "aria-label": t("cat.moveDown"),
                disabled: i === list.length - 1,
                onClick: () => reorder(list, i, 1),
              },
              icon("down")
            ),
            el(
              "button",
              { class: "icon-btn", type: "button", "aria-label": t("cat.edit"), onClick: () => openCategory(cat) },
              icon("edit")
            )
          )
        );
      });

      const hasArchived = categoriesOf(side, true).some((x) => x.archived);
      inner.append(
        sheetHead(t("cat.manage"), close),
        body,
        el(
          "div",
          { class: "sheet-foot" },
          hasArchived
            ? el("button", {
                class: "btn btn-ghost",
                type: "button",
                text: showArchived ? t("close") : t("cat.archived"),
                onClick: () => {
                  showArchived = !showArchived;
                  build();
                },
              })
            : null,
          el(
            "button",
            { class: "btn btn-primary", type: "button", onClick: () => openCategory(null, side) },
            icon("plus"),
            t("cat.add")
          )
        )
      );
    }
  }

  /** Swap two neighbours, then renumber the whole side so positions stay
   *  dense — a list that has been dragged about for a year otherwise ends
   *  up with every item at position 0. */
  function reorder(list, index, delta) {
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved);
    reordered.forEach((cat, i) => {
      if (cat.position !== i) state.ledger.put("categories", { ...cat, position: i });
    });
    build();
  }

  // live: this is a list of what exists, and a category added from the
  // editor on top of it — or on another device — has to appear here.
  sheet = openSheet(content, { live: true });
}

// ============================================================
//  Budgets
// ============================================================

function openBudgets() {
  openSheet((inner, close) => {
    const c = ctx();
    const body = el("div", { class: "sheet-body" });
    const inputs = new Map();

    const budgetFor = (categoryId) =>
      state.data.budgets.find((b) => (b.category_id || null) === (categoryId || null)) || null;

    const amountRow = (label, categoryId, iconText) => {
      const existing = budgetFor(categoryId);
      const input = el("input", {
        class: "input num",
        type: "text",
        inputmode: "decimal",
        style: { textAlign: "right" },
        placeholder: t("bud.none"),
        value: existing ? M.minorToInput(existing.amount_minor, existing.currency) : "",
      });
      groupsDigits(input);
      inputs.set(categoryId || "", { input, existing });
      return el(
        "div",
        { class: "rate-row" },
        el("span", { class: "rate-code", style: { minWidth: "auto", display: "flex", gap: "6px", alignItems: "center" } },
          iconText ? el("span", { text: iconText }) : null,
          el("span", { text: label })),
        input,
        el("span", { class: "help", style: { margin: 0 }, text: c.main_currency })
      );
    };

    body.append(
      el("p", { class: "help", style: { marginTop: 0 }, text: t("bud.help") }),
      el("div", { class: "field-label", style: { marginTop: "14px" }, text: t("bud.total") }),
      amountRow(t("ins.budgetTotal"), null, "∑"),
      el("div", { class: "field-label", style: { marginTop: "18px" }, text: t("bud.perCategory") })
    );

    for (const cat of categoriesOf("expense")) {
      body.append(amountRow(cat.name, cat.id, cat.icon));
    }

    const save = () => {
      for (const [key, { input, existing }] of inputs) {
        const categoryId = key || null;
        const raw = input.value.trim();
        if (!raw) {
          if (existing) state.ledger.remove("budgets", existing.id);
          continue;
        }
        const minor = M.parseAmountToMinor(raw, c.main_currency);
        if (minor === null || minor <= 0) {
          if (existing) state.ledger.remove("budgets", existing.id);
          continue;
        }
        state.ledger.put("budgets", {
          id: existing ? existing.id : M.uuid(),
          category_id: categoryId,
          amount_minor: minor,
          currency: c.main_currency,
          created_at: existing?.created_at || new Date().toISOString(),
          deleted_at: null,
        });
      }
      close();
    };

    inner.append(
      sheetHead(t("bud.title"), close),
      body,
      el(
        "div",
        { class: "sheet-foot" },
        el("button", { class: "btn btn-ghost", type: "button", text: t("cancel"), onClick: close }),
        el("button", { class: "btn btn-primary", type: "button", text: t("save"), onClick: save })
      )
    );
  });
}

// ============================================================
//  Exchange rates
// ============================================================

function openRateEditor(code, onSaved) {
  openSheet((inner, close) => {
    const c = ctx();
    const current = c.rates[code];
    const input = el("input", {
      class: "input num",
      type: "text",
      inputmode: "decimal",
      style: { textAlign: "right" },
      value: current ? String(current) : "",
      placeholder: "0.0",
      "data-autofocus": "",
    });
    const errorNode = el("p", { class: "error hidden", hidden: true });

    inner.append(
      sheetHead(t("set.rateFor", { code }) + " " + c.main_currency, close),
      el(
        "div",
        { class: "sheet-body" },
        el("div", { class: "rate-row" }, el("span", { class: "rate-code", text: "1 " + code + " =" }), input, el("span", { class: "help", style: { margin: 0 }, text: c.main_currency })),
        el("p", { class: "help", text: t("set.ratesHelp", { main: c.main_currency }) }),
        errorNode
      ),
      el(
        "div",
        { class: "sheet-foot" },
        el("button", { class: "btn btn-ghost", type: "button", text: t("cancel"), onClick: close }),
        el("button", {
          class: "btn btn-primary",
          type: "button",
          text: t("save"),
          onClick: async () => {
            const v = M.evalExpression(input.value);
            if (v === null || !(v > 0)) {
              errorNode.textContent = t("err.rateBad");
              show(errorNode, true);
              return;
            }
            await setSetting({ rates: { ...c.rates, [code]: v } });
            if (onSaved) onSaved(v);
            close();
            renderAll();
          },
        })
      )
    );
  });
}

function openRates() {
  let sheet = null;
  const build = () => sheet && sheet.rebuild();
  // Currencies added in this sheet but not yet given a rate. They live here
  // rather than in settings because a rate of 1 is not a blank — it is the
  // claim that one rupiah is one won, used in every total until someone
  // corrects it, and left in the box for them to delete first.
  const pending = new Set();
  const typed = new Map();

  function content(inner, close) {
    {
      const c = ctx();
      const body = el("div", { class: "sheet-body" });
      body.append(el("p", { class: "help", style: { marginTop: 0 }, text: t("set.ratesHelp", { main: c.main_currency }) }));

      // Every currency actually in use, plus any already given a rate.
      const inUse = new Set(state.data.accounts.filter((a) => !a.deleted_at).map((a) => a.currency));
      for (const code of Object.keys(c.rates)) inUse.add(code);
      for (const code of pending) inUse.add(code);
      inUse.delete(c.main_currency);
      const codes = [...inUse].sort();

      if (!codes.length) {
        body.append(el("p", { class: "help", text: t("ins.empty") }));
      }

      const edits = new Map();
      for (const code of codes) {
        const input = el("input", {
          class: "input num",
          type: "text",
          inputmode: "decimal",
          // What is on screen survives a rebuild — adding a second currency
          // must not wipe the rate just typed for the first.
          value: typed.has(code) ? typed.get(code) : c.rates[code] != null ? String(c.rates[code]) : "",
          placeholder: t("set.rateUnset"),
        });
        input.addEventListener("input", () => typed.set(code, input.value));
        edits.set(code, input);
        body.append(
          el(
            "div",
            { class: "rate-row" },
            el("span", { class: "rate-code", text: "1 " + code + " =" }),
            input,
            el("span", { class: "help", style: { margin: 0 }, text: c.main_currency })
          )
        );
      }

      const addSelect = el("select", { class: "select" });
      addSelect.append(el("option", { value: "", text: t("set.rateAdd") }));
      for (const code of M.CURRENCY_CODES) {
        if (code === c.main_currency || inUse.has(code)) continue;
        addSelect.append(el("option", { value: code, text: code + " · " + M.currencyOf(code).name[getLang()] }));
      }
      addSelect.addEventListener("change", () => {
        if (!addSelect.value) return;
        // A row to type into, and nothing written down yet. Save is what
        // decides whether this currency ends up with a rate at all.
        pending.add(addSelect.value);
        typed.set(addSelect.value, "");
        build();
      });
      body.append(el("div", { class: "field", style: { marginTop: "16px" } }, addSelect));

      inner.append(
        sheetHead(t("set.rates"), close),
        body,
        el(
          "div",
          { class: "sheet-foot" },
          el("button", { class: "btn btn-ghost", type: "button", text: t("cancel"), onClick: close }),
          el("button", {
            class: "btn btn-primary",
            type: "button",
            text: t("save"),
            onClick: async () => {
              const rates = { ...c.rates };
              for (const [code, input] of edits) {
                const raw = input.value.trim();
                if (!raw) {
                  delete rates[code];
                  continue;
                }
                const v = M.evalExpression(raw);
                if (v !== null && v > 0) rates[code] = v;
              }
              await setSetting({ rates });
              close();
              renderAll();
            },
          })
        )
      );
    }
  }

  sheet = openSheet(content);
}

// ============================================================
//  Settings
// ============================================================

/**
 * "Start over" — the account back to its first day.
 *
 * Counted, not hand-waved: someone about to lose four years of entries and
 * someone about to lose an afternoon's are owed different amounts of pause,
 * and the only honest way to give it is to say the number out loud.
 */
function resetRow(closeSettings) {
  return el(
    "button",
    {
      class: "picker danger",
      type: "button",
      onClick: async () => {
        const live = (list) => list.filter((x) => !x.deleted_at).length;
        const ok = await confirmSheet({
          title: t("reset.confirm"),
          body: t(state.local ? "reset.bodyLocal" : "reset.body", {
            tx: live(state.data.transactions),
            acc: live(state.data.accounts),
            cat: live(state.data.categories),
            bud: live(state.data.budgets),
          }),
          confirmLabel: t("reset.confirmLabel"),
          danger: true,
        });
        if (!ok) return;
        try {
          if (state.local) {
            // A device-only ledger has nowhere to propagate a tombstone to,
            // and keeping thousands of them in the cache for no reader is
            // just clutter. Throw the cache away and let it seed itself,
            // which is the same first day by a shorter road.
            closeSettings();
            state.ledger.close();
            state.ledger = null;
            S.forgetDevice(S.LOCAL_UID);
            // Before attaching, not after: opening the ledger renders, and
            // rendering the Accounts tab of a ledger that is mid-rebuild is
            // a flicker nobody asked to see.
            state.view = "log";
            attachLedger({ uid: S.LOCAL_UID, local: true });
            toast(t("reset.done"));
            return;
          }
          await state.ledger.resetAll();
          closeSettings();
          // Back to this month: the entry that put us in March is gone, and
          // an empty March would read as though the reset had missed.
          state.anchor = M.todayKey();
          state.view = "log";
          renderAll();
          toast(t("reset.done"));
        } catch (e) {
          console.error("Reset failed:", e);
          // The writes are in the outbox and will go up when they can, so
          // this is "not finished", not "not done".
          toast(t("reset.failed"), { danger: true });
        }
      },
    },
    icon("trash"),
    el(
      "span",
      { class: "picker-value stacked" },
      t("reset.title"),
      el("span", { class: "help", style: { margin: 0 }, text: t("reset.help") })
    )
  );
}

function openSettings() {
  let sheet = null;
  const build = () => sheet && sheet.rebuild();

  function content(inner, close) {
    {
      const c = ctx();
      const s = state.data.settings;
      const body = el("div", { class: "sheet-body" });

      const section = (title) =>
        el("h3", {
          style: {
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--faint)",
            margin: "20px 0 8px",
          },
          text: title,
        });

      const rowLink = (label, sublabel, iconName, onClick) =>
        el(
          "button",
          { class: "picker", type: "button", style: { marginBottom: "8px" }, onClick },
          icon(iconName),
          el(
            "span",
            { class: "picker-value" + (sublabel ? " stacked" : "") },
            label,
            sublabel ? el("span", { class: "help", style: { margin: 0 }, text: sublabel }) : null
          ),
          icon("chevron")
        );

      // --- appearance ---
      const themeSeg = el("div", { class: "seg" });
      for (const value of ["dark", "light"]) {
        themeSeg.append(
          el("button", {
            type: "button",
            text: t("set.theme." + value),
            "aria-pressed": String(s.theme === value),
            onClick: async () => {
              await setSetting({ theme: value });
              build();
            },
          })
        );
      }
      const langSeg = el("div", { class: "seg" });
      for (const value of ["en", "ko"]) {
        langSeg.append(
          el("button", {
            type: "button",
            text: value === "en" ? "English" : "한국어",
            "aria-pressed": String(s.lang === value),
            onClick: async () => {
              await setSetting({ lang: value });
              build();
            },
          })
        );
      }

      body.append(
        section(t("set.appearance")),
        el("div", { class: "field" }, el("span", { class: "field-label", text: t("set.theme") }), themeSeg),
        el("div", { class: "field" }, el("span", { class: "field-label", text: t("set.language") }), langSeg)
      );

      // --- money ---
      const mainSelect = el("select", { class: "select", id: "setMainCurrency" });
      for (const code of M.CURRENCY_CODES) {
        mainSelect.append(
          el("option", {
            value: code,
            selected: s.main_currency === code,
            text: code + " · " + M.currencyOf(code).name[getLang()],
          })
        );
      }
      mainSelect.addEventListener("change", async () => {
        // The starting accounts follow the main currency while the ledger is
        // still empty. That is what someone outside Korea wants, but it is
        // done on their behalf, so say it happened rather than let them find
        // out later.
        const stamp = () => state.data.accounts.map((a) => a.id + a.currency).join();
        const before = stamp();
        await setSetting({ main_currency: mainSelect.value });
        if (stamp() !== before) toast(t("set.accountsFollowed", { code: mainSelect.value }));
        build();
        renderAll();
      });

      const monthSelect = el("select", { class: "select" });
      for (let d = 1; d <= 28; d++) {
        monthSelect.append(el("option", { value: String(d), selected: s.month_start === d, text: String(d) }));
      }
      monthSelect.addEventListener("change", async () => {
        await setSetting({ month_start: Number(monthSelect.value) });
        build();
        renderAll();
      });

      body.append(
        section(t("set.money")),
        el(
          "div",
          { class: "field" },
          el("span", { class: "field-label", text: t("set.mainCurrency") }),
          mainSelect,
          el("p", { class: "help", text: t("set.mainCurrencyHelp") })
        ),
        rowLink(t("set.rates"), Object.keys(s.rates).join(", ") || t("none"), "chart", () => {
          close();
          openRates();
        }),
        el(
          "div",
          { class: "field" },
          el("span", { class: "field-label", text: t("set.monthStart") }),
          monthSelect,
          el("p", { class: "help", text: t("set.monthStartHelp") })
        )
      );

      // --- data ---
      // add(), not body.append(): the reset row is null on a device-only
      // ledger, and native append would write the word "null" here.
      add(body, [
        section(t("set.data")),
        rowLink(t("set.categories"), null, "list", () => {
          close();
          openManageCategories("expense");
        }),
        rowLink(t("set.accounts"), null, "wallet", () => {
          close();
          state.view = "accounts";
          renderAll();
        }),
        rowLink(t("bud.title"), null, "chart", () => {
          close();
          openBudgets();
        }),
        el(
          "button",
          {
            class: "picker",
            type: "button",
            style: { marginBottom: "8px" },
            onClick: exportCsv,
          },
          icon("download"),
          el(
            "span",
            { class: "picker-value stacked" },
            t("set.export"),
            el("span", { class: "help", style: { margin: 0 }, text: t("set.exportHelp") })
          )
        ),
        resetRow(close),
      ]);

      // --- account ---
      const email = state.session?.user?.email;
      // add(), not body.append(): a conditional child that comes out null
      // is skipped here and stringified to the word "null" there.
      add(body, [
        section(state.local ? t("local.title") : t("set.account")),
        state.local
          ? el("p", { class: "help", style: { marginTop: 0 }, text: t("local.help") })
          : email
            ? el("p", { class: "help", style: { marginTop: 0 }, text: t("set.signedInAs", { email }) })
            : null,
        state.local && isConfigured
          ? el(
              "button",
              {
                class: "btn btn-primary btn-block",
                type: "button",
                style: { marginTop: "10px" },
                onClick: () => {
                  close();
                  leaveLocal();
                },
              },
              t("local.signIn")
            )
          : null,
        state.local && isConfigured
          ? el("p", {
              class: "help",
              style: { textAlign: "center", marginTop: "8px" },
              text: t("local.signInHelp"),
            })
          : null,
        // No erase button here any more. "Start over" in Data does exactly
        // this for a device-only ledger, and two buttons that wipe the same
        // ledger — in different sections, under different names — is a
        // question about which one is worse, asked of someone who is
        // already nervous.
        state.local
          ? null
          : el(
              "button",
              {
                class: "btn btn-ghost btn-block",
                type: "button",
                style: { marginTop: "10px" },
                onClick: async () => {
                  const ok = await confirmSheet({
                    title: t("signout.confirm"),
                    body: t("signout.body"),
                    confirmLabel: t("signout"),
                  });
                  if (!ok) return;
                  const uid = state.session?.user?.id;
                  close();
                  if (uid) S.forgetDevice(uid);
                  await S.signOut();
                },
              },
              icon("signout"),
              t("signout")
            ),
        el("p", {
          class: "help",
          style: { textAlign: "center", marginTop: "18px" },
          text: "Tally · " + t("set.version", { v: appVersion() }),
        }),
      ]);

      inner.append(sheetHead(t("set.title"), close), body);
    }
  }

  sheet = openSheet(content);
}

function appVersion() {
  return document.querySelector('meta[name="app-version"]')?.content || "1";
}

function exportCsv() {
  const csv = M.toCsv(state.data.transactions, {
    accounts: state.data.accounts,
    categories: state.data.categories,
    ctx: ctx(),
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = el("a", {
    href: url,
    download: "tally-" + M.todayKey() + ".csv",
    style: { display: "none" },
  });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

// ============================================================
//  Service worker and version checks
// ============================================================

let swRegistration = null;
let reloading = false;
const RELOADED_FOR = "tally.reloadedFor";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker
    // The worker script itself must never come from the browser's HTTP
    // cache. GitHub Pages sends max-age=600 on everything, and a worker
    // that checks for its own replacement by reading a ten-minute-old copy
    // of itself will not find one.
    .register("./sw.js", { updateViaCache: "none" })
    .then((reg) => {
      swRegistration = reg;
      reg.update().catch(() => {});
    })
    .catch((e) => console.warn("SW:", e));

  // A new worker took over, which only happens when a deploy installed and
  // activated one: the code this page is running is now the old code.
  //
  // Unless there was no worker to replace. On a first visit the page loads
  // uncontrolled and the brand-new worker claims it, which fires this too —
  // and reloading there would make every first visit load twice. So the
  // question is whether there was a controller *before*, captured now.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) applyUpdate();
  });
}

/**
 * Is now a bad moment to reload?
 *
 * An open sheet means someone is part-way through typing something that
 * only exists in the DOM. Everything already saved survives a reload — the
 * ledger is on the device and the outbox with it — so nothing else counts.
 */
function busyEditing() {
  return Boolean(document.querySelector("dialog.sheet[open]"));
}

/**
 * Take the new version.
 *
 * Immediately if nothing is in the way, which is almost always: the app is
 * a list of transactions, and reloading it costs nothing visible. If a
 * sheet is open, ask instead — pulling the floor out from under a half
 * typed amount to save someone four seconds is not an improvement.
 */
function applyUpdate(target) {
  if (reloading) return;

  // A CDN can serve a new version.json from one edge and the old page from
  // another for a minute or two. Reloading again and again while that
  // settles would be a loop nobody can get out of, so a version is only
  // ever reloaded for once; if it is still not here, ask instead.
  let tried = null;
  try {
    tried = sessionStorage.getItem(RELOADED_FOR);
  } catch (e) {
    /* private mode; the guard is a nicety, not a requirement */
  }
  const loop = target != null && tried === String(target);

  if (loop || busyEditing()) {
    toast(t("update.ready"), {
      action: t("update.reload"),
      onAction: () => {
        reloading = true;
        location.reload();
      },
      ms: 20000,
    });
    return;
  }
  reloading = true;
  try {
    if (target != null) sessionStorage.setItem(RELOADED_FOR, String(target));
  } catch (e) {
    /* as above */
  }
  location.reload();
}

/**
 * @param deep also ask the worker to look for a replacement of itself. The
 *   browser only does that on navigation, so a page left open would never
 *   find one — but it fetches sw.js, so it is not for every tick of a timer.
 */
async function checkForUpdate({ deep = false } = {}) {
  if (deep && swRegistration) swRegistration.update().catch(() => {});
  try {
    const res = await fetch("./version.json?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const { version } = await res.json();
    if (version && String(version) !== appVersion()) applyUpdate(version);
  } catch (e) {
    /* offline, or the file is not there yet — neither is worth saying */
  }
}

// ============================================================
//  Go
// ============================================================

boot();
registerServiceWorker();
setTimeout(() => checkForUpdate({ deep: true }), 4000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate({ deep: true });
});
// A tab left open on a desk should not be running last week's code. What it
// asks for is eighteen bytes, and only while the tab is in front of someone.
setInterval(() => {
  if (document.visibilityState === "visible") checkForUpdate();
}, 60000);
