#!/usr/bin/env python3
"""Greg — start me up.

    python run.py

Reads configuration from greg/.env (copy greg/.env.example first), connects to
Telegram, and starts listening for your commands.
"""

from __future__ import annotations

import sys

from greg.bot import GregBot
from greg.config import Config


def main() -> int:
    config = Config()

    problems = config.problems()
    if problems:
        print("Greg can't start yet — please fix these in your .env file:\n")
        for p in problems:
            print(f"  • {p}")
        print("\n(Copy greg/.env.example to greg/.env and fill it in.)")
        return 1

    print("\n🤖 Greg starting up")
    print(config.summary())
    print()

    try:
        GregBot(config).run()
    except KeyboardInterrupt:
        print("\n👋 Greg signing off. See you later.")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
