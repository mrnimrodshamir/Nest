"""Generation stages: character reference stills, then shots.

Every artefact is written to disk and every stage is resumable — if a file
already exists it is not regenerated. Veo calls are long-running operations
costing real money, so nothing here re-runs speculatively.
"""
from __future__ import annotations

import time
from pathlib import Path

from client import get_client
from config import (
    CHARACTERS,
    CLIPS,
    IMAGE_MODEL,
    NEGATIVE_PROMPT,
    REFS,
    Shot,
    VEO_MODEL,
)

POLL_SECONDS = 15
POLL_TIMEOUT_SECONDS = 900


def reference_path(character_key: str) -> Path:
    return REFS / f"ref_{character_key}.png"


def generate_reference(character_key: str, *, force: bool = False) -> Path:
    """One locked portrait per character. Everything downstream depends on these,
    so they are generated first and never regenerated casually — a new face
    invalidates every shot already made."""
    out = reference_path(character_key)
    if out.exists() and not force:
        print(f"[ref] {character_key}: exists, skipping")
        return out

    from google.genai import types

    character = CHARACTERS[character_key]
    client = get_client()
    REFS.mkdir(parents=True, exist_ok=True)

    print(f"[ref] {character_key}: generating")
    result = client.models.generate_images(
        model=IMAGE_MODEL,
        prompt=character.reference_prompt,
        config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio="1:1"),
    )
    result.generated_images[0].image.save(str(out))
    print(f"[ref] {character_key}: -> {out.name}")
    return out


def clip_path(shot: Shot, attempt: int) -> Path:
    return CLIPS / f"{shot.num:02d}_{shot.key}_take{attempt}.mp4"


def generate_shot(shot: Shot, attempt: int, *, force: bool = False) -> Path:
    """Generate one take of one shot.

    Attempts are kept side by side rather than overwritten: the reviewer scores
    them, and a human can override the pick. Never destroy a take you paid for.
    """
    out = clip_path(shot, attempt)
    if out.exists() and not force:
        print(f"[shot {shot.num}] take {attempt}: exists, skipping")
        return out

    from google.genai import types

    client = get_client()
    CLIPS.mkdir(parents=True, exist_ok=True)

    kwargs = {}
    if shot.start_from_reference:
        ref = reference_path(shot.start_from_reference)
        if not ref.exists():
            raise FileNotFoundError(
                f"Shot {shot.num} starts from {shot.start_from_reference}'s reference, "
                f"but {ref} is missing. Run the characters stage first."
            )
        kwargs["image"] = types.Image.from_file(location=str(ref))

    print(f"[shot {shot.num}] {shot.key}: take {attempt} submitting")
    operation = client.models.generate_videos(
        model=VEO_MODEL,
        prompt=shot.full_prompt(),
        config=types.GenerateVideosConfig(
            aspect_ratio=shot.aspect_ratio,
            negative_prompt=NEGATIVE_PROMPT,
            number_of_videos=1,
        ),
        **kwargs,
    )

    waited = 0
    while not operation.done:
        if waited > POLL_TIMEOUT_SECONDS:
            raise TimeoutError(f"Shot {shot.num} take {attempt} exceeded {POLL_TIMEOUT_SECONDS}s")
        time.sleep(POLL_SECONDS)
        waited += POLL_SECONDS
        operation = client.operations.get(operation)
        print(f"[shot {shot.num}] take {attempt}: {waited}s")

    if getattr(operation, "error", None):
        raise RuntimeError(f"Shot {shot.num} take {attempt} failed: {operation.error}")

    video = operation.response.generated_videos[0].video
    client.files.download(file=video)
    video.save(str(out))
    print(f"[shot {shot.num}] take {attempt}: -> {out.name}")
    return out
