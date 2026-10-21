# Android releases and app updates

Sovel's GitHub distribution uses signed APK updates. Source repository: `quguai/sovel-player`.

## One-time setup

Create the release signing key **once**, keep an offline backup, and reuse it for every release. Losing the key prevents existing installations from being updated. Do not use the checked-in Android debug keystore.

```sh
keytool -genkeypair -v -keystore sovel-release.keystore \
  -alias sovel -keyalg RSA -keysize 4096 -validity 10000
```

Enter passwords interactively. In GitHub → repository Settings → Secrets and variables → Actions, add:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded contents of the keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias, for example `sovel` |
| `ANDROID_KEY_PASSWORD` | Key password |

On macOS, `base64 -i sovel-release.keystore | pbcopy` copies the encoded key without printing it. Paste it directly into the GitHub secret. Keep signing material outside the checkout. The workflow writes the key to the runner's temporary directory and removes it after the build. Never commit passwords or the signing key.

The workflow uses GitHub's built-in `GITHUB_TOKEN`; no personal access token is needed. The build job has read-only repository access. Only the publish job has `contents: write`.

## Publish a version

Commit and push the changes, then create a new immutable version tag:

```sh
git tag -a v0.1.0 -m "Sovel HiFi 0.1.0"
git push origin v0.1.0
```

Do this only when ready to publish. `.github/workflows/android-release.yml` triggers on `v*` tags and rejects malformed version tags. It:

1. Derives the version and Android version code from the tag; updates `mobile/app.json` only inside the CI checkout.
2. Installs locked npm dependencies and applies the project's native audio patches.
3. Runs lint, TypeScript checks and tests.
4. Builds a signed universal release APK for `armeabi-v7a`, `arm64-v8a`, and `x86_64`, including the JS bundle and assets. This APK does not need Metro or Expo Go.
5. Verifies the APK signature, rejects packaged WAV/FLAC/DSF test audio, and generates `update.json` and `SHA256SUMS`.
6. Uploads all assets to a draft GitHub Release and then publishes it. Beta/RC tags become prereleases.

The APK and update files are also retained as a workflow artifact for 14 days. Builds stop if signing secrets are missing. Existing releases are not overwritten; use a new tag. If publishing fails after creating a draft, inspect and remove the incomplete draft before rerunning the failed publish job.

An Android release is a universal APK, not an AAB. Store publishing and iOS/TestFlight release automation are not part of this workflow.

## Tag and version-code rules

Supported examples:

- `v0.1.0`
- `v0.2.0-beta.1`
- `v0.2.0-rc.1`

Major, minor and patch components range from 0 to 99; Beta/RC sequence numbers range from 1 to 99. Leading zeros and arbitrary suffixes are rejected. The deterministic Android version code is:

```text
(major × 10000 + minor × 100 + patch) × 1000 + stage
stage = beta sequence, 100 + RC sequence, or 999 for a stable release
```

This preserves `beta < rc < stable < next patch` and stays below Android's version-code limit. Example: `v0.2.0-beta.1` → `200001`, `v0.2.0-rc.1` → `200101`, `v0.2.0` → `200999`. Do not change this scheme after distributing releases. Keep the application ID `cn.quguai.music.sovel` and signing key stable.

A production-signed release cannot overwrite a debug-signed development installation. Export settings and prepare to re-authorize music sources before switching installation channels; the updater never uninstalls the old app or deletes its data automatically.

## In-app behavior

Settings → **版本更新** provides manual checks, version, size, progress, cancellation, explicit installation, an ignored-version preference, and stable/preview channels. The update flow does not display changelogs or external release links. Outside settings, automatic downloads display a compact progress bar; once ready, open update settings to confirm installation.

- Automatic checks are enabled by default, at most once every 12 hours while the app is active. Failed automatic checks do not interrupt listening; manual checks show errors. GitHub API rate-limit failures can be retried later.
- Automatic download is opt-in and requires Wi-Fi or Ethernet. The native downloader stops if that connection disappears. Manually requested downloads may use the current network.
- Downloads stream to private cache storage; size and SHA-256 must match the release manifest. Android package ID, increasing version code and the current installation's signing certificate must match before offering installation. The cached APK is checked again when installing. Signing-key rotation is not supported by this first implementation.
- Installation is always user initiated. If Android needs permission to install apps from Sovel, it opens system settings; return and click **安装更新** again. Cancelling the system installer leaves the downloaded APK available during the current process.
- Checks and downloads do not pause or reload the music player. Installation can stop the running application. Music files are never part of an update; database migrations are handled by the app on next launch.
- Unfinished downloads are not resumed across process death. Downloaded APKs are cached and can be discarded by Android; after restarting Sovel, download again. This version does not use a persistent background download service.
- Update preferences use a separate SQLite preference key (`appUpdates`) and are not included in the existing settings/EQ backup.

The public Releases API and assets need to be accessible without authentication. Never embed a GitHub token in the application. A private repository cannot serve this public update path; GitHub connectivity also depends on the user's network.

## Forks and other distribution channels

`mobile/app.json` contains `extra.githubRepository` and `extra.distribution: "github"`. The release preparation script uses `GITHUB_REPOSITORY` so a fork's published build checks that fork. Local builds use the committed value. The Android native module is autolinked from `mobile/modules/sovel-updates`.

iOS displays release-history access only and never downloads APKs. App Store and TestFlight installations update through their original channels. Google Play in-app updates, OTA JS updates and App Store version checks are not implemented. A future Play variant must disable the GitHub updater **and remove `REQUEST_INSTALL_PACKAGES` from its merged manifest**; changing the JS distribution flag alone is not sufficient.

## Local validation

```sh
cd mobile
npm run lint
npm run check
npx expo export --platform android --output-dir artifacts/android-bundle
```

A full release build also needs JDK 21, Android SDK/NDK and the four `SOVEL_*` signing environment variables used in `mobile/android/app/build.gradle`. Do not distribute the result of `assembleDebug` as a release. Before the first public release, verify downloading and upgrading between two signed builds on an actual Android device.

References: [GitHub release API](https://docs.github.com/en/rest/releases/releases), [Android signing](https://developer.android.com/studio/publish/app-signing), [Expo local module autolinking](https://docs.expo.dev/modules/autolinking/).
