"""Load and validate Greg's configuration from a .env file / environment."""

from __future__ import annotations

import os
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env loader (no external dependency).

    Looks for a `.env` next to the project root and copies any KEY=VALUE lines
    into os.environ without overwriting variables that are already set.
    """
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


class Config:
    """Validated configuration for a Greg run."""

    def __init__(self) -> None:
        _load_dotenv()

        self.telegram_token: str = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()

        ids_raw = os.environ.get("TELEGRAM_ALLOWED_USER_IDS", "")
        self.allowed_user_ids: set[int] = {
            int(x) for x in ids_raw.replace(" ", "").split(",") if x.strip().isdigit()
        }

        self.anthropic_key: str = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        self.anthropic_model: str = os.environ.get(
            "ANTHROPIC_MODEL", "claude-opus-4-8"
        ).strip()

        self.openai_key: str = os.environ.get("OPENAI_API_KEY", "").strip()

        self.spotify_client_id: str = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
        self.spotify_client_secret: str = os.environ.get(
            "SPOTIFY_CLIENT_SECRET", ""
        ).strip()
        self.spotify_redirect_uri: str = os.environ.get(
            "SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8888/callback"
        ).strip()

        self.allow_shell: bool = os.environ.get(
            "GREG_ALLOW_SHELL", "true"
        ).strip().lower() not in ("false", "0", "no", "off")

    # -- convenience flags ----------------------------------------------------

    @property
    def voice_enabled(self) -> bool:
        return bool(self.openai_key)

    @property
    def brain_enabled(self) -> bool:
        return bool(self.anthropic_key)

    @property
    def spotify_configured(self) -> bool:
        return bool(self.spotify_client_id and self.spotify_client_secret)

    def problems(self) -> list[str]:
        """Return a list of fatal configuration problems (empty == good to go)."""
        issues: list[str] = []
        if not self.telegram_token:
            issues.append("TELEGRAM_BOT_TOKEN is missing (get one from @BotFather).")
        if not self.allowed_user_ids:
            issues.append(
                "TELEGRAM_ALLOWED_USER_IDS is missing (message @userinfobot for "
                "your id). Greg refuses to run without an owner allow-list."
            )
        return issues

    def summary(self) -> str:
        return (
            f"  owner id(s)   : {', '.join(map(str, sorted(self.allowed_user_ids))) or '—'}\n"
            f"  brain (Claude): {'on · ' + self.anthropic_model if self.brain_enabled else 'off (rule-based fallback)'}\n"
            f"  voice (Whisper): {'on' if self.voice_enabled else 'off (typed messages only)'}\n"
            f"  raw shell      : {'allowed' if self.allow_shell else 'disabled'}"
        )
