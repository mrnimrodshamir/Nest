"""Turn the supplied NestUp logo card into the icon assets Expo/iOS expect.

The source art is a rounded, cream "app icon card" floating on white with a drop
shadow. iOS applies its own corner mask, so shipping it as-is would double-round
the corners and inset the mark. This script:

  1. crops away the white surround and the shadow,
  2. flood-fills the four rounded corners back to the card's own cream so the
     square is full-bleed (interior white is left untouched),
  3. writes a 1024x1024 opaque RGB icon (no alpha - App Store rejects alpha),
  4. writes the splash mark and the Android adaptive foreground.

Run: python scripts/build_brand_icons.py <source.png>
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# The card's own background is sampled at runtime. The splash/adaptive
# background in app.json is #FAF8F4, the same family, so there is no seam.


def chroma(px: tuple[int, int, int]) -> int:
    return max(px) - min(px)


def card_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of the cream card, excluding white paper and grey shadow.

    The shadow is neutral (chroma ~0) and light; the card is warm (chroma ~10+)
    and the artwork is saturated. So "warm or dark" isolates the card exactly.
    """
    px = img.load()
    w, h = img.size
    left, top, right, bottom = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if chroma((r, g, b)) >= 6 or (r + g + b) / 3 < 200:
                if x < left:
                    left = x
                if x > right:
                    right = x
                if y < top:
                    top = y
                if y > bottom:
                    bottom = y
    return left, top, right + 1, bottom + 1


def square(img: Image.Image) -> Image.Image:
    """Pad to a square without scaling, so the mark is never distorted."""
    w, h = img.size
    if w == h:
        return img
    side = max(w, h)
    fill = img.getpixel((w // 2, 2)) if h >= w else img.getpixel((2, h // 2))
    out = Image.new("RGB", (side, side), fill)
    out.paste(img, ((side - w) // 2, (side - h) // 2))
    return out


def fill_corners(img: Image.Image) -> Image.Image:
    """Repaint the rounded corners with the card colour, making it full-bleed.

    Scanning inward from each edge (rather than a global "replace light pixels")
    is deliberate: the negative space inside the mark is also light and must
    stay exactly as drawn. The scan stops at the first warm pixel, and the cream
    card fully encloses the artwork, so the interior is unreachable.

    White is neutral (chroma 0); the card is warm (chroma ~11). That gap is what
    separates "paper" from "card", and it is checked rather than assumed below.
    """
    out = img.copy()
    px = out.load()
    w, h = out.size
    fill = px[w // 2, int(h * 0.06)]
    assert chroma(fill) >= 6, f"sampled card colour {fill} is not warm - crop is wrong"

    def is_paper(p: tuple[int, int, int]) -> bool:
        # Paper, the drop shadow, and the card itself are all near-neutral and
        # light; the artwork is not. Consuming the card colour too is harmless
        # because it is repainted with itself, and it lets the ray swallow the
        # grey shadow fringe that sits between paper and card.
        return chroma(p) <= 12 and min(p) >= 170

    def run(coords):
        """Walk a ray inward, repainting paper until the card begins."""
        painted = []
        for x, y in coords:
            if not is_paper(px[x, y]):
                break
            painted.append((x, y))
        # Also take a couple of pixels past the boundary to kill the
        # anti-aliased fringe between paper and card.
        for x, y in coords[len(painted) : len(painted) + 2]:
            painted.append((x, y))
        for x, y in painted:
            px[x, y] = fill

    for y in range(h):
        run([(x, y) for x in range(w)])
        run([(x, y) for x in range(w - 1, -1, -1)])
    for x in range(w):
        run([(x, y) for y in range(h)])
        run([(x, y) for y in range(h - 1, -1, -1)])
    return out


def main() -> int:
    src_path = Path(sys.argv[1])
    src = Image.open(src_path).convert("RGB")

    box = card_bbox(src)
    card = fill_corners(square(src.crop(box)))

    icon = card.resize((1024, 1024), Image.LANCZOS)
    icon.save(ASSETS / "icon.png", "PNG", optimize=True)
    icon.save(ASSETS / "splash-icon.png", "PNG", optimize=True)

    # Android adaptive icons crop to a circle; keep the mark inside the 66%
    # safe zone rather than letting the launcher clip it.
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    inner = card.resize((708, 708), Image.LANCZOS).convert("RGBA")
    fg.paste(inner, (158, 158))
    fg.save(ASSETS / "adaptive-icon-foreground.png", "PNG", optimize=True)

    # In-app mark (Launch and Welcome). Rendered as a rounded badge by
    # NestUpLogo, so it ships as the same full-bleed square.
    card.resize((512, 512), Image.LANCZOS).save(
        ASSETS / "brand" / "nestup-mark.png", "PNG", optimize=True
    )

    print(f"source {src.size} -> card bbox {box}")
    for name in ("icon.png", "splash-icon.png", "adaptive-icon-foreground.png", "brand/nestup-mark.png"):
        im = Image.open(ASSETS / name)
        print(f"{name}: {im.size} {im.mode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
