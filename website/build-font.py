"""Build the self-hosted display faces.

Headlines carry most of the "premium" impression, and a system font is the
clearest tell that a page was not art-directed. Two families, because the site
is bilingual and Fraunces contains no Hebrew:

  Fraunces          — English display. Warm serif.
  Frank Ruhl Libre  — Hebrew display. The classic Hebrew book serif, so the
                      two languages read as the same brand rather than two
                      different sites.
  Assistant         — Hebrew body. Clean, modern, unmistakably Israeli, and
                      far better than whatever the phone would substitute.

Self-hosted rather than loaded from Google:
  - no third-party request on the critical path, no extra DNS/TLS handshake
  - no privacy surface
  - we control the subset, so each costs ~10KB instead of ~100KB

Each face is pinned to a single instance before subsetting — that, plus the
tight glyph set, is what makes them small. Each page loads only its own
language's faces.

    python build-font.py
"""
import re
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent / "assets"

# A browser UA is required or Google serves legacy TTF instead of woff2.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

LATIN = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
)
DIGITS = "0123456789"
PUNCT = " .,:;!?'\"’‘“”-–—()[]&@/%+#*°·…״׳"
# Hebrew alphabet including the five final forms, plus the maqaf and geresh
# that real Hebrew typesetting uses.
HEBREW = "אבגדהוזחטיכךלמםנןסעפףצץקרשת" + "־"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def google_woff2(css_url: str) -> bytes:
    css = fetch(css_url).decode("utf-8")
    urls = re.findall(r"url\((https://[^)]+\.woff2)\)", css)
    if not urls:
        raise SystemExit(f"no woff2 in the response for {css_url}")
    # Google splits the family into unicode-range blocks. The last block holds
    # the primary script for these families; the outlines for the axes we pin
    # are present regardless of which block we take.
    return fetch(urls[-1])


def build(name: str, css_url: str, instance: dict, glyphs: str, out_name: str) -> None:
    raw = google_woff2(css_url)
    tmp = OUT.parent / f"_{out_name}.src"
    tmp.write_bytes(raw)

    font = TTFont(tmp)
    if instance:
        font = instancer.instantiateVariableFont(font, instance, inplace=False)

    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "calt", "rlig"]  # rlig matters for Hebrew
    opts.desubroutinize = True
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    sub = subset.Subsetter(options=opts)
    sub.populate(text=glyphs)
    sub.subset(font)

    font.flavor = "woff2"
    out = OUT / out_name
    font.save(out)
    tmp.unlink(missing_ok=True)
    print(f"{name:22s} {len(raw)/1024:6.1f}KB -> {out.stat().st_size/1024:5.1f}KB  {out_name}")


GLYPHS = HEBREW + LATIN + DIGITS + PUNCT


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Display, both languages. Rubik covers Latin and Hebrew in one family,
    # so the Hebrew and English pages share a single voice instead of pairing
    # two unrelated faces and hoping they look related. Rounded terminals and
    # geometric forms — young and warm rather than literary, which is what a
    # consumer app for parents wants and what a book serif is not.
    build(
        "Rubik (display, he+en)",
        "https://fonts.googleapis.com/css2?family=Rubik:wght@300..900",
        {"wght": 600},
        GLYPHS,
        "rubik-display.woff2",
    )

    # Body, both languages. Assistant carries Latin as well as Hebrew, so the
    # two pages share this too. Two weights means two static instances — a
    # single file cannot hold both once the variable axis is pinned.
    build(
        "Assistant Regular",
        "https://fonts.googleapis.com/css2?family=Assistant:wght@200..800",
        {"wght": 400},
        GLYPHS,
        "assistant-body.woff2",
    )
    build(
        "Assistant SemiBold",
        "https://fonts.googleapis.com/css2?family=Assistant:wght@200..800",
        {"wght": 600},
        GLYPHS,
        "assistant-bold.woff2",
    )


if __name__ == "__main__":
    main()
