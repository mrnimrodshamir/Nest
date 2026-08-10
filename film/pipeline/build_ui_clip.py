"""Build the app beat from the REAL NestUp interface.

Veo never sees the UI. Asking a video model to render an app screen produces
invented features and gibberish text, and this film goes to a municipality — the
interface has to be the shipping one, pixel for pixel.

Source is a genuine device screenshot from the project. This composes it into a
3-second beat with a slow push-in and a tap ripple on the join control, which is
what a screen recording of that interaction looks like once graded.

    python build_ui_clip.py <screenshot.png> [--tap X,Y]

Prefer a true screen recording when you have one: drop it at
film/assets/app_screen.mp4 and this script becomes unnecessary.
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from config import FPS, ROOT, SHOTS_BY_KEY

OUT = ROOT / "assets" / "app_screen.mp4"
# Delivery frame; the phone screen is composited to fill it in the edit.
WIDTH, HEIGHT = 1920, 1080


def build(screenshot: Path, tap: tuple[int, int] | None) -> Path:
    duration = SHOTS_BY_KEY["app"].duration
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # Slow 4% push-in over the beat. Real screen recordings are static, but the
    # edit needs this shot to breathe like the ones either side of it.
    zoom = f"zoompan=z='min(1.04,1+0.04*on/({FPS}*{duration}))':d=1:s={WIDTH}x{HEIGHT}:fps={FPS}"
    chain = [
        f"scale={WIDTH}:-1:flags=lanczos",
        f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xFAF8F4",
        zoom,
    ]

    if tap:
        x, y = tap
        # A brief expanding ring at the moment of the join tap. Timed to land at
        # 2.0s so the cut to the park at the end of the beat follows the press.
        chain.append(
            f"drawbox=x={x}-40:y={y}-40:w=80:h=80:color=white@0.35:t=fill:"
            f"enable='between(t,2.0,2.25)'"
        )

    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-i", str(screenshot),
            "-t", f"{duration}", "-vf", ",".join(chain),
            "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-an",
            str(OUT),
        ],
        check=True,
    )
    print(f"[ui] {screenshot.name} -> {OUT} ({duration}s)")
    return OUT


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose the app beat from real UI")
    parser.add_argument("screenshot", type=Path)
    parser.add_argument("--tap", help="x,y of the join control, for the tap ripple")
    args = parser.parse_args()

    if not args.screenshot.exists():
        print(f"missing {args.screenshot}")
        return 1

    tap = None
    if args.tap:
        x_str, _, y_str = args.tap.partition(",")
        tap = (int(x_str), int(y_str))

    build(args.screenshot, tap)
    print(
        "\nNOTE: verify the join count on screen is REAL. This is a municipal asset; "
        "a fabricated number is the one error that cannot be walked back in that room."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
