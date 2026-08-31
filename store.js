// ============================================================
//  Tally — storage and sync.
//
//  One ledger, three places it can live at once: Postgres (the truth), this
//  device's cache (what you see the instant the app opens), and an outbox
//  (what you changed while the network was not there).
//
//  The rules that keep those three honest:
//
//    • Every row's id is made on the client. A transaction written in a
//      basement has its final identity from the moment you press Save, so
//      replaying it later can never create a second copy of it.
//
//    • Nothing is deleted, only marked deleted. Every change is therefore
//      an upsert of a whole row, which makes replaying the outbox
//      idempotent and order-independent — and makes realtime deletions
//      actually arrive (see the note in schema.sql).
//
//    • A row from the server wins, unless this device is still holding an
//      unsent change to that same row. That single rule is the whole
//      conflict policy, and it is why an edit made offline is not undone
//      by an echo of the version it replaced.
//
//  Nothing here touches the DOM. app.js renders; this file decides what is
//  true.
// ============================================================

import {
  supabaseUrl,
  supabaseAnonKey,
  googleClientId,
  hasGoogleClientId,
  isConfigured,
} from "./supabase-config.js?v=1";
import {
  normalizeAccount,
  normalizeCategory,
  normalizeTx,
  normalizeBudget,
  normalizeSettings,
  derivedId,
  SEED_CATEGORIES,
  SEED_ACCOUNTS,
  DEFAULT_CURRENCY,
} from "./money.js?v=1";

// Pinned exactly. A CDN that silently moves to a new major version is a
// deploy you did not make, at a time you did not choose.
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
const GIS_SRC = "https://accounts.google.com/gsi/client";

export const TABLES = ["accounts", "categories", "transactions", "budgets"];

const NORMALIZE = {
  accounts: normalizeAccount,
  categories: normalizeCategory,
  transactions: normalizeTx,
  budgets: normalizeBudget,
};

// PostgREST answers at most 1000 rows at a time by default. Ask in pages of
// exactly that and keep going until a short page says we are done.
const PAGE = 1000;

// ------------------------------------------------------------
//  The client
// ------------------------------------------------------------

let sb = null;
let sbPromise = null;

/** Load supabase-js and create the client. Safe to call repeatedly. */
export async function getClient() {
  if (sb) return sb;
  if (!isConfigured) throw new Error("Supabase is not configured");
  if (!sbPromise) {
    sbPromise = (async () => {
      const mod = await import(/* @vite-ignore */ SUPABASE_JS);
      sb = mod.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The in-page Google button is the way in; this only matters for
          // the redirect fallback, which does come back with a code in the
          // URL and does need picking up.
          detectSessionInUrl: true,
          storageKey: "tally.auth",
        },
        realtime: {
          // Postgres changes for one person are a trickle. A low ceiling
          // here is not a limit, it is a promise not to melt a phone if
          // something upstream goes wrong.
          params: { eventsPerSecond: 20 },
        },
        global: {
          headers: { "x-client-info": "tally-web" },
        },
      });
      return sb;
    })();
  }
  return sbPromise;
}

// ------------------------------------------------------------
//  Sign in
// ------------------------------------------------------------

let gisPromise = null;

/** Load Google Identity Services. Resolves false if it cannot be reached. */
export function loadGoogleIdentity() {
  if (!hasGoogleClientId) return Promise.resolve(false);
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve) => {
    if (globalThis.google && globalThis.google.accounts && globalThis.google.accounts.id) {
      resolve(true);
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(Boolean(globalThis.google?.accounts?.id));
    s.onerror = () => resolve(false);
    // A blocked or very slow CDN must not leave the sign-in screen waiting
    // forever with no visible way forward.
    setTimeout(() => resolve(Boolean(globalThis.google?.accounts?.id)), 8000);
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Draw Google's own button into `el` and hand the resulting ID token to
 * Supabase. Returns true if the button was rendered.
 *
 * The token is verified by Supabase's servers — signature, issuer and
 * audience — before any session exists. What crosses this boundary is a
 * proof, not a claim.
 */
export async function renderGoogleButton(el, { theme = "dark", locale = "en", onSignIn, onError }) {
  const ready = await loadGoogleIdentity();
  if (!ready) return false;
  const gid = globalThis.google.accounts.id;
  try {
    gid.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          const client = await getClient();
          const { error } = await client.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
          });
          if (error) throw error;
          if (onSignIn) onSignIn();
        } catch (e) {
          console.error("Sign-in failed:", e);
          if (onError) onError(e);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
    });
    el.innerHTML = "";
    gid.renderButton(el, {
      type: "standard",
      theme: theme === "light" ? "outline" : "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "center",
      locale,
      width: Math.min(360, Math.max(240, el.clientWidth || 320)),
    });
    return true;
  } catch (e) {
    console.error("Couldn't render the Google button:", e);
    return false;
  }
}

/**
 * The fallback: hand the browser to Supabase's OAuth callback and back.
 * Works everywhere the in-page button does not — at the cost of Google
 * naming the project's own domain on the consent screen.
 */
export async function signInWithRedirect() {
  const client = await getClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: location.origin + location.pathname,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = await getClient();
  try {
    // So the next sign-in shows the chooser rather than silently reusing
    // the same account.
    globalThis.google?.accounts?.id?.disableAutoSelect?.();
  } catch (e) {
    /* nothing here is worth failing a sign-out over */
  }
  await client.auth.signOut();
}

/** Calls back with the session (or null) now and on every later change. */
export async function watchAuth(onChange) {
  const client = await getClient();
  const { data } = await client.auth.getSession();
  onChange(data.session || null);
  const { data: sub } = client.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" && session) {
      // Realtime authorises the socket once, at connect time. Without this
      // the socket keeps an expired token and its subscriptions quietly
      // stop passing row level security about an hour in.
      try {
        client.realtime.setAuth(session.access_token);
      } catch (e) {
        console.warn("Couldn't refresh the realtime token:", e);
      }
      return;
    }
    onChange(session || null);
  });
  return () => sub.subscription.unsubscribe();
}

// ------------------------------------------------------------
//  The device's copy
// ------------------------------------------------------------

const CACHE_VERSION = 1;
const cacheKey = (uid) => "tally.cache." + uid;
const outboxKey = (uid) => "tally.outbox." + uid;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("Couldn't read " + key + ":", e);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("Couldn't write " + key + ":", e);
    return false;
  }
}

/** Wipe everything this device kept for a user. Used on sign-out. */
export function forgetDevice(uid) {
  try {
    localStorage.removeItem(cacheKey(uid));
    localStorage.removeItem(outboxKey(uid));
  } catch (e) {
    /* a browser that refuses to forget is not a failure we can fix here */
  }
}

// ------------------------------------------------------------
//  The ledger
// ------------------------------------------------------------

/**
 * Open the ledger for one signed-in person.
 *
 * @param uid        the user id
 * @param onChange   called with a snapshot whenever anything changes
 * @param onStatus   called with { state, pending, error } as sync moves
 * @param onError    called with (error, messageKey) for things worth saying
 */
export function openLedger({ uid, onChange, onStatus, onError }) {
  const rows = {
    accounts: new Map(),
    categories: new Map(),
    transactions: new Map(),
    budgets: new Map(),
  };
  let settings = normalizeSettings(null);
  let haveSettings = false;
  let cursors = {};
  /** key "table|id" → the row waiting to be sent. */
  const outbox = new Map();

  let channel = null;
  let closed = false;
  let status = "syncing";
  let flushing = false;
  let flushAgain = false;
  let retryTimer = null;
  let retryDelay = 2000;

  // ---------- cache ----------

  function loadCache() {
    const cached = readJson(cacheKey(uid), null);
    if (!cached || cached.v !== CACHE_VERSION) return false;
    cursors = cached.cursors || {};
    for (const table of TABLES) {
      const list = Array.isArray(cached.rows?.[table]) ? cached.rows[table] : [];
      const norm = NORMALIZE[table];
      for (const raw of list) {
        const row = norm(raw);
        if (row.id) rows[table].set(row.id, row);
      }
    }
    if (cached.settings) {
      settings = normalizeSettings(cached.settings);
      haveSettings = true;
    }
    const box = readJson(outboxKey(uid), null);
    if (box && Array.isArray(box.ops)) {
      for (const op of box.ops) {
        if (op && op.table && op.row) outbox.set(op.table + "|" + rowKey(op.table, op.row), op.row);
      }
    }
    return rows.transactions.size > 0 || rows.accounts.size > 0 || haveSettings;
  }

  let saveTimer = null;
  function saveCacheSoon() {
    if (saveTimer) return;
    // Serialising a year of transactions is not free; do it once per burst
    // of changes rather than once per change.
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveCache();
    }, 400);
  }

  function saveCache() {
    const payload = {
      v: CACHE_VERSION,
      cursors,
      settings: haveSettings ? settings : null,
      rows: {},
    };
    for (const table of TABLES) payload.rows[table] = [...rows[table].values()];
    if (!writeJson(cacheKey(uid), payload)) {
      // Out of room. The cache is an optimisation, not the ledger — drop
      // the oldest transactions from the *cache only* and try once more, so
      // the app still opens instantly on what matters most.
      const txs = [...rows.transactions.values()].sort((a, b) =>
        a.occurred_on < b.occurred_on ? 1 : -1
      );
      payload.rows.transactions = txs.slice(0, 2000);
      // A trimmed cache must not claim to be up to date, or the next delta
      // fetch would skip the rows we just dropped.
      payload.cursors = { ...cursors, transactions: null };
      writeJson(cacheKey(uid), payload);
    }
  }

  function saveOutbox() {
    const ops = [];
    for (const [key, row] of outbox) {
      ops.push({ table: key.slice(0, key.indexOf("|")), row });
    }
    writeJson(outboxKey(uid), { ops });
  }

  const rowKey = (table, row) => (table === "settings" ? uid : row.id);

  // ---------- what the app sees ----------

  function snapshot() {
    const live = (table) => [...rows[table].values()].filter((r) => !r.deleted_at);
    return {
      settings,
      accounts: live("accounts"),
      categories: live("categories"),
      transactions: live("transactions"),
      budgets: live("budgets"),
      pending: outbox.size,
      status,
    };
  }

  let emitTimer = null;
  function emit(immediate = false) {
    if (closed) return;
    if (immediate) {
      if (emitTimer) {
        clearTimeout(emitTimer);
        emitTimer = null;
      }
      onChange(snapshot());
      return;
    }
    // A first sync can deliver four tables in four callbacks; render once.
    if (emitTimer) return;
    emitTimer = setTimeout(() => {
      emitTimer = null;
      if (!closed) onChange(snapshot());
    }, 16);
  }

  function setStatus(next, error) {
    status = next;
    if (onStatus) onStatus({ state: next, pending: outbox.size, error: error || null });
  }

  // ---------- merging ----------

  /**
   * Take a row from the server.
   *
   * Refused only while this device is still holding an unsent change to
   * that same row: that local version is strictly newer than anything the
   * server can be echoing back, because the server has not seen it yet.
   */
  function acceptServerRow(table, raw) {
    if (table === "settings") {
      if (outbox.has("settings|" + uid)) return false;
      settings = normalizeSettings(raw);
      haveSettings = true;
      return true;
    }
    const row = NORMALIZE[table](raw);
    if (!row.id) return false;
    if (outbox.has(table + "|" + row.id)) return false;
    const prev = rows[table].get(row.id);
    // Out-of-order arrival: a realtime event that overtook a fetch must not
    // put back a version we have already moved past.
    if (prev && prev.updated_at && row.updated_at && row.updated_at < prev.updated_at) {
      return false;
    }
    rows[table].set(row.id, row);
    return true;
  }

  function applyLocal(table, row) {
    if (table === "settings") {
      settings = normalizeSettings(row);
      haveSettings = true;
      return;
    }
    const norm = NORMALIZE[table](row);
    rows[table].set(norm.id, norm);
  }

  // ---------- fetching ----------

  async function fetchTable(client, table) {
    const cursor = cursors[table] || null;
    const out = [];
    for (let from = 0; ; from += PAGE) {
      let q = client
        .from(table)
        .select("*")
        .eq("user_id", uid)
        // A stable total order. Ordering by updated_at alone would let two
        // rows written in the same microsecond swap places between pages,
        // which is how a row gets read twice and another not at all.
        .order("updated_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      // A later sync needs tombstones — a deletion is the only way it learns
      // a row is gone. A first sync mostly does not, and skipping a decade of
      // deleted transactions is worth real time on a slow connection. The
      // small tables keep theirs even then: an account whose categories were
      // all deleted on purpose must not look brand new to ensureSeeded.
      if (cursor) q = q.gte("updated_at", cursor);
      else if (table === "transactions") q = q.is("deleted_at", null);

      const { data, error } = await q;
      if (error) throw error;
      out.push(...data);
      if (data.length < PAGE) break;
    }
    return out;
  }

  async function fetchSettings(client) {
    const { data, error } = await client
      .from("settings")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Pull everything that changed since last time. */
  async function sync() {
    if (closed) return;
    const client = await getClient();
    setStatus("syncing");

    let changed = false;
    const settingsRow = await fetchSettings(client);
    if (settingsRow) {
      if (acceptServerRow("settings", settingsRow)) changed = true;
    } else if (!outbox.has("settings|" + uid)) {
      // First run on this account: publish whatever this device was already
      // set to, so the phone and the laptop start from the same place.
      await writeSettings(settings, { silent: true });
      changed = true;
    }

    for (const table of TABLES) {
      const list = await fetchTable(client, table);
      let newest = cursors[table] || null;
      for (const raw of list) {
        if (acceptServerRow(table, raw)) changed = true;
        if (raw.updated_at && (!newest || raw.updated_at > newest)) newest = raw.updated_at;
      }
      cursors[table] = newest;
    }

    await ensureSeeded();

    if (changed) {
      saveCacheSoon();
      emit();
    }
    setStatus(outbox.size ? "syncing" : "live");
    retryDelay = 2000;
  }

  // ---------- realtime ----------

  function subscribe() {
    if (closed || channel) return;
    getClient()
      .then((client) => {
        if (closed || channel) return;
        const ch = client.channel("tally:" + uid);
        const tables = ["settings", ...TABLES];
        for (const table of tables) {
          ch.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              // Row level security already limits this to one person; the
              // filter means the server does not even send the rest.
              filter: "user_id=eq." + uid,
            },
            (payload) => {
              if (closed) return;
              const raw = payload.new && Object.keys(payload.new).length ? payload.new : null;
              if (raw) {
                if (acceptServerRow(table, raw)) {
                  if (table !== "settings" && raw.updated_at) {
                    const cur = cursors[table];
                    if (!cur || raw.updated_at > cur) cursors[table] = raw.updated_at;
                  }
                  saveCacheSoon();
                  emit();
                }
              } else if (payload.eventType === "DELETE" && payload.old && payload.old.id) {
                // A hard delete, done by hand in the dashboard. Tally never
                // makes one, but it must not keep showing a row that is
                // genuinely gone.
                if (table !== "settings" && rows[table].delete(payload.old.id)) {
                  saveCacheSoon();
                  emit();
                }
              }
            }
          );
        }
        ch.subscribe((state) => {
          if (closed) return;
          if (state === "SUBSCRIBED") {
            setStatus(outbox.size ? "syncing" : "live");
            // Anything that happened between the last fetch and the socket
            // coming up is not in either — ask for it.
            sync().catch(reportSyncError);
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            setStatus("offline");
            scheduleRetry();
          }
        });
        channel = ch;
      })
      .catch(reportSyncError);
  }

  function unsubscribe() {
    if (!channel) return;
    const ch = channel;
    channel = null;
    getClient().then((client) => client.removeChannel(ch)).catch(() => {});
  }

  function scheduleRetry() {
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (closed) return;
      unsubscribe();
      subscribe();
      flush();
      sync().catch(reportSyncError);
    }, retryDelay);
    // Back off, but never so far that a reconnection feels like a hang.
    retryDelay = Math.min(retryDelay * 2, 30000);
  }

  function reportSyncError(err) {
    console.error("Sync failed:", err);
    setStatus(navigator.onLine ? "error" : "offline", err);
    scheduleRetry();
  }

  // ---------- writing ----------

  /** True for the kind of failure that is worth trying again later. */
  function isTransient(err) {
    if (!err) return false;
    if (!navigator.onLine) return true;
    // PostgREST reports a rejected row with a code; a dropped connection
    // has none. Retrying a constraint violation forever would jam the
    // outbox behind a row that is never going to be accepted.
    if (err.code && /^(2|4)\d/.test(String(err.code))) return false;
    if (err.status && err.status >= 400 && err.status < 500) return false;
    return true;
  }

  function enqueue(table, row) {
    outbox.set(table + "|" + rowKey(table, row), row);
    saveOutbox();
  }

  async function flush() {
    if (closed || flushing) {
      flushAgain = true;
      return;
    }
    if (outbox.size === 0) {
      setStatus("live");
      return;
    }
    flushing = true;
    flushAgain = false;
    setStatus("syncing");
    try {
      const client = await getClient();
      // Group by table so each table goes up as one request.
      const byTable = new Map();
      for (const [key, row] of outbox) {
        const table = key.slice(0, key.indexOf("|"));
        if (!byTable.has(table)) byTable.set(table, []);
        byTable.get(table).push({ key, row });
      }

      for (const [table, entries] of byTable) {
        // updated_at belongs to the server — it is the delta cursor, and a
        // client that sets it could hide its own writes from other devices.
        // The trigger overrules us anyway; not sending it says so.
        const payload = entries.map((e) => {
          const row = { ...e.row, user_id: uid };
          delete row.updated_at;
          return row;
        });
        const conflict = table === "settings" ? "user_id" : "id";
        const { data, error } = await client
          .from(table)
          .upsert(payload, { onConflict: conflict })
          .select();

        if (error) {
          if (isTransient(error)) throw error;
          // Rejected for good. Drop it rather than jam the queue, say so,
          // and re-sync so the screen shows what is actually stored.
          console.error("Rejected by the server (" + table + "):", error);
          for (const e of entries) outbox.delete(e.key);
          saveOutbox();
          if (onError) onError(error, "err.save");
          continue;
        }

        // Accepted. Clear the hold before taking the canonical rows, so
        // acceptServerRow stops refusing them.
        for (const e of entries) outbox.delete(e.key);
        for (const raw of data || []) {
          acceptServerRow(table, raw);
          if (table !== "settings" && raw.updated_at) {
            const cur = cursors[table];
            if (!cur || raw.updated_at > cur) cursors[table] = raw.updated_at;
          }
        }
      }

      saveOutbox();
      saveCacheSoon();
      emit();
      setStatus(outbox.size ? "syncing" : "live");
      retryDelay = 2000;
    } catch (err) {
      console.warn("Couldn't send changes yet:", err);
      setStatus(navigator.onLine ? "error" : "offline", err);
      scheduleRetry();
    } finally {
      flushing = false;
      if (flushAgain) {
        flushAgain = false;
        flush();
      }
    }
  }

  /**
   * Save a row. It is on screen before this returns and in Postgres
   * shortly after — or, with no network, as soon as there is one.
   */
  function put(table, row) {
    const full = { ...row, user_id: uid };
    applyLocal(table, full);
    enqueue(table, full);
    saveCacheSoon();
    emit(true);
    flush();
    return full;
  }

  /** Mark a row deleted. Reversible: `restore` puts it straight back. */
  function remove(table, id) {
    const prev = rows[table].get(id);
    if (!prev) return null;
    put(table, { ...prev, deleted_at: new Date().toISOString() });
    return prev;
  }

  function restore(table, row) {
    return put(table, { ...row, deleted_at: null });
  }

  async function writeSettings(next, { silent = false } = {}) {
    const merged = normalizeSettings({ ...settings, ...next });
    settings = merged;
    haveSettings = true;
    const row = { ...merged, user_id: uid };
    delete row.updated_at;
    enqueue("settings", row);
    saveCacheSoon();
    if (!silent) emit(true);
    await flush();
    return merged;
  }

  // ---------- first run ----------

  let seeding = false;
  async function ensureSeeded() {
    if (seeding) return;
    // "No rows at all", not "no live rows". Someone who deliberately deleted
    // every category still has the tombstones, and must not have the starter
    // set pushed back at them on the next reconnect.
    const noCategories = rows.categories.size === 0;
    const noAccounts = rows.accounts.size === 0;
    if (!noCategories && !noAccounts) return;
    seeding = true;
    try {
      const lang = settings.lang === "ko" ? "ko" : "en";
      const currency = settings.main_currency || DEFAULT_CURRENCY;

      if (noCategories) {
        let i = 0;
        for (const seed of SEED_CATEGORIES) {
          const id = await derivedId(uid, "category:" + seed.slug);
          applyLocal("categories", {
            id,
            user_id: uid,
            name: seed[lang],
            kind: seed.kind,
            icon: seed.icon,
            color: seed.color,
            archived: false,
            position: i++,
            deleted_at: null,
          });
          enqueue("categories", rows.categories.get(id));
        }
      }
      if (noAccounts) {
        let i = 0;
        for (const seed of SEED_ACCOUNTS) {
          const id = await derivedId(uid, "account:" + seed.slug);
          applyLocal("accounts", {
            id,
            user_id: uid,
            name: seed[lang],
            kind: seed.kind,
            currency,
            opening_minor: 0,
            color: seed.color,
            archived: false,
            position: i++,
            deleted_at: null,
          });
          enqueue("accounts", rows.accounts.get(id));
        }
      }
      saveCacheSoon();
      emit();
      await flush();
    } catch (e) {
      console.error("Couldn't set up the starting categories:", e);
    } finally {
      seeding = false;
    }
  }

  // ---------- lifecycle ----------

  function onOnline() {
    retryDelay = 2000;
    flush();
    sync().catch(reportSyncError);
  }

  function onOffline() {
    setStatus("offline");
  }

  function onVisible() {
    if (document.visibilityState !== "visible" || closed) return;
    // A socket can die without saying so — a laptop lid, a sleeping phone.
    // Coming back to the tab is the moment to find out.
    flush();
    sync().catch(reportSyncError);
  }

  addEventListener("online", onOnline);
  addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);

  const hadCache = loadCache();
  if (hadCache) emit(true);
  setStatus(navigator.onLine ? "syncing" : "offline");

  const ready = (async () => {
    if (!navigator.onLine) {
      setStatus("offline");
      // Still emit, so a plane-mode open shows the cached ledger rather
      // than a spinner.
      emit(true);
      subscribe();
      return;
    }
    try {
      await sync();
    } catch (err) {
      reportSyncError(err);
      emit(true);
    }
    subscribe();
    flush();
  })();

  return {
    ready,
    snapshot,
    put,
    remove,
    restore,
    writeSettings,
    sync: () => sync().catch(reportSyncError),
    flush,
    retry: onOnline,
    close() {
      closed = true;
      removeEventListener("online", onOnline);
      removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimer) clearTimeout(retryTimer);
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveCache();
      }
      unsubscribe();
    },
  };
}
