"""bot.py — the Telegram front door.

Uses the Telegram Bot API with long polling (getUpdates), so Greg works from
behind your home router with no port-forwarding, tunnels, or public server.
Your phone talks to Telegram's cloud; your laptop quietly polls it and acts.
"""

from __future__ import annotations

import os
import tempfile
import time

import requests

from .brain import Brain
from .config import Config
from .transcribe import Transcriber

API = "https://api.telegram.org/bot{token}/{method}"
FILE_API = "https://api.telegram.org/file/bot{token}/{path}"

WELCOME = (
    "👋 Hey, I'm *Greg* — your laptop, on a leash.\n\n"
    "Just tell me what to do:\n"
    "• _open youtube_\n"
    "• _search best ramen near me_\n"
    "• _open spotify and play_\n"
    "• _turn the volume down_\n"
    "• _lock the laptop_\n"
    "• _take a screenshot_\n\n"
    "You can type it or send a voice note. 🎙️"
)


class GregBot:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.brain = Brain(config)
        self.transcriber = Transcriber(config)
        self.offset: int | None = None
        self.owner_name = "you"

    # -- Telegram helpers -----------------------------------------------------

    def _call(self, method: str, **params):
        url = API.format(token=self.config.telegram_token, method=method)
        try:
            resp = requests.post(url, data=params, timeout=60)
            return resp.json()
        except Exception as exc:  # noqa: BLE001
            print(f"[telegram] {method} failed: {exc}")
            return {"ok": False}

    def send(self, chat_id: int, text: str, markdown: bool = False) -> None:
        params = {"chat_id": chat_id, "text": text[:4096]}
        if markdown:
            params["parse_mode"] = "Markdown"
        self._call("sendMessage", **params)

    def send_photo(self, chat_id: int, path: str, caption: str = "") -> None:
        url = API.format(token=self.config.telegram_token, method="sendPhoto")
        try:
            with open(path, "rb") as fh:
                requests.post(
                    url,
                    data={"chat_id": chat_id, "caption": caption[:1024]},
                    files={"photo": fh},
                    timeout=60,
                )
        except Exception as exc:  # noqa: BLE001
            print(f"[telegram] sendPhoto failed: {exc}")

    def typing(self, chat_id: int) -> None:
        self._call("sendChatAction", chat_id=chat_id, action="typing")

    def _download_voice(self, file_id: str) -> str | None:
        info = self._call("getFile", file_id=file_id)
        if not info.get("ok"):
            return None
        path = info["result"]["file_path"]
        url = FILE_API.format(token=self.config.telegram_token, path=path)
        try:
            data = requests.get(url, timeout=60).content
        except Exception as exc:  # noqa: BLE001
            print(f"[telegram] voice download failed: {exc}")
            return None
        local = os.path.join(tempfile.gettempdir(), f"greg_voice_{file_id}.ogg")
        with open(local, "wb") as fh:
            fh.write(data)
        return local

    # -- message handling -----------------------------------------------------

    def _authorized(self, user_id: int) -> bool:
        return user_id in self.config.allowed_user_ids

    def _handle_message(self, message: dict) -> None:
        chat_id = message["chat"]["id"]
        user = message.get("from", {})
        user_id = user.get("id")

        if not self._authorized(user_id):
            # Silently refuse strangers, but log it so you notice.
            print(f"[auth] ignored message from unauthorized user {user_id}")
            self.send(chat_id, "⛔ Sorry, I only take orders from my owner.")
            return

        self.owner_name = user.get("first_name") or "you"

        # 1) Figure out the text — from a typed message or a transcribed voice note.
        text = message.get("text")

        if not text and "voice" in message:
            if not self.transcriber.enabled:
                self.send(
                    chat_id,
                    "🎙️ I got your voice note, but voice isn't set up. Add an "
                    "OPENAI_API_KEY to enable it — or just type the command.",
                )
                return
            self.typing(chat_id)
            local = self._download_voice(message["voice"]["file_id"])
            if not local:
                self.send(chat_id, "Couldn't fetch that voice note, sorry.")
                return
            try:
                text = self.transcriber.transcribe(local)
            except Exception as exc:  # noqa: BLE001
                self.send(chat_id, f"Couldn't understand the audio: {exc}")
                return
            finally:
                try:
                    os.remove(local)
                except OSError:
                    pass
            if text:
                self.send(chat_id, f"🎧 heard: _{text}_", markdown=True)

        if not text:
            return  # nothing actionable (sticker, photo, etc.)

        # 2) Slash commands.
        if text.strip() in ("/start", "/help"):
            self.send(chat_id, WELCOME, markdown=True)
            return

        # 3) Hand it to Greg's brain and report back.
        self.typing(chat_id)
        result = self.brain.handle(text, owner_name=self.owner_name)

        if result.photo_path:
            self.send_photo(chat_id, result.photo_path, caption=result.message)
            try:
                os.remove(result.photo_path)
            except OSError:
                pass
        else:
            prefix = "" if result.ok else "⚠️ "
            self.send(chat_id, prefix + result.message)

    # -- main loop ------------------------------------------------------------

    def run(self) -> None:
        me = self._call("getMe")
        if not me.get("ok"):
            raise SystemExit(
                "Telegram rejected the bot token. Double-check TELEGRAM_BOT_TOKEN."
            )
        name = me["result"].get("username", "?")
        print(f"✅ Connected to Telegram as @{name}. Greg is listening…")
        print("   (Press Ctrl+C to stop.)\n")

        while True:
            try:
                params = {"timeout": 50}
                if self.offset is not None:
                    params["offset"] = self.offset
                url = API.format(token=self.config.telegram_token, method="getUpdates")
                resp = requests.get(url, params=params, timeout=60).json()
            except requests.exceptions.RequestException as exc:
                print(f"[poll] network error: {exc} — retrying in 3s")
                time.sleep(3)
                continue
            except Exception as exc:  # noqa: BLE001
                print(f"[poll] error: {exc} — retrying in 3s")
                time.sleep(3)
                continue

            if not resp.get("ok"):
                time.sleep(2)
                continue

            for update in resp.get("result", []):
                self.offset = update["update_id"] + 1
                message = update.get("message") or update.get("edited_message")
                if message:
                    try:
                        self._handle_message(message)
                    except Exception as exc:  # noqa: BLE001
                        print(f"[handler] error: {exc}")
