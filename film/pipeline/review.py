"""Automated shot review.

Samples frames from a take and asks Gemini to judge it against the film's own
standards, returning a structured verdict. The rubric is deliberately hostile:
the default assumption is that a generated clip is subtly wrong, and the
reviewer's job is to find how. A generous reviewer is worse than none, because
it launders bad takes into the edit.
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

from client import get_client
from config import REVIEWS, REVIEW_MODEL, Shot

# Below this, a take is rejected and regenerated.
PASS_THRESHOLD = 7.0
# Critical shots carry the film; hold them higher.
CRITICAL_THRESHOLD = 8.0

RUBRIC = """You are the finishing editor on a premium brand commercial in the register of
Apple and Airbnb. You are reviewing ONE generated shot. Be harsh — this footage
will be shown to a municipal government, and an audience that senses "AI video"
stops believing the story.

Score each criterion 0-10:

1. human_authenticity — do the people look like real, specific, slightly tired
   people? Glossy skin, symmetrical model faces, stock-photo smiling, or anyone
   looking at camera should score below 4.
2. anatomy — hands, fingers, faces, limbs across all sampled frames. Any warped
   hand, extra finger, melting face or impossible limb caps this at 2.
3. cinematography — is this a composed, locked, documentary-realistic frame?
   Drone moves, orbits, lens flares, slow motion or a teal-and-orange grade
   should score low.
4. brief_adherence — does it show what the shot description asks for?
5. usability — could this cut into a premium commercial as-is?

Then give:
- verdict: "pass" or "reject"
- primary_flaw: the single worst problem, one sentence, concrete
- prompt_advice: one specific change to the prompt that would fix that flaw

Return ONLY valid JSON:
{"human_authenticity":n,"anatomy":n,"cinematography":n,"brief_adherence":n,
 "usability":n,"overall":n,"verdict":"pass|reject","primary_flaw":"...",
 "prompt_advice":"..."}"""


@dataclass
class Verdict:
    overall: float
    verdict: str
    primary_flaw: str
    prompt_advice: str
    raw: dict

    @property
    def passed(self) -> bool:
        return self.verdict == "pass"


def sample_frames(clip: Path, count: int = 4) -> list[Path]:
    """Pull evenly spaced frames. Reviewing frames rather than the video keeps
    the review cheap and lets the model actually scrutinise hands."""
    frames_dir = REVIEWS / clip.stem
    frames_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(frames_dir.glob("frame_*.jpg"))
    if len(existing) >= count:
        return existing[:count]

    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(clip),
            "-vf", f"thumbnail,fps=1/{max(1, 8 // count)}",
            "-frames:v", str(count), "-q:v", "3",
            str(frames_dir / "frame_%02d.jpg"),
        ],
        check=True,
    )
    return sorted(frames_dir.glob("frame_*.jpg"))


def review_take(shot: Shot, clip: Path) -> Verdict:
    from google.genai import types

    client = get_client()
    frames = sample_frames(clip)
    if not frames:
        raise RuntimeError(f"No frames extracted from {clip}")

    contents: list = [
        RUBRIC,
        f"SHOT {shot.num} — {shot.key}\nIntended content: {shot.prompt}",
    ]
    for frame in frames:
        contents.append(types.Part.from_bytes(data=frame.read_bytes(), mime_type="image/jpeg"))

    response = client.models.generate_content(
        model=REVIEW_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    data = json.loads(response.text)

    threshold = CRITICAL_THRESHOLD if shot.critical else PASS_THRESHOLD
    overall = float(data.get("overall", 0))
    # Trust the number over the label: a model that says "pass" at 5.5 is being
    # agreeable, and agreeableness is exactly what ruins this footage.
    verdict = "pass" if overall >= threshold and data.get("verdict") == "pass" else "reject"

    result = Verdict(
        overall=overall,
        verdict=verdict,
        primary_flaw=data.get("primary_flaw", ""),
        prompt_advice=data.get("prompt_advice", ""),
        raw=data,
    )
    (REVIEWS / f"{clip.stem}.json").write_text(
        json.dumps({**data, "applied_threshold": threshold, "final_verdict": verdict}, indent=2),
        encoding="utf-8",
    )
    print(f"[review] {clip.name}: {overall:.1f} -> {verdict} ({result.primary_flaw})")
    return result
