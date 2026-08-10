"""The film, as data.

Every creative decision from the production package lives here so the pipeline
stays mechanical. Edit this file to change the film; never edit the generators.

Concept C — "They Were Here All Along". Shot numbering matches the package.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output"
REFS = OUT / "refs"
CLIPS = OUT / "clips"
REVIEWS = OUT / "reviews"
FINAL = OUT / "final"

# Veo 3.1. Confirmed against the live model list by `run.py doctor`, which fails
# loudly rather than silently falling back to an older engine.
VEO_MODEL = "veo-3.1-generate-preview"
IMAGE_MODEL = "imagen-4.0-generate-001"
REVIEW_MODEL = "gemini-2.5-flash"

FPS = 24
BRAND_BG = "#FAF8F4"

# Veo 3 produces 8-second clips; we generate then trim to the edit duration.
# Trimming is done on the tail, keeping the head where the prompt lands hardest.
VEO_CLIP_SECONDS = 8

# --------------------------------------------------------------------------
# Characters
# --------------------------------------------------------------------------
# IDENTITY STRATEGY, AND ITS LIMIT.
# Veo 3 through the Gemini API accepts ONE start image, not a set of identity
# references. It has no true cross-shot identity locking. So consistency here
# rests on three weaker mechanisms stacked together:
#   1. a fixed, unusually specific textual description repeated verbatim in
#      every prompt containing that character,
#   2. an Imagen-generated reference still passed as the start frame,
#   3. wardrobe that never changes, which is what viewers actually track.
# This is materially less reliable than a reference-driven model. Expect to
# burn attempts on the face shots, and check every one.

@dataclass(frozen=True)
class Character:
    key: str
    reference_prompt: str
    description: str


MAYA = Character(
    key="maya",
    reference_prompt=(
        "Photographic portrait of a 31-year-old Israeli woman, dark curly hair half-escaping "
        "a clip, visible tiredness under her eyes, no makeup, faint freckles, olive linen "
        "shirt. Neutral expression, front-on, even soft daylight, plain pale background. "
        "Ordinary and specific rather than glamorous. Documentary photography, 50mm, "
        "natural skin texture with visible pores."
    ),
    description=(
        "a 31-year-old woman with dark curly hair half-escaping a clip, tired eyes, no "
        "makeup, wearing an olive linen shirt and straight jeans"
    ),
)

DANA = Character(
    key="dana",
    reference_prompt=(
        "Photographic portrait of a 28-year-old Israeli woman, straight shoulder-length "
        "brown hair, warm open face, minimal makeup, grey t-shirt with a denim jacket "
        "knotted at the waist. Neutral expression, front-on, even soft daylight, plain pale "
        "background. Ordinary and specific rather than glamorous. Documentary photography, "
        "50mm, natural skin texture."
    ),
    description=(
        "a 28-year-old woman with straight shoulder-length brown hair, a grey t-shirt and a "
        "denim jacket knotted at the waist"
    ),
)

CHARACTERS = {c.key: c for c in (MAYA, DANA)}

# Applied to every video generation. Veo responds well to explicit exclusions,
# and these are the exact failure modes that make a clip read as AI.
NEGATIVE_PROMPT = (
    "glossy skin, airbrushed faces, symmetrical model looks, stock-photo smiling, "
    "people looking at camera, slow motion, lens flare, drone shot, orbiting camera, "
    "teal and orange grade, text, watermark, logo, distorted hands, extra fingers, "
    "warped faces, plastic skin"
)

GRADE_NOTE = {
    "warm": (
        "Warm late-afternoon Mediterranean light, low golden sun, long soft shadows, "
        "amber highlights, natural unfiltered colour."
    ),
    "cool": (
        "Cool early-morning light before the sun clears the buildings, blue-grey shadows, "
        "soft flat contrast, natural unfiltered colour."
    ),
    "mid": (
        "Mid-morning daylight filtered through ficus leaves, dappled shade, neutral warm "
        "balance, natural unfiltered colour."
    ),
}

COMMON_STYLE = (
    "Shot on ARRI Alexa, {lens}, T2.8, shallow but legible depth of field. "
    "Documentary realism, unposed, natural skin texture. Locked camera, no movement. "
    "Modern Tel Aviv, ordinary residential neighbourhood, not touristic."
)


@dataclass(frozen=True)
class Shot:
    num: int
    key: str
    start: float          # timeline in-point, seconds
    duration: float       # edit duration, seconds
    prompt: str
    lens: str = "35mm"
    grade: str = "mid"
    characters: tuple[str, ...] = ()
    start_from_reference: str | None = None   # character key -> use their still as frame 1
    aspect_ratio: str = "16:9"
    # Shots the automated reviewer must judge hardest. These carry the film.
    critical: bool = False
    max_attempts: int = 3
    generated: bool = True   # False = supplied asset (the app screen recording)
    note: str = ""

    audio: str = ""

    def full_prompt(self) -> str:
        cast = " ".join(CHARACTERS[k].description for k in self.characters)
        parts = [self.prompt]
        if cast:
            parts.append(f"The people in shot: {cast}. Their appearance must not change.")
        parts.append(GRADE_NOTE[self.grade])
        parts.append(COMMON_STYLE.format(lens=self.lens))
        if self.audio:
            # Veo 3.1 generates native audio from the prompt. We ask only for
            # DIEGETIC sound — the location's own ambience. No score: eleven
            # clips would give eleven unrelated pieces of music, and the film
            # needs one continuous piece laid in the edit.
            parts.append(f"Audio: {self.audio} No background music, no score.")
        return " ".join(parts)


SHOTS: list[Shot] = [
    Shot(
        num=1, key="group", start=0.0, duration=3.0, lens="35mm", grade="warm",
        prompt=(
            "Wide static shot, late afternoon in an ordinary Tel Aviv neighbourhood playground. "
            "Four adults sit and stand around a low concrete wall with coffee cups beside them, "
            "mid-conversation. Three toddlers play on rubber matting in the middle distance. "
            "Ficus canopy overhead. Relaxed unposed body language, nobody looking at camera."
        ),
        audio=(
            "Warm outdoor playground ambience — children playing at conversational distance, "
            "a chain swing creaking, relaxed adult conversation in Hebrew too far off to make "
            "out words, distant city traffic, sparrows."
        ),
    ),
    Shot(
        num=2, key="sleeping_child", start=3.0, duration=3.0, lens="50mm", grade="warm",
        prompt=(
            "Medium close shot from behind and slightly to the side: a toddler in a sunhat "
            "asleep against an adult's shoulder. An adult hand gently adjusts the hat brim "
            "without looking, still turned toward someone off-frame. Soft rim light on the "
            "child's hair."
        ),
        audio=(
            "Very quiet. A child's slow sleeping breathing close to the microphone, adult "
            "conversation continuing softly off-frame, distant playground sound."
        ),
        note="The emotional thesis in one image: the child is not asleep on their own parent.",
    ),
    Shot(
        num=3, key="morning", start=6.0, duration=2.0, lens="35mm", grade="cool",
        prompt=(
            "Wide static shot, 7am on a residential Tel Aviv street. Cream 1950s Bauhaus "
            "facades with rounded balconies, parked scooters, closed shutters, empty pavement. "
            "A single woman pushes a pram along the pavement, small in frame. Quiet and still."
        ),
        audio=(
            "Early morning city stillness — a single distant scooter, a shutter rolling up "
            "somewhere off-frame, one bird, pram wheels on pavement. Sparse and quiet."
        ),
        note="The hinge. Music stops here and the grade inverts.",
    ),
    Shot(
        num=4, key="nearmiss_boulevard", start=8.0, duration=2.5, lens="35mm", grade="mid",
        characters=("maya",), start_from_reference="maya",
        prompt=(
            "Static medium-wide on the central pedestrian path of Rothschild Boulevard, mature "
            "ficus trees, morning light through leaves. A woman walks toward camera pushing a "
            "pram. On the far path behind her, another parent with a pram walks the opposite "
            "direction, separated by trees and a lane of traffic. Neither looks up. A cyclist "
            "passes."
        ),
        audio=(
            "Boulevard ambience — traffic on both flanking lanes, a bicycle passing close, "
            "leaves overhead, pram wheels, a fragment of a Hebrew phone conversation drifting "
            "past and away."
        ),
    ),
    Shot(
        num=5, key="nearmiss_cafe", start=10.5, duration=2.5, lens="50mm", grade="mid",
        characters=("maya",), start_from_reference="maya",
        prompt=(
            "An outdoor cafe table on a Tel Aviv side street. A woman sits with a pram beside "
            "her, scrolling her phone with one thumb, an iced coffee sweating on the table. Two "
            "tables behind her and out of focus, a man with a stroller does exactly the same "
            "thing. Slow rack focus from her to him and back. Warm light reflected off the "
            "pavement."
        ),
        audio=(
            "Outdoor cafe ambience — an espresso machine and steam wand, cups on saucers, low "
            "indistinct Hebrew conversation at other tables, a scooter passing on the street."
        ),
        note="The only focus move in the film.",
    ),
    Shot(
        num=6, key="nearmiss_playground", start=13.0, duration=3.0, lens="35mm", grade="mid",
        characters=("maya",), start_from_reference="maya",
        prompt=(
            "Static wide of a small neighbourhood playground with rubber matting and a chain "
            "swing. A woman with a pram enters through the near gate. At the same moment a "
            "family with two small children leaves through the far gate at the opposite end. "
            "Empty swings move slightly between them. Neither group notices the other."
        ),
        audio=(
            "A near-empty playground — one chain swing moving in the wind, a gate latch, "
            "children's voices receding into the distance as the family leaves, then quiet."
        ),
    ),
    Shot(
        num=7, key="app", start=16.0, duration=3.0, generated=False,
        prompt="",
        note=(
            "NOT GENERATED. Screen recording of the shipping build, corner-pin tracked into a "
            "filmed hand plate. The join count must be real — this is a municipal asset. "
            "Place the file at film/assets/app_screen.mp4."
        ),
    ),
    Shot(
        num=8, key="arrival", start=19.0, duration=3.0, lens="50mm", grade="warm",
        characters=("maya", "dana"), start_from_reference="maya", critical=True, max_attempts=4,
        prompt=(
            "The same playground in warmer afternoon light. A woman comes through the gate with "
            "a pram, scanning slightly. A second woman, already there with a toddler, notices "
            "her and half-raises a hand in an uncertain greeting. Natural, slightly awkward, "
            "unrehearsed."
        ),
        audio=(
            "A gate hinge, pram wheels on rubber matting, and one word of greeting in Hebrew — "
            "'היי' — spoken quietly and a little uncertainly. Playground ambience behind."
        ),
    ),
    Shot(
        num=9, key="children", start=22.0, duration=3.0, lens="35mm", grade="warm",
        critical=True, max_attempts=5,
        prompt=(
            "Low camera at child height on rubber playground matting. Two toddlers around "
            "eighteen months meet over a scattered pile of plastic buckets; one holds a bucket "
            "out and the other takes it. No adults visible in frame. Late sun through ficus "
            "leaves, dust in the light."
        ),
        audio=(
            "Close, intimate playground sound — plastic buckets knocking together, small hands "
            "on rubber matting, one toddler babbling wordlessly. No adult voices."
        ),
        note="Second hardest shot. Toddler hands and faces are where these models fail worst.",
    ),
    Shot(
        num=10, key="introduction", start=25.0, duration=2.5, lens="50mm", grade="warm",
        characters=("maya", "dana"), start_from_reference="dana",
        critical=True, max_attempts=6,
        prompt=(
            "Two women sit on a low playground wall with takeaway coffees, mid-conversation, "
            "glancing toward children off-frame. One laughs — small and genuine, a reaction "
            "rather than a performance. The slightly awkward warmth of people who have just met."
        ),
        audio=(
            "Two women talking quietly in Hebrew, the words indistinct and overlapping as real "
            "conversation does, then one short genuine laugh — a reaction, not a performance. "
            "Children and playground behind them."
        ),
        note=(
            "THE payload, and the film's first human voice. Budget the most attempts here. "
            "If the laugh never lands, restructure rather than settle."
        ),
    ),
]

SHOTS_BY_KEY = {s.key: s for s in SHOTS}

TOTAL_DURATION = 30.0
CARD_IN = 27.5          # dip to brand background begins
CARD_LINE_HE = "הם היו כאן כל הזמן."
CARD_LINE_HE_ALT = "הקהילה שלכם קרובה יותר ממה שחשבתם."

# Burned-in Hebrew captions for the captioned deliverable.
CAPTIONS = [
    (0.0, 6.0, "[פסנתר. אחר צהריים בגן משחקים]"),
    (6.0, 8.0, "[שקט]"),
    (16.0, 16.5, "[נקישה רכה]"),
    (19.0, 22.0, "[קולות ילדים]"),
    (26.0, 27.0, "[צחוק]"),
]
