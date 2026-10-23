# Sovel HiFi · Mobile

**English** · [简体中文](README.zh-CN.md) · [Project overview](../README.md)

React Native and TypeScript implementation of Sovel HiFi. This directory contains the application, committed iOS/Android projects, native audio extensions, and tests. The browser demo at the repository root is a separate visual reference.

This guide describes the current source. New Jellyfin / Emby integration requires a native build until included in a release; consult that release's notes for APK availability. iOS simulator integration uses a mock server. Real Jellyfin / Emby deployments and Android validation for this integration remain outstanding.

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
| SQLite file | `sovel.db`, schema version 5 |

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
- Moves/renames currently create new path identities; previous records remain missing. Overlapping sources retain independent file copies; confident matches are aggregated into one visible song without duplicating audio.
- Offline storage, revoked permissions, and removed files retain index/favorite records. Reconnect and rescan; select the source again if its grant has expired.
- **复制音乐到应用** is an explicit optional copy action. iOS exposes this directory in Files → Sovel HiFi → Music.
- Cloud file providers may download/cache files themselves. File scanning uses local random access; Jellyfin/Emby have separate paged API adapters and stream original audio without copying it into the app.

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

## PEQ, AutoEQ and ReplayGain

Settings → **PEQ / AutoEQ** supports up to ten peak, low-shelf and high-shelf filters (PK / LSC / HSC), 10–24,000 Hz, ±24 dB and Q 0.1–20. Import local Equalizer APO / AutoEq parametric TXT files or paste parameters. Unsupported filter syntax and out-of-range values are rejected. Imports replace the current PEQ; no headphone profiles are downloaded automatically. Graphic EQ and PEQ stack in the native DSP; headroom estimates their combined response.

Settings → **高级设置** offers off/track/album ReplayGain, ±12 dB preamp and tag-peak protection. Album mode falls back to track tags; missing tags preserve original gain. Existing files need a full tag rescan to populate these fields. Local files and SMB/WebDAV file-tag scans provide the tags; server catalogs without ReplayGain data stay unnormalized. Native queue bindings apply gains without JS timers, including background transitions; iOS prebuffered items own independent gains. Peak protection uses stored peaks, not a true-peak limiter. Presets and settings migrate into older v1 backups without touching music or favorites.

Per-output/device preset memory is not implemented. NeriPlayer informed preset/state behavior; its implementation or full effect presets were not copied. The DSP uses published W3C equations, and AutoEq is a text-format reference.

## Custom theme colors

Settings → **样式管理** provides black/gold, deep sea, pine and dusk presets. Custom six-digit hex background/accent colors have dark-background and contrast validation, apply immediately after saving, survive restarts and are included in settings backups. The cover-derived player background stays independent; light/image themes are not included.

The About page uses `src/ui/AboutBrandCard.tsx`: bounded touch-driven tilt, layered parallax, a moving sheen and a spring return. It observes touch events without taking over vertical scrolling, respects reduced motion and has no idle animation or motion-sensor dependency. Version and license information remain outside the decorative card.

## Listening history and local discovery

SQLite's `listening_history` stores actual listening time, unique audio coverage, seek counts, and end reasons. Native monotonic sampling excludes pauses/buffering; seeking changes the sampling anchor. Repeating a segment adds listening time without double-counting completion. Unknown duration remains unknown.

Native snapshots are saved about every five seconds and on pause/track changes. JS ingests bounded batches, then acknowledges revisions, avoiding duplicate counting. A crash can lose the most recent uncheckpointed interval. History survives rescans and can be paged under Settings → **听歌记录与偏好**; it is not uploaded by the app.

Daily mixes are stable for the local day and contain up to 30 playable tracks. Related local songs combine tags, artist/album relationships, favorites, and the last 90 days of listening evidence, with stronger weight on the last 30 days. This is local rule-based ranking, not online recommendations or audio-content analysis. The complete history is retained beyond that ranking window.

## Format and output boundaries

WAV/FLAC metadata and iOS playback have been verified with the samples. DSF ID3 tags, artwork, and lyrics parsing are tested. MP3, AAC, ALAC, AIFF, Ogg, Opus, and other playback formats remain platform/codec-dependent. Android integrates DSF-to-float-PCM decoding; playback is enabled only in native builds containing that decoder, with mono/stereo and selectable PCM rates. Physical-device playback and output remain unverified. iOS uses a bounded, seekable virtual CAF stream backed by the same decoder; simulator playback and restored-position checks passed. It does not write a decoded copy to disk. HTTP sources must honor exact Range requests; remote DSF and physical-device compatibility need further validation. DFF/APE/WavPack can be indexed but remain blocked from playback. Neither TagLib nor an FFmpeg playback backend is integrated.

Jellyfin / Emby catalog sync and original-file streaming are implemented in development source; real-server and Android integration validation remain open. USB exclusive output, DoP/native DSD, vendor-specific internal DAC support, bit-perfect detection, guaranteed gapless playback, crossfade, theme images/light themes, and additional app languages remain unimplemented. USB DAC connections currently use system audio. Long background sessions, interruptions, Bluetooth, and physical outputs need real-device validation.

## Validation

```sh
npm run check
npm run lint
npm run test:dsd:stream # macOS: virtual CAF, seek and Apple AudioFile validation
```

Run the commands above for the current test count, TypeScript diagnostics and ESLint warnings. Tests use real SQLite and WAV/FLAC/DSF metadata fixtures; they cover scanning, cancellation/offline behavior, source identity, schema upgrades, history, queue restoration, backups, lyrics offsets, discovery, and placeholders.

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


## Aggregated libraries and media servers

Open **设置 → 音乐来源**. Use LAN discovery for Jellyfin/Emby/DLNA, or enter a manual address for any supported adapter (Jellyfin, Emby, DLNA, SMB, WebDAV, OpenSubsonic). Authenticate when needed, then select music libraries or directories. HTTP reverse-proxy prefixes are retained. Each selected library becomes an independently enabled, prioritized source. Compact two-column cards show the name, type, track count and status; tap a card for its address, sync controls, aggregation toggle, priority and reconnection. Use **同步曲库** to discover the complete server listing, then import against a fixed count. Server audio and tags are read-only. This first adapter uses a complete paged inventory and metadata upserts; it does not claim a server-side change feed.

- `tracks`, physical IDs, `favorites`, lyric offsets, history and saved queues remain intact. Schema 5 adds `catalog_copies`, source options, version preferences and an on-disk synchronization staging table. Backfill runs in bounded batches and can resume after interruption. Do not delete `sovel.db` when upgrading.
- Album/song/artist/folder browsing uses SQLite pages. Lists use lightweight summaries; full local lyrics/tags are loaded for the current track. FTS5 trigram search accelerates long substrings when available; short Chinese searches and older SQLite builds use a literal substring fallback.
- Older cached local tags may not contain release identifiers/year. A full local scan reads the new fields while preserving existing IDs and favorites.
- Aggregation uses recording/release identifiers where available, otherwise conservative album/artist/title/disc/track/duration keys. Unknown tags remain separate. Live/remastered/different editions are not merged by title alone. Manual merge/split editing is not part of this iteration.
- Playback selection favors available and supported copies, remembered user choice, lossless files, local files, then source priority. A complete album from one source is preferred when there are no per-song overrides. Unsupported DSD does not win merely because it has larger technical parameters.
- Disabling a source retains its index, favorites and credentials; it removes that source from aggregate browsing and future queue candidates. Library filter chips change only the current view. Re-enable to show the saved index again.
- Jellyfin/Emby tokens and SMB/WebDAV/OpenSubsonic credentials use `expo-secure-store` (iOS Keychain / Android encrypted storage). Passwords for those latter protocols are required for reconnecting and remain in secure storage; SQLite and settings backups contain no credentials. SQLite stores server/user/library identities. Auth headers are supplied to native playback; authenticated artwork URLs exist only in memory. New native builds are required for SecureStore. Proper iOS signing entitlements are required; an unsigned simulator binary cannot access Keychain.
- Both adapters request original-file streaming (`Static=true`). There is no automatic server transcoding in this iteration. Native codec/DSF support still determines whether playback succeeds. Jellyfin lyrics load on demand when the server exposes its lyrics API; Emby lyrics are not yet integrated.
- Offline/failed/cancelled inventories never mark old tracks missing. Import cancellation rolls back the source update; successful syncs retain missing entries instead of deleting favorites. A fixed page count changing during discovery causes a safe retry.
- All six adapters share source selection, priority and aggregation. Remote writes, cross-server favorite synchronization, audio downloads and a persistent stream cache are not implemented.

For a **mock server**, not a real Jellyfin/Emby deployment, run `python3 tests/mock-media-server.py` on the host. The optional `SovelUITests.testMusicSourcesAndRemotePlayback` integration test uses this loopback server and development WAV fixtures to exercise native login, sync, aggregation, source toggles and playback. It skips when the server is absent. The server and development audio are not packaged in release APKs.


### Network adapters and discovery

- **LAN discovery:** Jellyfin/Emby UDP probes on port 7359 and DLNA SSDP M-SEARCH on 1900. Search is user initiated, bounded and cancellable; it does not enumerate every IP. Select a result to fill its address, then authenticate and select libraries. Manual entry is always available. The phone and server must share a reachable LAN; multicast/broadcast filtering, VPNs and container networking can prevent discovery.
- **iOS:** allow Local Network access. The app declares `com.apple.developer.networking.multicast`; physical-device distribution requires Apple's entitlement approval and a matching provisioning profile. This is separate from simulator testing. Without a usable discovery entitlement, enter an HTTP(S) address manually. Native changes require rebuilding the application, not an Expo Go reload.
- **SMB:** enter `smb://host/Music` (or `smb://host:port/Music/subfolder`). Choose the share root or its listed subfolders; nested folders follow the scan rule. Accounts can be blank for guest access; domain accounts use `DOMAIN\user`. The iOS library negotiates SMB 2.0.2/2.1; Android uses SMBJ's supported SMB2/3 dialects. SMB1 and shares requiring SMB3-only encryption are not a cross-platform compatibility promise. No share writes are exposed. A per-run secret loopback HTTP proxy serves byte ranges from the original SMB file to native playback; it does not materialize a full audio copy. Connections open lazily for sync/playback so an offline NAS cannot delay local-library startup.
- **WebDAV:** enter the directory's full HTTP(S) URL, optionally with Basic-auth credentials in the separate fields. PROPFIND Depth 1 enumerates directories; the app traverses within selected roots. HTTP Range support is required for tag parsing. Native readers reject a full response before accepting its audio body and cap each read. Digest/OAuth login and automatic redirect authentication are not implemented.
- **Folder scanning:** SMB/WebDAV honor hidden-folder, recursion and minimum-size rules from File scanning. Phase 1 inventories matching files; phase 2 parses embedded tags, cover/artist images and lyrics using ranged reads. Only artwork is cached. Root and child-folder choices are mutually exclusive to avoid overlapping imports. A broken/cancelled scan retains the prior index and favorites.
- **DLNA:** discover a MediaServer or enter its device-description XML URL. ContentDirectory Browse supplies music metadata and HTTP resources, including paged child directories. It uses the server's published metadata and does not write tags or guarantee that a published resource is untranscoded. This is library browsing/reading, not a DLNA renderer, casting controller or AirPlay implementation.
- **OpenSubsonic:** enter the server base URL and account, then select music folders. Catalog import pages albums and their songs; streaming requests `format=raw`. Authentication uses a random per-session salt and token; authenticated stream/cover URLs remain in memory. Compatibility with servers lacking these album/folder endpoints, transcoding-only servers and remote lyrics APIs needs separate work.
- **Transactional imports:** full inventories and parsed tags are staged before replacing the source snapshot. Existing local files, favorites, queue IDs and schema-5 indexes are retained. No destructive database rebuild is needed. A network source is read-only; server-side writes, password exports, full-audio downloads and persistent audio caching are absent.

Reproducible development checks (local fixtures, not real-NAS certification):

```bash
# Run from mobile/. Python dependencies are for testing only; do not package them.
python3 -m venv artifacts/network-test-env
artifacts/network-test-env/bin/pip install impacket
artifacts/network-test-env/bin/python tests/mock-network-sources.py
# In another terminal:
swift test --package-path modules/sovel-network
JAVA_HOME=/path/to/jdk17 ./android/gradlew -p modules/sovel-network/tests/jvm test
# iOS simulator, after starting tests/mock-media-server.py as well:
# SovelUITests.testNetworkSourcesDiscoveryAndPlayback
```

The Swift checks exercise UDP discovery, real SMB2 authentication/listing/range reads and the loopback proxy, plus bounded WebDAV HTTP reads. The JVM checks compile the real SMBJ/NanoHTTPD adapters and exercise the same SMB2 and HTTP range paths; they are **not** a complete Android APK/device test. The iOS UI test covers discovery/manual entry, folder/library selection, synchronization, native playback and retained source selections using local fixtures. Physical NASes, signed iOS multicast discovery and Android device playback remain explicit validation targets. Native dependency/license details are in [network sources](../docs/network-sources.md).
