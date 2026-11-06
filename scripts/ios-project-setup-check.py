#!/usr/bin/env python3
"""Exercise setup against a generated-project fixture, including repeat runs."""
import importlib.util
import plistlib
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("configure_ios", Path(__file__).with_name("configure-ios-project.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    app = root / "ios/App/App"
    project = root / "ios/App/App.xcodeproj/project.pbxproj"
    app.mkdir(parents=True)
    project.parent.mkdir()
    fixture = {"rootObject": "project", "objects": {
        "project": {"isa": "PBXProject", "attributes": {}},
        "target": {"isa": "PBXNativeTarget", "name": "App", "buildConfigurationList": "configs"},
        "configs": {"buildConfigurations": ["debug", "release"]},
        "debug": {"name": "Debug", "buildSettings": {"PRESERVE_ME": "yes"}},
        "release": {"name": "Release", "buildSettings": {}},
    }}
    project.write_bytes(plistlib.dumps(fixture))
    (app / "Info.plist").write_bytes(plistlib.dumps({"CFBundleURLTypes": [{"CFBundleURLName": "other", "CFBundleURLSchemes": ["preserved"]}]}))
    (app / "AppDelegate.swift").write_text("import UIKit\nimport Capacitor\nclass AppDelegate: UIResponder, UIApplicationDelegate {\n}\n")
    module.configure(root)
    paths = [project, app / "Info.plist", app / "App.entitlements", app / "AppDelegate.swift"]
    before = [path.read_bytes() for path in paths]
    module.configure(root)
    assert before == [path.read_bytes() for path in paths], "Repeated native setup changed the generated app"
    result = plistlib.loads(project.read_bytes())["objects"]
    assert result["debug"]["buildSettings"]["APS_ENVIRONMENT"] == "development"
    assert result["release"]["buildSettings"]["APS_ENVIRONMENT"] == "production"
    assert result["debug"]["buildSettings"]["PRESERVE_ME"] == "yes"
    assert "com.apple.Push" in result["project"]["attributes"]["TargetAttributes"]["target"]["SystemCapabilities"]
    assert plistlib.loads((app / "Info.plist").read_bytes())["CFBundleURLTypes"][0]["CFBundleURLSchemes"] == ["preserved"]
    (app / "AppDelegate.swift").write_text("class AppDelegate { func didRegisterForRemoteNotificationsWithDeviceToken() {} }")
    try:
        module.configure(root)
        raise AssertionError("Partial APNs forwarding must fail before a candidate is built")
    except ValueError as error:
        assert "partial push hooks" in str(error)
print("iOS project setup passed: repeatability, preserved settings, permissions, URL types, capabilities and profile-specific APNs.")
