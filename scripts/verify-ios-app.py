#!/usr/bin/env python3
"""Verify the built wrapper; optionally audit actual exported signing/profile."""

import argparse
import hashlib
import json
import plistlib
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def verify(app, signed=False):
    info = plistlib.loads((app / "Info.plist").read_bytes())
    config = json.loads((app / "capacitor.config.json").read_text())
    assert info["CFBundleIdentifier"] == "com.ballknower.ios", "Unexpected app bundle ID"
    assert config["appId"] == "com.ballknower.ios", "Unexpected Capacitor bundle ID"
    assert not config.get("server", {}).get("url"), "A release app must load the bundled web app"
    assert not config.get("server", {}).get("appStartPath"), "The native QA fixture cannot be a release candidate"
    assert config.get("plugins", {}).get("CapacitorHttp", {}).get("enabled") is True
    assert (app / "public/index.html").is_file(), "Production web bundle is missing"
    assert not (app / "public/__bk_native_qa.html").exists(), "QA fixture leaked into the candidate"
    assert info.get("NSCameraUsageDescription") and info.get("NSPhotoLibraryUsageDescription")
    assert any("ballknower" in item.get("CFBundleURLSchemes", []) for item in info.get("CFBundleURLTypes", []))
    classes = config.get("packageClassList", [])
    for plugin in ["NativeAuthSessionPlugin", "AppPlugin", "CAPBrowserPlugin", "PushNotificationsPlugin"]:
        assert plugin in classes, f"The actual app is missing the {plugin} bridge registration"
    binary = app / info["CFBundleExecutable"]
    assert binary.is_file(), "The compiled app executable is missing"
    result = {
        "bundleId": info["CFBundleIdentifier"], "version": info["CFBundleShortVersionString"],
        "buildNumber": info["CFBundleVersion"], "binarySHA256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "registeredPlugins": classes, "signed": signed,
    }
    if signed:
        subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
        raw = subprocess.check_output(["codesign", "-d", "--entitlements", ":-", str(app)], stderr=subprocess.DEVNULL)
        entitlements = plistlib.loads(raw)
        profile = plistlib.loads(subprocess.check_output(["security", "cms", "-D", "-i", str(app / "embedded.mobileprovision")]))
        profile_entitlements = profile["Entitlements"]
        assert profile["ExpirationDate"].replace(tzinfo=timezone.utc) > datetime.now(timezone.utc), "Signing profile has expired"
        assert entitlements.get("aps-environment") == "production", "App Store APNs must use production"
        assert profile_entitlements.get("aps-environment") == "production", "Profile lacks production APNs"
        assert entitlements.get("com.apple.developer.applesignin") == ["Default"], "Signed app lacks Sign in with Apple"
        assert profile_entitlements.get("com.apple.developer.applesignin") == ["Default"], "Profile lacks Sign in with Apple"
        assert entitlements.get("application-identifier", "").endswith(".com.ballknower.ios")
        assert entitlements.get("application-identifier") == profile_entitlements.get("application-identifier"), "Signed application does not match its provisioning profile"
        assert entitlements.get("get-task-allow", False) is False, "Development signing cannot pass the App Store gate"
        assert not profile.get("ProvisionedDevices"), "Ad-hoc/development profile cannot pass the App Store gate"
        result.update({"apnsEnvironment": "production", "signInWithApple": True,
                       "profileExpiration": profile["ExpirationDate"].isoformat(),
                       "teamIdentifier": profile.get("TeamIdentifier", [])})
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--signed", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = verify(args.app, args.signed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
