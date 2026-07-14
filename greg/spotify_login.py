#!/usr/bin/env python3
"""Greg's one-time Spotify authorization.

Run this ONCE, by hand, in a normal terminal on your laptop (never via
Telegram — it needs to open a browser and you to click "Agree"):

    python spotify_login.py

It logs you into Spotify, asks for permission to control playback, and
saves a `.spotify_cache` file next to this script. After that, Greg can
play songs from Telegram forever without asking again (until you revoke
access on Spotify's end).

Requires SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in your .env — see the
README's "Playing music on Spotify" section for how to create those.
"""

from __future__ import annotations

import sys
from pathlib import Path

from greg.config import Config


def main() -> int:
    cfg = Config()

    if not cfg.spotify_configured:
        print(
            "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are missing from .env.\n"
            "Create an app at https://developer.spotify.com/dashboard, add "
            f"redirect URI {cfg.spotify_redirect_uri!r} to it, then paste the "
            "Client ID / Secret into your .env. See README for the full steps."
        )
        return 1

    try:
        import spotipy
        from spotipy.oauth2 import SpotifyOAuth
    except ImportError:
        print("Missing dependency — run: pip install -r requirements.txt")
        return 1

    cache_path = str(Path(__file__).resolve().parent / ".spotify_cache")
    auth = SpotifyOAuth(
        client_id=cfg.spotify_client_id,
        client_secret=cfg.spotify_client_secret,
        redirect_uri=cfg.spotify_redirect_uri,
        scope="user-modify-playback-state user-read-playback-state",
        cache_path=cache_path,
        open_browser=True,
    )

    print("\nOpening your browser to log into Spotify — approve access there...\n")
    sp = spotipy.Spotify(auth_manager=auth)
    me = sp.me()  # forces the auth flow to complete right now

    print(f"✅ Logged in as {me.get('display_name') or me.get('id')}.")
    print(
        "Greg can now play songs on Spotify (Premium required). Try texting "
        "your bot: 'play adele hello'\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
