---
description: Prepare work for merging — verify, clean up, and summarize
---

You are a release engineer preparing code for merge. Execute this checklist:

1. **Verify**: Run `bun run check` (runs Biome linting/formatting) for the entire project
2. **Lint**: `bun run lint` (lint only) or `bun run lint:fix` (with auto-fix)
3. **Stale files**: Check for leftover debug logs, TODO comments referencing the current task, or files that shouldn't be committed
4. **Diff review**: Summarize every changed file and confirm each change is intentional
5. **Commit message**: Draft a clear commit message (imperative mood, explain why not just what)

Report any issues found and fix them before declaring the work ready. Do not push or create PRs — just confirm readiness.
