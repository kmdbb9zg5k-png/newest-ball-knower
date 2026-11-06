#!/usr/bin/env python3
"""Exercise setup against a generated-project fixture, including repeat runs."""
import importlib.util
import plistlib
import tempfile
import copy
import xml.etree.ElementTree as ET
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
        "project": {"isa": "PBXProject", "attributes": {}, "targets": ["target"], "mainGroup": "main-group", "productRefGroup": "products"},
        "main-group": {"isa": "PBXGroup", "children": []},
        "products": {"isa": "PBXGroup", "children": []},
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
    qa_spec = importlib.util.spec_from_file_location("configure_ios_qa", Path(__file__).with_name("configure-ios-native-qa.py"))
    qa_module = importlib.util.module_from_spec(qa_spec)
    qa_spec.loader.exec_module(qa_module)
    qa_project = plistlib.loads(project.read_bytes())
    target_id = qa_module.add_ui_test_target(qa_project)
    before = copy.deepcopy(qa_project)
    assert qa_module.add_ui_test_target(qa_project) == target_id and qa_project == before
    assert qa_project["objects"][target_id]["productType"] == "com.apple.product-type.bundle.ui-testing"
    scheme_path = root / "ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme"
    qa_module.configure_scheme(scheme_path, target_id, "target")
    before = scheme_path.read_bytes()
    qa_module.configure_scheme(scheme_path, target_id, "target")
    assert before == scheme_path.read_bytes(), "Repeated UI-test scheme setup changed the scheme"
    scheme = ET.parse(scheme_path)
    assert scheme.find("TestAction/Testables/TestableReference/BuildableReference").get("BlueprintIdentifier") == target_id
print("iOS project setup passed: repeatability, preserved settings, permissions, URL types, capabilities and profile-specific APNs.")
print("Native QA UI-test target and shared scheme passed: fixture-only product, references and repeatability.")


# A newly selected workflow can start at BUILD_NUMBER=1 after the app already
# has many store builds. Versioning and exported-IPA verification must share the
# project counter, and missing project data must never fall back to that reset.
from ios_build_number import ios_build_number, verify_ios_build_number

for project_number, workflow_number in [("42", "1"), ("103", "17")]:
    environment = {"PROJECT_BUILD_NUMBER": project_number, "BUILD_NUMBER": workflow_number}
    assert ios_build_number(environment) == project_number
    assert verify_ios_build_number(project_number, environment) == project_number
    try:
        verify_ios_build_number(workflow_number, environment)
        raise AssertionError("An IPA using the restarted workflow counter was accepted")
    except ValueError as error:
        assert "PROJECT_BUILD_NUMBER" in str(error)

for environment in [{"BUILD_NUMBER": "99"}] + [
    {"PROJECT_BUILD_NUMBER": value, "BUILD_NUMBER": "99"}
    for value in [None, "", "0", "-1", "1.0", "01", " 7", "7 ", "abc", "１２"]
]:
    try:
        ios_build_number(environment)
        raise AssertionError("Missing or invalid project counter was accepted")
    except ValueError as error:
        assert "PROJECT_BUILD_NUMBER" in str(error)

print("iOS build numbering passed: shared project counter, restarted workflow, mismatched IPA and missing/invalid counter.")
