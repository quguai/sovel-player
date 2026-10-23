#!/usr/bin/env bash
set -euo pipefail
dsd_root="$(cd "$(dirname "$0")/.." && pwd)"
test_build="$dsd_root/tests/build"
mkdir -p "$test_build"
cc -O2 -g -fsanitize=address,undefined -c "$dsd_root/third_party/dsd2pcm/dsd2pcm.c" -o "$test_build/dsd2pcm-http.o"
c++ -std=c++17 -O2 -g -fobjc-arc -fsanitize=address,undefined \
  "$dsd_root/SovelDsdDecoder.cpp" "$dsd_root/SovelDsfPcmStream.cpp" "$dsd_root/tests/http_test.mm" \
  "$test_build/dsd2pcm-http.o" -I"$dsd_root" -framework AVFoundation -framework Foundation -o "$test_build/http_test"
"$test_build/http_test" "${1:-http://127.0.0.1:18768}"
