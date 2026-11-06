#!/usr/bin/env python3
"""Install the isolated native QA app and exercise real iOS URL delivery."""

import json
import shutil
import subprocess
import time
from pathlib import Path

ARTIFACTS = Path("artifacts/native")
BUNDLE = "com.ballknower.ios.nativeqa"


def run(*args, **options):
    return subprocess.run(args, check=True, text=True, **options)


def output(*args):
    return subprocess.check_output(args, text=True).strip()


def run_native_ui_test(device_id):
    # One UI-test session owns launch and both URL deliveries, so deployment does
    # not reinstall/replace the app while an external URL is waiting for consent.
    with (ARTIFACTS / "native-url-ui-test.log").open("w") as log:
        run("xcodebuild", "test-without-building", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
            "-configuration", "Debug", "-destination", f"id={device_id}",
            "-parallel-testing-enabled", "NO",
            "-derivedDataPath", str(ARTIFACTS / "qa"),
            "-resultBundlePath", str(ARTIFACTS / "native-url-ui-test.xcresult"),
            "-only-testing:NativeUITests/NativeURLConsentTests/testWarmAndColdCallbacks",
            "CODE_SIGNING_ALLOWED=NO", stdout=log, stderr=subprocess.STDOUT)
    print("Native UI test completed initial launch and warm/cold URL delivery.", flush=True)


def wait_report(path, predicate, name):
    deadline = time.monotonic() + 60
    report = None
    previous_progress = None
    while time.monotonic() < deadline:
        try:
            report = json.loads(path.read_text())
            if report.get("fatalError"):
                raise AssertionError(f"Native QA JavaScript failed: {report['fatalError']}")
            progress = (report.get("ready"), len(report.get("results", [])), len(report.get("callbacks", [])), report.get("failedAuthCallbacks", 0))
            if progress != previous_progress:
                print(json.dumps({"phase": name, "ready": progress[0], "completedChecks": progress[1], "callbacks": progress[2], "rejectedAuthCallbacks": progress[3]}), flush=True)
                previous_progress = progress
            if report.get("ready") and predicate(report):
                failures = [item for item in report["results"] if not item["passed"]]
                if failures:
                    raise AssertionError(f"Native bridge checks failed: {failures}")
                if report.get("platform") != "ios" or not report.get("native"):
                    raise AssertionError("The fixture did not run in a native iOS WKWebView")
                if report.get("exchanges") != 0:
                    raise AssertionError("Token-only callback attempted an authorization-code exchange")
                if report.get("cameraAuthorization") != 0 or report.get("photosAuthorization") != 0:
                    raise AssertionError("Photo permissions changed without a user action")
                shutil.copyfile(path, ARTIFACTS / f"{name}.json")
                return report
        except (OSError, json.JSONDecodeError):
            pass
        time.sleep(1)
    raise AssertionError(f"Timed out waiting for {name}; last sanitized report: {report}")


def main():
    devices = json.loads(output("xcrun", "simctl", "list", "devices", "available", "--json"))["devices"]
    choices = [(runtime, device) for runtime, items in devices.items() if ".iOS-" in runtime
               for device in items if device["name"].startswith("iPhone") and device.get("isAvailable")]
    if not choices:
        raise RuntimeError("This Xcode image has no available iPhone Simulator runtime")
    runtime, template = sorted(choices, key=lambda item: [int(v) for v in item[0].split(".iOS-")[1].split("-")])[-1]
    device_id = output("xcrun", "simctl", "create", "Ball Knower native QA", template.get("deviceTypeIdentifier", template["name"]), runtime)
    data = None
    try:
        run("xcrun", "simctl", "boot", device_id)
        run("xcrun", "simctl", "bootstatus", device_id, "-b")
        run_native_ui_test(device_id)
        data = Path(output("xcrun", "simctl", "get_app_container", device_id, BUNDLE, "data"))
        initial = wait_report(data / "Documents/initial-bridge-report.json", lambda value: len(value["results"]) >= 8, "initial-bridge-report")
        warm = wait_report(data / "Documents/warm-callback-report.json", lambda value: any(item["source"] == "warm" and item["hasImplicitToken"] for item in value["callbacks"]) and value["failedAuthCallbacks"] >= 1, "warm-callback-report")
        cold = wait_report(data / "Documents/cold-callback-report.json", lambda value: any(item["source"] == "cold" and item["hasImplicitToken"] for item in value["callbacks"]) and value["failedAuthCallbacks"] >= 1, "cold-callback-report")
        assert warm["nativeProcessIdentifier"] == initial["nativeProcessIdentifier"], "Warm callback unexpectedly restarted the app"
        assert cold["nativeProcessIdentifier"] != warm["nativeProcessIdentifier"], "Cold callback did not launch a new app process"
        summary = {
            "device": template["name"], "runtime": runtime,
            "bridgeChecks": len(initial["results"]),
            "warmCallbackRejected": warm["failedAuthCallbacks"] >= 1,
            "coldCallbackRejected": cold["failedAuthCallbacks"] >= 1,
            "physicalHapticVerified": False, "realOAuthVerified": False,
            "cameraCaptureVerified": False, "signedBuildVerified": False,
        }
        (ARTIFACTS / "simulator-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        print(json.dumps(summary, indent=2))
    except Exception:
        if data is None:
            lookup = subprocess.run(["xcrun", "simctl", "get_app_container", device_id, BUNDLE, "data"], text=True, capture_output=True)
            if lookup.returncode == 0:
                data = Path(lookup.stdout.strip())
        if data:
            for filename in ["native-qa-boot.json", "native-qa-report.json", "initial-bridge-report.json", "warm-callback-report.json", "cold-callback-report.json"]:
                source = data / "Documents" / filename
                if source.exists():
                    shutil.copyfile(source, ARTIFACTS / f"failure-{filename}")
        subprocess.run(["xcrun", "simctl", "io", device_id, "screenshot", str(ARTIFACTS / "failure-simulator.png")], check=False)
        with (ARTIFACTS / "simulator-app.log").open("w") as log:
            subprocess.run(["xcrun", "simctl", "spawn", device_id, "log", "show", "--last", "3m", "--style", "compact", "--predicate", 'process == "App"'], stdout=log, stderr=subprocess.STDOUT)
        raise
    finally:
        result = ARTIFACTS / "native-url-ui-test.xcresult"
        if result.exists():
            help_text = subprocess.run(["xcrun", "xcresulttool", "help", "export", "attachments"], text=True, capture_output=True).stdout
            if "--output-path" in help_text:
                subprocess.run(["xcrun", "xcresulttool", "export", "attachments", "--path", str(result), "--output-path", str(ARTIFACTS / "ui-attachments")], check=False)
        subprocess.run(["xcrun", "simctl", "shutdown", device_id], check=False)
        subprocess.run(["xcrun", "simctl", "delete", device_id], check=False)


if __name__ == "__main__":
    main()
