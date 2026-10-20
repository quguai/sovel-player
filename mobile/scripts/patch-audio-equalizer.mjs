import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const audio = resolve(root, "node_modules/expo-audio");
const version = JSON.parse(
  readFileSync(resolve(audio, "package.json"), "utf8"),
).version;
if (version !== "58.0.9")
  throw new Error(
    `Sovel EQ patch needs reviewed expo-audio 58.0.9; found ${version}`,
  );
function patch(file, before, after) {
  const path = resolve(audio, file),
    source = readFileSync(path, "utf8");
  if (source.includes(after)) return;
  if (source.split(before).length !== 2)
    throw new Error(`EQ patch anchor changed: ${file}`);
  writeFileSync(path, source.replace(before, after));
}
function copy(source, target) {
  const path = resolve(audio, target);
  mkdirSync(dirname(path), { recursive: true });
  copyFileSync(resolve(root, "native/equalizer", source), path);
}
for (const file of ["SovelEqualizerDSP.h", "SovelEqualizerDSP.cpp"]) {
  copy(file, `ios/${file}`);
  copy(file, `android/src/main/cpp/sovel/${file}`);
}
for (const file of ["SovelEqualizer.h", "SovelEqualizer.mm"])
  copy(`ios/${file}`, `ios/${file}`);
copy(
  "android/SovelEqualizer.kt",
  "android/src/main/java/expo/modules/audio/SovelEqualizer.kt",
);
for (const file of ["CMakeLists.txt", "sovel_equalizer_jni.cpp"])
  copy(`android/${file}`, `android/src/main/cpp/sovel/${file}`);
for (const file of [
  "SovelDsdDecoder.cpp",
  "SovelDsdDecoder.h",
  "android/sovel_dsd_jni.cpp",
  "third_party/dsd2pcm/dsd2pcm.c",
  "third_party/dsd2pcm/dsd2pcm.h",
  "third_party/dsd2pcm/LICENSE.txt",
]) {
  const target = resolve(audio, "android/src/main/cpp/sovel/dsd", file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(root, "native/dsd", file), target);
}
for (const file of ["SovelDsfHeader.kt", "SovelDsfExtractor.kt"])
  copyFileSync(
    resolve(root, "native/dsd/android", file),
    resolve(audio, "android/src/main/java/expo/modules/audio", file),
  );
patch(
  "android/src/main/java/expo/modules/audio/AudioPlaylist.kt",
  "DefaultMediaSourceFactory(context).setDataSourceFactory(dataSourceFactory)",
  "DefaultMediaSourceFactory(context, SovelExtractorsFactory()).setDataSourceFactory(dataSourceFactory)",
);
patch(
  "android/src/main/java/expo/modules/audio/AudioModule.kt",
  "ProgressiveMediaSource.Factory(factory)",
  "ProgressiveMediaSource.Factory(factory, SovelExtractorsFactory())",
);
patch(
  "android/src/main/java/expo/modules/audio/AudioPlaylist.kt",
  '      "trackCount" to trackCount,',
  `      "trackCount" to trackCount,
      "sovelError" to (ref.playerError?.cause?.message ?: ref.playerError?.message),`,
);
patch(
  "ios/AudioModule.swift",
  '    Name("ExpoAudio")',
  `    Name("ExpoAudio")
    // Sovel streaming EQ; native implementation is versioned in mobile/native.
    Function("configureSovelEqualizer") { (enabled: Bool, gains: [Double], preamp: Double, headroom: Bool) in
      SovelEqualizer.configure(enabled, gains: gains.map { NSNumber(value: $0) }, preamp: preamp, headroom: headroom)
    }
    Function("getSovelEqualizerStatus") { SovelEqualizer.status() }
`,
);
patch(
  "ios/AudioUtils.swift",
  "    return AVPlayerItem(asset: asset, automaticallyLoadedAssetKeys: [.tracks, .duration])",
  `    let item = AVPlayerItem(asset: asset, automaticallyLoadedAssetKeys: [.tracks, .duration])
    SovelEqualizer.attach(to: item)
    return item`,
);
patch(
  "ios/ExpoAudio.podspec",
  's.source_files = "**/*.{h,m,swift}"',
  `s.source_files = "**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "**/SovelEqualizerDSP.h"
  s.libraries = 'c++'
  s.frameworks = 'MediaToolbox'`,
);
patch(
  "ios/ExpoAudio.podspec",
  "'DEFINES_MODULE' => 'YES',",
  "'DEFINES_MODULE' => 'YES', 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',",
);
patch(
  "android/src/main/java/expo/modules/audio/AudioModule.kt",
  '    Name("ExpoAudio")',
  `    Name("ExpoAudio")
    // Sovel streaming EQ, shared by this application's players and playlists.
    Function("configureSovelEqualizer") { enabled: Boolean, gains: List<Double>, preamp: Double, headroom: Boolean ->
      check(SovelEqualizer.available) { "Sovel equalizer native library is unavailable" }
      SovelEqualizer.configure(enabled, gains.toDoubleArray(), preamp, headroom)
    }
    Function("getSovelEqualizerStatus") { SovelEqualizer.status() }
`,
);
for (const file of ["AudioPlaylist.kt", "AudioPlayer.kt"]) {
  patch(
    `android/src/main/java/expo/modules/audio/${file}`,
    "ExoPlayer.Builder(context)",
    "ExoPlayer.Builder(context, SovelEqualizerRenderers(context).setEnableAudioFloatOutput(true))",
  );
}
patch(
  "android/src/main/java/expo/modules/audio/AudioModule.kt",
  "    OnCreate {",
  `    Function("getSovelDsfSupport") { SovelDsfDecoder.available }
    Function("configureSovelDsf") { pcmRate: Int -> SovelDsfDecoder.configure(pcmRate) }

    OnCreate {`,
);
patch(
  "android/build.gradle",
  '  namespace "expo.modules.audio"',
  `  namespace "expo.modules.audio"
  externalNativeBuild { cmake { path 'src/main/cpp/sovel/CMakeLists.txt' } }
`,
);
console.log("Sovel native EQ integration applied to expo-audio 58.0.9");
