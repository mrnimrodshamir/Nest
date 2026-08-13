"""Generate web-optimised brand assets from the app's master artwork.

The app ships a 1024x1024 icon because the App Store requires it. Serving that
to a phone browser costs ~770KB for something rendered at 56px, so every web
asset here is derived and resized rather than copied.

    python build-assets.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "assets" / "icon.png"
OUT = ROOT / "assets"

# (filename, pixel size, purpose)
TARGETS = [
    ("mark-56.png", 56, "header lockup"),
    ("mark-112.png", 112, "header on 2x displays"),
    ("mark-192.png", 192, "PWA / Android"),
    ("apple-touch-icon.png", 180, "iOS home screen"),
    ("favicon-32.png", 32, "browser tab"),
]

OG_SIZE = (1200, 630)
BRAND_BG = (250, 248, 244)  # neutral[50] — the app background, never pure white


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = Image.open(SOURCE).convert("RGB")

    for name, size, purpose in TARGETS:
        master.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        kb = (OUT / name).stat().st_size / 1024
        print(f"{name:24s} {size:>4}px  {kb:6.1f}KB  {purpose}")

    # Social card. The mark centred on the brand background, so a shared link
    # looks deliberate rather than showing a cropped screenshot.
    card = Image.new("RGB", OG_SIZE, BRAND_BG)
    mark = master.resize((260, 260), Image.LANCZOS)
    card.paste(mark, ((OG_SIZE[0] - 260) // 2, (OG_SIZE[1] - 260) // 2 - 40))
    card.save(OUT / "og-card.png", optimize=True)
    print(f"{'og-card.png':24s} {OG_SIZE}  {(OUT / 'og-card.png').stat().st_size / 1024:6.1f}KB")

    # The 1024 master is not needed on the web at all.
    stale = OUT / "icon.png"
    if stale.exists():
        stale.unlink()
        print("removed icon.png (1024px master, not web-appropriate)")


if __name__ == "__main__":
    main()
