// ============================================================
//  Generate the Android app's Strings.kt from i18n.js.
//
//      node tools/gen-android-strings.mjs ../tally-android
//
//  Two hand-maintained copies of two hundred and forty strings drift within
//  a week — a key renamed here, a Korean line edited there, and the phone
//  quietly starts showing "tx.saveAnother" where a button should be. So the
//  web app's table is the source and the Kotlin is a build artefact that
//  happens to be committed, the way generated code usually is.
//
//  Run this after touching i18n.js. The Android app has a test that fails if
//  you forget.
// ============================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ALL_STRINGS, LANGS, DEFAULT_LANG } from "../i18n.js";

const target = resolve(process.argv[2] || "../tally-android");
const out = target + "/app/src/main/java/com/hanifedma/tally/i18n/Strings.kt";

/** Kotlin string literal: escape what Kotlin treats specially, and only that. */
function lit(value) {
  return (
    '"' +
    String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\$/g, "\\$")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t") +
    '"'
  );
}

// The web writes a few strings as HTML because it renders them into a page.
// Compose has no innerHTML, so strip the tags rather than print them.
const deHtml = (s) =>
  String(s)
    .replace(/<code>/g, "")
    .replace(/<\/code>/g, "")
    .replace(/<[^>]+>/g, "");

const keys = Object.keys(ALL_STRINGS[DEFAULT_LANG]);

// Fail loudly rather than generate a table with holes in it.
for (const lang of LANGS) {
  const missing = keys.filter((k) => ALL_STRINGS[lang][k] == null);
  if (missing.length) {
    console.error("Missing " + lang + " strings: " + missing.join(", "));
    process.exit(1);
  }
}

const table = (lang) =>
  keys.map((k) => "        " + lit(k) + " to " + lit(deHtml(ALL_STRINGS[lang][k])) + ",").join("\n");

const source = `package com.hanifedma.tally.i18n

// ============================================================
//  GENERATED FILE — do not edit.
//
//  Produced from the web app's i18n.js by tools/gen-android-strings.mjs, so
//  that the phone and the browser cannot disagree about what a button says.
//  Change the wording there and run the generator; StringsParityTest fails
//  if this file falls behind.
//
//  ${keys.length} keys, ${LANGS.length} languages.
// ============================================================

object Strings {

    val LANGS = listOf(${LANGS.map((l) => lit(l)).join(", ")})
    const val DEFAULT_LANG = ${lit(DEFAULT_LANG)}

${LANGS.map(
  (lang) => `    private val ${lang.toUpperCase()}: Map<String, String> = mapOf(
${table(lang)}
    )`
).join("\n\n")}

    private val TABLES: Map<String, Map<String, String>> = mapOf(
${LANGS.map((l) => "        " + lit(l) + " to " + l.toUpperCase() + ",").join("\n")}
    )

    /**
     * A translated string, with {placeholders} filled in.
     *
     * A missing key returns the key itself rather than an empty string: a
     * screen reading "tx.saveAnother" is a bug you fix in a minute, and a
     * screen with a blank button is one you ship.
     */
    fun get(lang: String, key: String, vars: Map<String, Any?> = emptyMap()): String {
        val table = TABLES[lang] ?: TABLES.getValue(DEFAULT_LANG)
        val raw = table[key] ?: TABLES.getValue(DEFAULT_LANG)[key] ?: return key
        if (vars.isEmpty()) return raw
        var out = raw
        for ((name, value) in vars) out = out.replace("{" + name + "}", value.toString())
        return out
    }

    /** Every key, for the parity test. */
    fun keys(lang: String): Set<String> = (TABLES[lang] ?: emptyMap()).keys
}
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, source, "utf8");
console.log("Wrote " + out.replace(/\\\\/g, "/"));
console.log(keys.length + " keys × " + LANGS.length + " languages");
