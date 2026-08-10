"""Orchestrator: characters -> shots -> review -> regenerate -> assemble.

    python run.py doctor       # check env, SDK, ffmpeg, assets. Spends nothing.
    python run.py characters   # the two reference stills. Do this first.
    python run.py shots        # generate + auto-review + regenerate weak takes
    python run.py assemble     # conform, grade, score, caption, export
    python run.py all          # everything, in order

Resumable throughout: anything already on disk is reused. Generation costs real
money, so no stage re-runs speculatively — pass --force to override.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from client import describe_key_state
from config import CHARACTERS, CLIPS, FINAL, ROOT, SHOTS, SHOTS_BY_KEY

PICKS_FILE = FINAL / "picks.json"


def doctor() -> int:
    print("=" * 60)
    print(describe_key_state())

    try:
        import google.genai  # noqa: F401
        print("google-genai: installed")
    except ImportError:
        print("google-genai: MISSING  ->  pip install -r requirements.txt")

    print(f"ffmpeg: {shutil.which('ffmpeg') or 'MISSING -> winget install Gyan.FFmpeg'}")

    # Verify the configured engine actually exists on this key rather than
    # discovering mid-run that we silently fell back to something older.
    try:
        from client import get_client
        from config import VEO_MODEL

        names = [m.name for m in get_client().models.list()]
        veo = sorted({n for n in names if "veo" in n})
        print(f"\nveo models on this key: {', '.join(veo) if veo else 'NONE VISIBLE'}")
        configured = any(VEO_MODEL in n for n in names)
        print(f"configured {VEO_MODEL}: {'AVAILABLE' if configured else 'NOT FOUND — fix VEO_MODEL in config.py'}")
    except Exception as exc:  # noqa: BLE001 - doctor reports, never raises
        print(f"\nmodel list unavailable: {type(exc).__name__}: {exc}")

    for name, path in [
        ("app screen recording", ROOT / "assets" / "app_screen.mp4"),
        ("score", ROOT / "assets" / "music" / "score.wav"),
        ("Heebo Medium", ROOT / "assets" / "fonts" / "Heebo-Medium.ttf"),
        ("Heebo Regular", ROOT / "assets" / "fonts" / "Heebo-Regular.ttf"),
    ]:
        print(f"{name}: {'ok' if path.exists() else 'MISSING -> ' + str(path)}")

    generated = [s for s in SHOTS if s.generated]
    print(f"\nshots: {len(SHOTS)} total, {len(generated)} generated")
    print(f"worst-case takes: {sum(s.max_attempts for s in generated)}")
    print("=" * 60)
    return 0


def stage_characters(force: bool) -> None:
    from generate import generate_reference

    for key in CHARACTERS:
        generate_reference(key, force=force)
    print(
        "\nSTOP AND LOOK AT THESE before continuing. Every shot with a face is "
        "conditioned on them, and regenerating later invalidates everything "
        "downstream. They must look like real, tired, specific people — if they "
        "look like models, re-run with --force."
    )


def stage_shots(only: str | None, force: bool) -> dict[str, str]:
    from generate import generate_shot
    from review import review_take

    picks: dict[str, str] = {}
    if PICKS_FILE.exists():
        picks = json.loads(PICKS_FILE.read_text(encoding="utf-8"))

    targets = [s for s in SHOTS if s.generated and (only is None or s.key == only)]
    # Critical shots first: if the laugh never lands the film needs restructuring,
    # and that is far cheaper to learn on take three than on take thirty.
    targets.sort(key=lambda s: (not s.critical, s.num))

    for shot in targets:
        if shot.key in picks and not force:
            print(f"[shot {shot.num}] already approved, skipping")
            continue

        best: tuple[float, Path] | None = None
        for attempt in range(1, shot.max_attempts + 1):
            clip = generate_shot(shot, attempt, force=force)
            verdict = review_take(shot, clip)
            if best is None or verdict.overall > best[0]:
                best = (verdict.overall, clip)
            if verdict.passed:
                picks[shot.key] = str(clip)
                break
            print(f"[shot {shot.num}] rejected: {verdict.primary_flaw}")
            print(f"[shot {shot.num}] advice: {verdict.prompt_advice}")
        else:
            # Exhausted attempts. Keep the best take and flag it rather than
            # silently shipping something the reviewer rejected.
            score, clip = best  # type: ignore[misc]
            picks[shot.key] = str(clip)
            print(
                f"[shot {shot.num}] !! no take passed after {shot.max_attempts}. "
                f"Best was {score:.1f} ({clip.name}). REVIEW THIS BY EYE."
            )

    FINAL.mkdir(parents=True, exist_ok=True)
    PICKS_FILE.write_text(json.dumps(picks, indent=2), encoding="utf-8")
    return picks


def stage_assemble() -> None:
    from assemble import build_master

    picks_raw = json.loads(PICKS_FILE.read_text(encoding="utf-8")) if PICKS_FILE.exists() else {}
    picks = {k: Path(v) for k, v in picks_raw.items()}
    picks["app"] = ROOT / "assets" / "app_screen.mp4"

    missing = [s.key for s in SHOTS if s.key not in picks]
    if missing:
        print(f"cannot assemble, missing shots: {', '.join(missing)}")
        sys.exit(1)

    build_master(picks, 1920, 1080, "16x9")
    build_master(picks, 1080, 1920, "9x16")


def main() -> int:
    parser = argparse.ArgumentParser(description="NestUp commercial pipeline")
    parser.add_argument(
        "stage", choices=["doctor", "characters", "shots", "assemble", "all"]
    )
    parser.add_argument("--shot", help="limit the shots stage to one shot key")
    parser.add_argument("--force", action="store_true", help="regenerate existing artefacts")
    args = parser.parse_args()

    if args.shot and args.shot not in SHOTS_BY_KEY:
        print(f"unknown shot '{args.shot}'. Known: {', '.join(SHOTS_BY_KEY)}")
        return 1

    if args.stage == "doctor":
        return doctor()
    if args.stage == "characters":
        stage_characters(args.force)
    elif args.stage == "shots":
        stage_shots(args.shot, args.force)
    elif args.stage == "assemble":
        stage_assemble()
    elif args.stage == "all":
        stage_characters(args.force)
        stage_shots(None, args.force)
        stage_assemble()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
