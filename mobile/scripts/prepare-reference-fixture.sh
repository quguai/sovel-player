#!/bin/sh
# Simulator-only file-provider fixture. No network or commercial music required.
set -eu
cd "$(dirname "$0")/.."
mkdir -p artifacts/ReferenceLibrary.app
cat > artifacts/ReferenceLibrary.swift <<'SWIFT'
import UIKit
@main class App: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = UIViewController()
    window?.makeKeyAndVisible()
    return true
  }
}
SWIFT
python3 - <<'PY'
import plistlib
from pathlib import Path
info = dict(CFBundleIdentifier='cn.quguai.music.sovel.referencefixture',CFBundleExecutable='ReferenceLibrary',CFBundleName='ReferenceLibrary',CFBundleDisplayName='Sovel Test Library',CFBundlePackageType='APPL',CFBundleVersion='1',CFBundleShortVersionString='1.0',MinimumOSVersion='16.4',LSRequiresIPhoneOS=True,UIFileSharingEnabled=True,LSSupportsOpeningDocumentsInPlace=True)
Path('artifacts/ReferenceLibrary.app/Info.plist').write_bytes(plistlib.dumps(info))
PY
xcrun swiftc -parse-as-library -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -target arm64-apple-ios16.4-simulator artifacts/ReferenceLibrary.swift -o artifacts/ReferenceLibrary.app/ReferenceLibrary
codesign --force --sign - artifacts/ReferenceLibrary.app > /dev/null 2>&1
xcrun simctl install booted artifacts/ReferenceLibrary.app
xcrun simctl launch booted cn.quguai.music.sovel.referencefixture
fixture_container="$(xcrun simctl get_app_container booted cn.quguai.music.sovel.referencefixture data)"
python3 - "$fixture_container" <<'PY'
import wave, math, struct, sys
from pathlib import Path
folder=Path(sys.argv[1])/'Documents'/'External Music'; folder.mkdir(parents=True,exist_ok=True)
with wave.open(str(folder/'Reference.wav'),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(44100)
    f.writeframes(b''.join(struct.pack('<h',int(math.sin(i*math.tau*220/44100)*1500)) for i in range(44100*60)))
print('Created 60-second original external WAV fixture.')
PY
