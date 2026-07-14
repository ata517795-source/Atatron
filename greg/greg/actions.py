"""actions.py — the hands of Greg.

Everything that actually touches the laptop lives here. Each public function
returns an ``ActionResult`` so the caller (the brain / the bot) can report back
to Telegram in a uniform way. The module is import-safe on any OS; platform
specifics are chosen at call time so you can develop on Linux and run on
Windows.
"""

from __future__ import annotations

import json
import os
import platform
import subprocess
import tempfile
import time
import urllib.parse
import webbrowser
from dataclasses import dataclass
from pathlib import Path

SYSTEM = platform.system()  # 'Windows', 'Darwin', 'Linux'
IS_WINDOWS = SYSTEM == "Windows"
IS_MAC = SYSTEM == "Darwin"


@dataclass
class ActionResult:
    ok: bool
    message: str
    photo_path: str | None = None  # set when an action produced an image to send


# ─────────────────────────────────────────────────────────────────────────────
#  Known destinations — the "fast path" the user cares about most.
# ─────────────────────────────────────────────────────────────────────────────

# Popular sites open instantly in the browser (no ambiguity, no app needed).
SITES: dict[str, str] = {
    "youtube": "https://www.youtube.com",
    "yt": "https://www.youtube.com",
    "gmail": "https://mail.google.com",
    "email": "https://mail.google.com",
    "google": "https://www.google.com",
    "github": "https://github.com",
    "twitter": "https://twitter.com",
    "x": "https://x.com",
    "chatgpt": "https://chat.openai.com",
    "claude": "https://claude.ai",
    "whatsapp": "https://web.whatsapp.com",
    "telegram": "https://web.telegram.org",
    "netflix": "https://www.netflix.com",
    "reddit": "https://www.reddit.com",
    "maps": "https://maps.google.com",
    "google maps": "https://maps.google.com",
    "drive": "https://drive.google.com",
    "google drive": "https://drive.google.com",
    "instagram": "https://www.instagram.com",
    "facebook": "https://www.facebook.com",
    "tiktok": "https://www.tiktok.com",
    "spotify web": "https://open.spotify.com",
    "translate": "https://translate.google.com",
    "amazon": "https://www.amazon.com",
    "linkedin": "https://www.linkedin.com",
    "wikipedia": "https://www.wikipedia.org",
}

# Native Windows apps → the command that launches them.
WINDOWS_APPS: dict[str, str] = {
    "notepad": "notepad",
    "calculator": "calc",
    "calc": "calc",
    "paint": "mspaint",
    "explorer": "explorer",
    "file explorer": "explorer",
    "files": "explorer",
    "command prompt": "cmd",
    "cmd": "cmd",
    "terminal": "wt",
    "powershell": "powershell",
    "task manager": "taskmgr",
    "settings": "ms-settings:",
    "control panel": "control",
    "snipping tool": "snippingtool",
    "camera": "microsoft.windows.camera:",
    # Common third-party apps (must be installed / on PATH):
    "spotify": "spotify",
    "discord": "discord",
    "chrome": "chrome",
    "google chrome": "chrome",
    "edge": "msedge",
    "firefox": "firefox",
    "vscode": "code",
    "vs code": "code",
    "code": "code",
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "outlook": "outlook",
    "steam": "steam",
    "obs": "obs",
    "zoom": "zoom",
}


def _norm(name: str) -> str:
    return name.strip().lower()


# ─────────────────────────────────────────────────────────────────────────────
#  Opening things
# ─────────────────────────────────────────────────────────────────────────────

def open_website(target: str) -> ActionResult:
    """Open a URL, a well-known site name, or fall back to a Google search."""
    key = _norm(target)
    if key in SITES:
        url = SITES[key]
    elif target.startswith(("http://", "https://")):
        url = target
    elif "." in key and " " not in key:  # looks like a bare domain
        url = "https://" + target.strip()
    else:
        return web_search(target)

    webbrowser.open(url)
    return ActionResult(True, f"Opened {url}")


def web_search(query: str) -> ActionResult:
    url = "https://www.google.com/search?q=" + urllib.parse.quote(query)
    webbrowser.open(url)
    return ActionResult(True, f'Searched the web for "{query}".')


def open_app(name: str) -> ActionResult:
    """Launch a desktop application by (friendly) name."""
    key = _norm(name)

    # If it's really a website they named, prefer the browser fast-path.
    if key in SITES:
        return open_website(key)

    if IS_WINDOWS:
        cmd = WINDOWS_APPS.get(key, key)
        try:
            # `start` resolves apps on PATH, App-execution-aliases and URIs.
            subprocess.Popen(f'start "" "{cmd}"', shell=True)
            return ActionResult(True, f"Launched {name}.")
        except Exception as exc:  # noqa: BLE001
            return ActionResult(False, f"Couldn't launch {name}: {exc}")

    if IS_MAC:
        try:
            subprocess.Popen(["open", "-a", name])
            return ActionResult(True, f"Launched {name}.")
        except Exception as exc:  # noqa: BLE001
            return ActionResult(False, f"Couldn't launch {name}: {exc}")

    # Linux
    try:
        subprocess.Popen([key])
        return ActionResult(True, f"Launched {name}.")
    except Exception as exc:  # noqa: BLE001
        return ActionResult(False, f"Couldn't launch {name}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
#  System control — volume, media keys, lock, sleep, screenshot, power
# ─────────────────────────────────────────────────────────────────────────────

# Windows virtual-key codes for the media keys.
_VK = {
    "mute": 0xAD,
    "volume_down": 0xAE,
    "volume_up": 0xAF,
    "next_track": 0xB0,
    "prev_track": 0xB1,
    "stop": 0xB2,
    "play_pause": 0xB3,
}


def _press_media_key(name: str, repeat: int = 1) -> None:
    """Tap a media/volume key `repeat` times (Windows via ctypes)."""
    import ctypes

    vk = _VK[name]
    for _ in range(max(1, repeat)):
        ctypes.windll.user32.keybd_event(vk, 0, 0, 0)  # key down
        ctypes.windll.user32.keybd_event(vk, 0, 2, 0)  # key up (KEYEVENTF_KEYUP)
        time.sleep(0.02)


def system_control(action: str, amount: int = 1) -> ActionResult:
    """Perform a system-level control action.

    action ∈ volume_up | volume_down | mute | play_pause | next_track |
             prev_track | lock | sleep | screenshot | shutdown | restart
    `amount` (for volume) is the number of key taps (~2% each on Windows).
    """
    action = _norm(action).replace(" ", "_")

    if action == "screenshot":
        return take_screenshot()

    if IS_WINDOWS:
        try:
            if action in ("volume_up", "volume_down"):
                _press_media_key(action, repeat=max(1, amount) * 2)
                return ActionResult(True, f"Volume {action.split('_')[1]}.")
            if action in ("mute", "play_pause", "next_track", "prev_track"):
                _press_media_key(action)
                return ActionResult(True, f"{action.replace('_', ' ').title()}.")
            if action == "lock":
                subprocess.Popen("rundll32.exe user32.dll,LockWorkStation", shell=True)
                return ActionResult(True, "Locked the laptop.")
            if action == "sleep":
                subprocess.Popen(
                    "rundll32.exe powrprof.dll,SetSuspendState 0,1,0", shell=True
                )
                return ActionResult(True, "Putting the laptop to sleep.")
            if action == "shutdown":
                subprocess.Popen("shutdown /s /t 0", shell=True)
                return ActionResult(True, "Shutting down.")
            if action == "restart":
                subprocess.Popen("shutdown /r /t 0", shell=True)
                return ActionResult(True, "Restarting.")
        except Exception as exc:  # noqa: BLE001
            return ActionResult(False, f"System action failed: {exc}")
        return ActionResult(False, f"Unknown system action: {action}")

    # Non-Windows best effort (handy while developing on macOS/Linux).
    if IS_MAC:
        mac = {
            "lock": 'pmset displaysleepnow',
            "sleep": "pmset sleepnow",
            "shutdown": "osascript -e 'tell app \"System Events\" to shut down'",
            "restart": "osascript -e 'tell app \"System Events\" to restart'",
            "play_pause": "osascript -e 'tell application \"Music\" to playpause'",
        }
        if action in mac:
            subprocess.Popen(mac[action], shell=True)
            return ActionResult(True, f"{action.replace('_', ' ').title()} (mac).")
    return ActionResult(
        False, f"'{action}' isn't wired up for {SYSTEM} yet — try it on Windows."
    )


def take_screenshot() -> ActionResult:
    try:
        from PIL import ImageGrab  # type: ignore
    except Exception:  # noqa: BLE001
        return ActionResult(
            False, "Screenshots need Pillow — run: pip install pillow"
        )
    try:
        img = ImageGrab.grab()
        path = os.path.join(tempfile.gettempdir(), f"greg_shot_{int(time.time())}.png")
        img.save(path)
        return ActionResult(True, "Here's your screen:", photo_path=path)
    except Exception as exc:  # noqa: BLE001
        return ActionResult(False, f"Couldn't grab the screen: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
#  Typing text into the focused window
# ─────────────────────────────────────────────────────────────────────────────

def type_text(text: str) -> ActionResult:
    """Type `text` into whatever window currently has focus (Windows)."""
    if not IS_WINDOWS:
        return ActionResult(False, "Typing is only wired up for Windows right now.")
    try:
        import ctypes

        for ch in text:
            # KEYEVENTF_UNICODE (0x4) lets us send any character directly.
            ctypes.windll.user32.keybd_event(0, ord(ch), 0x4, 0)
            ctypes.windll.user32.keybd_event(0, ord(ch), 0x4 | 0x2, 0)
            time.sleep(0.004)
        return ActionResult(True, f"Typed {len(text)} characters.")
    except Exception as exc:  # noqa: BLE001
        return ActionResult(False, f"Couldn't type text: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
#  Raw command execution — "full access"
# ─────────────────────────────────────────────────────────────────────────────

def run_command(command: str, timeout: int = 30) -> ActionResult:
    """Run a shell command on the laptop and return its output (truncated)."""
    try:
        completed = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        out = (completed.stdout or "") + (completed.stderr or "")
        out = out.strip() or "(no output)"
        if len(out) > 3000:
            out = out[:3000] + "\n…(truncated)"
        status = "ok" if completed.returncode == 0 else f"exit {completed.returncode}"
        return ActionResult(True, f"[{status}]\n{out}")
    except subprocess.TimeoutExpired:
        return ActionResult(False, f"Command timed out after {timeout}s.")
    except Exception as exc:  # noqa: BLE001
        return ActionResult(False, f"Command failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
#  WhatsApp — "whatsapp mom saying I'm on my way"
# ─────────────────────────────────────────────────────────────────────────────

# A name→number address book lives in greg/contacts.json (git-ignored).
# Numbers must include the country code, digits only, e.g. "6281234567890".
CONTACTS_FILE = Path(__file__).resolve().parent.parent / "contacts.json"


def _clean_number(raw: str) -> str:
    """Strip everything except digits (drops +, spaces, dashes, brackets)."""
    return "".join(ch for ch in str(raw) if ch.isdigit())


def load_contacts() -> dict[str, str]:
    if not CONTACTS_FILE.exists():
        return {}
    try:
        data = json.loads(CONTACTS_FILE.read_text(encoding="utf-8"))
        return {str(k).strip().lower(): _clean_number(v) for k, v in data.items()}
    except Exception:  # noqa: BLE001 — a broken contacts file shouldn't crash Greg
        return {}


def _resolve_number(contact: str) -> str | None:
    """Turn a name or raw number into a country-coded digit string."""
    digits = _clean_number(contact)
    # If they basically gave us a phone number already, trust it.
    if digits and len(digits) >= 8 and len(_norm(contact).replace(" ", "")) <= len(digits) + 3:
        return digits
    return load_contacts().get(_norm(contact))


def send_whatsapp(contact: str, message: str) -> ActionResult:
    """Send a WhatsApp message to a saved contact (or raw number).

    Tries a fully hands-free send via `pywhatkit` (needs WhatsApp Web logged in).
    If that isn't installed/available, it opens the chat with the message
    pre-typed so you only have to hit Send.
    """
    message = (message or "").strip()
    if not message:
        return ActionResult(False, f"What should I say to {contact}?")

    number = _resolve_number(contact)
    if not number:
        known = ", ".join(sorted(load_contacts())) or "(none saved yet)"
        return ActionResult(
            False,
            f"I don't have a number for \"{contact}\". Add it to contacts.json "
            f"(name → number with country code). Known contacts: {known}.",
        )

    # 1) Preferred: hands-free send through WhatsApp Web.
    try:
        import pywhatkit  # type: ignore

        pywhatkit.sendwhatmsg_instantly(
            phone_no=f"+{number}",
            message=message,
            wait_time=15,
            tab_close=True,
            close_time=3,
        )
        return ActionResult(True, f'Sent to {contact} on WhatsApp: "{message}"')
    except ImportError:
        pass  # pywhatkit not installed — fall through to the pre-filled open
    except Exception as exc:  # noqa: BLE001 — timing/focus issues, degrade gracefully
        url = f"https://wa.me/{number}?text={urllib.parse.quote(message)}"
        webbrowser.open(url)
        return ActionResult(
            True,
            f"Opened WhatsApp to {contact} with the message ready — just press "
            f"Send. (Auto-send hit a snag: {exc})",
        )

    # 2) Fallback: open the chat with the text pre-filled; user taps Send.
    url = f"https://wa.me/{number}?text={urllib.parse.quote(message)}"
    webbrowser.open(url)
    return ActionResult(
        True,
        f'Opened WhatsApp to {contact} with "{message}" ready — press Send to '
        f"fire it. (Install pywhatkit for fully hands-free sending.)",
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Spotify — real playback control ("play adele hello")
#
#  Opening the app only gets you to the app; actually starting a specific
#  track needs the Spotify Web API with your account authorized. Run
#  `python spotify_login.py` ONCE (outside of Telegram) to authorize — that
#  saves a refresh token to .spotify_cache so nothing here ever blocks
#  waiting for interactive login. Requires Spotify PREMIUM (Spotify's API
#  refuses remote playback control for free accounts).
# ─────────────────────────────────────────────────────────────────────────────

_SPOTIFY_CACHE = Path(__file__).resolve().parent.parent / ".spotify_cache"
_spotify_client = None  # lazy singleton


def _spotify_creds() -> tuple[str, str, str] | None:
    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        return None
    redirect_uri = os.environ.get(
        "SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8888/callback"
    ).strip()
    return client_id, client_secret, redirect_uri


def _get_spotify():
    """Return a ready spotipy client, or None if not authorized yet.

    Never opens a browser or blocks on input — only uses an existing cached
    token, so this is always safe to call from the Telegram message loop.
    """
    global _spotify_client
    if _spotify_client is not None:
        return _spotify_client
    creds = _spotify_creds()
    if creds is None or not _SPOTIFY_CACHE.exists():
        return None

    import spotipy
    from spotipy.oauth2 import SpotifyOAuth

    client_id, client_secret, redirect_uri = creds
    auth = SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="user-modify-playback-state user-read-playback-state",
        cache_path=str(_SPOTIFY_CACHE),
        open_browser=False,
    )
    _spotify_client = spotipy.Spotify(auth_manager=auth)
    return _spotify_client


def play_spotify(query: str) -> ActionResult:
    """Search Spotify for `query` and start playing the first match."""
    query = (query or "").strip()
    if not query:
        return ActionResult(False, "What song should I play?")

    if _spotify_creds() is None:
        return ActionResult(
            False,
            "Spotify playback isn't set up yet — add SPOTIFY_CLIENT_ID and "
            "SPOTIFY_CLIENT_SECRET to .env (see README's Spotify section).",
        )
    if not _SPOTIFY_CACHE.exists():
        return ActionResult(
            False,
            "Spotify isn't authorized yet — on your laptop run "
            "'python spotify_login.py' once to log in, then try again.",
        )
    try:
        import spotipy  # noqa: F401  (presence check)
    except ImportError:
        return ActionResult(False, "Run: pip install -r requirements.txt (needs spotipy)")

    try:
        sp = _get_spotify()

        devices = sp.devices().get("devices", [])
        if not devices:
            open_app("spotify")
            for _ in range(6):
                time.sleep(2)
                devices = sp.devices().get("devices", [])
                if devices:
                    break
        if not devices:
            return ActionResult(
                False,
                "No Spotify device found — open the Spotify app on your "
                "laptop, make sure you're logged in, then try again.",
            )
        device = next((d for d in devices if d.get("is_active")), devices[0])

        results = sp.search(q=query, type="track", limit=1)
        items = results.get("tracks", {}).get("items", [])
        if not items:
            return ActionResult(False, f'Couldn\'t find "{query}" on Spotify.')
        track = items[0]
        name = track["name"]
        artist = ", ".join(a["name"] for a in track["artists"])

        sp.start_playback(device_id=device["id"], uris=[track["uri"]])
        return ActionResult(True, f'▶️ Playing "{name}" by {artist} on Spotify.')
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "premium" in msg.lower() or "403" in msg:
            return ActionResult(
                False,
                "Spotify refused playback — this needs a Spotify PREMIUM "
                "account. Free accounts can't be remote-controlled.",
            )
        return ActionResult(False, f"Spotify playback failed: {msg}")
