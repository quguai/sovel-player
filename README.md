<p align="center"><img src="mobile/assets/icon.png" width="88" alt="Sovel HiFi icon" /></p>
<h1 align="center">Sovel HiFi</h1>
<p align="center">Your music. Your library. Your listening space.</p>
<p align="center"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>
<p align="center"><a href="https://sovel.quguai.cn">Official website</a></p>

Sovel HiFi is an open-source, cross-platform music player being built for local and remote libraries. It combines a charcoal-and-gold library, customizable vinyl visuals, and a dedicated lyrics view with a focus on the music you own.

**Development preview.** Local-library features are implemented, with playback and native EQ verified on the iOS simulator. Signed Android APK builds are verified in GitHub Actions; Android device playback and hardware behavior still need validation. Jellyfin/Emby adapters are implemented; real-server compatibility and dedicated HiFi output still need validation. The app UI currently uses Simplified Chinese; documentation is available in English and Chinese.

## A look inside

| Music library | Vinyl player | Synchronized lyrics |
| :---: | :---: | :---: |
| <img src="docs/images/library.png" width="240" alt="Dark music library with gold accents and album cards" /> | <img src="docs/images/vinyl.png" width="240" alt="Centered vinyl record with a slim tonearm" /> | <img src="docs/images/lyrics.png" width="240" alt="Dedicated lyrics view with the current line highlighted" /> |

Actual iOS simulator screenshots using the project's original listening samples. The browser demo is a separate design preview.

## Features in the current source

Source capabilities and released APKs can differ. The new Jellyfin / Emby integration needs a build from the current source until included in a release; check the selected release notes before downloading.

- **Bring your own files.** Index authorized files and folders in place. Copying audio into the app is a separate, explicit action.
- **Scan without rebuilding your library.** Discover files first, then import against a fixed total. Incremental and full scans preserve favorites and preferences, with filters for size, hidden files, and subfolders.
- **Connect your music servers.** Sign in to Jellyfin or Emby, select music libraries, sync their indexes and play original audio. Source cards control aggregation and priority; duplicate copies stay selectable.
- **Browse your collection.** Albums, songs, artists, folders, search, favorites, and independently remembered card/list views for albums and artists.
- **Make playback your own.** Cover, vinyl, and immersive views; nine record materials, two tonearms, cartridge colors, stylus lighting, and three rotation speeds. The About page adds a touch-responsive 3D brand card with a static reduced-motion alternative.
- **Read and adjust lyrics.** Separate lyrics and song-information pages, timestamp highlighting, tap-to-seek, and per-song timing adjustments.
- **Pick up where you left off.** Restore the queue, order, track, and position after restart, initially paused. Background playback, lock-screen controls, and a native sleep timer are included.
- **Shape the sound.** Native ten-band EQ, parametric EQ with AutoEQ text import, ReplayGain, presets, preamp control, and automatic headroom. iOS processing is verified; Android integration awaits validation.
- **Keep preferences local.** SQLite stores the library and listening history. Export settings and EQ presets to JSON and restore after a preview. Local discovery uses library tags, favorites, and listening history.

## Music sources

Open **设置 → 音乐来源** (Settings → Music sources). Search the LAN for **Jellyfin / Emby / DLNA**, or enter an address manually. Select a discovered server, sign in when required, and check the music libraries or folders to use. **SMB, WebDAV and OpenSubsonic** connections are also available. Reverse-proxy path prefixes are supported. Each selected library becomes a separate source you can enable and prioritize. Sources use compact two-column cards. Tap a card for connection details, aggregation controls, priority and sync. Tap **同步曲库** to discover the complete catalog first, then import metadata with a fixed-total progress indicator.

- **One collection, selectable versions.** Matching copies share a song row. Open the source/version selector to choose a copy and remember it, or restore automatic selection. Different Live, remastered and release editions are not merged by title alone.
- **Predictable defaults.** Among available, supported copies: remembered choice → lossless → local → source priority. Without per-song overrides, album playback prefers a complete album from one source.
- **Keep your collection.** Disabling a source retains its index and favorites. Upgrades migrate the existing database; do not delete it or rebuild it from scratch. SQLite pages and search indexes keep browsing separate from full metadata loading.
- **Index, then stream.** Remote sync currently enumerates the complete library in pages and updates metadata; it is not a server-side incremental change feed. Playback streams the original file, with no automatic transcoding, audio download or persistent stream cache. Native codec support still applies.
- **Local credentials and listening data.** Jellyfin/Emby access tokens and SMB/WebDAV/OpenSubsonic credentials use the system secure store, never SQLite or settings exports. DLNA does not require credentials. Server files are read-only; favorites and listening history are local, not synchronized back to the server.

| Connection | Discovery and access |
| --- | --- |
| Jellyfin / Emby | LAN UDP discovery or manual HTTP(S) address; sign in and select music libraries |
| DLNA / UPnP | SSDP discovery or device-description URL; select ContentDirectory folders; HTTP audio playback (not casting) |
| SMB | Manual `smb://host/Music` shared-folder URL, optional port/account/domain; read-only SMB2+ access |
| WebDAV | Manual HTTP(S) directory URL, optional Basic authentication; directory scanning and HTTP Range tag reads |
| OpenSubsonic | Manual server URL, account and password; music folders, album indexing and original streams |

Auto-discovery needs the same LAN, local-network permission and server discovery ports reachable; manual addresses remain available when routers or containers block broadcasts. iOS physical-device discovery also requires Apple's multicast entitlement in the signing profile. SMB/WebDAV scan rules apply before tag import; scanning first counts matching files, then reads embedded tags, lyrics and artwork against a fixed total. No audio copy is added to the library.

These connections are implemented in **development source**, not a promise about an older APK. Protocol contract tests and native Swift/Kotlin SMB2 and Range-read tests use local fixtures. iOS simulator integration uses test servers; physical NAS deployments and the complete Android app still need integration validation. See the [mobile guide](mobile/README.md#aggregated-libraries-and-media-servers) for limits and reproducible checks.

## Capability status

| Area | Current status |
| --- | --- |
| Local files and folders | Implemented; iOS access-in-place and restart recovery verified |
| WAV / FLAC | Metadata and iOS playback verified with development fixtures |
| DSF | Native DSD-to-PCM on Android and iOS; iOS simulator playback and restored seeking verified; physical output unverified |
| Other audio formats | Platform- and codec-dependent; no blanket compatibility claim |
| Ten-band EQ | Native integration on both platforms; iOS processing and presets verified |
| Background playback / sleep timer | Native implementation; iOS simulator checks passed; real-device checks remain |
| Jellyfin / Emby | Source selection, paged sync, aggregation and original-file streaming implemented; real-server validation pending |
| LAN discovery / SMB / WebDAV / DLNA / OpenSubsonic | Implemented in development source; local protocol/native tests; real-device/NAS checks remain |
| PEQ / AutoEQ / ReplayGain | Native DSP implemented; measured response and iOS simulator checks passed |
| Theme colors | Four dark presets and custom background/accent, saved and included in backups |
| USB exclusive output / DoP / native DSD | Planned; requires Android and DAC validation |
| Bit-perfect / guaranteed gapless playback | Not verified or promised by the current build |

File bit depth and sample rate describe the source, not the DAC output. Metadata parsing, decoding, and output capabilities are tracked separately. See the [mobile development guide](mobile/README.md) for details.

## Releases and updates

Download from the [website](https://sovel.quguai.cn/#download) or [GitHub Releases](https://github.com/quguai/sovel-player/releases). Choose **one** Android APK:

| Package suffix | Choose for |
| --- | --- |
| `arm64-v8a.apk` | Android systems supporting 64-bit ARM; use this smaller package when supported |
| `armeabi-v7a.apk` | 32-bit ARM Android systems, including some older HiFi players |
| `x86_64.apk` | Android x86_64 emulators and compatible Intel/AMD devices |
| `universal.apk` | All three supported ABIs; choose this if unsure |

Use the ABI supported by the Android **system**, not just the CPU hardware. Features are identical. Available files depend on the selected release; older releases may provide only universal. The website defaults to universal and remembers an explicit package choice. It prefers the latest stable release, or clearly labels the latest preview if no stable release exists. It never infers the ABI from the browser. iOS does not use APKs; build from source for now.

In the app, open **设置 → 版本更新** (Settings → Version updates). Stable checks exclude Beta/RC; select **测试版** to receive previews. ABI-aware Android builds automatically select a compatible package, show its architecture and size, verify the download and ask before installation. Existing older clients continue through universal; subsequent updates can use smaller packages after upgrading. No reinstall or manual architecture selection is needed for in-app updates.

Push a `vX.Y.Z` tag to build the signed Android packages and publish a GitHub Release. Beta/RC tags publish prereleases. Release signing secrets must be configured first; see the [release setup guide](docs/android-releases.md). Android device upgrade verification is still required before public distribution.

## Build the native app

Use a Node.js version supported by [mobile/package.json](mobile/package.json), such as 22.13+ on the 22.x line, and npm. iOS requires macOS, Xcode, and CocoaPods. Android requires JDK 21, the Android SDK, and a device or emulator.

```sh
git clone https://github.com/quguai/sovel-player.git
cd sovel-player/mobile
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

`npm start` runs Metro separately. Custom native modules require a native development build; **Expo Go is not sufficient**. Native projects are committed, so routine development does not require Prebuild. Installation and start scripts apply the maintained audio integrations automatically.

Open **设置 → 文件扫描** (Settings → File scanning) for local files, or **设置 → 音乐来源** (Settings → Music sources) for Jellyfin / Emby libraries. Development audio fixtures remain in `mobile/tests/fixtures` for tests; they are not included in the app or downloaded by it.

## Explore the browser demo

From the repository root:

```sh
npm run dev
```

Open [localhost:4786](http://localhost:4786). No dependency installation is needed for the preview. It listens on the local machine only; use `PORT=4787 npm run dev` to change the port.

The browser demo has its own state and does not share the native SQLite library. Demonstration tracks and quality labels are illustrative; native audio processing and hardware output are not represented by this preview.

## Product website

The bilingual product website lives in [`site/`](site). Run `npm run site:dev` to preview it, or `npm run site:build` to generate `dist/` for Cloudflare Pages. See the [website deployment guide](site/README.md) for hosting settings and live GitHub Stars/Release downloads.

## Development

| Component | Implementation |
| --- | --- |
| UI and application logic | React Native 0.88, React 19.3, TypeScript, Expo SDK 58 |
| Library and preferences | SQLite via `expo-sqlite` |
| Metadata | `music-metadata` with a random-access tokenizer |
| Playback | `expo-audio` 58.0.9, AVFoundation on iOS, Media3 on Android |
| Graphic EQ | Shared C++ DSP with platform-native integration |
| File access | Android SAF and an iOS security-scoped bookmark module |

```text
mobile/       React Native app, native projects, DSP, and tests
docs/         Implementation notes, reference reviews, and screenshots
design/       Icon and artwork explorations
previews/     Browser design-preview images
app.js        Browser interaction demo
styles.css    Browser demo styling
```

From `mobile/`:

```sh
npm run check    # TypeScript and core tests
npm run lint     # ESLint
```

Run the commands above for the current test count and diagnostics. Core coverage includes real SQLite migrations and paging, aggregation, source selection, and Jellyfin / Emby HTTP contracts. iOS simulator checks cover local listening and remote login, synchronization, version selection and playback against a mock server. Real media-server deployments, Android validation of the new integration and USB DAC output remain outstanding. Native test commands are in the [development guide](mobile/README.md).

Contributions are welcome. Include reproduction steps and device, OS, and audio-format details for playback issues. Native audio changes should include platform-specific validation. Reference checkouts belong in the ignored `repos/` directory and are not dependencies or submodules.

## Roadmap

- Expand real-NAS/server compatibility testing and network interruption recovery; evaluate additional source adapters separately.
- Validate Android playback, SAF/SD-card access, interruptions, and background behavior on real devices.
- Extend decoding and output for DSD and additional lossless formats, with explicit per-device capabilities.
- Develop and verify Android USB exclusive output and vendor-specific internal DAC paths.
- Add playback transitions, per-output preset memory, and additional app languages.

## Credits and license

Licensed under the [MIT License](LICENSE). Existing third-party notices, including the [Expo starter notice](mobile/LICENSE), are retained.

[NeriPlayer](https://github.com/cwuom/NeriPlayer), [MusicFree](https://github.com/maotoumao/MusicFree), and [Auxio](https://github.com/oxycblt/auxio) informed feature and behavior research; their GPL/AGPL implementation code was not copied into this project. [music-metadata](https://github.com/Borewit/music-metadata) is an actual dependency. See the [reference inventory](docs/upstream-references.md) and [feature review](docs/feature-adoption-review.md) (Chinese).

Generated icon, turntable, and placeholder assets include provenance records in [mobile/assets](mobile/assets). Listening samples are synthesized by this project. Browser concept photography comes from Unsplash: [ocean](https://images.unsplash.com/photo-1475924156734-496f6cac6ec1), [mountains](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b), [forest](https://images.unsplash.com/photo-1441974231531-c6227db76b6e), and [desert](https://images.unsplash.com/photo-1509316785289-025f5b846b35).
