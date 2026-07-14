# 🤖 Greg — control your laptop from Telegram

Greg is a personal AI assistant that lives on your **Windows laptop** and takes
orders from your **Telegram** chat. Type (or say) _"open youtube"_ and your
laptop opens YouTube. Say _"turn the volume down"_, _"lock the laptop"_, or
_"take a screenshot"_ — Greg does it, wherever you are, from your phone.

```
   Your phone (Telegram)  ──▶  Telegram cloud  ──▶  Greg on your laptop  ──▶  action
        "open youtube"                                (polls for messages)      🎬
```

Because Greg **polls** Telegram, it works from anywhere with no port
forwarding, no public server, and no tunnel — your laptop just needs internet.

---

## What Greg can do

| You say… | Greg does |
|---|---|
| `open youtube` / `open gmail` / `open netflix` | opens the site in your browser |
| `open spotify` / `open discord` / `open notepad` | launches the desktop app |
| `search best ramen near me` | runs a web search |
| `turn the volume up` / `mute` / `pause` / `next song` | media & volume keys |
| `lock the laptop` / `go to sleep` | locks / sleeps the machine |
| `take a screenshot` | grabs your screen and sends it back to Telegram |
| `whatsapp mom saying I'm on my way` | sends a WhatsApp message (see below) |
| `what's my IP?` / `list files on my desktop` | runs a command and replies with the output |
| _(a voice note saying any of the above)_ | transcribes it, then does it |

Anything you can phrase in words, Greg's Claude brain tries to map to a real
action — the table above is just the common stuff.

---

## Setup (about 10 minutes, one time)

### 1. Install Python
Download **Python 3.10+** from <https://python.org/downloads> and, on the first
installer screen, **tick "Add Python to PATH"** before clicking Install.

### 2. Get the code onto your laptop
Copy this `greg/` folder to your laptop (e.g. `C:\Greg`). Then open **Command
Prompt** in that folder and install the requirements:

```bat
cd C:\Greg
pip install -r requirements.txt
```

### 3. Create your Telegram bot
1. Open Telegram and message **@BotFather**.
2. Send `/newbot`, pick a name and a username. BotFather replies with a
   **token** like `123456789:AAE...`. Keep it.
3. Message **@userinfobot** — it replies with your numeric **user id** (so Greg
   only ever obeys you).

### 4. Get your API keys
- **Claude (required — Greg's brain):** create a key at
  <https://console.anthropic.com> → *API Keys*.
- **OpenAI (optional — voice notes):** create a key at
  <https://platform.openai.com/api-keys>. Skip this and Greg still works great
  with typed messages.

### 5. Fill in your `.env`
Copy `.env.example` to `.env` and paste your values in:

```bat
copy .env.example .env
notepad .env
```

```ini
TELEGRAM_BOT_TOKEN=123456789:AAE...
TELEGRAM_ALLOWED_USER_IDS=your_user_id_here
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...        # optional, for voice
```

### 6. Check your setup (recommended)
Run the doctor — it verifies you're on Windows, packages are installed, your
`.env` is right, and Telegram accepts your token, then offers a live test:

```bat
python doctor.py
```

Fix anything it flags, then continue.

### 7. Start Greg
Double-click **`start_greg.bat`**, or run:

```bat
python run.py
```

You should see `✅ Connected to Telegram as @yourbot. Greg is listening…`.
Now open Telegram, find your bot, send `/start`, then try **`open youtube`**. 🎉

---

## Sending WhatsApp messages

Greg can fire off WhatsApp messages for you: _"whatsapp mom saying I'm on my
way"_, _"text dad: call me"_, _"message ana i'm late"_.

**1. Save your people.** Copy `contacts.example.json` to `contacts.json` and put
in real names → phone numbers **with country code**, digits only (Indonesia is
`62`, so `08123…` becomes `628123…`):

```json
{
  "mom": "628123456789",
  "dad": "628198765432"
}
```

`contacts.json` is git-ignored, so your numbers stay on your laptop. You can
also just say a raw number: _"whatsapp 628123456789 saying hi"_.

**2. Choose how it sends:**

- **Pre-filled (default, no setup):** Greg opens the WhatsApp chat with your
  message already typed — you just press **Send**. Works out of the box.
- **Fully hands-free (Greg presses Send too):** install the helper and log into
  WhatsApp Web once:
  ```bat
  pip install pywhatkit
  ```
  Then open <https://web.whatsapp.com> in your browser and scan the QR code with
  your phone (WhatsApp → Settings → Linked Devices). Keep that logged in and
  Greg will send messages without you touching anything.

> Note: WhatsApp has no official personal-account API, so hands-free mode drives
> WhatsApp Web through your browser. If a send ever mistimes, Greg falls back to
> the pre-filled chat so your message is never lost.

## Keep Greg always on (optional)

So Greg is ready the moment your laptop boots:

1. Press `Win + R`, type `shell:startup`, press Enter.
2. Right-click `start_greg.bat` → **Create shortcut**, and drop the shortcut in
   that Startup folder.

Now Greg starts with Windows. (To run it hidden without a console window, use
Task Scheduler with "Run whether user is logged on or not".)

---

## Security — please read

Greg has real control over your laptop, so it's built defensively:

- **Owner-only.** Greg ignores every Telegram user except the id(s) in
  `TELEGRAM_ALLOWED_USER_IDS`. Set this to *your* id only.
- **Your secrets stay local.** The `.env` file lives on your laptop and is
  git-ignored — it is never committed or uploaded.
- **The `run_command` tool is powerful.** It's what lets Greg do "anything",
  but that also means anyone who controls your Telegram account could run
  commands on your laptop. Protect your Telegram with a strong password + 2FA.
  If you'd rather lock Greg down to only the safe built-in actions, set
  `GREG_ALLOW_SHELL=false` in `.env`.
- Greg will ask for confirmation before destructive things like shutting down
  or deleting files.

---

## How it fits together

```
run.py                 → entry point; loads config, starts the bot
greg/config.py         → reads .env, validates, owner allow-list
greg/bot.py            → Telegram long-polling loop (text + voice notes)
greg/transcribe.py     → voice note → text (OpenAI Whisper)
greg/brain.py          → Claude decides which action(s) to run (tool use)
greg/actions.py        → the hands: open apps/sites, volume, lock, screenshot, shell
```

No `.env`? Greg tells you exactly what's missing. No Claude key? Greg falls
back to simple rules (`open …`, `search …`, `volume up`, `lock`, `screenshot`)
so it still does the basics.

---

## Troubleshooting

- **"Telegram rejected the bot token"** — recheck `TELEGRAM_BOT_TOKEN` in `.env`.
- **Greg replies "I only take orders from my owner"** — your
  `TELEGRAM_ALLOWED_USER_IDS` doesn't match your real id (from @userinfobot).
- **An app won't open by name** — make sure it's installed and on your PATH, or
  tell Greg the exact `.exe` (e.g. `open C:\Path\To\App.exe`).
- **Voice notes say voice isn't set up** — add `OPENAI_API_KEY` to `.env`.
- **Screenshots error** — run `pip install pillow`.
