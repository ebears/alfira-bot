# Phase 1 — Setup & Verification Guide

This guide walks you through getting the bot running end-to-end for the first time.
By the end you should have a bot that can join your voice channel and play a YouTube video.

---

## Prerequisites

Install these before anything else. The bot cannot run without them.

### Node.js (v18 or higher)
```bash
node --version   # Should print v18.x.x or higher
```
Download from https://nodejs.org if needed.

### FFmpeg
FFmpeg handles the audio encoding step — yt-dlp fetches the audio,
FFmpeg converts it to the Opus format Discord requires.

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu / Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add the `bin` folder to your PATH.

Verify:
```bash
ffmpeg -version   # Should print FFmpeg version info
```

### yt-dlp
yt-dlp extracts audio streams from YouTube.

**macOS / Linux:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Windows:**
Download `yt-dlp.exe` from https://github.com/yt-dlp/yt-dlp/releases/latest
and place it somewhere on your PATH.

Verify:
```bash
yt-dlp --version   # Should print a version like 2024.xx.xx
```

---

## Discord Setup

### 1. Create a Discord application

1. Go to https://discord.com/developers/applications
2. Click **New Application**, give it a name.
3. Go to the **Bot** tab → click **Add Bot**.
4. Under **Privileged Gateway Intents**, enable **Server Members Intent** and **Message Content Intent**.
   (These are needed for future phases. Enable them now to avoid re-visiting.)
5. Click **Reset Token** and copy the token. You will need this for `.env`.

### 2. Invite the bot to your server

Still in the Developer Portal:
1. Go to **OAuth2 → URL Generator**.
2. Under **Scopes**, check: `bot`, `applications.commands`
3. Under **Bot Permissions**, check:
   - `Connect`
   - `Speak`
   - `Send Messages`
   - `Use Slash Commands`
4. Copy the generated URL and open it in your browser to invite the bot.

### 3. Get your IDs

You will need two IDs. To see them, enable **Developer Mode** in Discord:
Settings → Advanced → Developer Mode → ON.

- **Client ID:** Developer Portal → Your Application → General Information → Application ID
- **Guild ID:** Right-click your server name in Discord → Copy Server ID

---

## Installation

```bash
# From the project root
npm install

# Copy the env template and fill it in
cp packages/bot/.env.example packages/bot/.env
```

Open `packages/bot/.env` and fill in all three values:
```
DISCORD_BOT_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
```

---

## Running

### Step 1: Register slash commands
This only needs to be run once (and again when commands change).

```bash
npm run bot:deploy
```

You should see:
```
🔄  Registering 3 slash command(s)...
✅  Slash commands registered successfully.
```

If you see a 401 error, your `DISCORD_BOT_TOKEN` is wrong.
If you see a 50001 error, your bot hasn't been invited to the server yet.

### Step 2: Start the bot

```bash
npm run bot:dev
```

You should see:
```
✅  Logged in as YourBotName#1234
```

---

## Verification Checklist

Work through these in order. Each one confirms a different part of the stack.

- [x] **Bot appears online in your server.** If not, the token is wrong or the bot wasn't invited.
- [x] **Slash commands appear when you type `/`.** If not, re-run `npm run bot:deploy`.
- [x] **`/join` works.** Join a voice channel yourself, then run `/join`. The bot should appear in the channel.
- [x] **`/leave` works.** Run `/leave`. The bot should disconnect.
- [x] **`/play` works.** Try: `/play url:https://www.youtube.com/watch?v=dQw4w9WgXcQ`
  - The bot should reply with "▶️ Now playing: **Rick Astley - Never Gonna Give You Up** (3:33)"
  - You should hear audio in the voice channel within a few seconds.
- [x] **Audio plays cleanly** with no crackling, cutting out, or error messages in the terminal.
- [x] **`/leave` after `/play` works.** The bot disconnects and audio stops.

---

## Common Problems

### "yt-dlp: command not found"
yt-dlp is not on your PATH. Re-check the installation step and make sure
the binary is accessible from your terminal.

### "ffmpeg: command not found"
Same issue with FFmpeg. The bot process needs to be able to run `ffmpeg` directly.

### Bot connects but no audio plays
Check the terminal for yt-dlp error output. The most common causes are:
- The video is age-restricted (yt-dlp can't access it without login credentials)
- The video is private or has been removed
- yt-dlp is outdated — run `yt-dlp -U` to update it

### "Could not join the voice channel in time"
The bot doesn't have the **Connect** permission in that channel. Check the channel's
permission overrides in Discord.

### TypeScript errors on startup
Make sure you ran `npm install` from the **root** of the project (not inside `packages/bot`).
The monorepo root install handles all workspaces.

---

## What's next

Once everything on the checklist is green, Phase 1 is complete. Phase 2 builds the
`GuildPlayer` class on top of this foundation, adding a proper queue, skip, stop,
loop, and shuffle.
