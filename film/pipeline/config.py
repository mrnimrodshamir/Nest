"""The film, as data. v3 — "Your community is closer than you think."

Every creative decision lives here so the pipeline stays mechanical. Edit this
file to change the film; never edit the generators.

WHAT CHANGED IN v3, AND WHY
  * Camera moves. v2 was locked-off throughout, which is defensible on a real
    set but is actively harmful here: a static frame with a drifting subject is
    exactly what reads as "AI animation". Handheld micro-movement, rack focus
    and shallow depth give the eye motion parallax to trust, and they hide
    generation artefacts rather than presenting them on a stable plate.
  * Micro-behaviour is now specified per shot. Hesitation, adjusting a stroller
    brake, tucking a blanket, blowing on coffee. This is the single strongest
    anti-uncanny lever available — a person doing one small unnecessary thing
    reads as alive; a person executing exactly one intention reads as animated.
  * The babies are never alone in frame. v2 had a toddler shot with "no adults
    visible", which is both unsettling and off-brief. A parent's hand, knee or
    shoulder is always in frame.
  * The app is 5 seconds and tells the story. v2 hid it to 3 and made it a
    gesture; the audience could not see WHY the two women end up together. Now
    the same activity card appears twice, once per mother, and the story needs
    no explanation.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output"
REFS = OUT / "refs"
CLIPS = OUT / "clips"
REVIEWS = OUT / "reviews"
FINAL = OUT / "final"

VEO_MODEL = "veo-3.1-generate-preview"
IMAGE_MODEL = "imagen-4.0-generate-001"
REVIEW_MODEL = "gemini-2.5-flash"

FPS = 24
BRAND_BG = "#FAF8F4"
VEO_CLIP_SECONDS = 8

# --------------------------------------------------------------------------
# Characters
# --------------------------------------------------------------------------
# IDENTITY STRATEGY, AND ITS LIMIT.
# Veo 3.1 via the Gemini API accepts ONE start image, not a set of identity
# references, and has no true cross-shot identity locking. Consistency rests on
# three weaker mechanisms stacked: a fixed verbatim description repeated in
# every prompt, an Imagen still as the start frame, and wardrobe that never
# changes (which is what viewers actually track). Expect to burn attempts on
# the face shots and check every one by eye.

@dataclass(frozen=True)
class Character:
    key: str
    reference_prompt: str
    description: str


MAYA = Character(
    key="maya",
    reference_prompt=(
        "Candid photograph of a real 31-year-old Israeli woman, dark curly hair in a messy "
        "bun with strands escaping, visible tiredness under her eyes, no makeup, faint "
        "freckles, small stud earrings, soft olive linen shirt slightly creased. Neutral "
        "unposed expression, not smiling at the camera, even soft daylight, plain pale "
        "background. Ordinary and specific, NOT a fashion model, not glamorous, not "
        "symmetrical. Documentary photography, 50mm, visible skin texture and pores."
    ),
    description=(
        "a tired 31-year-old woman with dark curly hair in a messy bun, no makeup, wearing a "
        "creased olive linen shirt and straight jeans"
    ),
)

DANA = Character(
    key="dana",
    reference_prompt=(
        "Candid photograph of a real 28-year-old Israeli woman, straight shoulder-length "
        "brown hair pushed behind one ear, slightly tired warm face, minimal makeup, grey "
        "cotton t-shirt with a denim jacket knotted at the waist. Neutral unposed expression, "
        "not smiling at the camera, even soft daylight, plain pale background. Ordinary and "
        "specific, NOT a fashion model, not glamorous. Documentary photography, 50mm, visible "
        "skin texture."
    ),
    description=(
        "a 28-year-old woman with straight shoulder-length brown hair, a grey t-shirt and a "
        "denim jacket knotted at the waist"
    ),
)

CHARACTERS = {c.key: c for c in (MAYA, DANA)}

# The babies are never described alone — see BABY_RULE, appended to every shot
# that contains one.
BABY_RULE = (
    "The baby is ALWAYS physically with a parent — in a stroller the parent is holding, on a "
    "parent's lap, or with a parent's hand or knee clearly in frame. Never a child alone."
)

# The exact failure modes that make a clip read as AI. Veo responds well to
# explicit exclusion.
NEGATIVE_PROMPT = (
    "glossy skin, airbrushed faces, symmetrical model looks, fashion model, influencer "
    "aesthetic, full makeup, stock-photo smiling, grinning at camera, people looking at "
    "camera, repeated looping movement, robotic motion, stiff posture, slow motion, lens "
    "flare, drone shot, orbiting camera, teal and orange grade, generic European city, text, "
    "watermark, logo, distorted hands, extra fingers, warped faces, plastic skin, floating "
    "babies, unattended baby"
)

GRADE_NOTE = {
    "warm": (
        "Warm late-afternoon Mediterranean light, low golden sun, long soft shadows, amber "
        "highlights, natural unfiltered colour."
    ),
    "cool": (
        "Cool early-morning Mediterranean light before the sun clears the buildings, blue-grey "
        "shadows, soft flat contrast, natural unfiltered colour."
    ),
    "mid": (
        "Bright mid-morning Tel Aviv daylight filtered through ficus leaves, dappled shade, "
        "neutral warm balance, natural unfiltered colour."
    ),
}

# Tel Aviv must be unmistakable — never "generic Europe".
CITY_NOTE = (
    "Unmistakably Tel Aviv: white and cream 1930s Bauhaus buildings with rounded balconies and "
    "external shutters, ficus and jacaranda street trees, parked bicycles and electric "
    "scooters, air-conditioning units, Hebrew shop signage slightly out of focus, "
    "Mediterranean haze."
)

COMMON_STYLE = (
    "Shot on ARRI Alexa, {lens}, T2.0, shallow depth of field with soft foreground blur. "
    "{camera} Documentary realism, unposed, imperfect timing, visible skin texture. "
    "Real people, not actors performing. Ordinary residential Tel Aviv, never touristic."
)


@dataclass(frozen=True)
class Shot:
    num: int
    key: str
    start: float
    duration: float
    prompt: str
    # Per-shot camera language. v2 was locked throughout; a static frame with a
    # moving subject is what makes generated footage look like animation.
    camera: str = "Handheld with subtle natural drift and breathing, never a locked tripod."
    lens: str = "35mm"
    grade: str = "mid"
    characters: tuple[str, ...] = ()
    has_baby: bool = False
    start_from_reference: str | None = None
    aspect_ratio: str = "16:9"
    critical: bool = False
    max_attempts: int = 3
    generated: bool = True
    # Off for interiors and tight close-ups: describing Bauhaus facades and
    # street trees in a shallow two-shot on a bench is noise, and Veo will try
    # to honour it by dragging buildings into a frame that should be all skin
    # and blur.
    city: bool = True
    # The small unnecessary actions that separate a person from an animation.
    behaviour: str = ""
    audio: str = ""
    note: str = ""

    def full_prompt(self) -> str:
        parts = [self.prompt]
        if self.behaviour:
            parts.append(f"Small natural behaviour: {self.behaviour}.")
        if self.characters:
            cast = "; ".join(CHARACTERS[k].description for k in self.characters)
            parts.append(f"The people in shot: {cast}. Their appearance must not change.")
        if self.has_baby:
            parts.append(BABY_RULE)
        parts.append(GRADE_NOTE[self.grade])
        if self.city:
            parts.append(CITY_NOTE)
        parts.append(COMMON_STYLE.format(lens=self.lens, camera=self.camera))
        if self.audio:
            # Veo 3.1 generates native audio. DIEGETIC ONLY — eleven clips would
            # otherwise give eleven unrelated pieces of music, and the film needs
            # one continuous score laid in the edit.
            parts.append(f"Audio: {self.audio} No background music, no score.")
        return " ".join(parts)


SHOTS: list[Shot] = [
    # --- 1. Morning apartment ---------------------------------------------
    Shot(
        num=1, key="apartment", start=0.0, duration=3.5, lens="35mm", grade="cool",
        characters=("maya",), has_baby=True, start_from_reference="maya",
        camera="Slow handheld push-in from the doorway, shallow focus, foreground doorframe blurred.",
        city=False,  # Interior. The street note would put Bauhaus facades in a bedroom.
        prompt=(
            "Interior, a small Tel Aviv apartment at 7am. Cool morning light through half-open "
            "shutters throwing slatted stripes across the floor. A woman moves through an "
            "ordinary morning routine with a baby on her hip, gathering a bag, checking a "
            "changing mat. Unremarkable domestic clutter — a drying rack, a half-drunk coffee."
        ),
        behaviour=(
            "she shifts the baby from one hip to the other without thinking, glances at the "
            "clock, pats her pocket for keys and doesn't find them the first time"
        ),
        audio=(
            "Quiet apartment interior — a fridge hum, a spoon on ceramic, a baby making small "
            "wordless sounds, distant traffic through a window."
        ),
    ),

    # --- 2. Street: physically close, socially apart ------------------------
    Shot(
        num=2, key="street", start=3.5, duration=3.5, lens="50mm", grade="cool",
        characters=("maya",), has_baby=True, start_from_reference="maya",
        camera=(
            "Handheld tracking alongside her at walking pace, then a rack focus past her to the "
            "far pavement and back."
        ),
        prompt=(
            "Exterior, a residential Tel Aviv street just after sunrise. A woman pushes a "
            "stroller along the pavement. On the opposite pavement, separated by parked cars "
            "and street trees, another woman pushes a stroller in the opposite direction. "
            "Neither notices the other. A dog walker and a cyclist pass through the frame."
        ),
        behaviour=(
            "she stops to set the stroller brake with her foot, tucks a thin blanket back over "
            "the baby's legs, checks the baby's face before moving on"
        ),
        audio=(
            "Early street ambience — stroller wheels on uneven pavement, a bicycle freewheel, a "
            "shutter rolling up, sparrows, a distant scooter."
        ),
        note="The premise in one frame: four metres apart, no idea.",
    ),

    # --- 3. The app, in three real beats ------------------------------------
    # NOT GENERATED. Screen recording from the shipping build. Veo never sees the
    # interface: asking a video model for an app screen invents features and
    # renders text as gibberish, and this goes to a municipality.
    Shot(
        num=3, key="app_open", start=7.0, duration=2.0, generated=False, prompt="",
        note=(
            "Real UI beat 1 — Maya opens NestUp, Discovery shows nearby activities. "
            "film/assets/app_01_nearby.mp4"
        ),
    ),
    Shot(
        num=4, key="app_details", start=9.0, duration=1.5, generated=False, prompt="",
        note=(
            "Real UI beat 2 — the activity card: Morning Playground Meetup, Meir Park, starts "
            "in 15 minutes, parents joining, distance. THE JOIN COUNT MUST BE REAL. "
            "film/assets/app_02_details.mp4"
        ),
    ),
    Shot(
        num=5, key="app_join", start=10.5, duration=1.5, generated=False, prompt="",
        note=(
            "Real UI beat 3 — tap Join, confirmation, map with the pin. Then the SAME card "
            "again from Dana's phone: that repeat is what makes the story self-explanatory. "
            "film/assets/app_03_join.mp4"
        ),
    ),

    # --- 4. Walking, separately, to the same place -------------------------
    Shot(
        num=6, key="walking", start=12.0, duration=3.0, lens="35mm", grade="mid",
        characters=("maya", "dana"), has_baby=True,
        camera=(
            "Two handheld over-the-shoulder fragments cut together, each following a stroller "
            "from behind, foreground leaves drifting through frame."
        ),
        prompt=(
            "Two separate moments: each woman walking her stroller through Tel Aviv toward the "
            "same destination. One passes along Rothschild Boulevard's tree-lined central path "
            "past benches and cyclists; the other passes a small corner cafe with pavement "
            "tables. They are never in the same frame."
        ),
        behaviour=(
            "one takes a sip from a takeaway coffee and finds it has gone cold; the other "
            "leans down mid-stride to retrieve a dropped soft toy"
        ),
        audio=(
            "Boulevard ambience — traffic on both flanking lanes, bicycle bells, leaves, a "
            "fragment of Hebrew conversation passing and receding, an espresso machine."
        ),
    ),

    # --- 5. Arrival: eye contact, no dialogue ------------------------------
    Shot(
        num=7, key="arrival", start=15.0, duration=3.0, lens="50mm", grade="warm",
        characters=("maya", "dana"), has_baby=True, start_from_reference="maya",
        critical=True, max_attempts=4,
        camera="Slow handheld push-in, rack focus from one woman to the other across the gate.",
        prompt=(
            "A small neighbourhood playground in Tel Aviv, mid-morning. Two women arrive at the "
            "gate from different directions with strollers. They notice each other. A brief, "
            "slightly uncertain moment of eye contact and a small closed-mouth smile. No "
            "dialogue, no wave, nothing overplayed."
        ),
        behaviour=(
            "one hesitates half a step, unsure whether to speak, and looks down at her baby "
            "instead; the other pushes hair behind her ear"
        ),
        audio=(
            "A gate hinge, stroller wheels changing from pavement to rubber matting, children "
            "playing further off, leaves."
        ),
        note="Hesitation is the point. A confident greeting here would be a lie.",
    ),

    # --- 6. The babies — the emotional climax ------------------------------
    Shot(
        num=8, key="babies", start=18.0, duration=4.0, lens="50mm", grade="warm",
        has_baby=True, critical=True, max_attempts=6,
        camera=(
            "Very low handheld at stroller height, extremely shallow focus, a parent's knee "
            "soft in the foreground, slow drift between the two babies."
        ),
        city=False,  # Tight close-up. Nothing but skin, fabric and blur belongs here.
        prompt=(
            "Two babies, around ten months old, each held on their mother's lap on a low "
            "playground bench, facing each other closely. One notices the other and stares, "
            "then breaks into a real open-mouthed giggle. The second baby reaches a hand toward "
            "the first. Both mothers' hands and arms are visible holding them steady, but the "
            "mothers' faces are out of frame — this moment belongs to the babies."
        ),
        behaviour=(
            "a small hand grabs at the other baby's sleeve and misses; one baby kicks with "
            "excitement; a mother's thumb strokes a foot without her thinking about it"
        ),
        audio=(
            "Very close and intimate — two babies babbling, one real bubbling giggle, fabric "
            "rustling, a soft delighted exhale from a mother off-frame. Playground behind."
        ),
        note=(
            "THE CLIMAX and the longest shot in the film. The babies connect BEFORE the adults "
            "do — that is the whole thesis. Budget the most attempts here; if this giggle never "
            "reads as real, the film does not work and needs restructuring."
        ),
    ),

    # --- 7. The mothers, finally ------------------------------------------
    Shot(
        num=9, key="mothers", start=22.0, duration=3.5, lens="50mm", grade="warm",
        characters=("maya", "dana"), has_baby=True, critical=True, max_attempts=5,
        start_from_reference="dana",
        camera="Handheld two-shot, slow drift, foreground stroller wheel blurred across the lens.",
        prompt=(
            "The two women now sitting together on a low playground wall, babies on their laps, "
            "takeaway coffee cups beside them, mid-conversation. One says something ordinary "
            "and the other laughs — a small, genuine, slightly surprised laugh, not a "
            "performance. Relaxed shoulders. The easy awkwardness of people twenty minutes into "
            "knowing each other."
        ),
        behaviour=(
            "one blows across the top of her coffee before drinking; the other adjusts her "
            "baby's sunhat mid-sentence and loses her thread for a second"
        ),
        audio=(
            "Two women talking quietly in Hebrew, words indistinct and overlapping the way real "
            "conversation does, then one short genuine laugh. Babies and playground behind."
        ),
        note="The film's first human voices. Everything before this is wordless.",
    ),

    # --- 8. Wide ending ----------------------------------------------------
    Shot(
        num=10, key="wide", start=25.5, duration=2.0, lens="35mm", grade="warm",
        has_baby=True,
        camera="Very slow handheld pull-back, holding the wide, almost still but breathing.",
        prompt=(
            "Wide shot of a Tel Aviv neighbourhood playground in late golden light. Several "
            "young families together — parents on benches and on the low wall, strollers "
            "parked, babies and toddlers on laps and on the matting. Bauhaus buildings and "
            "ficus canopy behind. A cyclist passes on the path. Unhurried, ordinary, alive."
        ),
        behaviour="nobody performs; people are simply talking, watching children, drinking coffee",
        audio=(
            "Full warm playground ambience — overlapping conversation, children, a chain swing, "
            "distant city traffic, birds."
        ),
    ),
]

SHOTS_BY_KEY = {s.key: s for s in SHOTS}

TOTAL_DURATION = 30.0
CARD_IN = 27.5

# The client's line, chosen over the alternate. Warmer and more parent-facing.
CARD_LINE_HE = "הקהילה שלכם קרובה יותר ממה שחשבתם."
CARD_LINE_EN = "Your community is closer than you think."

CAPTIONS = [
    (0.0, 7.0, "[בוקר. דירה בתל אביב]"),
    (12.0, 15.0, "[גלגלי עגלה. רחוב תל אביבי]"),
    (18.0, 22.0, "[תינוקות מגלים זה את זה]"),
    (24.5, 25.5, "[צחוק]"),
    (27.6, 30.0, "הקהילה שלכם קרובה יותר ממה שחשבתם.  ·  NestUp"),
]
