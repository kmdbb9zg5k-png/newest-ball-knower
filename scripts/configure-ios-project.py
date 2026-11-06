#!/usr/bin/env python3
"""Apply reproducible Ball Knower settings after `cap add/sync ios`.

The native directory is generated, so both CI and a local Xcode checkout must run
this script. It preserves unrelated settings and is safe to repeat. The optional
QA controller/resources are confined to an unsigned Debug Simulator build.
"""

import argparse
import json
import plistlib
import subprocess
from pathlib import Path


BUNDLE_ID = "com.ballknower.ios"
CAMERA_REASON = "Ball Knower uses the camera only when you choose to take a profile photo."
PHOTOS_REASON = "Ball Knower uses your photo library only when you choose a profile photo."
PUSH_HOOKS = """
    // Ball Knower: forward APNs registration to the Capacitor push plugin.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
"""


def read_project(path):
    try:
        return plistlib.loads(path.read_bytes())
    except plistlib.InvalidFileException:
        # Xcode's generated OpenStep plist can be read by Apple's own converter.
        data = subprocess.check_output(["plutil", "-convert", "xml1", "-o", "-", str(path)])
        return plistlib.loads(data)


def configure_project(project, qa=False):
    objects = project["objects"]
    targets = [(key, value) for key, value in objects.items()
               if value.get("isa") == "PBXNativeTarget" and value.get("name") == "App"]
    if len(targets) != 1:
        raise ValueError("Expected exactly one generated App target")
    target_id, target = targets[0]
    configs = objects[target["buildConfigurationList"]]["buildConfigurations"]
    for config_id in configs:
        config = objects[config_id]
        settings = config.setdefault("buildSettings", {})
        settings["PRODUCT_BUNDLE_IDENTIFIER"] = BUNDLE_ID + (".nativeqa" if qa else "")
        settings["CODE_SIGN_ENTITLEMENTS"] = "App/App.entitlements"
        # Debug uses the development service; Release must match the App Store profile.
        settings["APS_ENVIRONMENT"] = "development" if config["name"] == "Debug" else "production"
    attributes = objects[project["rootObject"]].setdefault("attributes", {})
    capabilities = attributes.setdefault("TargetAttributes", {}).setdefault(target_id, {}).setdefault("SystemCapabilities", {})
    capabilities["com.apple.Push"] = {"enabled": 1}
    capabilities["com.apple.SignInWithApple"] = {"enabled": 1}
    return project


def configure(root):
    app = root / "ios/App/App"
    project_path = root / "ios/App/App.xcodeproj/project.pbxproj"
    if not project_path.is_file():
        raise ValueError("Generate the iOS project with the locked Capacitor CLI first")
    info_path = app / "Info.plist"
    info = plistlib.loads(info_path.read_bytes())
    info["NSCameraUsageDescription"] = CAMERA_REASON
    info["NSPhotoLibraryUsageDescription"] = PHOTOS_REASON
    url_types = info.setdefault("CFBundleURLTypes", [])
    native_type = next((item for item in url_types if item.get("CFBundleURLName") == BUNDLE_ID), None)
    if native_type is None:
        native_type = {"CFBundleURLName": BUNDLE_ID, "CFBundleURLSchemes": []}
        url_types.append(native_type)
    schemes = native_type.setdefault("CFBundleURLSchemes", [])
    if "ballknower" not in schemes:
        schemes.append("ballknower")
    info_path.write_bytes(plistlib.dumps(info, sort_keys=False))

    entitlement_path = app / "App.entitlements"
    entitlements = plistlib.loads(entitlement_path.read_bytes()) if entitlement_path.exists() else {}
    entitlements["com.apple.developer.applesignin"] = ["Default"]
    entitlements["aps-environment"] = "$(APS_ENVIRONMENT)"
    entitlement_path.write_bytes(plistlib.dumps(entitlements, sort_keys=False))

    # These callbacks are required by @capacitor/push-notifications on iOS.
    delegate_path = app / "AppDelegate.swift"
    delegate = delegate_path.read_text()
    hooks = ["didRegisterForRemoteNotificationsWithDeviceToken", "didFailToRegisterForRemoteNotificationsWithError"]
    present = [hook in delegate for hook in hooks]
    if any(present) and not all(present):
        raise ValueError("AppDelegate has partial push hooks; review it before generating a candidate")
    if not any(present):
        insertion = delegate.rfind("}")
        if insertion < 0:
            raise ValueError("Generated AppDelegate class was not found")
        delegate = delegate[:insertion] + PUSH_HOOKS + delegate[insertion:]
        delegate_path.write_text(delegate)
    for notification in [".capacitorDidRegisterForRemoteNotifications", ".capacitorDidFailToRegisterForRemoteNotifications"]:
        if notification not in delegate:
            raise ValueError("AppDelegate push hook does not forward to Capacitor")

    project = configure_project(read_project(project_path))
    project_path.write_bytes(plistlib.dumps(project, sort_keys=False))
    print("Configured native URL scheme, photo permissions, Apple entitlement and profile-specific APNs entitlement.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    configure(args.root)
