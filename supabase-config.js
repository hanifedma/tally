// ============================================================
//  PASTE YOUR SUPABASE PROJECT HERE
//  ------------------------------------------------------------
//  Two values, both from the Supabase dashboard:
//
//    Project Settings → Data API      → Project URL
//    Project Settings → API Keys      → anon / public
//
//  Both are SAFE to publish on GitHub. The URL is in every request the
//  browser makes anyway, and the anon key is not a password: it identifies
//  the project, and can only ever act as whoever is signed in. What
//  protects your ledger is the row level security in schema.sql, which
//  lets each signed-in person read and write only their own rows.
//
//  What must NEVER go in this file is the *service_role* key. That one
//  bypasses row level security entirely. If you ever paste it here by
//  mistake, rotate it in the dashboard immediately.
//
//  Until this is filled in, Tally shows a short setup screen instead of
//  a sign-in button that could not work.
//
//  Full walkthrough: SETUP.md (about ten minutes, free tier).
// ============================================================

export const supabaseUrl = "https://zibjtnclujlsfhkiggrg.supabase.co";
export const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppYmp0bmNsdWpsc2Zoa2lnZ3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Mzg5MjksImV4cCI6MjEwNDExNDkyOX0.UudhYwglkg5Rpor0Zt3H27nVISqPzH9AomOvPg34T3Q";

// ============================================================
//  The Google OAuth web client id — what decides the wording of the
//  sign-in dialog, and the one piece of setup worth explaining.
//
//  The obvious way to sign in with Google is to redirect the browser to
//  Supabase's own callback domain. Google then names the origin it is
//  handing off to, so the account chooser reads
//
//      Choose an account → to continue to abcdefgh.supabase.co
//
//  — a random project ref, shown at the exact moment someone is deciding
//  whether to trust this app with their Google account. Google will not
//  print a friendlier name instead, because an unverified app's name is
//  just text typed into a console, and displaying it unchecked would make
//  the consent screen a perfect phishing surface.
//
//  So Tally does not redirect. Google's own button is drawn on the page,
//  it hands back an ID token, and store.js trades that token for a
//  Supabase session. The browser never leaves the site, so the site is
//  what Google names.
//
//  Find it in the Google Cloud console → APIs & Services → Credentials →
//  the "Web application" client. The same id goes into the Android app's
//  supabase.properties, and into Supabase → Authentication → Sign In /
//  Providers → Google → "Authorized Client IDs".
//
//  A client id is public — it is meant to be read out of the page. All of
//  its security is that it refuses to work from an origin you have not
//  listed under "Authorised JavaScript origins" on that same client.
//
//  Leave it empty and sign-in still works: it falls back to the redirect
//  described above, project ref and all.
// ============================================================
export const googleClientId = "964081959156-a30tj98puhmcve27s4n629ndnipct344.apps.googleusercontent.com";

/** A value that has actually been filled in, as opposed to a placeholder. */
const filled = (v) =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  !v.startsWith("PASTE_") &&
  !v.startsWith("YOUR_");

export const hasSupabaseUrl = filled(supabaseUrl) && /^https:\/\/[^/]+\.supabase\.(co|in)$/.test(supabaseUrl.trim());
export const hasSupabaseKey = filled(supabaseAnonKey) && supabaseAnonKey.trim().length > 20;

/**
 * A real client id, as opposed to blank, a placeholder, or the project
 * *number* pasted by mistake — all of which fail inside Google's own popup,
 * where nothing can report the reason back to the page.
 */
export const hasGoogleClientId =
  filled(googleClientId) && googleClientId.trim().endsWith(".apps.googleusercontent.com");

/** True when Tally has everything it needs to talk to the cloud at all. */
export const isConfigured = hasSupabaseUrl && hasSupabaseKey;
