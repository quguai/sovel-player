# Sovel HiFi · Mobile

**English** · [简体中文](README.zh-CN.md) · [Project overview](../README.md)

React Native and TypeScript implementation of Sovel HiFi. This directory contains the application, committed iOS/Android projects, native audio extensions, and tests. The browser demo at the repository root is a separate visual reference.

## Android releases

The root [Android release workflow](../.github/workflows/android-release.yml) runs on `v*` tags, validates the version, runs checks, builds a signed APK and publishes the APK plus update manifest to GitHub Releases. Configure the four signing secrets before creating a release tag. [Release setup and update behavior](../docs/android-releases.md).

## Setup

Use a Node.js version matching [package.json](package.json): `^22.13.0 || ^24.3.0 || >=26.0.0`, and npm. iOS needs macOS, Xcode, and CocoaPods. Android needs JDK 21, the Android SDK, and a device or emulator.

From this directory:

```sh
npm ci
```

For iOS:

```sh
cd ios
pod install
cd ..
npm run ios
```

For Android:

```sh
npm run android
```

`npm start` runs Metro separately. This app requires a native development build, not Expo Go. Native dependency changes require recompilation; run `pod install` for iOS changes. Native projects are versioned and should not normally be regenerated with Prebuild. If a rename or dependency change leaves Metro serving stale modules, restart with `npm start -- --clear`.

| Identity | Value |
| --- | --- |
| Display name | Sovel HiFi |
| Wordmark / native project | Sovel |
| Android application ID / iOS Bundle ID | `cn.quguai.music.sovel` |
| URL scheme | `sovel://` |
| SQLite file | `sovel.db`, schema version 4 |

The pre-release rename uses a new application identity and database without runtime migration from the earlier brand. Database schema upgrades are separate from branding, and ordinary scans update the existing database.

## Development audio fixtures

The repository retains two original synthesized 24-second audio fixtures for development and metadata tests. They live only under `tests/fixtures`, are not bundled into the app, and have no in-app download/import shortcut. For simulator playback tests, install the app, run `sh scripts/prepare-listening-fixtures.sh`, then scan the app files through Settings → File scanning.

| File | Embedded title / artist / album | Audio |
| --- | --- | --- |
| `tests/fixtures/sample.wav` | 初见 / Sovel / 声音手记 | PCM WAV, 16-bit, 44.1 kHz, stereo |
| `tests/fixtures/sample.flac` | 微光 / Sovel / 声音手记 | FLAC, 16-bit, 44.1 kHz, stereo |

Both include artwork and timed lyrics. They are interaction/metadata fixtures, not commercial recordings or Hi-res masters. `npm run fixtures` regenerates them; generating FLAC requires FFmpeg. `tests/tagged.dsf` is a metadata fixture and is not a playable DSD demonstration.

Tap the format/sample-rate line in the player to inspect file information. Displayed sample rate and bit depth describe the source file, not the DAC output.

## Files and scanning

Selecting files or adding a folder indexes the original audio without copying or modifying its tags.

- Android uses SAF file/folder selection and persistent URI grants. Provider `content://` URIs are used directly.
- iOS uses the local `SovelAccess` module, `UIDocumentPicker` access-in-place, and security-scoped bookmarks. Access is restored on restart and retained for native playback.
- SQLite stores source identity, paths/URIs, size, modification time, metadata, lyrics, favorites, and preferences. Artwork is cached separately; audio is not stored in SQLite.
- A folder grant can discover new songs and same-name `.lrc` files. A single-file grant indexes only selected files.
- Moves/renames currently create new path identities; previous records remain missing. Overlapping sources can create duplicate index entries without duplicating audio.
- Offline storage, revoked permissions, and removed files retain index/favorite records. Reconnect and rescan; select the source again if its grant has expired.
- **复制音乐到应用** is an explicit optional copy action. iOS exposes this directory in Files → Sovel HiFi → Music.
- Cloud file providers may download/cache files themselves. This implementation targets local, randomly readable files and does not mirror remote music libraries.

All sources share one database. Scanning first enumerates the entire selected scope and applies filters, then imports against one fixed total. Settings include minimum file size, hidden content, and subfolder inclusion. Source-management selection does not automatically start a scan; quick import actions also perform an incremental scan.

| Scan mode | Behavior |
| --- | --- |
| Incremental | Enumerates sources; rereads new or changed files, or files with unreliable modification dates |
| Full | Enumerates and rereads all eligible metadata, artwork, and lyrics |
| Refresh tags | Rereads metadata without relying on cached size/modification signals |

Stable indexed identities preserve favorites, lyrics offsets, and listening history across rescans. Only a complete, successful enumeration can mark tracks missing. Narrower filters retain previous records. Metadata failures preserve old tags and are retried. Sources commit independently, so cancellation keeps already completed source updates. A killed scan is marked interrupted and must be restarted; directory watching and cross-process scan resume are not implemented.

## Interface and playback

- Charcoal-and-gold library with albums, songs, artists, folders, search, and favorites. Album and artist card/list choices are remembered independently.
- Compact mini-player with a rotating record and text navigation. Cover and portrait placeholders are bundled assets, assigned consistently without network requests or per-track copies. Embedded artwork takes priority; artist portraits are kept separate from album covers.
- Three home layouts and three playback views: album cover, vinyl, and immersive artwork. Nine record materials, two tonearms, six cartridge colors, independent stylus lighting, and three rotation speeds share the settings/appearance sheet. The clothing icon opens that sheet.
- Song details, player, and lyrics form three horizontal pages, with the player in the center. Swipe left for lyrics or right for details; header dots navigate between pages. Portrait pages share progress and playback controls; landscape layouts use columns. Reduced-motion preferences are respected.
- Details include artist/album navigation, album cards with indexed song counts, related local songs, audio properties, and file name/path/modification time. Unknown paths or metadata are not invented.
- Native queue, seek, previous/next, shuffle, list repeat, and track repeat. Background playback and lock-screen controls are integrated. Disabling background playback pauses when leaving the app and does not resume automatically on return.
- Restart restores queue IDs, original/shuffled order, current track, and position, initially paused. Unavailable tracks retain their canonical queue entries; restoration can advance to the next playable item. Native checkpoints use a queue token to reject stale records and normally save position about every two seconds.
- Timed lyrics highlight the current line and support tap-to-seek. Untimed lyrics remain static. Per-song offsets range from −30 to +30 seconds in 0.2-second steps; positive values advance lyrics. Seeking applies the inverse offset. Overrides live in their own SQLite table and survive rescans.

### Native sleep timer

Presets are 15/30/60/90 minutes, with a custom 1–180-minute duration and cancellation. iOS uses a continuous monotonic clock and DispatchSource; Android uses `elapsedRealtime` and a main-thread Handler. JS only displays remaining time. Pause, track changes, and lock-screen transitions do not reset the deadline. The current mode pauses at expiry; finish-track/finish-queue modes are not implemented. The timer is session-only and ends with the app process; real-device background behavior still needs validation.

### Settings backup

Settings → **备份与恢复** exports appearance, playback preferences, scan rules, EQ parameters, custom presets, and collection layouts. Restore validates the version, size, and parameters, then previews the replacement before applying it.

Files are written to `Documents/Backups` and shared through the system sheet. The backup excludes audio, favorites, queue/position, lyrics offsets, listening history, source addresses, and access grants. Cancelling import does not change settings; file permissions must be authorized separately on another device.

## Ten-band equalizer

Settings → **均衡器** provides ten bands from 31.25 Hz to 16 kHz, ±12 dB per band, six built-in presets, up to 30 custom presets, and −24 to 0 dB preamp. Disabling preserves the curve; selecting a preset does not automatically enable EQ.

The shared C++ implementation uses peaking biquads based on the [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/). Automatic headroom estimates the combined maximum boost and reduces preamp. Parameters transition over approximately 40 ms; samples outside the final range are clipped. This is not a compressor or true-peak limiter.

- `native/equalizer/` handles interleaved/planar PCM 16/24/32-bit and float32. Disabled/neutral settings bypass after the transition; bands above the applicable Nyquist limit are skipped.
- iOS attaches `AVPlayerItem.audioMix` and `MTAudioProcessingTap`; AVFoundation retains decoding, session, queue, and media controls.
- Android wraps Media3's `ForwardingAudioSink` and calls the shared DSP through JNI. Encoded passthrough and hardware offload are disabled on this path so processing is not bypassed. This is not USB exclusive output.
- Reported processing format is the DSP input, not the DAC format. Applying EQ modifies samples; disabling this stage alone does not prove bit-perfect output.

`scripts/patch-audio-equalizer.mjs` and `scripts/patch-audio-playback.mjs` apply maintained integrations to **`expo-audio@58.0.9`**, in that order. Installation/start scripts run both; repeated application is safe. The audio package is explicitly built from source. Upgrading it requires reviewing patch anchors and native behavior; OTA updates cannot add these native extensions.

PEQ, AutoEQ import, ReplayGain, and per-output/device preset memory are not implemented. NeriPlayer informed preset/state behavior; its implementation or full effect presets were not copied.

## Listening history and local discovery

SQLite's `listening_history` stores actual listening time, unique audio coverage, seek counts, and end reasons. Native monotonic sampling excludes pauses/buffering; seeking changes the sampling anchor. Repeating a segment adds listening time without double-counting completion. Unknown duration remains unknown.

Native snapshots are saved about every five seconds and on pause/track changes. JS ingests bounded batches, then acknowledges revisions, avoiding duplicate counting. A crash can lose the most recent uncheckpointed interval. History survives rescans and can be paged under Settings → **听歌记录与偏好**; it is not uploaded by the app.

Daily mixes are stable for the local day and contain up to 30 playable tracks. Related local songs combine tags, artist/album relationships, favorites, and the last 90 days of listening evidence, with stronger weight on the last 30 days. This is local rule-based ranking, not online recommendations or audio-content analysis. The complete history is retained beyond that ranking window.

## Format and output boundaries

WAV/FLAC metadata and iOS playback have been verified with the samples. DSF ID3 tags, artwork, and lyrics parsing are tested. MP3, AAC, ALAC, AIFF, Ogg, Opus, and other playback formats remain platform/codec-dependent. DSF/DFF/APE/WavPack may be indexed but are blocked from playback pending decoder work. Neither TagLib nor an FFmpeg playback backend is integrated.

Remote library adapters, USB exclusive output, DoP/native DSD, vendor-specific internal DAC support, bit-perfect detection, guaranteed gapless playback, crossfade, arbitrary custom themes, and additional app languages remain unimplemented. USB DAC connections currently use system audio. Long background sessions, interruptions, Bluetooth, and physical outputs need real-device validation.

## Validation

```sh
npm run check
npm run lint
```

The current baseline is 54 passing core tests, a passing TypeScript check, and zero ESLint errors with seven existing warnings. Tests use real SQLite and WAV/FLAC/DSF metadata fixtures; they cover scanning, cancellation/offline behavior, source identity, schema upgrades, history, queue restoration, backups, lyrics offsets, discovery, and placeholders.

Optional JS bundle export checks:

```sh
npx expo export --platform ios --platform android --output-dir artifacts/bundles
```

Bundle export does not verify native Android compilation or device playback. Current iOS simulator checks cover import, actual playback progress, WAV/FLAC switching, lyrics, scanning, restart recovery, EQ/presets, native sleep timing, backup flows, and collection views. The rename regression passed local playback/restart and EQ tests. The signed Android release build and exclusion of test audio are verified by [GitHub Actions](https://github.com/quguai/sovel-player/actions/runs/39416673982) for `v0.1.0-beta.4`. Android device playback and hardware validation remain outstanding.

Native DSP test:

```sh
mkdir -p artifacts
clang++ -std=c++17 -O2 -Wall -Wextra native/equalizer/tests/dsp_test.cpp native/equalizer/SovelEqualizerDSP.cpp -o artifacts/eq-dsp-test
artifacts/eq-dsp-test
```

Native checkpoint/timer/history test on macOS:

```sh
swiftc native/playback/ios/SovelPlaybackState.swift tests/native/main.swift -o /tmp/sovel-playback-tests
/tmp/sovel-playback-tests
```

iOS UI tests live in `ios/SovelUITests`; open `ios/Sovel.xcworkspace`, choose the **Sovel** scheme and an available simulator, then run the relevant tests. `sh scripts/prepare-reference-fixture.sh` prepares the separate file-provider fixture for access-in-place tests. `ruby scripts/add-ios-uitests.rb` can restore the test target after regeneration and requires the `xcodeproj` gem. BlurView's built-in test guard is enabled only in UI-test processes to avoid animation-idling stalls. Build outputs and screenshots belong in ignored `artifacts/`.

## Implementation references and assets

The [feature review](../docs/feature-adoption-review.md), [settings/scan notes](../docs/settings-and-scan-references.md), [metadata review](../docs/music-metadata-review.md), and [reference inventory](../docs/upstream-references.md) are currently in Chinese. They distinguish upstream research, implemented features, and planned work. Reference GPL/AGPL code was not copied; `music-metadata` is an actual MIT-licensed dependency.

Generated icons, turntable textures, and bundled placeholders retain provenance records beside their assets. Real embedded images take priority over the four default album covers and two neutral portraits. Defaults are shared packaged files, do not alter audio metadata, and are not presented as actual artist photographs. There is currently no manual placeholder-image picker or online artist-image service.

The project uses the root [MIT License](../LICENSE) and retains the [Expo starter notice](LICENSE).
