# Troubleshooting

Common issues and solutions for Alfira.

## Bot Issues

### Bot not joining voice channels

**Symptoms:** `/join` command times out or bot doesn't appear in voice channel.

**Solutions:**
1. Ensure the bot has the required permissions (Connect, Speak).
2. Check that the voice channel allows bot access.
3. Verify `DISCORD_BOT_TOKEN` is correct.
4. Check API logs: `docker compose logs api`

### Audio not playing

**Symptoms:** Bot joins but no audio is heard.

**Solutions:**
1. Check if yt-dlp can access the video (may be region-locked).
2. Ensure ffmpeg is installed (handled by Docker image).
3. Check API logs for yt-dlp errors.
4. Try a different video/URL to isolate the issue.

## Authentication Issues

### OAuth2 login fails

**Symptoms:** "Invalid redirect_uri" error during Discord login.

**Solutions:**
1. Verify `DISCORD_REDIRECT_URI` matches exactly in:
   - Discord Developer Portal → OAuth2 → Redirects
   - Your `.env` file
2. Check that `WEB_UI_ORIGIN` matches your actual domain.
3. Ensure you're using `https://` in production.

## Database Issues

### Connection errors

**Symptoms:** API crashes with "Connection refused" or "database not found".

**Solutions:**
1. Ensure PostgreSQL is running: `docker compose ps`
2. Check database logs: `docker compose logs db`
3. Wait for the healthcheck to pass before starting API.
4. Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`

## Web UI Issues

### WebSocket connection fails

**Symptoms:** Web UI shows "Connecting..." indefinitely.

**Solutions:**
1. Check that `/socket.io` is properly proxied by your reverse proxy.
2. Ensure WebSocket upgrade headers are passed through.
3. Verify `WEB_UI_ORIGIN` matches the domain users access.

## Resetting Everything

**Warning:** This will delete all your data (playlists, songs, etc.).

```bash
# Stop and remove everything, including database
docker compose down -v

# Rebuild from scratch
docker compose up --build
```

## Getting Help

1. Check the logs: `docker compose logs -f api`
2. Search existing [GitHub Issues](https://github.com//ebears/alfira-bot/issues).
3. Open a new issue with:
   - Docker version
   - Relevant log output
   - Steps to reproduce