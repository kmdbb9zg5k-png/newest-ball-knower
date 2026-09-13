"""Build a compact reviewer sheet from the exact derivatives shipped to clients."""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


DATA = Path("docs/qa/simulated-player-art-visual-set.json")
ART = Path("public/solo-characters/v2/qa")
OUTPUT = Path("docs/qa/simulated-player-art-contact-sheet.webp")
FULL_OUTPUT = Path("docs/qa/simulated-player-art-full-body-contact-sheet.webp")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def main() -> None:
    qa = json.loads(DATA.read_text())
    players = qa["players"]
    card_width, card_height = 384, 480
    cell_width, cell_height = 424, 574
    columns = 3
    rows = (len(players) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, 76 + rows * cell_height), "#07101d")
    draw = ImageDraw.Draw(sheet)
    title = ImageFont.truetype(FONT_BOLD, 30)
    body = ImageFont.truetype(FONT, 18)
    label = ImageFont.truetype(FONT_BOLD, 17)
    draw.text((24, 18), "Ball Knower · Simulated Player Art QA · v4", font=title, fill="#ffffff")
    draw.text((24, 52), "Exact 384×480 card derivatives · approved representative set", font=body, fill="#9eb0c8")
    for index, player in enumerate(players):
        column, row = index % columns, index // columns
        x, y = column * cell_width + 20, 76 + row * cell_height + 14
        image = Image.open(ART / player["id"] / "card.webp").convert("RGB")
        sheet.paste(image, (x, y))
        draw.rectangle((x, y + card_height - 92, x + card_width, y + card_height), fill="#07101ddd")
        draw.text((x + 14, y + card_height - 80), player["name"], font=label, fill="#ffffff")
        facts = f'{player["group"]} · {player["position"]} · #{player["number"]} · {player["heightInches"] // 12}\'{player["heightInches"] % 12}" · {player["weightLbs"]} lb'
        draw.text((x + 14, y + card_height - 54), facts, font=body, fill="#b8c8dc")
        draw.text((x + 14, y + card_height + 13), player["id"], font=body, fill="#7890ad")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT, "WEBP", quality=86, method=6)
    print(f"Wrote {OUTPUT} ({sheet.width}×{sheet.height})")

    full_cell_width, full_cell_height = 360, 590
    full_sheet = Image.new("RGB", (columns * full_cell_width, 76 + rows * full_cell_height), "#07101d")
    full_draw = ImageDraw.Draw(full_sheet)
    full_draw.text((24, 18), "Ball Knower · Full-Body QA · v4", font=title, fill="#ffffff")
    full_draw.text((24, 52), "Exact lazy-loaded 768×1152 derivatives · identity anchored to portrait", font=body, fill="#9eb0c8")
    for index, player in enumerate(players):
        column, row = index % columns, index // columns
        x, y = column * full_cell_width + 20, 76 + row * full_cell_height + 14
        image = Image.open(ART / player["id"] / "full-body.webp").convert("RGB").resize((320, 480), Image.Resampling.LANCZOS)
        full_sheet.paste(image, (x, y))
        full_draw.text((x, y + 492), player["name"], font=label, fill="#ffffff")
        full_draw.text((x, y + 518), f'{player["group"]} · #{player["number"]} · {player["weightLbs"]} lb', font=body, fill="#b8c8dc")
        full_draw.text((x, y + 546), player["id"], font=body, fill="#7890ad")
    full_sheet.save(FULL_OUTPUT, "WEBP", quality=86, method=6)
    print(f"Wrote {FULL_OUTPUT} ({full_sheet.width}×{full_sheet.height})")


if __name__ == "__main__":
    main()
