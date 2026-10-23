#!/usr/bin/env bash
set -euo pipefail
dsd_root="$(cd "$(dirname "$0")/.." && pwd)"
test_build="$dsd_root/tests/build"
mkdir -p "$test_build"
cc -O2 -g -fsanitize=address,undefined -c "$dsd_root/third_party/dsd2pcm/dsd2pcm.c" -o "$test_build/dsd2pcm-stream.o"
c++ -std=c++17 -O2 -g -fsanitize=address,undefined \
  "$dsd_root/SovelDsdDecoder.cpp" "$dsd_root/SovelDsfPcmStream.cpp" "$dsd_root/tests/stream_test.cpp" \
  "$test_build/dsd2pcm-stream.o" -framework AudioToolbox -o "$test_build/stream_test"
"$test_build/stream_test"
