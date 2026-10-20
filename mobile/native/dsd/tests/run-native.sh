#!/usr/bin/env bash
set -euo pipefail
dsd_root="$(cd "$(dirname "$0")/.." && pwd)"
test_build="$dsd_root/tests/build"
mkdir -p "$test_build"
# Address/undefined sanitizers cover block boundaries, reset and malformed buffers.
cc -O2 -g -fsanitize=address,undefined -c "$dsd_root/third_party/dsd2pcm/dsd2pcm.c" -o "$test_build/dsd2pcm.o"
c++ -std=c++17 -O2 -g -fsanitize=address,undefined \
  "$dsd_root/SovelDsdDecoder.cpp" "$dsd_root/tests/decoder_test.cpp" \
  "$test_build/dsd2pcm.o" -o "$test_build/decoder_test"
"$test_build/decoder_test"
