"""Build the self-hosted display face.

The headlines carry the whole "premium" impression, and a system sans is the
clearest tell that a page was not art-directed. Fraunces is a warm, soft serif
that suits a parent community without tipping into craft-fair territory.

Self-hosted rather than loaded from Google:
  - no third-party request on the critical path, no extra DNS/TLS handshake
  - no privacy surface
  - we control the subset, so it costs ~10KB instead of ~60KB

Only headlines use it, at one weight, so the variable font is pinned to a
single static instance before subsetting. That is what makes it small.

    python build-font.py
"""
import re
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent / "assets" / "fraunces-display.woff2"

CSS_URL = (
    "https://fonts.googleapis.com/css2"
    "?family=Fraunces:opsz,SOFT,WONK,wght@9..144,0..100,0..1,100..900"
)
# A browser UA is required or Google serves legacy TTF instead of woff2.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# Pinned axes. opsz high = the display cut (finer joins, more contrast).
# SOFT rounds the terminals slightly, which is what keeps it friendly.
# WONK off: the wonky italic-ish forms are too much personality for headlines.
INSTANCE = {"opsz": 144, "wght": 600, "SOFT": 40, "WONK": 0}

# Latin basic plus the punctuation the copy actually uses. Kept broad enough
# that ordinary copy edits do not silently render tofu.
GLYPHS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " .,:;!?'\"’‘“”-–—()[]&@/%+#*°·…"
)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def main() -> None:
    css = fetch(CSS_URL).decode("utf-8")
    urls = re.findall(r"url\((https://[^)]+\.woff2)\)", css)
    if not urls:
        raise SystemExit("no woff2 in the Google CSS response")
    # The latin subset is the last block Google emits; it is also the only one
    # we need, and any block carries the full outlines for the axes we pin.
    raw = fetch(urls[-1])

    src = Path(__file__).resolve().parent / "_fraunces-src.woff2"
    src.write_bytes(raw)

    font = TTFont(src)
    before = len(raw)

    font = instancer.instantiateVariableFont(font, INSTANCE, inplace=False)

    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "calt"]  # keep pairs and ligatures
    opts.desubroutinize = True
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(text=GLYPHS)
    subsetter.subset(font)

    font.flavor = "woff2"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)
    src.unlink(missing_ok=True)

    after = OUT.stat().st_size
    print(f"source  {before/1024:6.1f}KB")
    print(f"output  {after/1024:6.1f}KB  -> {OUT.name}")


if __name__ == "__main__":
    main()
