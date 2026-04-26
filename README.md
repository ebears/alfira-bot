<h1 align="center">Alfira</h1>
<p align="center">
  <img width="299" height="299" src="https://raw.githubusercontent.com/ebears/alfira/main/.github/logo.png" alt="Alfira Logo">
  <br>
  <a href="https://github.com/ebears/alfira"><img src="https://img.shields.io/badge/status-experimental%20%7C%20pre--release-orange" alt="Status: Experimental | Pre-release"></a>
  <br>
  <a href="https://github.com/ebears/alfira/actions/workflows/docker-build.yml"><img src="https://github.com/ebears/alfira/actions/workflows/docker-build.yml/badge.svg" alt="GitHub Actions"></a>
  <br>
  <a href="https://bun.com/"><img src="https://img.shields.io/badge/Bun%20-F472B6?logo=bun&logoColor=white" alt="Bun"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite"></a>
  <br>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React%20-61DAFB?logo=react&logoColor=black" alt="React"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind%20-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://github.com/drizzle-team/drizzle-orm"><img src="https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle"></a>
  <br>
  <a href="https://github.com/tiramisulabs/seyfert"><img src="https://img.shields.io/badge/Seyfert%20-2D7553?logo=discord&logoColor=white" alt="Seyfert"></a>
  <a href="https://github.com/PerformanC/NodeLink"><img src="https://img.shields.io/badge/NodeLink%20-63B64C?logo=apple%20music&logoColor=white" alt="NodeLink"></a>
  <a href="https://github.com/Ganyu-Studios/Hoshimi"><img src="https://img.shields.io/badge/Hoshimi%20-353139?logo=typescript&logoColor=white" alt="Hoshimi"></a>
</p>

> **Status:** This project is actively maintained but considered **experimental** and **pre-release**.

## Features

**Alfira** is a self-hosted Discord music bot with a web UI for library management and real-time playback control. The intended scope of the bot is a single small to medium-sized Discord server.

### Web UI

- **Responsive layout** — Works on desktop and mobile
- **Different themes** — User-selectable auto/light/dark mode and color themes
- **Virtual scrolling** — Efficient rendering for large libraries
- **Now playing bar** — Persistent playback controls with progress bar and seek

### Music Library

- **Song management** — Add songs via YouTube links (playlist support included) to a persistent, shared library with duplicate detection
- **Edit metadata** — Set custom title, artist, album, and artwork per song
- **Tag system** — Organize songs with tags; color-code and canonicalize tag names
- **Playlists** — Create & manage private or public playlists from the library
- **Search & filter** — Search by title, artist, album, or tags

### Playback

- **Discord voice** — Play, pause, seek, and skip songs from the library or any playlist in a Discord call
- **Loop modes** — Off, song, or queue
- **Shuffle / unshuffle** — Randomize queue order, with the ability to restore the original order
- **Per-song volume offset** — Adjust playback volume for individual songs
- **Audio filters** — Fine-tune audio with a graphical equalizer and compressor

### Queue Management

- **Priority queue** — Add songs to "Up Next" to play immediately after the current track
- **Quick add** — Paste a YouTube URL directly into the queue without saving to the library
- **Override** — Instantly replace the queue with a YouTube URL and start playing

### Authentication & Authorization

- **Discord OAuth2** — Log in with your Discord account; guild membership required
- **Admin roles** — Use Discord role IDs to control access to admin access

### Real-Time Updates

- **WebSocket sync** — Queue state, now playing, and elapsed time update across all clients in real time
- **Live song events** — Songs added, updated, or deleted propagate instantly to all connected users
- **Playlist events** — Playlist changes broadcast to all clients

## Screenshots

<p align="center">
  <img src=".github/screenshots/songs-page.png" width="900" alt="Songs page">
</p>

<details>
  <summary>Click to see more screenshots</summary>
  <p align="center">
    <img src=".github/screenshots/playlists-page.png" width="450" alt="Playlists page">
    <img src=".github/screenshots/playlist-details.png" width="450" alt="Playlist details">
    <br>
    <img src=".github/screenshots/login.png" width="450" alt="Login">
    <img src=".github/screenshots/settings-page.png" width="450" alt="Settings page">
    <br>
    <img src=".github/screenshots/theme-example-1.png" width="300" alt="Theme example 1">
    <img src=".github/screenshots/theme-example-2.png" width="300" alt="Theme example 2">
    <img src=".github/screenshots/theme-example-3.png" width="300" alt="Theme example 3">
    <img src=".github/screenshots/theme-example-4.png" width="300" alt="Theme example 4">
    <img src=".github/screenshots/theme-example-5.png" width="300" alt="Theme example 5">
    <img src=".github/screenshots/theme-example-6.png" width="300" alt="Theme example 6">
  </p>
</details>

---

<p align="center">
  <img width="256" src="https://raw.githubusercontent.com/ebears/alfira/main/.github/icon.png">
</p>

<h2 align="center">Quick Start with Docker</h2>

```bash
# 1. Copy docker-compose.prod.yml and .env.example from this repo to the folder you want the bot to live.
curl -o docker-compose.prod.yml https://raw.githubusercontent.com/ebears/alfira/main/docker-compose.prod.yml
curl -o .env.example https://raw.githubusercontent.com/ebears/alfira/main/.env.example

# 2. Rename docker-compose.prod.yml to docker-compose.yml and .env.example to .env.
cp docker-compose.prod.yml docker-compose.yml
cp .env.example .env

# 3. Configure the .env.
nano .env  # or micro, zed, code, vim, etc.

# 4. Start the stack - web UI at http://localhost:8180
docker compose up -d
```

For public deployment with a reverse proxy and HTTPS, see the **[Full Installation Guide](docs/installation.md)**.

---

## Documentation

| Document | Description |
|----------|-------------|
| **[Installation Guide](docs/installation.md)** | Development and production setup, Discord configuration, reverse proxy setup |
| **[Configuration Reference](docs/configuration.md)** | Complete environment variables reference |
| **[Tech Stack](docs/tech-stack.md)** | Technology stack and project structure |
| **[Biome Setup](docs/biome-setup.md)** | Editor setup for Biome linting and formatting |
| **[Troubleshooting](docs/troubleshooting.md)** | Common issues and solutions |

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
