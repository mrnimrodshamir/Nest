"""Authenticated Gemini/Veo client.

SECURITY CONTRACT — the whole reason this module exists:
  * The API key is read from the environment ONLY (GEMINI_API_KEY).
  * It is never written to disk, never logged, never passed on a command line,
    and never included in any artefact this pipeline produces.
  * Nothing here prints the key, and errors are raised without echoing it.

If you ever need to confirm the key is loaded, check `describe_key_state()`,
which reports presence and length and nothing else.
"""
from __future__ import annotations

import os
from pathlib import Path

ENV_VAR = "GEMINI_API_KEY"
# The repo's .env, which is gitignored and already holds the project's other
# secrets. Loaded as a fallback so the key never has to be typed on a command
# line (where it would land in shell history) or pasted into source.
DOTENV = Path(__file__).resolve().parent.parent.parent / ".env"


def _load_dotenv_if_needed() -> None:
    if os.environ.get(ENV_VAR) or not DOTENV.exists():
        return
    for line in DOTENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        if name.strip() == ENV_VAR:
            os.environ[ENV_VAR] = value.strip().strip("'\"")
            return


class MissingApiKey(RuntimeError):
    pass


def _read_key() -> str:
    _load_dotenv_if_needed()
    key = os.environ.get(ENV_VAR, "").strip()
    if not key:
        raise MissingApiKey(
            f"{ENV_VAR} is not set. Set it in your shell for this session:\n"
            f"  PowerShell:  $env:{ENV_VAR} = '<your key>'\n"
            f"  bash:        export {ENV_VAR}='<your key>'\n"
            "Or put it in .env (already gitignored). Never commit it."
        )
    return key


def describe_key_state() -> str:
    """Safe diagnostic: presence and length, never the value."""
    _load_dotenv_if_needed()
    key = os.environ.get(ENV_VAR, "")
    return f"{ENV_VAR}: {'set, length ' + str(len(key)) if key else 'NOT SET'}"


def get_client():
    """Build a google-genai client. Imported lazily so `--help` works without the SDK."""
    from google import genai

    return genai.Client(api_key=_read_key())
