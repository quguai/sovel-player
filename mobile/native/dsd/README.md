# DSF software playback

Android / Media3 1.9.1 integration for expo-audio 58.0.9. `patch-audio-equalizer.mjs`
copies the versioned sources into the Android audio module; npm install/start and
native builds already run that patch. A new native APK is required. Expo Go, older
APKs and iOS do not advertise this decoder capability.

## Implemented

- Sony DSF 1.01, uncompressed mono/stereo, 4096-byte channel blocks, both bit orders.
- DSD64/128/256/512 (2.8224/5.6448/11.2896/22.5792 MHz). The corresponding
  3.072/6.144/12.288/24.576 MHz family is also recognized.
- Settings → DSD mode → PCM: 44.1, 88.2, 176.4 (default), 352.8 kHz.
  One shared selection applies to DSD64, DSD128, DSD256 and DSD512.
  The 48 kHz DSD family maps these to 48, 96, 192, 384 kHz respectively.
- Float32 interleaved PCM through the existing Media3 sink and EQ.
  These are decoder rates, **not a claim about the final DAC rate or bit-perfect output**.
- Range-based seeks, bounded block buffers, trimmed final padding, filter preroll,
  resource release on extractor teardown. No full-track PCM cache or audio copy.
- Native capability gating in queues, queue restoration and UI; settings persistence
  and backup migration. Changing rate rebuilds the queue while retaining position,
  ordering and play/pause state.

DoP and Native are separate output transports and remain visibly unavailable.
No vendor-specific R4 DAC interface or USB exclusive transport is implemented.
DFF/DST, multichannel DSF, iOS DSD playback and gapless DSD are not enabled.
The FIR pipeline has a small fixed group delay; it does not perform gapless delay
compensation. Actual R4 output routing, CPU consumption and 352.8 kHz acceptance
still require device testing.

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
JAVA_HOME=/path/to/jdk17 bash native/dsd/tests/run-jvm.sh
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
