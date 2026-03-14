# Changelog

All notable changes to this project will be documented in this file.

## 0.9.0-beta.1 — 2026-03-13

First public beta of Wheat, a research sprint framework for structured decision-making.

### What's included

- **CLI entrypoint** (`bin/wheat.js`) — dispatches `init`, `compile`, `guard`, `status`, `update` subcommands
- **Conversational init** (`lib/init.js`) — interactive, quick (`--question`), and headless (`--headless`) modes for bootstrapping a sprint in any repo
- **Bran compiler** (`compiler/wheat-compiler.js`) — 7-pass compilation pipeline that validates claims, detects conflicts, checks evidence strength, and produces `compilation.json`
- **Sprint detection** (`compiler/detect-sprints.js`) — git-based multi-sprint discovery without config pointers
- **Manifest generator** (`compiler/generate-manifest.js`) — topic-map manifest for AI-assisted codebase navigation
- **Guard hook** (`lib/guard.js`) — PreToolUse hook for Claude Code that blocks output artifact generation unless compilation is fresh and passing
- **Status checker** (`lib/status.js`) — terminal snapshot of sprint health
- **Command updater** (`lib/update.js`) — syncs slash command templates to `.claude/commands/`
- **17 slash command templates** — `/research`, `/prototype`, `/challenge`, `/witness`, `/blind-spot`, `/status`, `/brief`, `/present`, `/feedback`, `/resolve`, `/replay`, `/calibrate`, `/handoff`, `/merge`, `/connect`, `/evaluate`, `/init`
- **CLAUDE.md template** — auto-generated AI assistant configuration with intent router
- **Explainer HTML template** — dark scroll-snap presentation template for output artifacts
- **GitHub CI workflow** — tests across Node 18, 20, 22; verifies zero dependencies
- **Zero npm dependencies** — uses only Node built-in modules

### Architecture

```
bin/wheat.js          CLI entrypoint
lib/                  Subcommand handlers (init, compile, guard, status, update)
compiler/             Bran compiler + sprint detection + manifest generation
templates/            CLAUDE.md template, slash commands, HTML templates
```

### Requirements

- Node.js >= 18
- Git (for sprint detection and guard hooks)
