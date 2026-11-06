#!/usr/bin/env python3
"""Install the isolated native QA app and exercise real iOS URL delivery."""

import json
import shutil
import subprocess
import time
from pathlib import Path

ARTIFACTS = Path("artifacts/native")
BUNDLE = "com.ballknower.ios.nativeqa"
APP = ARTIFACTS / "qa/Build/Products/Debug-iphonesimulator/App.app"


def run(*args, **options):
    return subprocess.run(args, check=True, text=True, **options)


def output(*args):
    return subprocess.check_output(args, text=True).strip()


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
        run("xcrun", "simctl", "install", device_id, str(APP))
        data = Path(output("xcrun", "simctl", "get_app_container", device_id, BUNDLE, "data"))
        report_path = data / "Documents/native-qa-report.json"
        run("xcrun", "simctl", "launch", device_id, BUNDLE)
        initial = wait_report(report_path, lambda value: len(value["results"]) >= 8, "initial-bridge-report")
        run("xcrun", "simctl", "io", device_id, "screenshot", str(ARTIFACTS / "initial-bridge.png"))

        run("xcrun", "simctl", "openurl", device_id, "ballknower://auth/callback#access_token=native-qa-only&refresh_token=native-qa-warm")
        warm = wait_report(report_path, lambda value: any(item["source"] == "warm" and item["hasImplicitToken"] for item in value["callbacks"]) and value["failedAuthCallbacks"] >= 1, "warm-callback-report")
        run("xcrun", "simctl", "io", device_id, "screenshot", str(ARTIFACTS / "warm-callback.png"))

        run("xcrun", "simctl", "terminate", device_id, BUNDLE)
        report_path.unlink(missing_ok=True)
        run("xcrun", "simctl", "openurl", device_id, "ballknower://auth/callback#access_token=native-qa-only&refresh_token=native-qa-cold")
        cold = wait_report(report_path, lambda value: any(item["source"] == "cold" and item["hasImplicitToken"] for item in value["callbacks"]) and value["failedAuthCallbacks"] >= 1, "cold-callback-report")
        run("xcrun", "simctl", "io", device_id, "screenshot", str(ARTIFACTS / "cold-callback.png"))
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
        if data:
            for filename in ["native-qa-boot.json", "native-qa-report.json"]:
                source = data / "Documents" / filename
                if source.exists():
                    shutil.copyfile(source, ARTIFACTS / f"failure-{filename}")
        subprocess.run(["xcrun", "simctl", "io", device_id, "screenshot", str(ARTIFACTS / "failure-simulator.png")], check=False)
        with (ARTIFACTS / "simulator-app.log").open("w") as log:
            subprocess.run(["xcrun", "simctl", "spawn", device_id, "log", "show", "--last", "3m", "--style", "compact", "--predicate", 'process == "App"'], stdout=log, stderr=subprocess.STDOUT)
        raise
    finally:
        subprocess.run(["xcrun", "simctl", "shutdown", device_id], check=False)
        subprocess.run(["xcrun", "simctl", "delete", device_id], check=False)


if __name__ == "__main__":
    main()
