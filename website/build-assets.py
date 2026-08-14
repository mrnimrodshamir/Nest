"""Generate every web asset from real sources.

Two jobs:
  1. Brand marks, derived from the app's 1024px App Store icon. Serving that
     master for a 40px logo costs ~770KB, so each size is generated.
  2. Product screenshots, from REAL device captures. Never a mockup, never an
     invented interface — if a screen is missing we ship without it rather than
     draw a fake one.

    python build-assets.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "assets"
ICON = ROOT.parent / "assets" / "icon.png"

BRAND_BG = (250, 248, 244)  # neutral[50] — the app background, never pure white

MARKS = [
    ("mark-56.png", 56), ("mark-112.png", 112), ("mark-192.png", 192),
    ("apple-touch-icon.png", 180), ("favicon-32.png", 32),
]

# Real iPhone 16 Pro captures (1206x2622) from the device.
SOURCE_DIR = Path(r"C:\Users\Administrator\Downloads")
SCREENS = {
    "screen-place.webp": "79A320F2-4087-415A-8BA9-5E4E2068FC0B.png",
    "screen-forums.webp": "95E498CE-356B-4526-8DED-295264C9D893.png",
    "screen-activities.webp": "24180641-C74E-469E-88E5-39F55DB602B9.png",
}
# 560px wide is twice the largest rendered size (280px), so it stays crisp on
# retina without shipping the full 1206px capture.
SCREEN_WIDTH = 560


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = Image.open(ICON).convert("RGB")

    for name, size in MARKS:
        master.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print(f"{name:24s} {(OUT / name).stat().st_size / 1024:7.1f}KB")

    for out_name, src_name in SCREENS.items():
        src = SOURCE_DIR / src_name
        if not src.exists():
            print(f"{out_name:24s} SKIPPED — source missing: {src_name}")
            continue
        shot = Image.open(src).convert("RGB")
        height = round(shot.height * SCREEN_WIDTH / shot.width)
        shot = shot.resize((SCREEN_WIDTH, height), Image.LANCZOS)
        # WebP at 80 is visually indistinguishable here and roughly a fifth the
        # size of the source PNG.
        shot.save(OUT / out_name, "WEBP", quality=80, method=6)
        print(f"{out_name:24s} {SCREEN_WIDTH}x{height}  {(OUT / out_name).stat().st_size / 1024:7.1f}KB")

    # Social card: the mark on the brand ground, so a shared link reads as
    # deliberate rather than as a cropped screenshot.
    card = Image.new("RGB", (1200, 630), BRAND_BG)
    mark = master.resize((240, 240), Image.LANCZOS)
    card.paste(mark, ((1200 - 240) // 2, (630 - 240) // 2 - 30))
    card.save(OUT / "og-card.png", optimize=True)
    print(f"{'og-card.png':24s} {(OUT / 'og-card.png').stat().st_size / 1024:7.1f}KB")

    total = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file()) / 1024
    print(f"\ntotal {total:.0f}KB")


if __name__ == "__main__":
    main()
