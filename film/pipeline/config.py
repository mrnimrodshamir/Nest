"""The film, as data. v4 — "Your community is closer than you think."

Every creative decision lives here so the pipeline stays mechanical. Edit this
file to change the film; never edit the generators.

WHAT v4 FIXES, FROM REVIEWING THE v3 PROOF-OF-CONCEPT FOOTAGE
  * MIRRORED BLOCKING. The gate shot had both mothers walking toward each
    other, symmetrically framed, same pose, same stroller, same instant. Two
    people performing one choreography is the fastest possible AI tell. v4
    forbids it structurally: the two women are never in the same frame until
    they are already sitting down, and ANTI_MIRROR is appended to every shot.
  * A GENERATED LOGO. The wide ending had a NestUp mark baked into the plate at
    mid-depth, behind a branch — wrong proportions, wrong colours, and a
    wordmark reading "estUp". Unusable and not compositable over. Branding is
    never generated; it is added in the edit, always.
  * OVERPLAYED FACES. One mother's reaction read as a cartoon "oh!"; the baby's
    laugh was a performance. v4 asks for noticing, not reacting.
  * CAUSE AND EFFECT. v3 put the two women together with no reason. Now the app
    beat runs BETWEEN the two mornings and shows the same activity joined
    twice, so the meeting is earned before it happens.
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
@dataclass(frozen=True)
class Character:
    key: str
    reference_prompt: str
    description: str


MAYA = Character(
    key="maya",
    reference_prompt=(
        "Candid photograph of a real 31-year-old Israeli woman, dark curly hair in a messy bun "
        "with strands escaping, visible tiredness under her eyes, no makeup, faint freckles, "
        "soft olive linen shirt slightly creased. Neutral unposed expression, NOT smiling, not "
        "looking at the camera, even soft daylight, plain pale background. Ordinary and "
        "specific, NOT a fashion model. Documentary photography, 50mm, visible skin texture."
    ),
    description=(
        "a tired 31-year-old woman with dark curly hair in a messy bun, no makeup, wearing a "
        "creased olive linen shirt and straight jeans"
    ),
)

DANA = Character(
    key="dana",
    reference_prompt=(
        "Candid photograph of a real 28-year-old Israeli woman, straight shoulder-length brown "
        "hair pushed behind one ear, slightly tired warm face, minimal makeup, grey cotton "
        "t-shirt and a denim jacket. Neutral unposed expression, NOT smiling, not looking at "
        "the camera, even soft daylight, plain pale background. Ordinary and specific, NOT a "
        "fashion model. Documentary photography, 50mm, visible skin texture."
    ),
    description=(
        "a 28-year-old woman with straight shoulder-length brown hair, a grey t-shirt and a "
        "denim jacket"
    ),
)

CHARACTERS = {c.key: c for c in (MAYA, DANA)}

BABY_RULE = (
    "The baby is ALWAYS physically with a parent — held, on a lap, or in a stroller the parent "
    "has a hand on. Never a child alone in frame."
)

# Appended to every shot. The v3 footage failed on exactly these.
ANTI_MIRROR = (
    "Only ONE mother appears in this shot. No second adult performing a matching action, no "
    "symmetrical composition, no mirrored blocking."
)

RESTRAINT = (
    "Underplayed. No broad smiles, no laughing, no surprised expressions, no reacting to "
    "camera. Ordinary unremarkable behaviour, as if unaware of being filmed."
)

NEGATIVE_PROMPT = (
    "glossy skin, airbrushed faces, symmetrical model looks, fashion model, influencer "
    "aesthetic, full makeup, stock-photo smiling, grinning, exaggerated expressions, surprised "
    "face, cartoon reaction, people looking at camera, mirrored composition, two people doing "
    "the same action, synchronized movement, repeated looping movement, robotic motion, slow "
    "motion, lens flare, drone shot, orbiting camera, teal and orange grade, generic European "
    "city, text, letters, words, watermark, logo, brand mark, signage in focus, user interface, "
    "phone screen content, distorted hands, extra fingers, warped faces, plastic skin, "
    "unattended baby"
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
        "Bright mid-morning Tel Aviv daylight through ficus leaves, dappled shade, neutral warm "
        "balance, natural unfiltered colour."
    ),
}

CITY_NOTE = (
    "Unmistakably Tel Aviv: white and cream 1930s Bauhaus buildings with rounded balconies and "
    "external shutters, ficus street trees, parked bicycles and electric scooters, "
    "air-conditioning units, Mediterranean haze. No readable signage."
)

COMMON_STYLE = (
    "Shot on ARRI Alexa, {lens}, T2.0, shallow depth of field with soft foreground blur. "
    "{camera} Documentary realism, unposed, imperfect timing, visible skin texture. Real "
    "people, not actors performing. Ordinary residential Tel Aviv, never touristic."
)


@dataclass(frozen=True)
class Shot:
    num: int
    key: str
    start: float
    duration: float
    prompt: str
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
    city: bool = True
    solo: bool = True     # False only where both women are legitimately together
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
        if self.solo:
            parts.append(ANTI_MIRROR)
        parts.append(RESTRAINT)
        if self.has_baby:
            parts.append(BABY_RULE)
        parts.append(GRADE_NOTE[self.grade])
        if self.city:
            parts.append(CITY_NOTE)
        parts.append(COMMON_STYLE.format(lens=self.lens, camera=self.camera))
        if self.audio:
            # Diegetic only, and NO SPEECH: v3 produced invented Hebrew mumbling.
            parts.append(
                f"Audio: {self.audio} No dialogue, no speech, no voices saying words. "
                "No background music, no score."
            )
        return " ".join(parts)


SHOTS: list[Shot] = [
    # === PARALLEL MORNINGS — alternating, never simultaneous =================
    Shot(
        num=1, key="maya_home", start=0.0, duration=3.0, lens="35mm", grade="cool",
        characters=("maya",), has_baby=True, start_from_reference="maya", city=False,
        camera="Slow handheld push-in from a doorway, foreground doorframe blurred.",
        prompt=(
            "Interior, a small Tel Aviv apartment at 7am. Cool light through half-open shutters "
            "throwing slatted stripes across the floor. A woman moves through an ordinary "
            "morning with a baby on her hip — gathering a bag, checking a changing mat. "
            "Domestic clutter: a drying rack, a half-drunk coffee."
        ),
        behaviour=(
            "she shifts the baby from one hip to the other without thinking, then pats her "
            "pocket for keys and does not find them the first time"
        ),
        audio="Quiet interior — fridge hum, a spoon on ceramic, small wordless baby sounds.",
    ),
    Shot(
        num=2, key="maya_street", start=3.0, duration=2.5, lens="50mm", grade="cool",
        characters=("maya",), has_baby=True, start_from_reference="maya",
        camera="Handheld tracking alongside her at walking pace, shallow focus.",
        prompt=(
            "Exterior, a residential Tel Aviv street just after sunrise. A woman pushes a "
            "stroller along the pavement, a takeaway coffee in one hand. A cyclist passes "
            "behind her. Ordinary, unhurried."
        ),
        behaviour="she drinks from the coffee and finds it has already gone lukewarm",
        audio="Stroller wheels on uneven pavement, a bicycle freewheel, a shutter rolling up, sparrows.",
    ),
    Shot(
        num=3, key="dana_home", start=5.5, duration=2.5, lens="35mm", grade="cool",
        characters=("dana",), has_baby=True, start_from_reference="dana",
        camera="Handheld, low, following her out through a building's street door.",
        prompt=(
            "A different woman comes out of a Bauhaus apartment building's street door, "
            "manoeuvring a stroller down two steps and turning the opposite way along the "
            "pavement. Morning light. A completely different action from anything before it — "
            "not walking, not drinking coffee: negotiating a doorway."
        ),
        behaviour=(
            "she holds the door with her hip, bumps the stroller down the steps one wheel at a "
            "time, then crouches to check the baby before straightening up"
        ),
        audio="A heavy door on a closer, stroller wheels on steps, a scooter passing, street birds.",
        note="Deliberately a different ACTION and a different framing from Maya's morning.",
    ),

    # === THE APP — real footage, the story's hinge ==========================
    # NEVER GENERATED. Screen recordings from the shipping build, motion-tracked
    # into a phone in a filmed hand plate. Veo invents features and renders text
    # as gibberish — the v3 wide shot's mangled "estUp" logo proved it.
    Shot(
        num=4, key="app_maya", start=8.0, duration=2.5, generated=False, prompt="",
        note=(
            "REAL UI 1 — Maya's phone: home screen, then Discovery with nearby activities, "
            "settling on Morning Playground Meetup / Meir Park / starts in 15 minutes / "
            "parents joining / distance. film/assets/app_01_maya.mp4"
        ),
    ),
    Shot(
        num=5, key="app_dana", start=10.5, duration=2.5, generated=False, prompt="",
        note=(
            "REAL UI 2 — Dana's phone: THE SAME activity card, then Join, then the "
            "confirmation and the map pin. The repeat is the whole story — cause and effect, "
            "no narration needed. THE JOIN COUNT MUST BE REAL. film/assets/app_02_dana.mp4"
        ),
    ),

    # === TWO JOURNEYS, STILL SEPARATE ======================================
    Shot(
        num=6, key="maya_walk", start=13.0, duration=2.5, lens="35mm", grade="mid",
        characters=("maya",), has_baby=True,
        camera="Over-the-shoulder, following the stroller from behind, foreground leaves drifting through frame.",
        prompt=(
            "A woman walks her stroller along Rothschild Boulevard's tree-lined central path, "
            "past benches and a dog walker. Dappled light through ficus."
        ),
        behaviour="she leans down mid-stride to retrieve a soft toy the baby has dropped",
        audio="Boulevard ambience — traffic on both flanking lanes, a bicycle bell, leaves, a dog's collar.",
    ),
    Shot(
        num=7, key="dana_coffee", start=15.5, duration=2.0, lens="50mm", grade="mid",
        characters=("dana",), has_baby=True,
        camera="Handheld, slight rack focus from the counter to her face.",
        prompt=(
            "A woman waits at a small Tel Aviv corner cafe's pavement counter, one hand on her "
            "stroller, while a takeaway coffee is made. She is not on her phone. A completely "
            "different activity from the previous shot."
        ),
        behaviour="she rocks the stroller absently with one hand while she waits",
        audio="Espresso machine, steam wand, cups on saucers, street traffic behind.",
    ),

    # === ARRIVAL — accidental, not converging ==============================
    Shot(
        num=8, key="arrival", start=17.5, duration=2.5, lens="35mm", grade="warm",
        characters=("maya",), has_baby=True, start_from_reference="maya",
        camera="Static-ish handheld wide, letting her enter and settle within the frame.",
        prompt=(
            "A small Tel Aviv neighbourhood playground. A woman arrives alone, parks her "
            "stroller beside a low wall, sets the brake and sits down, lifting the baby onto "
            "her lap. She is not looking for anyone. Other families are around, unremarkable."
        ),
        behaviour="she stretches her back after sitting, and pushes the stroller hood down to let light in",
        audio="Playground ambience at a distance, a chain swing, stroller brake, fabric.",
        note="She is NOT walking toward anyone. The meeting must be accidental.",
    ),

    # === THE BABIES — the climax, and it is quiet ==========================
    Shot(
        num=9, key="babies", start=20.0, duration=4.0, lens="50mm", grade="warm",
        has_baby=True, critical=True, max_attempts=6, city=False, solo=False,
        camera=(
            "Very low handheld at lap height, extremely shallow focus, a parent's knee soft in "
            "the foreground, slow drift between the two babies."
        ),
        prompt=(
            "Two babies around ten months old, each on their own mother's lap at opposite ends "
            "of the same low wall, close enough to see each other. One notices the other and "
            "simply looks — a long, curious, unblinking stare. A small quiet smile. One reaches "
            "a hand out a little way. That is all that happens. The mothers' hands hold the "
            "babies steady but their faces are out of frame."
        ),
        behaviour=(
            "one baby's hand opens and closes; the other kicks once; a mother's thumb moves on "
            "a foot without her thinking about it"
        ),
        audio=(
            "Very close and intimate — soft baby breathing, one small wordless sound, fabric "
            "rustling. Playground far behind and low."
        ),
        note=(
            "THE CLIMAX, and the v3 version overplayed it. Noticing, not laughing. A stare and "
            "a small smile carry more than a giggle, and are far easier to generate credibly. "
            "Most attempts budgeted here."
        ),
    ),

    # === THE MOTHERS — reacting AFTER the babies ===========================
    Shot(
        num=10, key="mothers", start=24.0, duration=3.0, lens="50mm", grade="warm",
        characters=("maya", "dana"), has_baby=True, critical=True, max_attempts=5,
        start_from_reference="dana", solo=False,
        camera="Handheld two-shot, slow drift, foreground stroller wheel blurred across the lens.",
        prompt=(
            "The two women, already sitting at either end of the same low wall with babies on "
            "their laps, both notice what their babies are doing and look up at each other. A "
            "small, brief, closed-mouth smile between them — the acknowledgement of strangers "
            "who have just been given a reason to speak. They do not speak yet. Coffee cups "
            "beside them."
        ),
        behaviour="one glances back down at her baby, then up again; the other tilts her head slightly",
        audio="Playground ambience, fabric, a coffee cup set down on stone. No speech.",
        note="The mothers react AFTER the babies. Never before, never simultaneously.",
    ),

    # === WIDE ENDING — and NO generated branding ===========================
    Shot(
        num=11, key="wide", start=27.0, duration=1.5, lens="35mm", grade="warm",
        has_baby=True, solo=False,
        camera="Very slow handheld pull-back, holding wide, almost still but breathing.",
        prompt=(
            "Wide shot of a Tel Aviv neighbourhood playground in late golden light. Several "
            "young families — parents on benches and a low wall, strollers parked, babies and "
            "toddlers on laps and on a play mat. Bauhaus buildings and ficus canopy behind. "
            "Absolutely no signage, no logos, no text anywhere in frame."
        ),
        behaviour="nobody performs; people talk, watch children, drink coffee",
        audio="Full warm playground ambience — overlapping voices too distant to make out words, children, birds.",
        note=(
            "v3 generated a fake NestUp logo into this plate at mid-depth, behind a branch, "
            "with a broken wordmark. Branding is composited in the edit, never generated."
        ),
    ),
]

SHOTS_BY_KEY = {s.key: s for s in SHOTS}

TOTAL_DURATION = 30.0
CARD_IN = 28.5

CARD_LINE_HE = "הקהילה שלכם קרובה יותר ממה שחשבתם."
CARD_LINE_EN = "Your community is closer than you think."

# --------------------------------------------------------------------------
# Voice-over — English only, and sparse
# --------------------------------------------------------------------------
# Two lines in thirty seconds. They land in the first half, explain the product
# once, and then get out of the way: everything from the babies onward plays in
# ambience alone. Generated with a real TTS voice, never by Veo — v3's native
# audio invented Hebrew mumbling that sounded like speech and meant nothing.
VOICEOVER = [
    (5.0, "Somewhere near you, another parent is having the same morning."),
    (13.2, "NestUp shows them the same playground, at the same hour."),
    # 15.7 -> 30.0 is deliberately silent. The babies do not need narrating.
]

CAPTIONS = [
    (5.0, 9.5, "Somewhere near you, another parent is having the same morning."),
    (13.2, 17.5, "NestUp shows them the same playground, at the same hour."),
    (28.6, 30.0, "Your community is closer than you think."),
]
