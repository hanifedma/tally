// ============================================================
//  Drive the real app over the DevTools Protocol: seed a device-only
//  ledger, reload, check what the interface actually does, and take the
//  screenshots that go in the README.
//
//  Both jobs on purpose. A screenshot run that asserts nothing quietly
//  starts publishing pictures of a broken app, and a test run that produces
//  no pictures is one nobody looks at. Every number checked below was
//  worked out by hand from the seed, not read off the screen.
//
//      node tools/serve.mjs                    # one terminal
//      chrome --headless=new --remote-debugging-port=9333
//             --user-data-dir=/tmp/tally-shots about:blank
//      node tools/screenshots.mjs docs/screenshots
//
//  It drives device-only mode, so it needs no Supabase project and no
//  account — which is also why it can run anywhere, including on a machine
//  that has never been set up.
// ============================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] || ".";
const PORT = 9333;
// The local server by default. Point it at the deployed site to check that
// what actually shipped behaves the way what is on disk does:
//     TALLY_URL=https://hanifedma.com/tally/ node tools/screenshots.mjs out
const BASE = process.env.TALLY_URL || "http://localhost:8080/";
mkdirSync(OUT, { recursive: true });

// Written into the page's own localStorage, in the exact shape store.js
// writes, so what is photographed afterwards has been through the real
// loadCache path rather than a special one built for pictures.
const SEED = `(async () => {
  // Relative, not absolute: the deployed site lives under /tally/, and a
  // leading slash would look for these at the domain root. No ?v= either —
  // this is a tool, and must not need editing every time the version bumps.
  const M = await import("./money.js");
  const { buildDemoLedger } = await import("./tools/demo-ledger.js");
  const d = await buildDemoLedger(M);
  localStorage.setItem("tally.mode", "local");
  localStorage.setItem("tally.cache.local", JSON.stringify({
    v: 1,
    cursors: {},
    settings: d.settings,
    rows: {
      accounts: d.accounts,
      categories: d.categories,
      transactions: d.transactions,
      budgets: d.budgets,
    },
  }));
  return "seeded " + d.transactions.length + " transactions, " + d.accounts.length + " accounts";
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          const msgId = ++id;
          ws.send(JSON.stringify({ id: msgId, method, params }));
          return new Promise((res, rej) => pending.set(msgId, { res, rej }));
        },
        events,
        close: () => ws.close(),
      });
    ws.onerror = reject;
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) events.push(msg);
    };
  });
}

const created = await fetch(
  "http://127.0.0.1:" + PORT + "/json/new?" + encodeURIComponent(BASE),
  { method: "PUT" }
).then((r) => r.json());
const c = await connect(created.webSocketDebuggerUrl);

await c.send("Page.enable");
await c.send("Runtime.enable");
await c.send("Log.enable");

async function viewport(w, h, scale = 2) {
  await c.send("Emulation.setDeviceMetricsOverride", {
    width: w,
    height: h,
    deviceScaleFactor: scale,
    mobile: w < 700,
  });
}

async function evalIn(expression, awaitPromise = false) {
  const r = await c.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
}

async function shot(name) {
  const s = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = join(OUT, name + ".png");
  writeFileSync(file, Buffer.from(s.data, "base64"));
  return file;
}

const results = [];
const check = (name, cond, detail) => {
  results.push((cond ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
};

// ---------- 1. the setup screen offers a way in ----------
await viewport(390, 844);
await c.send("Page.navigate", { url: BASE });
await sleep(2000);
// A first visit, whatever an earlier run left behind.
await evalIn("localStorage.clear()");
await c.send("Page.reload");
await sleep(2500);

check(
  "setup screen shown before any choice",
  await evalIn('!document.getElementById("setup").hidden')
);
check(
  "setup offers device-only mode",
  await evalIn('!!document.getElementById("setupLocal").textContent.trim()'),
  await evalIn('document.getElementById("setupLocal").textContent')
);
await shot("setup");

// ---------- 2. one click, and the app is usable ----------
await evalIn('document.getElementById("setupLocal").click()');
await sleep(1200);
check("app visible after one click", await evalIn('!document.getElementById("app").hidden'));
check(
  "starter categories were seeded",
  (await evalIn('JSON.parse(localStorage["tally.cache.local"]).rows.categories.length')) === 16,
  String(await evalIn('JSON.parse(localStorage["tally.cache.local"]).rows.categories.length'))
);
check(
  "status says on this device",
  /device|기기/i.test(await evalIn('document.querySelector("#syncStatus span").textContent')),
  await evalIn('document.querySelector("#syncStatus span").textContent')
);
check(
  "no outbox was created",
  (await evalIn('localStorage["tally.outbox.local"] === undefined || localStorage["tally.outbox.local"] === null')) === true
);
// The choice sticks: a second visit must not put the setup screen back.
await c.send("Page.reload");
await sleep(2000);
check(
  "the choice is remembered on the next visit",
  await evalIn('!document.getElementById("app").hidden && document.getElementById("setup").hidden')
);

// ---------- 3. seed a real ledger and reload ----------
console.log(await evalIn(SEED, true));
await c.send("Page.reload");
await sleep(2500);

check("ledger survived a reload", await evalIn('document.querySelectorAll("#viewLog .tx").length >= 5'),
  String(await evalIn('document.querySelectorAll("#viewLog .tx").length')) + " rows");
// Worked out by hand from the seed: ₩3,120,000 of salary; ₩223,100 of won
// expenses plus three rupiah rows at 0.0876 (20,744 + 10,354 + 6,570).
// Transfers — ₩400,000 and ₩250,000 between the user's own accounts —
// appear in neither column, which is the whole point.
const money = (id) => evalIn(`document.getElementById("${id}").textContent`);
check("income is exactly the salary, with no transfer in it", (await money("sumIn")) === "₩3,120,000", await money("sumIn"));
check("expenses convert each rupiah row once", (await money("sumOut")) === "₩260,768", await money("sumOut"));
check("net is income less expenses", (await money("sumNet")) === "+₩2,859,232", await money("sumNet"));
check("rupiah rows show a converted figure", await evalIn('document.querySelectorAll("#viewLog .tx-alt").length > 0'));
check(
  "device-only banner is shown",
  await evalIn('!document.getElementById("banner").hidden && /device|기기/i.test(document.getElementById("banner").textContent)'),
  await evalIn('document.getElementById("banner").textContent')
);
await shot("log-dark");

// ---------- 4. writing works and persists ----------
const before = await evalIn('document.querySelectorAll("#viewLog .tx").length');
await evalIn('document.getElementById("fab").click()');
await sleep(700);
check("editor opens", await evalIn('!!document.querySelector("dialog.sheet[open]")'));
await shot("editor");
await evalIn(`(() => {
  const a = document.querySelector("dialog.sheet[open] .amount-input");
  a.value = "4200+800";
  a.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
await sleep(300);
await evalIn('[...document.querySelectorAll("dialog.sheet[open] .sheet-foot button")].pop().click()');
await sleep(900);
check("sheet closed after save", await evalIn('!document.querySelector("dialog.sheet[open]")'));
check(
  "row added",
  (await evalIn('document.querySelectorAll("#viewLog .tx").length')) === before + 1
);
await sleep(700);
check(
  "the calculator was evaluated, and the row was written to disk",
  await evalIn(
    'JSON.parse(localStorage["tally.cache.local"]).rows.transactions.some(t => t.amount_minor === 5000)'
  )
);
await c.send("Page.reload");
await sleep(2500);
check(
  "still there after a reload",
  (await evalIn('document.querySelectorAll("#viewLog .tx").length')) === before + 1,
  String(await evalIn('document.querySelectorAll("#viewLog .tx").length'))
);

// ---------- 5. every screen ----------
await evalIn('document.getElementById("tabInsights").click()');
await sleep(600);
check("donut drawn", await evalIn('document.querySelectorAll("#viewInsights .donut-seg").length >= 3'));
check("budget bars drawn", await evalIn('document.querySelectorAll("#viewInsights .bar-fill").length >= 2'));
check("trend chart drawn", await evalIn('document.querySelectorAll("#viewInsights .trend-col").length === 6'));
await shot("insights");

await evalIn('document.getElementById("tabAccounts").click()');
await sleep(600);
check("archived account hidden", (await evalIn('document.querySelectorAll("#viewAccounts .acct").length')) === 3);
check(
  "account name and currency are separate lines",
  (await evalIn(
    'getComputedStyle(document.querySelector("#viewAccounts .acct-name")).display'
  )) === "block"
);
await shot("accounts");

// ---------- 6. settings shows where the ledger lives ----------
await evalIn('document.getElementById("btnMenu").click()');
await sleep(700);
check(
  "settings explains device-only mode",
  await evalIn('/device|기기/i.test(document.querySelector("dialog.sheet[open]").textContent)')
);
check(
  "settings offers to erase local data",
  await evalIn('/erase|지우기/i.test(document.querySelector("dialog.sheet[open]").textContent)')
);
await evalIn(
  '(() => { const b = document.querySelector("dialog.sheet[open] .sheet-body"); if (b) b.scrollTop = b.scrollHeight; })()'
);
await sleep(400);
await shot("settings");
await evalIn('document.querySelectorAll("dialog.sheet[open]").forEach(d => d.close())');
await sleep(400);

// ---------- 7. light, Korean, desktop ----------
await evalIn('document.getElementById("tabLog").click()');
await sleep(400);
await evalIn('document.getElementById("btnTheme").click()');
await sleep(800);
check("light theme applied", (await evalIn('document.documentElement.getAttribute("data-theme")')) === "light");
await shot("log-light");
await evalIn('document.getElementById("btnTheme").click()');
await sleep(700);

await evalIn('document.getElementById("btnLang").click()');
await sleep(900);
check("Korean applied", (await evalIn('document.getElementById("tabLog").textContent')) === "내역",
  await evalIn('document.getElementById("tabLog").textContent'));
check(
  "the theme and language choice was saved to the device ledger",
  (await evalIn('JSON.parse(localStorage["tally.cache.local"]).settings.lang')) === "ko"
);
await shot("log-korean");
await evalIn('document.getElementById("btnLang").click()');
await sleep(900);

await viewport(1280, 860, 2);
await sleep(700);
check("desktop layout does not scroll sideways",
  await evalIn("document.documentElement.scrollWidth <= document.documentElement.clientWidth"),
  (await evalIn("document.documentElement.scrollWidth")) + " vs " + (await evalIn("document.documentElement.clientWidth")));
await shot("desktop");

// ---------- console ----------
const problems = c.events
  .filter((e) => e.method === "Log.entryAdded" || e.method === "Runtime.exceptionThrown")
  .map((e) =>
    e.method === "Log.entryAdded"
      ? e.params.entry.level + ": " + e.params.entry.text
      : "EXCEPTION: " +
        (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)
  )
  .filter((s) => !/favicon|sw\.js|ServiceWorker/i.test(s))
  .filter((s) => /error|EXCEPTION/i.test(s));

console.log("\n" + results.join("\n"));
console.log("\nfailures: " + results.filter((r) => r.startsWith("FAIL")).length);
console.log("console errors: " + (problems.length ? "\n  " + problems.join("\n  ") : "none"));

c.close();
await fetch("http://127.0.0.1:" + PORT + "/json/close/" + created.id);
process.exit(0);
