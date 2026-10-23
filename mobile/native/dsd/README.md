# DSF software playback

Android / Media3 1.9.1 and iOS / AVFoundation integration for expo-audio 58.0.9.
`patch-audio-equalizer.mjs` copies the maintained native sources into the audio module.
A new native build is required; Expo Go and older packages do not gain a decoder via JS updates.

## Implemented

- Sony DSF 1.01, uncompressed mono/stereo, 4096-byte channel blocks, both bit orders.
- DSD64/128/256/512 (2.8224/5.6448/11.2896/22.5792 MHz). The corresponding
  3.072/6.144/12.288/24.576 MHz family is also recognized.
- Settings → DSD mode → PCM: 44.1, 88.2, 176.4 (default), 352.8 kHz.
  One shared selection applies to DSD64, DSD128, DSD256 and DSD512.
  The 48 kHz DSD family maps these to 48, 96, 192, 384 kHz respectively.
- Float32 interleaved PCM through the existing Media3 sink or AVFoundation processing tap and EQ.
  These are decoder rates, **not a claim about the final DAC rate or bit-perfect output**.
- Range-based seeks, bounded block buffers, trimmed final padding, filter preroll,
  resource release on extractor/asset teardown. No full-track PCM cache or audio copy.
- Native capability gating in queues, queue restoration and UI; settings persistence
  and backup migration. Changing rate rebuilds the queue while retaining position,
  ordering and play/pause state.

DoP and Native are separate output transports and remain visibly unavailable.
No vendor-specific R4 DAC interface or USB exclusive transport is implemented.
DFF/DST, multichannel DSF and gapless DSD are not enabled.
The FIR pipeline has a small fixed group delay; it does not perform gapless delay
compensation. Actual R4 output routing, CPU consumption and 352.8 kHz acceptance
still require device testing.

## iOS streaming

`SovelDsfPcmStream` exposes a seekable virtual CAF stream to an `AVAssetResourceLoader`.
Local files use bounded positional reads; HTTP requests require exact 206 byte ranges,
reject ignored Range responses before the body, cap reads and refuse cross-origin redirects.
CAF supports large stream lengths; only block-sized input and at most 128 KB output buffers
are owned by this adapter. There is no decoded-file write or persistent audio cache.
Cancellation, final-block trimming and FIR preroll are handled natively. The regular
AVQueuePlayer retains queue, session, lock-screen and DSP behavior.

The iOS Release simulator build and DSF playback/restored-position UI check passed using
synthetic silence. Remote DSF playback, interrupted connections and physical-device output
still need integration validation. This is PCM software playback, not native DSD/DoP output.

## Reused decoder

`third_party/dsd2pcm/{dsd2pcm.c,dsd2pcm.h,LICENSE.txt}` are copied unchanged from
[clivem/dsd2pcm](https://github.com/clivem/dsd2pcm), commit
`6cfb3bad54c103a74f15f0399fa8f435ecc3592a`.
The core is Sebastian Gesemann's 96-tap DSD-to-float, 8:1 decimator, with Adrian
Smith's table-initialization additions. BSD-2-Clause notices are retained here and
distributed inside the app at Settings → About → Decoder licenses.

Sovel adds serialized table initialization, bounded channel processing, optional
cascaded 191-tap half-band FIR decimation, DSF extraction and JNI. Native DSD data
is never sent as ordinary PCM to simulate DoP.

## Checks

```sh
bash native/dsd/tests/run-native.sh
bash native/dsd/tests/run-stream.sh # macOS AudioToolbox
JAVA_HOME=/path/to/jdk17 bash native/dsd/tests/run-jvm.sh
bash native/dsd/tests/run-http.sh # requires tests/mock-network-sources.py
npm run check
npm run lint
```

Native tests use ASan/UBSan and exercise all input/output rates, channels, bit order,
reset, split buffers, seek preroll, silence, upper audible passband, ultrasonic
rejection and invalid buffers. JVM tests use the real Media3 extractor APIs with
Robolectric and a host JNI build, including final-block trimming, timestamps and
replay/seek equivalence. They do not substitute for APK installation or listening
on R4. The Gradle test harness downloads its Maven dependencies on its first run.

References: [Sony DSF specification](https://dsd-guide.com/sites/default/files/white-papers/DSFFileFormatSpec_E.pdf),
[Media3 customization](https://developer.android.com/media/media3/exoplayer/customization).

The virtual stream test checks 64 input-rate/output-rate/channel combinations with ASan/UBSan, byte-exact seek/preroll equivalence and Apple AudioFile CAF parsing. `scripts/prepare-dsf-ui-fixture.mjs` creates a simulator-only playback fixture; it is not included in APK assets.

The production Objective-C HTTP reader is additionally checked with authenticated Range reads, ignored Range responses and unauthorized responses; invalid responses are rejected before accepting audio bodies.
