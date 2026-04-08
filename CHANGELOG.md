# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0]

### Added
- Initial public release
- Discord OAuth2 login with role-based permissions (Admin vs Member)
- Song library with YouTube URL ingestion via yt-dlp
- Playlist management (create, rename, delete, add/remove songs)
- Real-time sync via Socket.io for player state and library changes
- Web UI player with progress bar and queue view
- Queue management with loop modes (`off`, `song`, `queue`) and shuffle
- Audio playback via `yt-dlp` + `ffmpeg` + `@discordjs/voice`
- Short-lived JWT tokens with refresh token flow
- Rate limiting on authentication endpoints
- Helmet middleware for HTTP security headers
- Socket.io authentication middleware
- Input length validation for security
- Docker production deployment with pre-built images
- Database migration service for PostgreSQL
- Architecture diagram in tech stack documentation
- Contributing guide for contributors

### Security
- Socket.io authentication middleware to validate connections
- Helmet middleware for security headers
- Input length validation on all user inputs
- Short-lived JWT tokens with refresh token rotation
- Rate limiting on authentication endpoints to prevent brute force