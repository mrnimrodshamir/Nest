# NestUp commercial — automated pipeline

Veo 3 + Imagen + Gemini via the Gemini API, assembled with ffmpeg.
Concept C, "They Were Here All Along". The film is defined in `config.py`;
edit that, never the generators.

## Setup

```bash
pip install -r requirements.txt
```

The API key is read from `GEMINI_API_KEY` — environment first, then the repo's
gitignored `.env`. It is never hardcoded, logged, or written to any artefact.

```bash
echo "GEMINI_API_KEY=<your key>" >> ../../.env
```

ffmpeg is required for review frame extraction and all assembly.

## Run

```bash
python run.py doctor       # env, SDK, ffmpeg, assets. Spends nothing.
python run.py characters   # two reference stills. STOP and look at them.
python run.py shots        # generate + auto-review + regenerate weak takes
python run.py assemble     # conform, grade, score, caption, export
python run.py all
```

Everything is resumable — existing artefacts are reused, and generation never
re-runs speculatively. `--force` overrides. `--shot introduction` limits to one.

## How the automation actually works

**Generate → review → regenerate** is a real loop, not a formality. Each take is
sampled into four frames and scored by Gemini against a deliberately hostile
rubric: human authenticity, anatomy, cinematography, brief adherence, usability.
Warped hands cap the score at 2. Anything below 7 is rejected and regenerated
with the reviewer's own prompt advice attached; critical shots must clear 8.

A model that says "pass" at 5.5 is being agreeable, so the numeric score
overrides the label. Agreeableness is precisely what ruins this footage.

Shots are attempted **critical-first**. If the laugh in shot 10 never lands, the
film needs restructuring, and that is far cheaper to learn on take three than on
take thirty.

If a shot exhausts its attempts, the best take is kept and loudly flagged rather
than silently shipped.

## Character consistency — the honest limitation

Veo 3 through the Gemini API takes **one start image**, not a set of identity
references. It has no true cross-shot identity locking. Consistency here rests on
three weaker mechanisms stacked: a fixed verbatim character description in every
prompt, an Imagen reference still as the start frame, and wardrobe that never
changes (which is what viewers actually track).

This is materially less reliable than a reference-driven model such as Seedance
2.0. It is a real cost of the Veo-only decision. Expect to burn attempts on the
face shots, and check every one by eye — the reviewer catches anatomy and gloss,
but it cannot know that shot 8's Maya is a different woman from shot 5's.

## What the pipeline cannot produce

Three inputs are yours. `doctor` reports them as missing until they exist:

- **`assets/app_screen.mp4`** — the app beat. A screen recording of the shipping
  build, not a generation. **The join count must be real**; this is going to a
  municipality, and a fabricated number is the one error that cannot be walked
  back in that room.
- **`assets/music/score.wav`** — the Gemini API has no music model. Veo emits
  native per-clip audio, but a 30-second film needs one continuous score, not
  eleven unrelated beds. Licensed track, solo felt piano.
- **`assets/fonts/Heebo-{Medium,Regular}.ttf`** — Hebrew must be set in a real
  Hebrew face. A Latin font substitutes glyphs and the end card will be wrong.

## Output

```
output/refs/     ref_maya.png, ref_dana.png
output/clips/    NN_key_takeN.mp4          every take, never overwritten
output/reviews/  NN_key_takeN.json         scores and flaws
output/final/    picks.json
                 NestUp_16x9_master.mp4     scored
                 NestUp_16x9_clean.mp4      no audio
                 NestUp_16x9_captioned.mp4  burned Hebrew
                 NestUp_9x16_*.mp4
```

## Cost

Nine generated shots, 33 worst-case takes, plus two stills. Veo 3 is billed per
second of output; at eight seconds per clip that is ~264 seconds of generation
worst-case, before the vertical regenerations. Check current Veo pricing against
your Google Cloud billing account before a full run — `doctor` prints the take
count so you can multiply it yourself.

Start with `characters`, then `--shot introduction`. Two stages, small spend, and
they tell you whether the film is achievable at all.
