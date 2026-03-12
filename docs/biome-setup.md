# Biome Setup Guide

This document describes the Biome configuration for the Alfira project.

## What is Biome?

Biome is a fast, all-in-one toolchain for web projects that provides:
- **Linting**: Catches bugs and enforces code quality
- **Formatting**: Maintains consistent code style
- **Import Organization**: Automatically organizes imports

## Installation

Biome is already installed as a dev dependency in the project root:

```bash
npm install
```

This installs `@biomejs/biome` version 2.4.6 or later.

## NPM Scripts

The following scripts are available in the root `package.json`:

```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format all code
npm run format

# Check formatting without making changes
npm run format:check

# Combined: lint + format in one command
npm run check
```

## Editor Integration

### Zed Editor

The project includes Zed editor configuration in `.zed/settings.json`:

1. Install the **Biome** extension from Zed's extension marketplace
2. The extension will automatically:
   - Format code on save
   - Show linting errors inline
   - Auto-fix issues when saving
   - Organize imports automatically

#### Zed Configuration

```json
{
  "languages": {
    "JavaScript": {
      "language_servers": ["biome", "..."],
      "formatter": "language_server",
      "format_on_save": "on"
    },
    "TypeScript": {
      "language_servers": ["biome", "..."],
      "formatter": "language_server",
      "format_on_save": "on"
    }
    // ... other languages
  }
}
```

## CI Integration

Biome is integrated into the GitHub Actions workflow (`.github/workflows/typecheck.yml`):

```yaml
- name: Lint with Biome
  run: npm run lint
```

This ensures all code passes linting checks before merging.

## Common Workflows

### Before Committing

```bash
# Run both linting and formatting
npm run check
```

### Fixing All Issues

```bash
# Auto-fix all safe fixes
npm run lint:fix

# Format all files
npm run format
```

### Checking Specific Files

```bash
# Check a specific file
npx biome lint packages/api/src/index.ts

# Format a specific file
npx biome format packages/api/src/index.ts
```

## Resources

- [Biome Documentation](https://biomejs.dev/)
- [Biome GitHub Repository](https://github.com/biomejs/biome)
- [Zed Biome Extension](https://github.com/biomejs/biome-zed)
- [Biome Playground](https://biomejs.dev/playground/)
