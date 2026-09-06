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

// A segmented control's selected segment has to read as raised, which means
// lighter than the track it sits in — in *both* themes. It is easy to get
// wrong from tokens alone, because the dark palette's --surface is darker
// than its --surface-2 while the light palette's is lighter.
const SEG = `(() => {
  const on = document.querySelector('.tab[aria-selected="true"]');
  const track = document.querySelector(".tabs-inner");
  return getComputedStyle(on).backgroundColor + " on " + getComputedStyle(track).backgroundColor;
})()`;
const luma = (css) => {
  const [r, g, b] = css.match(/[\d.]+/g).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const segColours = () => evalIn(SEG);
const segLifted = async () => {
  const [on, track] = (await evalIn(SEG)).split(" on ");
  return luma(on) > luma(track);
};

// ---------- 1. the setup screen offers a way in ----------
await viewport(390, 844);
await c.send("Page.navigate", { url: BASE });
await sleep(2000);
// A first visit, whatever an earlier run left behind.
await evalIn("localStorage.clear()");
await c.send("Page.reload");
await sleep(2500);

// Which of the two front doors is showing depends on whether this copy has
// a Supabase project pasted into it: the setup screen explains what is
// missing, the sign-in screen offers Google. Both must offer the same way
// past, and the run has to work either way — the deployed site is
// configured and a fresh checkout is not.
const front = (await evalIn('!document.getElementById("setup").hidden')) ? "setup" : "login";
const localButton = front === "setup" ? "setupLocal" : "loginLocal";
check(
  "a way in is shown before any choice",
  await evalIn(`!document.getElementById("${front}").hidden`),
  front
);
check(
  "it offers device-only mode",
  await evalIn(`!!document.getElementById("${localButton}").textContent.trim()`),
  await evalIn(`document.getElementById("${localButton}").textContent`)
);
if (front === "login") {
  // Google's script is fetched from its own CDN; give it a moment.
  for (let i = 0; i < 12; i++) {
    if (await evalIn('!!document.querySelector("#googleSlot div[role=button]")')) break;
    await sleep(500);
  }
  // In the page on an unregistered origin, in an iframe on a registered one.
  check(
    "and Google's button is drawn",
    await evalIn(
      '!!document.querySelector("#googleSlot div[role=button], #googleSlot iframe")'
    ),
    await evalIn(
      'document.querySelector("#googleSlot iframe") ? "iframe" : "in the page"'
    )
  );
  // Google paints one of the containers around its button white, which on a
  // dark page is a white frame around a black button. How deep that
  // container sits depends on which button it drew — the plain one, or the
  // wider "Continue as …" it uses for an account it recognises — so what is
  // checked here is every ancestor of the button, at any depth, and not a
  // fixed `> div > div`, which was right for one of them and wrong for the
  // other. The button itself and the circle its logo sits in are excluded by
  // construction: neither contains the button.
  check(
    "with nothing painted around it",
    await evalIn(`(() => {
      const bad = [...document.querySelectorAll('#googleSlot div:has([role="button"])')]
        .map(n => getComputedStyle(n).backgroundColor)
        .filter(bg => bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent");
      return bad.length === 0 ? true : bad.join();
    })()`) === true,
    await evalIn(
      `[...document.querySelectorAll('#googleSlot div:has([role="button"])')].map(n => getComputedStyle(n).backgroundColor).join() || "no wrappers"`
    )
  );
  // And it is drawn in the app's language, which only the script's URL can
  // say: renderButton takes a `locale`, and the build Google serves accepts
  // it and ignores it in favour of a guess from the address you connected
  // from. This fails on a machine whose Google guess happens to match the
  // app's language — which is the ordinary case for an English one, so the
  // check is worth more when it is run from somewhere else.
  check(
    "in the language the app is in",
    await evalIn(`[...document.scripts].some(s => s.src.includes("gsi/client?hl="))`),
    await evalIn(
      '[...document.scripts].map(s => s.src).filter(s => s.includes("gsi/client")).join() || "no script"'
    )
  );
}
await shot(front === "login" ? "signin" : "setup");

// ---------- 2. one click, and the app is usable ----------
await evalIn(`document.getElementById("${localButton}").click()`);
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

// ---------- 2b. the empty state, which is day one for everybody ----------
check(
  "the empty state offers a way to start",
  await evalIn('!!document.querySelector("#viewLog .empty .btn")')
);
check(
  "its button icon takes the button's own colour and sits on its centre line",
  await evalIn(`(() => {
    const btn = document.querySelector("#viewLog .empty .btn");
    const svg = btn.querySelector("svg");
    const a = getComputedStyle(svg), b = getComputedStyle(btn);
    return a.color === b.color && a.marginBottom === "0px";
  })()`),
  await evalIn(`(() => {
    const btn = document.querySelector("#viewLog .empty .btn");
    const svg = btn.querySelector("svg");
    return getComputedStyle(svg).color + " on " + getComputedStyle(btn).backgroundColor;
  })()`)
);
await shot("empty");

// ---------- 2c. the starting accounts follow the main currency ----------
// Only while they are still the ones we made and hold nothing. Step 9 checks
// the other half: once there is a ledger, they stop following.
const accountCurrencies = () =>
  evalIn(
    'JSON.parse(localStorage["tally.cache.local"]).rows.accounts.map(a => a.currency).join(",")'
  );
const setMainCurrency = async (code) => {
  await evalIn('document.getElementById("btnMenu").click()');
  await sleep(600);
  await evalIn(`(() => {
    const s = document.getElementById("setMainCurrency");
    s.value = "${code}";
    s.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await sleep(600);
  await evalIn('document.querySelectorAll("dialog.sheet[open]").forEach(d => d.close())');
  await sleep(400);
};

check("starter accounts begin in the default currency", (await accountCurrencies()) === "KRW,KRW",
  await accountCurrencies());
await setMainCurrency("IDR");
check("empty starter accounts follow the main currency", (await accountCurrencies()) === "IDR,IDR",
  await accountCurrencies());
check(
  "and the accounts screen says so",
  await evalIn(
    '(document.getElementById("tabAccounts").click(), true) && [...document.querySelectorAll("#viewAccounts .acct")].every(n => /IDR/.test(n.textContent))'
  )
);
await setMainCurrency("KRW");
check("and follow it back", (await accountCurrencies()) === "KRW,KRW", await accountCurrencies());
await evalIn('document.getElementById("tabLog").click()');
await sleep(300);

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
// The answer to a sum is shown while it is being typed, not only once it
// has been saved — 4200+800 reads back as ₩5,000 before anyone commits to it.
check(
  "a sum shows its running total",
  /5,000/.test(await evalIn('document.querySelector("dialog.sheet[open] .amount-alt").textContent')),
  await evalIn('document.querySelector("dialog.sheet[open] .amount-alt").textContent')
);
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

// ---------- 6b. undo works from inside a sheet ----------
// A sheet is a modal <dialog>: it makes everything outside it inert and
// paints above every z-index. A toast raised from one used to be visible and
// unpressable, which is the worst way for an Undo to fail.
await evalIn(
  '[...document.querySelectorAll("dialog.sheet[open] button")].find(b => /Manage categories|분류 관리/.test(b.textContent)).click()'
);
await sleep(700);
const catCount = () =>
  evalIn('JSON.parse(localStorage["tally.cache.local"]).rows.categories.filter(c => !c.deleted_at).length');
const before6b = await catCount();
await evalIn(`(() => {
  const d = [...document.querySelectorAll("dialog.sheet[open]")].pop();
  d.querySelector(".manage-row button:last-of-type").click();
})()`);
await sleep(600);
await evalIn(`(() => {
  const d = [...document.querySelectorAll("dialog.sheet[open]")].pop();
  [...d.querySelectorAll("button.btn-danger")].pop().click();
})()`);
await sleep(600);
await evalIn(`(() => {
  const d = [...document.querySelectorAll("dialog.sheet[open]")].pop();
  [...d.querySelectorAll("button.btn")].pop().click();
})()`);
await sleep(900);
check("deleting from a sheet works", (await catCount()) === before6b - 1,
  before6b + " → " + (await catCount()));
const undo = await evalIn(`(() => {
  const t = document.querySelector(".toast");
  if (!t) return "no toast";
  const r = t.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return t.contains(hit) ? "reachable" : "covered by " + (hit ? hit.className : "nothing");
})()`);
check("its Undo can actually be pressed, with the sheet still open", undo === "reachable", undo);
await evalIn('document.querySelector(".toast button").click()');
await sleep(700);
check("and it puts the row back", (await catCount()) === before6b, String(await catCount()));

await evalIn('document.querySelectorAll("dialog.sheet[open]").forEach(d => d.close())');
await sleep(400);

// ---------- 7. light, Korean, desktop ----------
await evalIn('document.getElementById("tabLog").click()');
await sleep(400);
check("the selected tab stands on its track, not in it (dark)", await segLifted(),
  await segColours());
await evalIn('document.getElementById("btnTheme").click()');
await sleep(800);
check("light theme applied", (await evalIn('document.documentElement.getAttribute("data-theme")')) === "light");
check("the selected tab stands on its track, not in it (light)", await segLifted(),
  await segColours());

// Korean goes on top of light rather than beside it. Both are the same
// screen, and the README does not need it twice.

// A starter category the app named and nobody renamed. "KB Bank" is not one
// of ours, so it must come through the switch untouched.
const named = (name) =>
  evalIn(
    `JSON.parse(localStorage["tally.cache.local"]).rows.categories.concat(
       JSON.parse(localStorage["tally.cache.local"]).rows.accounts
     ).some(r => r.name === ${JSON.stringify(name)})`
  );
await evalIn('document.getElementById("btnLang").click()');
await sleep(900);
check("Korean applied", (await evalIn('document.getElementById("tabLog").textContent')) === "내역",
  await evalIn('document.getElementById("tabLog").textContent'));
check(
  "the theme and language choice was saved to the device ledger",
  (await evalIn('JSON.parse(localStorage["tally.cache.local"]).settings.lang')) === "ko"
);
check("starter names we wrote follow the language", (await named("식비")) && (await named("현금")));
check("a name the person chose is left alone", await named("KB Bank"));
await shot("log-korean-light");
await evalIn('document.getElementById("btnLang").click()');
await sleep(900);
check("and follow it back", (await named("Food")) && (await named("Cash")));
await evalIn('document.getElementById("btnTheme").click()');
await sleep(700);
check("and so does the theme", (await evalIn('document.documentElement.getAttribute("data-theme")')) === "dark");

await viewport(1280, 860, 2);
await sleep(700);
check("desktop layout does not scroll sideways",
  await evalIn("document.documentElement.scrollWidth <= document.documentElement.clientWidth"),
  (await evalIn("document.documentElement.scrollWidth")) + " vs " + (await evalIn("document.documentElement.clientWidth")));
await shot("desktop");

// ---------- 9. a real ledger's accounts do not follow anything ----------
// Last, because it leaves the main currency somewhere else for a moment and
// no screenshot should catch that. An account with money filed under it owns
// its currency: `accountBalances` adds minor units without converting.
await viewport(390, 844);
await sleep(400);
const kept = await accountCurrencies();
await setMainCurrency("USD");
check("accounts with a history keep their own currency", (await accountCurrencies()) === kept,
  kept + " → " + (await accountCurrencies()));
await setMainCurrency("KRW");

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
