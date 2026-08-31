// ============================================================
//  The demo ledger, written in the shape the Android app's LocalStore
//  reads, so the phone can be photographed holding the same money as the
//  browser.
//
//      node tools/demo-cache.mjs /tmp/tally-cache.json
//
//  Then, with the debug build installed:
//
//      adb push /tmp/tally-cache.json /sdcard/cache-local.json
//      adb shell "run-as com.hanifedma.tally sh -c \
//        'cat /sdcard/cache-local.json > files/tally/cache-local.json'"
//
//  The two formats differ in exactly two ways, both of them Kotlin's:
//  kotlinx.serialization was given @SerialName snake_case for the columns
//  but plain names for the wrapper, and the four tables sit at the top
//  level rather than under `rows`.
// ============================================================

import { writeFileSync } from "node:fs";
import * as M from "../money.js";
import { buildDemoLedger } from "./demo-ledger.js";

const out = process.argv[2] || "tally-cache.json";
const d = await buildDemoLedger(M);

// LocalStore.Cache: version/cursors/settings and then the tables by name.
// The rows themselves are already snake_case — they are the same objects the
// web writes, and the same ones Postgres would return.
const cache = {
  version: 1,
  cursors: {},
  settings: d.settings,
  accounts: d.accounts,
  categories: d.categories,
  transactions: d.transactions,
  budgets: d.budgets,
};

writeFileSync(out, JSON.stringify(cache, null, 2));
console.log(
  "wrote " +
    out +
    " — " +
    d.transactions.length +
    " transactions, " +
    d.accounts.length +
    " accounts, " +
    d.categories.length +
    " categories"
);
