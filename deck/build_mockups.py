"""
Renders iPhone mockups of NestUp's real screens for the municipality deck.

SOURCE OF TRUTH: every colour, type size, radius, string and photograph here is
lifted from the shipping codebase --
  colours   src/theme/colors.ts
  type      src/theme/typography.ts (Plus Jakarta Sans, real TTFs)
  copy      src/i18n/en.ts
  artwork   assets/activity-art/*.jpg (the real category photography)
  layout    CARD_MEDIA_MAX_HEIGHT=168, card/row structures from the components

These are faithful reconstructions of screens that exist, not concepts. The app
cannot be run on this machine (react-native-maps has no web build), so nothing
here is a live screen capture -- but no element depicts a feature that does not
ship.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "node_modules/@expo-google-fonts/plus-jakarta-sans"
ART = ROOT / "assets/activity-art"
OUT = Path(__file__).resolve().parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

S = 3  # 3x for retina crispness
W, H = 393 * S, 852 * S  # iPhone 14 Pro logical points

# --- real tokens from src/theme/colors.ts ----------------------------------
APP_BG      = "#FAF8F4"
SURFACE     = "#FEFDFB"
INK         = "#2B2B28"
INK_2       = "#726F65"
MUTED       = "#767368"
BORDER      = "#E3E0D6"
ROSE_700    = "#A95F70"   # brand.primary
ROSE_100    = "#F8DEE3"   # brand.primaryTint
ROSE_200    = "#F3B6C2"
SAGE_500    = "#7C9A82"
SAGE_50     = "#F1F5F1"
SAND_500    = "#C9A876"
SAND_100    = "#F1E4CE"
SKY_500     = "#8FB4C9"
SKY_100     = "#E6EFF3"
WARN        = "#E8B04B"
INVERSE     = "#FEFDFB"


def f(weight, size):
    names = {400: "PlusJakartaSans_400Regular", 500: "PlusJakartaSans_500Medium",
             600: "PlusJakartaSans_600SemiBold", 700: "PlusJakartaSans_700Bold"}
    return ImageFont.truetype(str(FONTS / f"{names[weight]}.ttf"), size * S)


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r * S, fill=fill, outline=outline, width=int(width * S))


def photo(name, w, h, radius=0):
    """Real category artwork, cover-cropped to the frame (never stretched)."""
    im = Image.open(ART / name).convert("RGB")
    tw, th = w, h
    sr, ir = tw / th, im.width / im.height
    if ir > sr:
        nh = im.height; nw = int(nh * sr)
        im = im.crop(((im.width - nw) // 2, 0, (im.width + nw) // 2, nh))
    else:
        nw = im.width; nh = int(nw / sr)
        im = im.crop((0, (im.height - nh) // 2, nw, (im.height + nh) // 2))
    im = im.resize((tw, th), Image.LANCZOS)
    if radius:
        m = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, tw, th], radius=radius * S, fill=255)
        im.putalpha(m)
    return im


def base():
    im = Image.new("RGB", (W, H), APP_BG)
    return im, ImageDraw.Draw(im)


def status_bar(d, dark=False):
    c = INK if not dark else INVERSE
    d.text((28 * S, 20 * S), "9:41", font=f(600, 15), fill=c)
    # signal / wifi / battery, simplified
    x = W - 96 * S
    for i, hgt in enumerate([4, 6, 8, 10]):
        d.rounded_rectangle([x + i * 6 * S, 30 * S - hgt * S, x + i * 6 * S + 4 * S, 30 * S], radius=1 * S, fill=c)
    rr(d, [W - 46 * S, 21 * S, W - 22 * S, 32 * S], 3, outline=c, width=1.2)
    rr(d, [W - 44 * S, 23 * S, W - 28 * S, 30 * S], 2, fill=c)


def home_indicator(d, dark=False):
    rr(d, [W // 2 - 60 * S, H - 12 * S, W // 2 + 60 * S, H - 7 * S], 3,
       fill=INK if not dark else INVERSE)


def tab_bar(d, active=0):
    top = H - 88 * S
    d.rectangle([0, top, W, H], fill=SURFACE)
    d.line([0, top, W, top], fill=BORDER, width=int(1 * S))
    labels = ["Discovery", "Chats", "Profile"]
    for i, lab in enumerate(labels):
        cx = W * (2 * i + 1) // 6
        col = ROSE_700 if i == active else MUTED
        # glyph
        if i == 0:
            # compass: ring + needle (two triangles), not a slash
            d.ellipse([cx - 11 * S, top + 16 * S, cx + 11 * S, top + 38 * S], outline=col, width=int(2 * S))
            d.polygon([(cx + 5 * S, top + 22 * S), (cx, top + 27 * S), (cx - 1 * S, top + 26 * S)], fill=col)
            d.polygon([(cx - 5 * S, top + 32 * S), (cx, top + 27 * S), (cx + 1 * S, top + 28 * S)], fill=col)
        elif i == 1:
            rr(d, [cx - 12 * S, top + 17 * S, cx + 12 * S, top + 35 * S], 7, outline=col, width=2)
            d.polygon([(cx - 5 * S, top + 35 * S), (cx + 2 * S, top + 35 * S), (cx - 5 * S, top + 41 * S)], fill=col)
        else:
            d.ellipse([cx - 11 * S, top + 16 * S, cx + 11 * S, top + 38 * S], outline=col, width=int(2 * S))
            d.ellipse([cx - 4 * S, top + 21 * S, cx + 4 * S, top + 29 * S], fill=col)
        w = d.textlength(lab, font=f(500, 10))
        d.text((cx - w / 2, top + 46 * S), lab, font=f(500, 10), fill=col)


def stylised_map(d):
    """An abstract stand-in for the live Apple Maps view, in brand tones."""
    d.rectangle([0, 0, W, H], fill="#EDEAE3")
    for y in range(0, H, 84 * S):
        d.line([0, y, W, y], fill="#E4E0D7", width=int(9 * S))
    for x in range(-60 * S, W + 200 * S, 96 * S):
        d.line([x, 0, x + 120 * S, H], fill="#E4E0D7", width=int(9 * S))
    # a couple of parks + the sea edge, so it reads as Tel Aviv
    rr(d, [30 * S, 150 * S, 160 * S, 260 * S], 14, fill="#DCE6DC")
    rr(d, [240 * S, 330 * S, 372 * S, 430 * S], 14, fill="#DCE6DC")
    d.polygon([(0, 0), (54 * S, 0), (30 * S, H), (0, H)], fill="#DCE7EC")


def pin(d, x, y, kind, selected=False):
    """Type-specific markers: Activities round, Places square, Events diamond.
    No offset shadow -- at this scale it reads as a hard black arc rather than
    depth. The white ring is what separates a marker from the map."""
    col = {"a": ROSE_700, "p": SAGE_500, "e": SAND_500}[kind]
    r = 17 * S if selected else 14 * S
    if kind == "a":
        d.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=INVERSE, width=int(2.5 * S))
    elif kind == "p":
        rr(d, [x - r, y - r, x + r, y + r], 7, fill=col, outline=INVERSE, width=2.5)
    else:
        d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], fill=col, outline=INVERSE)


def toolbar_chip(d, x, y, w, label, active=False):
    rr(d, [x, y, x + w, y + 38 * S], 10,
       fill=ROSE_700 if active else APP_BG, outline=None if active else BORDER, width=1)
    col = INVERSE if active else INK
    d.text((x + 14 * S, y + 11 * S), label, font=f(600, 13), fill=col)


# ===========================================================================
# 1. DISCOVERY — one map, three content types, sticky controls
# ===========================================================================
def discovery():
    im, d = base()
    stylised_map(d)
    status_bar(d)

    pin(d, 108 * S,  96 * S, "a")
    pin(d, 252 * S,  74 * S, "p")
    pin(d, 306 * S, 150 * S, "e")
    pin(d, 168 * S, 168 * S, "a", selected=True)
    pin(d,  62 * S, 196 * S, "p")

    # host FAB
    d.ellipse([W - 84 * S, 164 * S, W - 28 * S, 220 * S], fill=ROSE_700)
    d.line([W - 56 * S, 180 * S, W - 56 * S, 204 * S], fill=INVERSE, width=int(3 * S))
    d.line([W - 68 * S, 192 * S, W - 44 * S, 192 * S], fill=INVERSE, width=int(3 * S))

    # bottom sheet, expanded so the mixed feed is visible
    sheet = 248 * S
    d.rectangle([0, sheet, W, H], fill=SURFACE)
    rr(d, [0, sheet, W, sheet + 60 * S], 22, fill=SURFACE)
    rr(d, [W // 2 - 20 * S, sheet + 9 * S, W // 2 + 20 * S, sheet + 13 * S], 2, fill=BORDER)

    y = sheet + 24 * S
    toolbar_chip(d, 20 * S, y, 104 * S, "Search")
    toolbar_chip(d, 134 * S, y, 116 * S, "Filters · 2", active=True)
    toolbar_chip(d, 260 * S, y, 96 * S, "Sort")

    y += 52 * S
    d.text((20 * S, y), "12 nearby", font=f(700, 22), fill=INK)
    d.text((20 * S, y + 32 * S), "Swipe up to explore", font=f(400, 13), fill=MUTED)

    # --- Activity card (vertical; media capped at the real 168pt ceiling) ---
    y += 60 * S
    card_h = 168 * S
    ph = photo("baby_playtime_card.jpg", W - 40 * S, card_h, radius=14)
    im.paste(ph, (20 * S, y), ph)
    d = ImageDraw.Draw(im)
    rr(d, [30 * S, y + 12 * S, 138 * S, y + 40 * S], 8, fill="#00000055")
    d.text((41 * S, y + 19 * S), "Baby playtime", font=f(600, 12), fill=INVERSE)
    y += card_h + 8 * S
    d.text((20 * S, y), "Morning play at Gan Meir", font=f(600, 17), fill=INK)
    d.text((20 * S, y + 24 * S), "Tomorrow 10:00 · 0.4km", font=f(400, 13), fill=MUTED)
    d.text((20 * S, y + 44 * S), "3 spots left", font=f(500, 12), fill=WARN)

    # --- Place row (same 116pt bound as the shipping card) ---
    y += 70 * S
    rr(d, [20 * S, y, W - 20 * S, y + 116 * S], 14, fill=SURFACE, outline=BORDER, width=1)
    p = photo("indoor_playground_card.jpg", 112 * S, 116 * S, radius=14)
    im.paste(p, (20 * S, y), p)
    d = ImageDraw.Draw(im)
    d.text((146 * S, y + 18 * S), "PLAYGROUND", font=f(500, 10), fill=SAGE_500)
    d.text((146 * S, y + 38 * S), "Gan HaHashmal", font=f(600, 16), fill=INK)
    d.text((146 * S, y + 62 * S), "Florentin · 0.6km", font=f(400, 13), fill=MUTED)
    d.text((146 * S, y + 84 * S), "Shaded · Fenced · Toilets", font=f(400, 12), fill=INK_2)

    im = im.convert("RGB")
    d = ImageDraw.Draw(im)
    tab_bar(d, 0)
    home_indicator(d)
    return im


# ===========================================================================
# 2. EVENT DETAILS — municipal event made social
# ===========================================================================
def event_details():
    im, d = base()
    status_bar(d)
    d.rectangle([0, 0, W, 96 * S], fill=SURFACE)
    d.text((W / 2 - d.textlength("Event details", font=f(600, 17)) / 2, 56 * S),
           "Event details", font=f(600, 17), fill=INK)
    rr(d, [20 * S, 48 * S, 64 * S, 92 * S], 22, fill=SURFACE, outline=BORDER, width=1)
    d.line([42 * S, 62 * S, 32 * S, 70 * S], fill=INK, width=int(2 * S))
    d.line([32 * S, 70 * S, 42 * S, 78 * S], fill=INK, width=int(2 * S))

    hero = photo("story_time_hero.jpg", W - 40 * S, 176 * S, radius=16)
    im.paste(hero, (20 * S, 108 * S), hero)
    d = ImageDraw.Draw(im)

    y = 300 * S
    rr(d, [20 * S, y, 128 * S, y + 26 * S], 7, fill=SAND_100)
    d.text((31 * S, y + 6 * S), "STARTING SOON", font=f(600, 10), fill="#96794F")
    d.text((20 * S, y + 40 * S), "Story time at", font=f(700, 24), fill=INK)
    d.text((20 * S, y + 70 * S), "Beit Ariela", font=f(700, 24), fill=INK)

    y += 116 * S
    for label, val in [("Today · 16:30–17:15", "e"), ("Beit Ariela Library, Shaul HaMelech 25", "m")]:
        col = ROSE_700
        if val == "e":
            rr(d, [20 * S, y + 2 * S, 40 * S, y + 22 * S], 5, outline=col, width=1.6)
            d.line([26 * S, y - 2 * S, 26 * S, y + 6 * S], fill=col, width=int(1.6 * S))
            d.line([34 * S, y - 2 * S, 34 * S, y + 6 * S], fill=col, width=int(1.6 * S))
        else:
            d.ellipse([24 * S, y + 2 * S, 36 * S, y + 14 * S], outline=col, width=int(1.6 * S))
            d.polygon([(30 * S, y + 24 * S), (24 * S, y + 12 * S), (36 * S, y + 12 * S)], fill=col)
        d.text((54 * S, y + 2 * S), label, font=f(400, 15), fill=INK)
        y += 42 * S

    # Who's going — NestUp attendance
    y += 8 * S
    d.text((20 * S, y), "Who's going", font=f(600, 17), fill=INK)
    d.text((20 * S, y + 26 * S), "7 NestUp parents going", font=f(400, 15), fill=INK_2)
    ax = 20 * S
    # All tints must carry white text at AA; ROSE_100 is far too pale for that.
    tints = [ROSE_200, SAGE_500, SKY_500, SAND_500, "#B9808E"]
    initials = ["N", "D", "Y", "A", "M"]
    for i in range(5):
        d.ellipse([ax, y + 54 * S, ax + 40 * S, y + 94 * S], fill=tints[i], outline=SURFACE, width=int(2 * S))
        tw = d.textlength(initials[i], font=f(600, 15))
        d.text((ax + 20 * S - tw / 2, y + 65 * S), initials[i], font=f(600, 15), fill=INVERSE)
        ax += 46 * S
    d.text((ax + 4 * S, y + 66 * S), "+2", font=f(500, 15), fill=MUTED)

    # RSVP — NestUp only, visually distinct from external registration
    y += 116 * S
    rr(d, [20 * S, y, W - 20 * S, y + 52 * S], 10, fill=ROSE_700)
    lbl = "You're going"
    tw = d.textlength(lbl, font=f(600, 17))
    # Vector tick -- Plus Jakarta Sans has no U+2713, so a glyph would tofu.
    cx0 = W / 2 - tw / 2 - 30 * S
    d.line([cx0, y + 27 * S, cx0 + 7 * S, y + 34 * S], fill=INVERSE, width=int(2.6 * S))
    d.line([cx0 + 7 * S, y + 34 * S, cx0 + 19 * S, y + 19 * S], fill=INVERSE, width=int(2.6 * S))
    d.text((W / 2 - tw / 2, y + 15 * S), lbl, font=f(600, 17), fill=INVERSE)
    note = "This tells other NestUp parents. It does not"
    note2 = "register you with the organizer."
    for i, n in enumerate([note, note2]):
        tw = d.textlength(n, font=f(400, 12))
        d.text((W / 2 - tw / 2, y + 62 * S + i * 17 * S), n, font=f(400, 12), fill=MUTED)

    y += 104 * S
    d.line([20 * S, y, W - 20 * S, y], fill=BORDER, width=int(1 * S))
    d.text((20 * S, y + 18 * S), "Register with organizer", font=f(600, 15), fill=ROSE_700)
    d.text((20 * S, y + 42 * S), "Tel Aviv-Yafo Municipality", font=f(400, 12), fill=MUTED)

    home_indicator(d)
    return im


# ===========================================================================
# 3. FORUMS — 12 curated communities
# ===========================================================================
def forums():
    im, d = base()
    status_bar(d)
    d.text((20 * S, 56 * S), "Forums", font=f(700, 28), fill=INK)

    y = 104 * S
    seg = [("Chats", False), ("Past Chats", False), ("Forums", True)]
    x = 20 * S
    rr(d, [20 * S, y, W - 20 * S, y + 44 * S], 10, fill=APP_BG)
    sw = (W - 46 * S) // 3
    for i, (lab, act) in enumerate(seg):
        if act:
            rr(d, [x + 3 * S, y + 3 * S, x + sw, y + 41 * S], 8, fill=SURFACE)
        tw = d.textlength(lab, font=f(600 if act else 500, 13))
        d.text((x + sw / 2 - tw / 2 + 1 * S, y + 14 * S), lab,
               font=f(600 if act else 500, 13), fill=INK if act else MUTED)
        x += sw
    y += 60 * S

    rr(d, [20 * S, y, W - 20 * S, y + 44 * S], 10, fill=SURFACE)
    d.ellipse([34 * S, y + 14 * S, 50 * S, y + 30 * S], outline=MUTED, width=int(1.6 * S))
    d.line([48 * S, y + 28 * S, 55 * S, y + 35 * S], fill=MUTED, width=int(1.6 * S))
    d.text((66 * S, y + 13 * S), "Search forums", font=f(400, 15), fill=MUTED)
    y += 66 * S

    d.text((20 * S, y), "Pinned", font=f(600, 13), fill=MUTED)
    y += 26 * S

    rows = [
        ("Things to Do with Kids in Tel Aviv", "Places, events and local ideas for families.", 3, SAND_500),
        ("Local Recommendations", "Local services, places and parent-to-parent tips.", 0, SAGE_500),
        ("Parents on Parental Leave", "Meet other parents during parental leave.", 12, SKY_500),
    ]
    for title, sub, unread, col in rows:
        rr(d, [20 * S, y, W - 20 * S, y + 76 * S], 14, fill=ROSE_100 if unread else SURFACE)
        d.ellipse([34 * S, y + 16 * S, 78 * S, y + 60 * S], fill=ROSE_100 if not unread else SURFACE)
        d.ellipse([48 * S, y + 30 * S, 64 * S, y + 46 * S], fill=ROSE_700)
        t = title if len(title) < 30 else title[:28] + "…"
        d.text((92 * S, y + 16 * S), t, font=f(600, 15), fill=INK)
        d.text((92 * S, y + 38 * S), sub[:38] + ("…" if len(sub) > 38 else ""), font=f(400, 12), fill=INK_2)
        if unread:
            bx = W - 62 * S
            rr(d, [bx, y + 24 * S, bx + 34 * S, y + 46 * S], 11, fill=ROSE_700)
            lab = str(unread)
            tw = d.textlength(lab, font=f(700, 12))
            d.text((bx + 17 * S - tw / 2, y + 29 * S), lab, font=f(700, 12), fill=INVERSE)
        y += 84 * S

    d.text((20 * S, y + 4 * S), "All forums", font=f(600, 13), fill=MUTED)
    y += 30 * S
    for title in ["Breastfeeding", "Baby Sleep", "First-Time Parents", "Daycare & Preschools"]:
        rr(d, [20 * S, y, W - 20 * S, y + 62 * S], 14, fill=SURFACE)
        d.ellipse([34 * S, y + 13 * S, 70 * S, y + 49 * S], fill=ROSE_100)
        d.ellipse([46 * S, y + 25 * S, 58 * S, y + 37 * S], fill=ROSE_700)
        d.text((86 * S, y + 22 * S), title, font=f(600, 15), fill=INK)
        y += 70 * S

    tab_bar(d, 1)
    home_indicator(d)
    return im


# ===========================================================================
# 4. PLACE DETAILS — verified municipal place, made useful
# ===========================================================================
def place_details():
    im, d = base()
    status_bar(d)
    d.rectangle([0, 0, W, 96 * S], fill=SURFACE)
    d.text((W / 2 - d.textlength("Place details", font=f(600, 17)) / 2, 56 * S),
           "Place details", font=f(600, 17), fill=INK)
    rr(d, [20 * S, 48 * S, 64 * S, 92 * S], 22, fill=SURFACE, outline=BORDER, width=1)
    d.line([42 * S, 62 * S, 32 * S, 70 * S], fill=INK, width=int(2 * S))
    d.line([32 * S, 70 * S, 42 * S, 78 * S], fill=INK, width=int(2 * S))

    hero = photo("playground_meetup_hero.jpg", W - 40 * S, 190 * S, radius=16)
    im.paste(hero, (20 * S, 108 * S), hero)
    d = ImageDraw.Draw(im)

    y = 316 * S
    d.text((20 * S, y), "PLAYGROUND", font=f(500, 11), fill=ROSE_700)
    d.text((20 * S, y + 22 * S), "Gan HaHashmal", font=f(700, 24), fill=INK)
    d.text((20 * S, y + 56 * S), "Barzilay St 6, Tel Aviv-Yafo", font=f(400, 15), fill=INK_2)

    y += 94 * S
    rr(d, [20 * S, y, W - 20 * S, y + 96 * S], 14, fill="#EDEAE3")
    for gy in range(0, 4):
        d.line([20 * S, y + gy * 26 * S, W - 20 * S, y + gy * 26 * S], fill="#E4E0D7", width=int(5 * S))
    pin(d, W // 2, y + 48 * S, "p")

    y += 116 * S
    d.text((20 * S, y), "What's here", font=f(600, 17), fill=INK)
    y += 30 * S
    chips = ["Shaded", "Fenced", "Toilets", "Water fountain", "Stroller access"]
    cx, cy = 20 * S, y
    for c in chips:
        w = d.textlength(c, font=f(400, 13)) + 28 * S
        if cx + w > W - 20 * S:
            cx = 20 * S; cy += 40 * S
        rr(d, [cx, cy, cx + w, cy + 32 * S], 8, fill=SAGE_50)
        d.text((cx + 14 * S, cy + 8 * S), c, font=f(400, 13), fill="#4F6B55")
        cx += w + 8 * S

    y = cy + 62 * S
    d.text((20 * S, y), "Today Here", font=f(600, 17), fill=INK)
    y += 30 * S
    rr(d, [20 * S, y, W - 20 * S, y + 92 * S], 14, fill=SURFACE, outline=BORDER, width=1)
    p = photo("music_activity_card.jpg", 92 * S, 92 * S, radius=14)
    im.paste(p, (20 * S, y), p)
    d = ImageDraw.Draw(im)
    rr(d, [126 * S, y + 14 * S, 208 * S, y + 38 * S], 6, fill=SAND_100)
    d.text((135 * S, y + 20 * S), "TODAY", font=f(600, 10), fill="#96794F")
    d.text((126 * S, y + 46 * S), "Music & movement", font=f(600, 15), fill=INK)
    d.text((126 * S, y + 68 * S), "16:00 · Municipality", font=f(400, 12), fill=MUTED)

    y += 116 * S
    rr(d, [20 * S, y, W - 20 * S, y + 52 * S], 10, fill=ROSE_700)
    lbl = "Create activity here"
    tw = d.textlength(lbl, font=f(600, 17))
    d.text((W / 2 - tw / 2, y + 15 * S), lbl, font=f(600, 17), fill=INVERSE)

    home_indicator(d)
    return im


# ===========================================================================
# 5. PUBLIC PROFILE — trust without surveillance
# ===========================================================================
def public_profile():
    im, d = base()
    status_bar(d)
    rr(d, [20 * S, 48 * S, 64 * S, 92 * S], 22, fill=SURFACE, outline=BORDER, width=1)
    d.line([42 * S, 62 * S, 32 * S, 70 * S], fill=INK, width=int(2 * S))
    d.line([32 * S, 70 * S, 42 * S, 78 * S], fill=INK, width=int(2 * S))

    cx = W // 2
    d.ellipse([cx - 62 * S, 130 * S, cx + 62 * S, 254 * S], fill=ROSE_100)
    tw = d.textlength("D", font=f(700, 52))
    d.text((cx - tw / 2, 168 * S), "D", font=f(700, 52), fill=ROSE_700)

    for txt, fnt, col, dy in [
        ("Dana", f(700, 28), INK, 276 * S),
        ("Florentin · Mom of 2", f(400, 15), INK_2, 316 * S),
        ("Product designer", f(400, 15), INK_2, 344 * S),
    ]:
        tw = d.textlength(txt, font=fnt)
        d.text((cx - tw / 2, dy), txt, font=fnt, fill=col)

    bio = "Loves long stroller walks and the beach at sunset."
    tw = d.textlength(bio, font=f(400, 13))
    d.text((cx - tw / 2, 380 * S), bio, font=f(400, 13), fill=INK_2)

    rr(d, [46 * S, 420 * S, W - 46 * S, 462 * S], 10, fill=ROSE_100)
    s = "You're both going to Story time at Beit Ariela"
    tw = d.textlength(s, font=f(400, 12))
    d.text((cx - tw / 2, 434 * S), s, font=f(400, 12), fill="#8B4E5D")

    ctx = "Member since August 2026  ·  Hosted 4 · Joined 11"
    tw = d.textlength(ctx, font=f(500, 12))
    d.text((cx - tw / 2, 486 * S), ctx, font=f(500, 12), fill=MUTED)

    # what is deliberately absent
    y = 546 * S
    d.line([46 * S, y, W - 46 * S, y], fill=BORDER, width=int(1 * S))
    d.text((46 * S, y + 22 * S), "Never shown publicly", font=f(600, 12), fill=MUTED)
    y += 48 * S
    for item in ["Phone number", "Email address", "Home address", "Children's birthdates"]:
        d.line([50 * S, y + 8 * S, 62 * S, y + 8 * S], fill=BORDER, width=int(2 * S))
        d.text((74 * S, y), item, font=f(400, 13), fill=MUTED)
        y += 28 * S

    rr(d, [20 * S, H - 168 * S, W - 20 * S, H - 116 * S], 10, fill=ROSE_700)
    lbl = "Message Dana"
    tw = d.textlength(lbl, font=f(600, 17))
    d.text((W / 2 - tw / 2, H - 153 * S), lbl, font=f(600, 17), fill=INVERSE)

    home_indicator(d)
    return im


SCREENS = {
    "screen_discovery": discovery,
    "screen_event": event_details,
    "screen_forums": forums,
    "screen_place": place_details,
    "screen_profile": public_profile,
}

if __name__ == "__main__":
    for name, fn in SCREENS.items():
        img = fn()
        img.save(OUT / f"{name}.png")
        print(f"  {name}.png  {img.width}x{img.height}")
    print("mockups done")
