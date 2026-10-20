#!/usr/bin/env bash
set -euo pipefail
: "${JAVA_HOME:?Set JAVA_HOME to JDK 17 or later}"
access_root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$(uname -s)" == Darwin ]]; then
  mkdir -p "$access_root/tests/ios/build"
  swiftc "$access_root/ios/SovelDirectoryReader.swift" "$access_root/tests/ios/main.swift" \
    -o "$access_root/tests/ios/build/directory-tests"
  "$access_root/tests/ios/build/directory-tests"
fi
bash "$access_root/../../android/gradlew" -p "$access_root/tests/android" test --console=plain
