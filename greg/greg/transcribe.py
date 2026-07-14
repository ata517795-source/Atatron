"""transcribe.py — turn a Telegram voice note into text via OpenAI Whisper.

Telegram voice messages arrive as OGG/Opus, which Whisper accepts directly, so
no ffmpeg is required. If no OPENAI_API_KEY is set this module is never used.
"""

from __future__ import annotations

from .config import Config


class Transcriber:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._client = None
        if config.voice_enabled:
            from openai import OpenAI

            self._client = OpenAI(api_key=config.openai_key)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def transcribe(self, audio_path: str) -> str:
        """Return the recognized text (raises on failure)."""
        if self._client is None:
            raise RuntimeError("Voice transcription is not configured.")
        with open(audio_path, "rb") as fh:
            result = self._client.audio.transcriptions.create(
                model="whisper-1",
                file=fh,
            )
        return (result.text or "").strip()
