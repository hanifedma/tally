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

// ------------------------------------------------------------
//  What only the phone says
//
//  Almost every string belongs to both apps, which is the whole point of
//  generating this. A few cannot: one names a file that exists only in this
//  repo, another names a failure only Credential Manager can have. They live
//  here rather than in i18n.js so the website is not carrying strings it can
//  never show — and here rather than pencilled into Strings.kt afterwards,
//  which is how they got lost the last time this was run.
// ------------------------------------------------------------
const ANDROID = {
  en: {
    // The web app is edited and reloaded; this one is built.
    "setup.p1":
      "Tally is not connected to a database yet. Put your Supabase project URL and anon key into supabase.properties and build the app again.",
    // Credential Manager can fail before it has shown anything at all — no
    // Play Services, no accounts on the device, a client id that does not
    // match the signing key. It reports every one of those as a cancellation.
    "err.auth.unavailable":
      "Google wouldn't sign you in. Check this device has a Google account added, and that the app's sign-in setup is complete.",
  },
  ko: {
    "setup.p1":
      "아직 데이터베이스에 연결되지 않았습니다. Supabase 프로젝트 URL과 anon 키를 supabase.properties에 넣고 앱을 다시 빌드하세요.",
    "err.auth.unavailable":
      "Google이 로그인을 거부했습니다. 이 기기에 Google 계정이 추가되어 있는지, 로그인 설정이 완료되었는지 확인해 주세요.",
  },
};

/** The web's table with the phone's overrides and additions folded in. */
const stringsFor = (lang) => ({ ...ALL_STRINGS[lang], ...ANDROID[lang] });

// Android-only keys sort after the shared ones rather than being interleaved,
// so a diff of this file after a wording change stays readable.
const keys = [
  ...Object.keys(ALL_STRINGS[DEFAULT_LANG]),
  ...Object.keys(ANDROID[DEFAULT_LANG]).filter((k) => !(k in ALL_STRINGS[DEFAULT_LANG])),
];

// An override for a key the web has since renamed is a string nobody will
// ever see, sitting in the file looking authoritative.
for (const lang of LANGS) {
  if (!ANDROID[lang]) {
    console.error("No Android overrides for " + lang);
    process.exit(1);
  }
  const stale = Object.keys(ANDROID[lang]).filter(
    (k) => !(k in ANDROID[DEFAULT_LANG])
  );
  if (stale.length) {
    console.error("Android override in " + lang + " with no " + DEFAULT_LANG + ": " + stale.join(", "));
    process.exit(1);
  }
}

// Fail loudly rather than generate a table with holes in it.
for (const lang of LANGS) {
  const table = stringsFor(lang);
  const missing = keys.filter((k) => table[k] == null);
  if (missing.length) {
    console.error("Missing " + lang + " strings: " + missing.join(", "));
    process.exit(1);
  }
}

const table = (lang) => {
  const strings = stringsFor(lang);
  return keys.map((k) => "        " + lit(k) + " to " + lit(deHtml(strings[k])) + ",").join("\n");
};

const source = `package com.hanifedma.tally.i18n

// ============================================================
//  GENERATED FILE — do not edit.
//
//  Produced from the web app's i18n.js by tools/gen-android-strings.mjs, so
//  that the phone and the browser cannot disagree about what a button says.
//  Change the wording in i18n.js and run the generator again — a few
//  Android-only strings live in the generator itself, at the top.
//
//  Nothing compares this against i18n.js automatically: the web table is
//  JavaScript and this is a unit test on the JVM. ParityTest checks what it
//  can from here — that every key exists in both languages and that no
//  placeholder was lost in translation.
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
