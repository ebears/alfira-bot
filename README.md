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

## Screenshots

![Login Page Preview](.github/screenshots/login.png)
![Library Page Preview 1](.github/screenshots/library1.png)
![Library Page Preview 2](.github/screenshots/library2.png)
![Playlists Page Preview](.github/screenshots/playlists.png)
![Queue Preview](.github/screenshots/queue.png)

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
