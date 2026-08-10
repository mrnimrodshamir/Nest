# NestUp — 30" Launch Film
## Director's package: treatment, boards, prompts, timeline, sound

**Status:** pre-production complete, generation blocked on credits (0.35 available, free plan).
**Deliverable when funded:** 16:9 master, 9:16 cut, SRT (he/en), project files, all source clips.

---

## 1. The idea

The film has one job: make "a few metres apart, and they'll never know" feel like a
loss — then remove it. Everything else is restraint.

Three rules govern every decision below:

1. **Nobody is sad.** These are not lonely women. They are two capable people with
   a free morning. The gap is logistical, not emotional. If a shot reads as pity,
   it is wrong.
2. **The city is a character.** Tel Aviv does the emotional work — ficus shade,
   limestone, salt haze, the specific white light of 9am. Shoot the city honestly
   and the film earns its warmth without a single swelling chord.
3. **The product appears once, and it is real.** One clean interface beat. No
   invented features, no fake notification, no redesigned UI. Screen recordings
   from the shipping build.

**Casting note that matters more than any prompt:** the two mothers must not be
beautiful. They must be *specific*. Under-eye shadow, a scrunchie on the wrist,
one of them in yesterday's shirt. The single fastest way to make this look
AI-generated is symmetrical faces and clean hair.

---

## 2. Shot list, model assignment, and prompts

Aspect for principal photography: **16:9, 24fps, shot 4K where the model allows**,
so the 9:16 cut is a reframe from real resolution rather than an upscale.

### Identity continuity — do this first

Before any video generation, produce **two locked character reference stills** with
`nano_banana` or an equivalent image model, then pass them as `image_references`
to **Seedance 2.0** on every shot containing a face. Seedance is the only model in
the roster with genuine multi-shot identity consistency; using Veo for the people
shots will give you two different women by scene 5. This is the single highest-risk
failure in the whole production.

- `ref_mother_A.png` — early 30s, curly dark hair tied back, olive linen shirt, tote bag.
- `ref_mother_B.png` — late 20s, straight brown hair, grey tee, denim jacket knotted at waist.

Keep wardrobe identical across all shots. Continuity is cheaper than correction.

---

### SCENE 1 — 0:00–0:05 · "Two doors"

**Model:** Veo 3 (`veo-3-preview`) — no faces in close-up, so identity risk is low
and Veo's architectural light is the best in the roster.
**Aspect:** 16:9 · **Duration:** 5s · **Audio:** off (scored in post)

> Wide static cinematic shot, early morning in a residential Tel Aviv street.
> Two adjacent 1950s Bauhaus apartment buildings, cream render, rounded balconies,
> mature ficus trees casting dappled shade across the pavement. Warm low-angle
> sunlight from frame right, long soft shadows, faint Mediterranean haze.
> Simultaneously, a woman exits the doorway of the left building pushing a stroller,
> and a woman exits the right building pushing a stroller. They turn in opposite
> directions along the pavement. Neither looks up. Parked scooters, a cat on a wall,
> laundry on a balcony line. Shot on ARRI Alexa, 35mm anamorphic, shallow depth,
> natural colour, documentary realism, no camera movement.

**Direction:** the whole film lives or dies on this being *static*. Let the audience
find the second woman themselves. A camera move would tell them where to look and
kill the discovery.

---

### SCENE 2 — 0:05–0:10 · "Parallel mornings"

Shot as **two separate clips**, split in the edit — never ask a model for a
split-screen composition, it will render a literal seam.

**Model:** Seedance 2.0, `mode: std`, `resolution: 1080p`, `image_references` locked
**Duration:** 5s each

**2A — Playground**
> Medium shot, a woman in an olive linen shirt sits on the edge of a sunlit
> playground bench, one hand rocking a stroller, the other holding a phone she is
> half-watching. Behind her, empty swings move slightly in the breeze. Dappled light
> through eucalyptus. She is relaxed, unhurried, faintly bored — an ordinary Tuesday.
> Natural skin texture, no makeup, flyaway hair. 50mm, shallow depth of field,
> handheld with almost imperceptible drift. Documentary, unposed.

**2B — Café**
> Medium shot, a woman in a grey tee and denim jacket sits at a small outdoor café
> table on a Tel Aviv side street, stroller parked beside her, iced coffee sweating
> on the table. She scrolls her phone with one thumb, glances up at the street, back
> down. Warm reflected light from the pavement. Passing cyclist soft in foreground.
> 50mm, shallow depth, handheld drift, natural colour, unposed documentary realism.

**Direction:** both women must at some point look *up and out* — at the street, at
nothing. That glance is the entire premise of the film. It is the "is there anything
happening today?" look, and it must not be sad. Bored and open, not lonely.

---

### SCENE 3 — 0:10–0:15 · "The real thing"

**No AI generation.** This is a screen recording of the shipping build, composited
into a filmed hand-and-phone plate.

- **Plate:** Seedance 2.0, 4s — *"Extreme close-up over the shoulder of a woman's
  hand holding a phone in dappled outdoor light, screen not visible to camera,
  thumb resting. Warm bounce light, shallow depth, real skin texture."* Generate
  the plate with a **green rectangle** where the screen sits, or track a corner-pin
  in post.
- **Screen content:** capture from the device — Discovery, sheet at the half snap
  point, a real Playground Meetup card. Genuine distance and genuine attendee count.
  If the copy says *"3 parents already joined"*, three parents must actually have
  joined. This is a municipal pitch asset; a fabricated count is the one mistake
  that cannot be walked back in that room.
- **Composite:** corner-pin track, screen-space blur to match the plate's DOF, a
  1.5% screen reflection layer, and a subtle rolling-shutter wobble so it doesn't
  read as a pasted rectangle.

**Direction:** hold the UI for a full beat before any interaction. Let it be legible.
The instinct to cut fast here is wrong — this shot is the argument.

---

### SCENE 4 — 0:15–0:22 · "Pin to park"

The signature transition. Built as a match-cut, not an effect.

**4A (2s)** — screen recording: thumb taps *I'm going*, the button state changes.
Real app, real state change.

**4B (5s)** — **Model:** Kling v3.0, `mode: pro` — the roster's strongest
camera-motion model, and this is a pure move.
> Push-in through a map pin marker that fills frame and dissolves into the real
> location: a sunlit Tel Aviv neighbourhood playground, ficus shade, children's
> voices, dust in the light. Continuous forward camera movement, smooth, no cut.
> Photorealistic, natural colour, 35mm, cinematic depth.

**Direction in the edit:** the pin's centre and the park's vanishing point must sit
at the *same screen coordinate*. Match on position and the cut disappears; miss it
by 5% and it looks like a transition preset. This is worth an hour of nudging.

---

### SCENE 5 — 0:22–0:28 · "Hello"

The most fragile passage. Generate as **three short clips**, not one long take —
long generations drift and the faces will change.

**Model:** Seedance 2.0, `image_references` locked, `mode: std`, 1080p

**5A (2s) — the approach**
> Two women arriving at a playground from opposite paths with strollers, noticing
> each other, a small uncertain wave. Mid shot, natural light, unposed.

**5B (2s) — the children**
> Close on two toddlers on a rubber playground surface, one offering the other a
> plastic bucket. Low camera at child height, warm afternoon light, shallow depth,
> documentary.

**5C (2s) — the conversation**
> Two women sitting on a low playground wall, takeaway coffees, mid-conversation,
> one laughing at something ordinary. Relaxed body language, glancing toward the
> children off-frame. Natural skin, unposed, 50mm.

**Direction:** no eye contact with camera, ever. No one says a line to the lens.
The laugh in 5C must be a *reaction*, not a performance — if it looks like an advert,
regenerate it. Budget three or four attempts on 5C specifically; it is the emotional
payload of the film and the hardest thing for any model to fake.

---

### SCENE 6 — 0:28–0:30 · "End card"

**Model:** Veo 3, 3s (trimmed to 2s)
> Wide static shot, late afternoon golden light in a Tel Aviv playground. Children
> playing in the middle distance, two parents talking on a bench at frame left.
> Warm haze, long shadows, ficus canopy. Locked camera, no movement, cinematic.

Card composited in post — never generated. Models render text as gibberish, and
Hebrew worst of all.

- Frame holds live for 20 frames, then a 12-frame dip to `#FAF8F4` (the app's own
  background — the brand's colour, not a generic white).
- NestUp mark centred, `assets/icon.png`, 180px, corners masked.
- Below, 24 frames later:

> **הקהילה שלכם קרובה יותר ממה שחשבתם.**

- Right-aligned. Set in a real Hebrew face — **Heebo** or **Assistant**, both of
  which carry the app's tone. Never let a Latin font auto-substitute Hebrew glyphs.
- Wordmark **NestUp** beneath, 60% opacity, small.
- Hold 30 frames. Cut to black. No fade on the last frame — a hard out is more
  confident.

---

## 3. Editing timeline (24fps, 16:9 master)

| In | Out | Dur | Shot | Source | Transition out |
|---|---|---|---|---|---|
| 00:00 | 00:05 | 5.0s | S1 Two doors | Veo 3 | Cut |
| 00:05 | 00:07.5 | 2.5s | S2A Playground | Seedance | Cut |
| 00:07.5 | 00:10 | 2.5s | S2B Café | Seedance | Cut |
| 00:10 | 00:13 | 3.0s | S3 UI, mother A | Screen rec + plate | Cut |
| 00:13 | 00:15 | 2.0s | S3 UI, mother B | Screen rec + plate | Cut |
| 00:15 | 00:17 | 2.0s | S4A Tap Join | Screen rec | Match cut |
| 00:17 | 00:22 | 5.0s | S4B Pin → park | Kling v3.0 | Cut |
| 00:22 | 00:24 | 2.0s | S5A Approach | Seedance | Cut |
| 00:24 | 00:26 | 2.0s | S5B Children | Seedance | Cut |
| 00:26 | 00:28 | 2.0s | S5C Conversation | Seedance | Dip to #FAF8F4 |
| 00:28 | 00:30 | 2.0s | S6 End card | Veo 3 + comp | Hard out |

**Cutting pattern:** 5s / 2.5s / 2.5s / 3s / 2s / 2s / 5s / 2s / 2s / 2s / 2s. The
film opens slow, accelerates into the app, opens out again for the transition, then
settles. Do not trim scene 1 to "get going faster" — the patience there is what
makes the meeting land.

---

## 4. Colour

One grade across the whole film, so the app footage and the live footage share a
skin. Do not grade the screen recording separately; let it sit inside the same
world.

- Base: warm neutral, ~5600K, shading amber in highlights.
- Lift the shadows slightly and desaturate them toward cool grey — Mediterranean
  shade is blue, and honouring that stops the warmth reading as a filter.
- Skin protected: keep the orange-red vector unclipped, no beauty smoothing.
- Highlight rolloff soft; the sun should bloom, not clip.
- Very light halation on speculars. Grain: 35mm, fine, ~2%. Both are there to
  break the digital-perfect surface that makes AI footage read as AI.
- **No LUT-driven teal-and-orange.** Nothing dates a launch film faster.

---

## 5. Sound

Sound carries more of this film than the picture does. Budget real attention here.

**Music.** Solo piano, felt-damped, close-mic'd with the mechanism audible. Slow,
unresolved, no percussion, no swell, no strings-entering-at-the-key-change. It
should sound like someone playing in the next apartment.

- 0:00–0:15 — sparse single notes, unhurried
- 0:15–0:22 — one gentle harmonic lift as the pin becomes the park
- 0:22–0:30 — a simple resolution, then let it decay into ambience under the card

**Ambience** (mixed low, always present — silence is what makes AI footage feel fake):
street ambience with distant traffic; a scooter passing in S1; sparrows and ficus
leaves; café clatter and an espresso machine in 2B; playground foley — a chain
swing, rubber matting, children at conversational distance, never shrieking.

**Design details that do the heavy lifting:**
- S3: no UI sound at all. Silence on the interface beat is more premium than a chime.
- S4A: one soft haptic-like *tick* on the Join tap. This is the only designed sound
  effect in the film. Used once, it becomes the brand's sonic signature.
- S4B: crossfade the street bed into the park bed *across* the match cut, starting
  4 frames early. Sound leads picture; the audience arrives before the image does.
- S5: the first human voice in the whole film is the laugh in 5C. Everything before
  is wordless. That is what makes it land.
- No voiceover. No tagline read aloud. The card speaks.

**Mix:** −16 LUFS integrated, true peak −1.5 dBTP. Duck the ambience 3 dB under the
card so the last two seconds feel like a held breath.

---

## 6. The 9:16 cut

Not a centre-crop. A separate edit — a reframed crop of a 16:9 master will lose
both women in scene 1, which destroys the premise.

- **S1** — regenerate natively at 9:16. Stack the buildings vertically: one doorway
  upper frame, one lower. The vertical composition actually tells the "two doors,
  no contact" story *better* than the wide.
- **S2** — the split becomes a genuine vertical stack, playground above, café below.
  This is the one place the vertical format wins outright.
- **S3/S4A** — the phone fills the frame. Best-looking shots in the vertical cut.
- **S4B/S5** — reframe from 4K masters, tracking the subject; punch in ~15%.
- **S6** — regenerate at 9:16, card centred, type one size larger.
- Duration holds at 30s. Nothing is cut, only recomposed.

---

## 7. Cost and how to unblock

Current balance: **0.35 credits, free plan.** Nothing can generate.

Estimated volume — 11 finished clips, and realistically **2–3 attempts per shot**
(scene 5C more), so budget **25–35 generations**, weighted toward Seedance `std`
at 1080p and Kling `pro`. Add the two reference stills and any regenerated 9:16
shots. Ask me to open the top-up widget and I'll pull the live pricing rather than
guess at a number here.

**The moment credits exist, the order of work is fixed:**

1. Lock the two character reference stills. Nothing else starts until the faces are
   final — every downstream shot depends on them.
2. Scene 1 and Scene 6 (no faces, lowest risk, establishes the grade).
3. Scene 5C. Generate it early and often. If the laugh never looks real, the film
   needs restructuring, and it is far better to learn that on day one.
4. Everything else.
5. Screen recordings from the device — I'll direct the exact capture steps.
6. Assembly, grade, mix, both cuts.

---

## 8. What I need from you

- **Credits**, or the film stops here.
- **Device capture** for scene 3 and 4A, or permission to drive it — I need a real
  Playground Meetup with a real join count. If none exists yet, seed one properly
  rather than faking the number.
- **A call on the two faces** once the reference stills exist. That is a casting
  decision and it belongs to you, not to me.
