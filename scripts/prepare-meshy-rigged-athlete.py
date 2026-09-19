#!/usr/bin/env python3
"""Prepare a Meshy-rigged athlete for Ball Knower's mobile WebGL renderer.

The Meshy export already contains the authored skin and animations. This build
step keeps that rig intact, gives generated motion IDs stable names, downsizes
oversized maps to the 2K runtime budget, and compacts the GLB binary chunk.
"""

from __future__ import annotations

import argparse
import io
import json
import struct
from pathlib import Path

from PIL import Image


MOTION_NAMES = {
    "Running": "run",
    "Walking": "walk",
    "01a0abda-0d05-707a-8e03-0efb7df50a59": "juke",
    "01a0abdb-d2cb-7152-a406-b607a5ba4200": "stiff_arm",
    "01a0abdd-cb85-7197-8e2b-41739540d3df": "wrap_tackle",
    "01a0abe0-8307-720f-8a00-2c1aaab793d8": "high_point_catch",
    "RunFast": "sprint",
    "restpose": "rest",
}


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise ValueError(f"{path} is not a GLB v2 file")
    document = None
    binary = None
    offset = 12
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8 : offset + 8 + length]
        if chunk_type == 0x4E4F534A:
            document = json.loads(chunk.rstrip(b"\0 \t\r\n"))
        elif chunk_type == 0x004E4942:
            binary = chunk
        offset += 8 + length
    if document is None or binary is None:
        raise ValueError("GLB needs JSON and BIN chunks")
    return document, binary


def encode_jpeg(raw: bytes, name: str) -> bytes:
    with Image.open(io.BytesIO(raw)) as source:
        image = source.convert("RGB")
        if max(image.size) > 2048:
            image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        is_data_map = name in {"normal", "texture_0_metallic_roughness"}
        image.save(
            output,
            format="JPEG",
            quality=85 if is_data_map else 84,
            subsampling=1 if is_data_map else 2,
            optimize=True,
            progressive=True,
        )
        return output.getvalue()


def write_glb(path: Path, document: dict, binary: bytearray) -> None:
    while len(binary) % 4:
        binary.append(0)
    document["buffers"][0]["byteLength"] = len(binary)
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    payload = bytearray(struct.pack("<III", 0x46546C67, 2, total))
    payload.extend(struct.pack("<II", len(encoded), 0x4E4F534A))
    payload.extend(encoded)
    payload.extend(struct.pack("<II", len(binary), 0x004E4942))
    payload.extend(binary)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    document, binary = read_glb(args.source)
    found = {animation.get("name") for animation in document.get("animations", [])}
    missing = set(MOTION_NAMES) - found
    if missing:
        raise ValueError(f"Missing expected Meshy motions: {sorted(missing)}")
    for animation in document["animations"]:
        animation["name"] = MOTION_NAMES[animation["name"]]

    replacements: dict[int, bytes] = {}
    for image in document.get("images", []):
        view_index = image["bufferView"]
        view = document["bufferViews"][view_index]
        start = view.get("byteOffset", 0)
        raw = binary[start : start + view["byteLength"]]
        replacements[view_index] = encode_jpeg(raw, image.get("name", ""))
        image["mimeType"] = "image/jpeg"

    compact = bytearray()
    for index, view in enumerate(document["bufferViews"]):
        while len(compact) % 4:
            compact.append(0)
        start = view.get("byteOffset", 0)
        raw = replacements.get(index, binary[start : start + view["byteLength"]])
        view["byteOffset"] = len(compact)
        view["byteLength"] = len(raw)
        compact.extend(raw)

    primitive = document["meshes"][0]["primitives"][0]
    positions = document["accessors"][primitive["attributes"]["POSITION"]]["count"]
    triangles = document["accessors"][primitive["indices"]]["count"] // 3
    document.setdefault("asset", {})["generator"] = "Ball Knower Meshy Athlete Pipeline"
    document["extras"] = {
        **document.get("extras", {}),
        "ballKnowerAthlete": {
            "version": 3,
            "source": "Meshy 7.1 multi-view, PBR, humanoid auto-rig",
            "mobileVertices": positions,
            "mobileTriangles": triangles,
            "motions": [animation["name"] for animation in document["animations"]],
        },
    }
    write_glb(args.output, document, compact)
    print(
        f"Wrote {args.output} ({args.output.stat().st_size:,} bytes, "
        f"{positions:,} vertices, {triangles:,} triangles)"
    )


if __name__ == "__main__":
    main()
