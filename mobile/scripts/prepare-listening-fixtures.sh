#!/bin/sh
# Development only: seed an installed iOS simulator app, never its bundle.
set -eu
cd "$(dirname "$0")/.."
fixture_container="$(xcrun simctl get_app_container booted cn.quguai.music.sovel data)"
mkdir -p "$fixture_container/Documents/Music"
cp tests/fixtures/sample.wav "$fixture_container/Documents/Music/Sovel - 初见.wav"
cp tests/fixtures/sample.flac "$fixture_container/Documents/Music/Sovel - 微光.flac"
echo 'Test audio copied to simulator Documents/Music. Run an incremental scan in the app.'
