"""Print the exact prompt strings the pipeline sends to Veo, ready to paste.

These are assembled by Shot.full_prompt() — the same call generate.py makes — so
what you paste is byte-identical to what the automated run would submit.

    python print_prompts.py            # human-readable
    python print_prompts.py --md       # markdown, for sharing
"""
from __future__ import annotations

import argparse

from config import NEGATIVE_PROMPT, SHOTS, VEO_MODEL


# The exclusions that actually earned their place, from reviewing real output.
# Deliberately SHORT and placed EARLY: a long prompt risks truncation in Flow's
# box, and anything cut is cut from the end — which is exactly where a naive
# build would put the rules that matter most.
FLOW_BANS = (
    "No text, letters, signage, logos or phone screens anywhere in frame. No mirrored or "
    "symmetrical composition and never two people doing the same action at once. No glossy "
    "skin, no model looks, no stock-photo smiling, nobody looking at camera. No slow motion, "
    "drone or orbiting camera, no lens flare, no teal-and-orange."
)


def flow_prompt(shot) -> str:
    """A compact Flow prompt: scene, behaviour, cast, bans, look, camera, sound.

    Rebuilt rather than reusing full_prompt() because the API path carries the
    exclusions in a separate negative_prompt field, where length is free. Here
    every character competes with the description for the model's attention.
    """
    from config import CHARACTERS, CITY_NOTE, GRADE_NOTE

    parts = [shot.prompt]
    if shot.behaviour:
        parts.append(f"Small unposed detail: {shot.behaviour}.")
    if shot.characters:
        parts.append(
            "Cast, unchanged across shots: "
            + "; ".join(CHARACTERS[k].description for k in shot.characters)
            + "."
        )
    if shot.solo:
        parts.append("Only ONE mother in this shot.")
    if shot.has_baby:
        parts.append("The baby is always held or on a lap, never alone in frame.")
    parts.append(FLOW_BANS)
    parts.append("Underplayed, documentary, as if unaware of being filmed.")
    parts.append(GRADE_NOTE[shot.grade])
    if shot.city:
        parts.append(CITY_NOTE)
    parts.append(f"{shot.lens}, T2.0, shallow focus. {shot.camera}")
    if shot.audio:
        parts.append(f"Sound: {shot.audio} No speech, no music.")
    return " ".join(parts)


def print_flow(shots) -> int:
    """Google Flow has one prompt box and no negative field, so the exclusions
    must ride inside the prompt or they are silently dropped."""
    print("=" * 78)
    print("GOOGLE FLOW — paste one block per shot, in this order. Set 16:9.")
    print("Attach ref_maya.png / ref_dana.png as the reference image where noted.")
    print("Shots 4 and 5 are missing on purpose: that is the real app screen recording.")
    print("=" * 78)
    for shot in shots:
        ref = f"   [ref image: ref_{shot.start_from_reference}.png]" if shot.start_from_reference else ""
        print(f"\n\n### SHOT {shot.num} · {shot.key} · {shot.duration}s{ref}")
        if shot.note:
            print(f"# {shot.note}")
        print()
        print(flow_prompt(shot))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--md", action="store_true")
    parser.add_argument(
        "--flow", action="store_true",
        help="Google Flow format: exclusions folded into prose, since Flow has no negative field.",
    )
    args = parser.parse_args()

    shots = [s for s in SHOTS if s.generated]

    if args.flow:
        return print_flow(shots)

    if args.md:
        print(f"# Veo prompts — `{VEO_MODEL}`\n")
        print(f"**Negative prompt (every shot):**\n\n> {NEGATIVE_PROMPT}\n")
        for shot in shots:
            ref = f" · start frame: `ref_{shot.start_from_reference}.png`" if shot.start_from_reference else ""
            print(f"## Shot {shot.num} — {shot.key} · {shot.duration}s · {shot.aspect_ratio}{ref}\n")
            if shot.note:
                print(f"*{shot.note}*\n")
            print(f"```\n{shot.full_prompt()}\n```\n")
        return 0

    print("=" * 78)
    print(f"MODEL: {VEO_MODEL}")
    print(f"NEGATIVE PROMPT (all shots):\n{NEGATIVE_PROMPT}")
    print("=" * 78)
    for shot in shots:
        print(f"\n--- SHOT {shot.num}: {shot.key} ({shot.duration}s, {shot.aspect_ratio}) ---")
        if shot.start_from_reference:
            print(f"start frame: ref_{shot.start_from_reference}.png")
        print(shot.full_prompt())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
