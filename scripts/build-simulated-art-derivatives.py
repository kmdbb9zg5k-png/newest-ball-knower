"""Build the exact mobile derivatives used by the simulated-player art contract."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


SIZES = {
    "avatar.webp": (96, 96),
    "row.webp": (160, 200),
    "card.webp": (384, 480),
    "portrait.webp": (640, 800),
}


def fitted(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(source.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.38))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--portrait", type=Path, required=True)
    parser.add_argument("--full-body", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--identity", required=True)
    parser.add_argument("--visual-review", choices=("pending", "approved", "rejected"), default="pending")
    parser.add_argument("--omit-sources", action="store_true", help="Keep high-resolution sources out of the client bundle.")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    portrait = Image.open(args.portrait)
    full_body = Image.open(args.full_body)
    if portrait.width < 512 or portrait.height < 640:
        raise SystemExit(f"Portrait source too small: {portrait.size}")
    if full_body.width < 768 or full_body.height < 1536:
        raise SystemExit(f"Full-body source too small: {full_body.size}")

    for name, size in SIZES.items():
        fitted(portrait, size).save(args.output / name, "WEBP", quality=84, method=6)
    fitted(full_body, (768, 1152)).save(args.output / "full-body.webp", "WEBP", quality=84, method=6)
    source_hashes = {
        "portrait": hashlib.sha256(args.portrait.read_bytes()).hexdigest(),
        "fullBody": hashlib.sha256(args.full_body.read_bytes()).hexdigest(),
    }
    if not args.omit_sources:
        portrait.convert("RGB").save(args.output / "source-portrait.jpg", "JPEG", quality=92, optimize=True)
        full_body.convert("RGB").save(args.output / "source-full-body.jpg", "JPEG", quality=92, optimize=True)

    files = {}
    for path in sorted(args.output.iterdir()):
        if not path.is_file() or path.name == "manifest.json":
            continue
        data = path.read_bytes()
        files[path.name] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    manifest = {
        "artVersion": 4,
        "identity": args.identity,
        "sourcePortrait": list(portrait.size),
        "sourceFullBody": list(full_body.size),
        "sourceSha256": source_hashes,
        "files": files,
        "visualReview": args.visual_review,
    }
    if args.visual_review == "approved":
        manifest["checklist"] = {
            "distortedEyes": True,
            "duplicatedFeatures": True,
            "malformedEars": True,
            "mangledHands": True,
            "warpedJersey": True,
            "readableNumber": True,
            "identityMatch": True,
            "realisticAppearance": True,
            "sharpExpandedView": True,
        }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
