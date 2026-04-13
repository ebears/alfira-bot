# Troubleshooting

Common issues and solutions for Alfira.

## Bot Issues

### Bot not joining voice channels

**Symptoms:** Bot doesn't appear in voice channel when using the Play button.

**Solutions:**
1. Ensure the bot has the required permissions (Connect, Speak).
2. Check that the voice channel allows bot access.
3. Verify `DISCORD_BOT_TOKEN` is correct.
4. Check API logs: `docker compose logs alfira`

### Audio not playing

**Symptoms:** Bot joins but no audio is heard.

**Solutions:**
1. Ensure the NodeLink service is running (it starts automatically inside the alfira container).
2. Check API logs for NodeLink connection errors: `docker compose logs alfira`
3. Look for `[NodeLink]` prefix in logs to see NodeLink startup status.
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

**Symptoms:** API crashes with "database not found" or permission errors.

**Solutions:**
1. Ensure the alfira container is running: `docker compose ps`
2. Check API logs: `docker compose logs alfira`
3. Verify the `/data` volume is properly mounted and writable.
4. For fresh database, delete the volume: `docker compose down -v` then `docker compose up --build`

## Resetting Everything

**Warning:** This will delete all your data (playlists, songs, etc.).

```bash
# Stop and remove everything, including database
docker compose down -v

# Rebuild from scratch
docker compose up --build
```

## Getting Help

1. Check the logs: `docker compose logs -f alfira`
2. Search existing [GitHub Issues](https://github.com/ebears/alfira/issues).
3. Open a new issue with:
   - Docker version
   - Relevant log output
   - Steps to reproduce