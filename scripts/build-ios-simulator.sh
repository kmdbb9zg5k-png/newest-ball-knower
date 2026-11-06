#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/native
git rev-parse HEAD > artifacts/native/commit.txt
xcodebuild -version | tee artifacts/native/xcode-version.txt
swift --version | tee artifacts/native/swift-version.txt
shasum -a 256 package-lock.json > artifacts/native/package-lock.sha256

# First compile the actual production web bundle and wrapper. No QA controller,
# service substitute, credential, provisioning profile or signing is involved.
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Release -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$PWD/artifacts/native/production" \
  CODE_SIGNING_ALLOWED=NO build 2>&1 | tee artifacts/native/production-build.log
python3 scripts/verify-ios-app.py \
  --app artifacts/native/production/Build/Products/Release-iphonesimulator/App.app \
  --output artifacts/native/production-app-manifest.json

# This separate generated app uses the same real native plugins and bridge.
# Its different bundle ID prevents mistaking a fixture for a release candidate.
BK_NATIVE_QA=1 node scripts/prepare-ios-native-qa.mjs
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$PWD/artifacts/native/qa" \
  CODE_SIGNING_ALLOWED=NO build-for-testing 2>&1 | tee artifacts/native/qa-build.log
python3 scripts/ios-simulator-qa.py
