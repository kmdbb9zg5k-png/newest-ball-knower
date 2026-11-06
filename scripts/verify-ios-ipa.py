#!/usr/bin/env python3
"""Audit the exported IPA without uploading or distributing it."""
import hashlib
import importlib.util
import json
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("verify_ios_app", Path(__file__).with_name("verify-ios-app.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ipas = [path for folder in [root / "build/ios/ipa", root / "ios/App/build/ios/ipa"] if folder.exists() for path in folder.glob("*.ipa")]
if len(ipas) != 1:
    raise RuntimeError(f"Expected exactly one exported IPA, found {len(ipas)}")
ipa = ipas[0]
with tempfile.TemporaryDirectory(prefix="ball-knower-ipa-") as directory:
    with zipfile.ZipFile(ipa) as archive:
        archive.extractall(directory)
    apps = list((Path(directory) / "Payload").glob("*.app"))
    if len(apps) != 1:
        raise RuntimeError("Expected exactly one iOS application in the IPA")
    manifest = module.verify(apps[0], signed=True)
manifest.update({"commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
                 "ipaSHA256": hashlib.sha256(ipa.read_bytes()).hexdigest(),
                 "distribution": "artifact-only; device QA and upload are separate gates"})
if manifest["buildNumber"] != os.environ.get("BUILD_NUMBER"):
    raise RuntimeError("The exported IPA build number does not match the CI build")
artifacts = root / "artifacts/release"
artifacts.mkdir(parents=True, exist_ok=True)
(artifacts / "signed-ipa-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(artifacts / "commit.txt").write_text(manifest["commit"] + "\n")
(artifacts / "ios-build-number.txt").write_text(manifest["buildNumber"] + "\n")
print(json.dumps(manifest, indent=2))
