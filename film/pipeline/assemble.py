"""Assembly: trim, conform, grade, score, caption, export.

All ffmpeg. The edit is deterministic — every cut point comes from config.SHOTS,
so re-running produces an identical master.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from config import (
    BRAND_BG,
    CAPTIONS,
    CARD_IN,
    CARD_LINE_HE,
    CLIPS,
    FINAL,
    FPS,
    ROOT,
    SHOTS,
    TOTAL_DURATION,
    Shot,
)

ASSETS = ROOT / "assets"
WORK = FINAL / "work"

# Act-based grade. The film's colour tells the story: warm at the ends, cool
# through the near-misses. Applied uniformly so the app screen recording sits in
# the same world rather than floating above it.
GRADE_CURVES = {
    "warm": "eq=contrast=1.04:saturation=1.02,colorbalance=rs=0.03:gs=0.01:bs=-0.04",
    "cool": "eq=contrast=0.98:saturation=0.94,colorbalance=rs=-0.03:gs=0.0:bs=0.05",
    "mid":  "eq=contrast=1.01:saturation=0.99,colorbalance=rs=0.01:gs=0.0:bs=-0.01",
}
# Film texture. Both exist to break the digital-perfect surface that reads as AI.
FILM_LOOK = "noise=alls=4:allf=t+u,unsharp=3:3:0.3"


def _run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def conform(shot: Shot, source: Path, width: int, height: int) -> Path:
    """Trim to edit duration, scale to the delivery frame, apply the act grade."""
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / f"{shot.num:02d}_{shot.key}_{width}x{height}.mp4"
    if out.exists():
        return out

    grade = GRADE_CURVES[shot.grade if shot.generated else "mid"]
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},fps={FPS},{grade},{FILM_LOOK}"
    )
    _run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(source), "-t", f"{shot.duration}",
        "-vf", vf, "-an",
        "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p",
        str(out),
    ])
    return out


def build_end_card(width: int, height: int) -> Path:
    """Type card, composited not generated — models render Hebrew as gibberish."""
    out = WORK / f"card_{width}x{height}.mp4"
    if out.exists():
        return out

    font = ASSETS / "fonts" / "Heebo-Medium.ttf"
    if not font.exists():
        raise FileNotFoundError(
            f"Missing {font}. Hebrew must be set in a real Hebrew face — a Latin font "
            "will substitute glyphs and the card will be wrong. Download Heebo and place "
            "it there."
        )
    logo = ASSETS.parent.parent / "assets" / "icon.png"
    duration = TOTAL_DURATION - CARD_IN
    fontsize = int(height * 0.045)

    _run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", f"color=c={BRAND_BG}:s={width}x{height}:d={duration}:r={FPS}",
        "-i", str(logo),
        "-filter_complex",
        (
            f"[1:v]scale={int(height*0.14)}:-1[logo];"
            f"[0:v][logo]overlay=(W-w)/2:(H-h)/2-{int(height*0.06)}[bg];"
            f"[bg]drawtext=fontfile='{font.as_posix()}':text='{CARD_LINE_HE}':"
            f"fontcolor=0x2B2B2B:fontsize={fontsize}:x=(w-tw)/2:y=h/2+{int(height*0.05)}:"
            f"alpha='min(1,max(0,(t-0.4)/0.5))'"
        ),
        "-t", f"{duration}", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
        str(out),
    ])
    return out


def concat(segments: list[Path], out: Path) -> Path:
    listing = WORK / f"{out.stem}_concat.txt"
    listing.write_text(
        "\n".join(f"file '{p.as_posix()}'" for p in segments), encoding="utf-8"
    )
    _run([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", str(listing), "-c", "copy", str(out),
    ])
    return out


def mix_audio(video: Path, out: Path) -> Path:
    """Score + ambience under picture.

    NOTE ON MUSIC: the Gemini API has no music model. Veo 3 can emit native audio
    per clip, but a 30-second film needs ONE continuous score, not eleven
    unrelated beds — so the score is a supplied, licensed track. Drop it at
    film/assets/music/score.wav. Ambience beds are optional and layered the same way.
    """
    music = ASSETS / "music" / "score.wav"
    if not music.exists():
        print(f"[audio] no score at {music} — exporting mute master")
        return video

    _run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(video), "-i", str(music),
        "-filter_complex",
        # -16 LUFS delivery, with the card ducked so the last beat feels held.
        f"[1:a]atrim=0:{TOTAL_DURATION},afade=t=out:st={TOTAL_DURATION-2}:d=2,"
        f"volume='if(gte(t,{CARD_IN}),0.7,1)':eval=frame,"
        "loudnorm=I=-16:TP=-1.5:LRA=11[a]",
        "-map", "0:v", "-map", "[a]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest",
        str(out),
    ])
    return out


def burn_captions(video: Path, out: Path, height: int) -> Path:
    font = ASSETS / "fonts" / "Heebo-Regular.ttf"
    if not font.exists():
        raise FileNotFoundError(f"Missing {font} — needed for Hebrew captions.")

    draws = ";".join(
        f"drawtext=fontfile='{font.as_posix()}':text='{text}':fontcolor=white@0.85:"
        f"fontsize={int(height*0.028)}:box=1:boxcolor=black@0.35:boxborderw=10:"
        f"x=(w-tw)/2:y=h-{int(height*0.10)}:enable='between(t,{start},{end})'"
        for start, end, text in CAPTIONS
    )
    _run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(video),
        "-vf", draws, "-c:a", "copy", "-c:v", "libx264", "-crf", "16",
        "-pix_fmt", "yuv420p", str(out),
    ])
    return out


def build_master(picks: dict[str, Path], width: int, height: int, label: str) -> Path:
    """Full conform -> concat -> score -> deliverables for one aspect ratio."""
    FINAL.mkdir(parents=True, exist_ok=True)
    segments = []
    for shot in SHOTS:
        source = picks.get(shot.key)
        if source is None:
            raise FileNotFoundError(
                f"No approved take for shot {shot.num} ({shot.key}). "
                + (shot.note if not shot.generated else "Run the generate stage.")
            )
        segments.append(conform(shot, source, width, height))
    segments.append(build_end_card(width, height))

    clean = concat(segments, FINAL / f"NestUp_{label}_clean.mp4")
    scored = mix_audio(clean, FINAL / f"NestUp_{label}_master.mp4")
    burn_captions(scored, FINAL / f"NestUp_{label}_captioned.mp4", height)
    print(f"[assemble] {label}: master, clean and captioned written to {FINAL}")
    return scored
