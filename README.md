# para (Android App + GitHub APK Builder)

## 1. Set Up Supabase Backend
1. Open your Supabase project -> **SQL Editor** and run `supabase/migrations/001_init.sql`.
2. Under **Authentication -> Providers**, enable **Email** (and optionally **Google**) and add `para://auth/callback` under **Authentication -> URL Configuration -> Redirect URLs**.

## 2. Build the APK via GitHub Actions
1. Extract this ZIP so the files (`package.json`, `app.json`, `eas.json`, `.github/`, `src/`, `supabase/`) are at the root of your repository.
2. Run `npx eas-cli init` locally once to bind your Expo `projectId` in `app.json`, then upload the extracted files to your GitHub `main` branch.
3. In GitHub **Settings -> Secrets and variables -> Actions**, add:
   - `EXPO_TOKEN`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Open the **Actions** tab on GitHub, run **Build Android APK**, and download **`para-android-apk`** from **Artifacts**.
