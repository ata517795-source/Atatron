"""brain.py — turns what you say into what Greg does.

Primary path: Claude (Anthropic) with tool-use. Claude reads your message,
decides which laptop action(s) to run, we execute them, feed the results back,
and Claude writes a short friendly reply.

Fallback path: if no ANTHROPIC_API_KEY is set, a small rule-based parser still
handles the common cases ("open youtube", "search cats", "volume up", "lock").
"""

from __future__ import annotations

import re

from . import actions
from .actions import ActionResult
from .config import Config

SYSTEM_PROMPT = (
    "You are Greg, {owner}'s personal assistant. You live on their Windows "
    "laptop and are reachable through Telegram. When they ask you to do "
    "something on the computer, use the available tools to actually do it — "
    "don't just describe it. Prefer the fastest route: for well-known services "
    "like YouTube or Gmail, open the website. Keep replies short and natural, "
    "like a text message. Confirm what you did in a few words. If a request is "
    "ambiguous or potentially destructive (deleting files, shutting down), ask "
    "a quick confirming question before acting. You can chat normally too. "
    "To message someone on WhatsApp use send_whatsapp with a saved contact name "
    "or a phone number that includes the country code. When they ask to play a "
    "specific song or artist, use play_song (it actually starts playback) "
    "instead of open_app — only use open_app for Spotify if they just want the "
    "app open with nothing specific to play."
)

# Tool schema handed to Claude.
TOOLS = [
    {
        "name": "open_website",
        "description": "Open a website in the default browser. Accepts a full URL, "
        "a known site name (youtube, gmail, github, netflix, …), or a bare domain. "
        "This is the fast path for services like YouTube.",
        "input_schema": {
            "type": "object",
            "properties": {"target": {"type": "string"}},
            "required": ["target"],
        },
    },
    {
        "name": "web_search",
        "description": "Search the web (opens Google results in the browser).",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "open_app",
        "description": "Launch a desktop application by name, e.g. spotify, discord, "
        "notepad, calculator, vscode, chrome, steam.",
        "input_schema": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        },
    },
    {
        "name": "system_control",
        "description": "Control the machine. action is one of: volume_up, "
        "volume_down, mute, play_pause, next_track, prev_track, lock, sleep, "
        "screenshot, shutdown, restart. amount is optional (volume tap count).",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string"},
                "amount": {"type": "integer"},
            },
            "required": ["action"],
        },
    },
    {
        "name": "type_text",
        "description": "Type text into whatever window currently has focus.",
        "input_schema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
    },
    {
        "name": "play_song",
        "description": "Play a specific song on Spotify (actually starts playback, "
        "not just opens the app). `query` is the song/artist to search for, e.g. "
        "'Adele Hello' or 'Adele'. Requires Spotify Premium and prior authorization.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "send_whatsapp",
        "description": "Send a WhatsApp message. `contact` is a saved contact name "
        "(from the address book) or a phone number with country code. `message` is "
        "the text to send. Use this when the user asks to WhatsApp / message / text "
        "someone.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact": {"type": "string"},
                "message": {"type": "string"},
            },
            "required": ["contact", "message"],
        },
    },
    {
        "name": "run_command",
        "description": "Run a raw shell/PowerShell command on the laptop and return "
        "its output. Powerful — use only when nothing else fits.",
        "input_schema": {
            "type": "object",
            "properties": {"command": {"type": "string"}},
            "required": ["command"],
        },
    },
]


def _dispatch(name: str, args: dict, allow_shell: bool) -> ActionResult:
    """Route one tool call to the matching function in actions.py."""
    if name == "open_website":
        return actions.open_website(args.get("target", ""))
    if name == "web_search":
        return actions.web_search(args.get("query", ""))
    if name == "open_app":
        return actions.open_app(args.get("name", ""))
    if name == "system_control":
        return actions.system_control(args.get("action", ""), int(args.get("amount", 1)))
    if name == "type_text":
        return actions.type_text(args.get("text", ""))
    if name == "play_song":
        return actions.play_spotify(args.get("query", ""))
    if name == "send_whatsapp":
        return actions.send_whatsapp(args.get("contact", ""), args.get("message", ""))
    if name == "run_command":
        if not allow_shell:
            return ActionResult(False, "Raw commands are disabled (GREG_ALLOW_SHELL=false).")
        return actions.run_command(args.get("command", ""))
    return ActionResult(False, f"Unknown tool: {name}")


class Brain:
    """Holds the Claude client (if configured) and answers messages."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self._client = None
        if config.brain_enabled:
            from anthropic import Anthropic

            self._client = Anthropic(api_key=config.anthropic_key)

    # -- public ---------------------------------------------------------------

    def handle(self, text: str, owner_name: str = "you") -> ActionResult:
        """Return a single ActionResult: `.message` is the reply to send,
        `.photo_path` is set if an image should also be sent."""
        if self._client is None:
            return self._rule_based(text)
        try:
            return self._with_claude(text, owner_name)
        except Exception as exc:  # noqa: BLE001 — never let the brain crash the bot
            return ActionResult(False, f"My brain hiccuped ({exc}). Try rephrasing?")

    # -- Claude agentic loop --------------------------------------------------

    def _with_claude(self, text: str, owner_name: str) -> ActionResult:
        messages = [{"role": "user", "content": text}]
        photo_path: str | None = None
        system = SYSTEM_PROMPT.format(owner=owner_name)

        for _ in range(6):  # safety cap on tool-use rounds
            resp = self._client.messages.create(
                model=self.config.anthropic_model,
                max_tokens=1024,
                system=system,
                tools=TOOLS,
                messages=messages,
            )

            tool_uses = [b for b in resp.content if b.type == "tool_use"]
            if not tool_uses:
                reply = "".join(b.text for b in resp.content if b.type == "text").strip()
                return ActionResult(True, reply or "Done.", photo_path=photo_path)

            messages.append({"role": "assistant", "content": resp.content})
            tool_results = []
            for tu in tool_uses:
                result = _dispatch(tu.name, tu.input or {}, self.config.allow_shell)
                if result.photo_path:
                    photo_path = result.photo_path
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": result.message,
                        "is_error": not result.ok,
                    }
                )
            messages.append({"role": "user", "content": tool_results})

        return ActionResult(True, "Working on it…", photo_path=photo_path)

    # -- Rule-based fallback (no API key) -------------------------------------

    def _rule_based(self, text: str) -> ActionResult:
        t = text.strip().lower()

        # Spotify — actually play a track, not just open the app.
        # Matches: "play adele" · "play adele hello" · "play the song adele" ·
        #          "open spotify and play adele" · "open my spotify and play adele song"
        m = re.match(
            r"^(?:open\s+(?:my\s+)?spotify\s+and\s+play|play\s+the\s+song|play)\s+(.+)$",
            t,
        )
        if m:
            query = m.group(1).strip()
            query = re.sub(r"^(?:the\s+)?song\s+", "", query)
            query = re.sub(r"\s+song$", "", query)
            query = re.sub(r"\s+on\s+spotify$", "", query)
            if query:
                return actions.play_spotify(query)

        m = re.match(r"^(?:open|launch|start|go to)\s+(.+)$", t)
        if m:
            target = m.group(1).strip()
            if actions._norm(target) in actions.SITES or "." in target:
                return actions.open_website(target)
            if actions._norm(target) in actions.WINDOWS_APPS:
                return actions.open_app(target)
            return actions.open_website(target)  # best guess

        m = re.match(r"^(?:search|google|look up)\s+(?:for\s+)?(.+)$", t)
        if m:
            return actions.web_search(m.group(1).strip())

        # WhatsApp:  "whatsapp mom saying I'm on my way"
        #            "text dad: call me"   /   "message ana i'm late"
        m = re.match(
            r"^(?:send\s+(?:a\s+)?)?(?:whatsapp|wa|text|message|msg)\s+(?:to\s+)?(.+)$",
            t,
        )
        if m:
            rest = m.group(1).strip()
            parts = re.split(r"\s+(?:saying|that says|:)\s+|:\s*", rest, maxsplit=1)
            if len(parts) == 2 and parts[1].strip():
                contact, msg = parts[0], parts[1]
            else:
                toks = rest.split(maxsplit=1)
                contact = toks[0]
                msg = toks[1] if len(toks) > 1 else ""
            return actions.send_whatsapp(contact.strip(), msg.strip())

        if t in ("volume up", "louder", "turn it up"):
            return actions.system_control("volume_up", 3)
        if t in ("volume down", "quieter", "turn it down"):
            return actions.system_control("volume_down", 3)
        if t in ("mute", "unmute"):
            return actions.system_control("mute")
        if t in ("pause", "play", "resume"):
            return actions.system_control("play_pause")
        if t in ("next", "skip", "next song"):
            return actions.system_control("next_track")
        if t in ("previous", "back", "last song"):
            return actions.system_control("prev_track")
        if t in ("lock", "lock it", "lock the laptop", "lock screen"):
            return actions.system_control("lock")
        if t in ("sleep", "go to sleep"):
            return actions.system_control("sleep")
        if "screenshot" in t or "screen shot" in t or "screengrab" in t or "capture screen" in t:
            return actions.take_screenshot()

        return ActionResult(
            False,
            "I don't have my Claude brain configured, so I only understand simple "
            "commands like: open youtube · search cats · volume up · lock · "
            "screenshot · whatsapp mom saying hi. Add an ANTHROPIC_API_KEY to "
            "unlock full natural language.",
        )
