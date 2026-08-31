# Tally

A money manager for people whose money is in more than one currency.

**[hanifedma.com/tally](https://hanifedma.com/tally/)** · Android app:
[hanifedma/tally-android](https://github.com/hanifedma/tally-android)

---

## What it is

One ledger, on your phone and your laptop at the same time. Enter lunch on the
phone and it is on the laptop before you look up — both read and write the same
Postgres, and both listen to the same realtime stream.

- **Expenses, income and transfers**, grouped by day, each day showing its own
  two totals.
- **Every account keeps its own currency.** A won account holds won and a
  rupiah account holds rupiah; they are only ever added together in one place,
  and that place says which currency it is speaking.
- **Budgets that follow your payday.** Set the month to begin on the day you
  are actually paid, and the bars mark where today sits so "60% spent" reads
  differently on the 5th than on the 25th.
- **Works with no signal.** The ledger is cached on the device and anything you
  change is queued and sent when there is a network again.
- **English and Korean**, dark and light, chosen once and followed everywhere —
  the setting lives on the account, not the device.
- **CSV export** with both what you paid and what it was worth.

## The thing it fixes

The app this replaces put Korean won and Indonesian rupiah in the same column
and called the result a total. It also counted a transfer between two of your
own accounts as both income and an expense, which is why its monthly figures
never matched the bank.

Tally does neither. Every transaction is stored in its account's own currency
along with **the exchange rate on the day it was entered**, frozen, so editing
today's rate cannot quietly rewrite what last March cost. A rate it does not
know it asks for — once — rather than guessing 1:1 and being invisibly wrong
for ever. And a transfer is a transfer.

## Setup

[**SETUP.md**](SETUP.md) — about fifteen minutes, all free. A Supabase project,
a Google OAuth client, four values pasted into two files.

## How it is built

No framework, no build step, no dependencies to install. Plain ES modules, the
system font stack, and one pinned import of `supabase-js` from a CDN. Open
`index.html` through the local server and you are running exactly what is
deployed.

| File | What it holds |
|---|---|
| `money.js` | Every number the app shows. Pure functions, no DOM, no network. |
| `i18n.js` | 242 strings × 2 languages. Also the source the Android app's `Strings.kt` is generated from. |
| `store.js` | Postgres, the device cache, and the outbox — and the rules that reconcile them. |
| `app.js` | Three screens and the sheets over them. |
| `styles.css` | The design system, as CSS custom properties. |
| `schema.sql` | Five tables, row level security, realtime. Paste into Supabase and run. |
| `sw.js` | A network-first service worker. Never caches an API response. |

### Three decisions worth knowing about

**Nothing is ever deleted.** A `deleted_at` marks a row as gone and clients
filter it out. That buys undo; a delta sync that can ask *what changed since?*
and get deletions in the same answer; and — the important one — realtime that
works at all. A real `DELETE` sends only the primary key, which row level
security then has no `user_id` to check, so the event is dropped before it
reaches the device that needed it. A soft delete is an `UPDATE` carrying the
whole row, so it always arrives.

**Every id is made on the client.** A transaction written in a basement has its
final identity the moment you press Save, so replaying it when the network
returns cannot create a second copy. The same trick makes first-run seeding
safe: category ids are derived from your user id, so a phone and a laptop
opening Tally for the first time in the same minute write the same rows rather
than two sets of them.

**A date is a date.** `occurred_on` is a plain calendar day, not a timestamp.
Recording lunch in Seoul and opening the app in Jakarta must not move it to
yesterday. The time of day rides along as minutes past midnight, purely for
ordering within the day.

## Working on it

```bash
node tools/serve.mjs              # http://localhost:8080  (loopback only)
node tools/run-tests.mjs          # the test suite, in a terminal
open http://localhost:8080/tests.html   # the same suite, in a browser
./bump-version.sh                 # bump every ?v= and version.json together
node tools/make-icons.mjs . ../tally-android/app/src/main/res
node tools/gen-android-strings.mjs ../tally-android
```

`money.js` is covered by 51 tests. Run them before pushing; the Android app has
its own copy of the same arithmetic, and a `ParityTest` over there asserts the
two produce identical answers for the same inputs — down to the exact
formatted string and the exact derived UUID.

After editing `i18n.js`, run the string generator. The Android build has a test
that fails if `Strings.kt` has fallen behind.

## Licence

Personal project. Do what you like with it.
