#!/usr/bin/env python3
"""Greg doctor — run this ON YOUR WINDOWS LAPTOP to verify your setup.

    python doctor.py

It checks, in order:
  1. You're on Windows (so the laptop-control features will work)
  2. Python version is new enough
  3. Required packages are installed
  4. Your .env is filled in correctly
  5. Telegram accepts your bot token
  6. (optional) fires a harmless test action so you SEE it work

Nothing here changes your system except the optional Notepad test at the end,
which you opt into by pressing Enter.
"""

from __future__ import annotations

import platform
import sys

OK = "✅"
WARN = "⚠️ "
BAD = "❌"


def line(mark: str, text: str) -> None:
    print(f"  {mark} {text}")


def main() -> int:
    print("\n🩺 Greg doctor — checking your Windows setup\n")
    fatal = 0

    # 1. Operating system ----------------------------------------------------
    sysname = platform.system()
    if sysname == "Windows":
        line(OK, f"Operating system: Windows ({platform.release()})")
    else:
        line(
            WARN,
            f"Operating system: {sysname} — Greg is built for Windows. It will "
            "run here, but opening apps / volume / screenshots may not work.",
        )

    # 2. Python version ------------------------------------------------------
    v = sys.version_info
    if v >= (3, 10):
        line(OK, f"Python {v.major}.{v.minor}.{v.micro}")
    else:
        line(BAD, f"Python {v.major}.{v.minor} — please install Python 3.10 or newer.")
        fatal += 1

    # 3. Packages ------------------------------------------------------------
    for mod, why, required in [
        ("requests", "Telegram connection", True),
        ("anthropic", "Greg's Claude brain", True),
        ("openai", "voice notes (optional)", False),
        ("PIL", "screenshots (optional)", False),
    ]:
        try:
            __import__(mod)
            line(OK, f"Package '{mod}' installed — {why}")
        except ImportError:
            mark = BAD if required else WARN
            line(mark, f"Package '{mod}' missing — {why}. Run: pip install -r requirements.txt")
            if required:
                fatal += 1

    # 4. Configuration -------------------------------------------------------
    try:
        from greg.config import Config

        cfg = Config()
    except Exception as exc:  # noqa: BLE001
        line(BAD, f"Couldn't load config: {exc}")
        return 1

    problems = cfg.problems()
    if problems:
        for p in problems:
            line(BAD, p)
            fatal += 1
    else:
        line(OK, f"Owner allow-list set: {sorted(cfg.allowed_user_ids)}")
    line(
        OK if cfg.brain_enabled else WARN,
        "Claude brain key present" if cfg.brain_enabled
        else "No ANTHROPIC_API_KEY — Greg will use simple rules only",
    )
    line(
        OK if cfg.voice_enabled else WARN,
        "Voice (Whisper) key present" if cfg.voice_enabled
        else "No OPENAI_API_KEY — voice notes disabled (typing still works)",
    )

    # 5. Telegram reachability ----------------------------------------------
    if cfg.telegram_token:
        try:
            import requests

            r = requests.get(
                f"https://api.telegram.org/bot{cfg.telegram_token}/getMe", timeout=15
            ).json()
            if r.get("ok"):
                line(OK, f"Telegram accepted your token — bot is @{r['result']['username']}")
            else:
                line(BAD, "Telegram rejected the token — recheck TELEGRAM_BOT_TOKEN.")
                fatal += 1
        except Exception as exc:  # noqa: BLE001
            line(WARN, f"Couldn't reach Telegram ({exc}). Check your internet.")

    # Verdict ----------------------------------------------------------------
    print()
    if fatal:
        print(f"{BAD} {fatal} problem(s) to fix before Greg can run. See above.\n")
        return 1
    print(f"{OK} Setup looks good!\n")

    # 6. Optional live action ------------------------------------------------
    if sysname == "Windows":
        try:
            ans = input("Fire a test action now (open Notepad)? [Enter = yes, n = skip] ")
        except EOFError:
            ans = "n"
        if ans.strip().lower() != "n":
            from greg import actions

            res = actions.open_app("notepad")
            line(OK if res.ok else BAD, res.message)
            print("\nIf Notepad just opened, Greg can control your laptop. 🎉")
    print("\nNext: run  python run.py  then message your bot 'open youtube'.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
