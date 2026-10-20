#!/usr/bin/env bash
set -euo pipefail
: "${JAVA_HOME:?Set JAVA_HOME to JDK 17 or later}"
dsd_root="$(cd "$(dirname "$0")/.." && pwd)"
test_build="$dsd_root/tests/jvm/build/native"
mkdir -p "$test_build"
case "$(uname -s)" in
  Darwin) jni_platform=darwin; suffix=dylib; shared=-dynamiclib ;;
  Linux) jni_platform=linux; suffix=so; shared=-shared ;;
  *) echo "Host JNI tests support macOS/Linux"; exit 1 ;;
esac
cc -O2 -fPIC -c "$dsd_root/third_party/dsd2pcm/dsd2pcm.c" -o "$test_build/dsd2pcm.o"
c++ -std=c++17 -O2 -fPIC "$shared" -I"$JAVA_HOME/include" -I"$JAVA_HOME/include/$jni_platform" \
  "$dsd_root/SovelDsdDecoder.cpp" "$dsd_root/android/sovel_dsd_jni.cpp" \
  "$test_build/dsd2pcm.o" -o "$test_build/libsovel_equalizer.$suffix"
bash "$dsd_root/../../android/gradlew" -p "$dsd_root/tests/jvm" test --console=plain
