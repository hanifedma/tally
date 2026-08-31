# Setting Tally up

About fifteen minutes, all on free tiers, done once. Everything else is
already built.

There are two accounts to create — a database and a sign-in — and then four
values to paste into two files. Nothing here can be done for you: both
services want a real person's email and a verification click.

Work through this in order. The web app and the Android app share every
value, so doing it once does both.

---

## 1. The database — Supabase (5 min)

Tally keeps your ledger in Postgres. The free tier is far more than a
personal ledger will ever need.

1. Go to **[supabase.com](https://supabase.com)** and sign up (GitHub sign-in
   is quickest).
2. **New project**. Name it `tally`. Choose a region near you — Seoul or
   Singapore if you are in Asia — and let it generate a database password.
   You will not need that password again; Tally never uses it.
3. Wait about two minutes for it to finish provisioning.

### Run the schema

4. In the left sidebar: **SQL Editor** → **New query**.
5. Open [`schema.sql`](schema.sql) from this repo, copy the whole file, paste
   it in, and press **Run**.

   It should say *Success. No rows returned.* That has created five tables,
   locked every one of them to its owner, and turned on the realtime stream
   that keeps your phone and your laptop in step. It is safe to run again
   later if you ever pull an update.

### Copy the two values

6. **Project Settings** (the gear, bottom left) → **Data API**.
   Copy the **Project URL** — it looks like `https://abcdefgh.supabase.co`.
7. **Project Settings** → **API Keys** → copy the **`anon` / `public`** key.

   > Take the **anon** key, never the **service_role** one. The anon key can
   > only ever act as whoever is signed in, which is why it is safe in a
   > public repo. The service_role key ignores row level security entirely.

---

## 2. Sign-in — Google (7 min)

This is the fiddly half. Read step 4 before you do step 3.

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)** and
   create a project called `Tally`.
2. **APIs & Services** → **OAuth consent screen**:
   - User type: **External**, then **Create**.
   - App name `Tally`, your email for both support and developer contact.
   - **Save and continue** through the scopes and test-users steps — Tally
     asks for nothing beyond your name, email and picture, which every app
     gets by default.
   - Under **Audience**, add your own Google account as a **test user**.
     (You can leave the app in "Testing" for ever if only you use it.)

3. **APIs & Services** → **Credentials** → **Create credentials** →
   **OAuth client ID** → **Web application**. Name it `Tally web`.

   Under **Authorised JavaScript origins**, add all of these:

   ```
   https://hanifedma.com
   http://localhost:8080
   ```

   Under **Authorised redirect URIs**, add your Supabase callback — the
   project URL from step 1.6 with `/auth/v1/callback` on the end:

   ```
   https://YOUR-PROJECT.supabase.co/auth/v1/callback
   ```

   **Create**, then copy the **Client ID**. It ends in
   `.apps.googleusercontent.com`. Copy the **Client secret** too — Supabase
   wants it in step 5.

4. **Credentials** → **Create credentials** → **OAuth client ID** →
   **Android**. Name it `Tally android`.

   - Package name: `com.hanifedma.tally`
   - SHA-1 certificate fingerprint: the one printed by

     ```bash
     cd tally-android
     keytool -list -v -keystore tally-release.jks -alias tally
     ```

     (The password is in `tally-android/keystore.properties`, which is not
     committed. If you rebuild the keystore, the fingerprint changes and this
     entry has to change with it.)

   This client is never referenced in code. It exists so that Google will
   issue tokens to an app signed with *that* certificate — which is what
   stops anyone else's app claiming to be Tally.

5. Back in **Supabase** → **Authentication** → **Sign In / Providers** →
   **Google**:
   - Turn it **on**.
   - **Client ID**: the *web* client id from step 3.
   - **Client Secret**: the web client secret from step 3.
   - Open **Authorised Client IDs** and paste the *web* client id there too.

   > That last box is the one everybody misses. Both apps sign in by handing
   > Supabase an ID token rather than redirecting, and Supabase will only
   > accept a token whose audience is listed there. Without it sign-in fails
   > with a "provider" or "audience" error and nothing else explains why.

---

## 3. Paste the values in (2 min)

**Web** — edit `tally/supabase-config.js`:

```js
export const supabaseUrl = "https://YOUR-PROJECT.supabase.co";
export const supabaseAnonKey = "eyJ...";           // the anon key
export const googleClientId = "1234-abcd.apps.googleusercontent.com";
```

**Android** — edit `tally-android/supabase.properties`:

```properties
supabase.url=https://YOUR-PROJECT.supabase.co
supabase.anonKey=eyJ...
google.webClientId=1234-abcd.apps.googleusercontent.com
```

Both take the **web** client id. The Android one from step 2.4 is never
typed anywhere: Credential Manager asks Google for a token *for the web
client*, and proves the app is genuine with the signing certificate.

All three values are public by design and safe to commit. Your ledger is
protected by the row level security in `schema.sql`, which lets each signed-in
person read and write only their own rows.

---

## 4. Run it

**Web, locally:**

```bash
cd tally
node tools/serve.mjs        # → http://localhost:8080
```

`localhost` counts as a secure origin, so Google sign-in behaves exactly as it
will in production. Opening `index.html` as a `file://` URL does not.

**Web, deployed:** push to the `tally` repo on GitHub, then
**Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
It appears at `https://hanifedma.com/tally/` a minute later.

**Android:** install the APK from `tally-android/app/build/outputs/apk/release/`,
or rebuild it after editing `supabase.properties`:

```bash
cd tally-android
./gradlew assembleRelease
```

---

## If sign-in does not work

| What you see | What it means |
|---|---|
| The account chooser never appears on the web | The origin you are on is not in **Authorised JavaScript origins**. It must match exactly, scheme and port included. |
| Chooser appears, then "sign-in failed" | The web client id is not in Supabase's **Authorised Client IDs** (step 2.5). |
| Android says "no Google account is available" | No account on the device, or no Play Services. |
| Android chooser appears, then fails | The SHA-1 in the Android OAuth client does not match the certificate the APK was signed with. A debug build and a release build have different ones. |
| "Tally is not connected to a database yet" | `supabase-config.js` or `supabase.properties` still holds a `PASTE_...` placeholder. |
| Sign-in works, but the ledger is empty on one device only | Almost always a caching issue — pull down or reopen. If it persists, check that `schema.sql` ran without errors. |

Nothing here needs a paid plan, and nothing here expires.
