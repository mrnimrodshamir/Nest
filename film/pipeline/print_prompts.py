"""Print the exact prompt strings the pipeline sends to Veo, ready to paste.

These are assembled by Shot.full_prompt() — the same call generate.py makes — so
what you paste is byte-identical to what the automated run would submit.

    python print_prompts.py            # human-readable
    python print_prompts.py --md       # markdown, for sharing
"""
from __future__ import annotations

import argparse

from config import NEGATIVE_PROMPT, SHOTS, VEO_MODEL


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--md", action="store_true")
    args = parser.parse_args()

    shots = [s for s in SHOTS if s.generated]

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
