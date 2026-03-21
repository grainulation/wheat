# Changelog

All notable changes to this project will be documented in this file.

## 1.0.3 — 2026-03-21

### Performance

- **`--quiet` mode** now skips sprint detection and manifest generation (3.5x faster)
- `detect-sprints.js` consolidated from 2 batch git calls to 1

### Docs & Governance

- Added CODE_OF_CONDUCT.md and CONTRIBUTING.md

## 1.0.2 — 2026-03-20

### Performance

- **14x compile speedup** (3.5s to 0.25s) via three changes:
  - Batch git queries in detect-sprints.js (2 calls instead of 32)
  - Export `buildManifest()` from generate-manifest.js for direct import
  - Replace subprocess spawn in wheat-compiler.js with inline `buildManifest()` call
- Slim `compilation.json` — strip claim content from `resolved_claims` (25% smaller, ~17K fewer tokens per read). Build scripts hydrate content from claims.json on demand.

### Changes

- MCP server version now reads from package.json instead of hardcoded constant
- `/brief` defaults to fast next-steps only; full brief is opt-in via `--full` flag

## 1.0.1 — 2026-03-18

### Changes

- `wheat init` now accepts `--non-interactive` as an alias for `--headless`
- MCP server exposes `wheat/init` tool for cross-session sprint bootstrap
- `wheat connect farmer` now also runs `wheat update` (slash commands) and writes sprint paths to `.farmer-config.json`
- Added `/next` slash command -- routes next steps through Farmer for mobile feedback
- 18 slash command templates (was 17)
- Compiler error messages now show expected claim shape when schema violations are detected
- Pre-commit hook prefers local wheat binary over `npx --yes` (addresses Socket supply-chain flag)
- MCP server uses `execFileSync` instead of `execSync` (no shell invocation)

### Docs & Site

- Rewritten landing page copy for clarity -- plain language, no forced analogies
- Added FAQ entries: "What are claims?", "What's a sprint?", "How is this different from Obra?"
- Added structured data for Google rich results: FAQPage, HowTo, enhanced SoftwareApplication schema
- SEO keywords targeting real search queries (architecture decision, ADR, technology evaluation, Claude Code)
- Updated concepts.md with engineering mental model table and sprint definition
- Updated README tagline and "How it works" section
- All docs now reference 18 slash commands

## 1.0.0 — 2026-03-17

First stable release. Published to npm as `@grainulation/wheat`.

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
- **18 slash command templates** — `/research`, `/prototype`, `/challenge`, `/witness`, `/blind-spot`, `/status`, `/brief`, `/present`, `/feedback`, `/resolve`, `/replay`, `/calibrate`, `/handoff`, `/merge`, `/connect`, `/evaluate`, `/init`, `/next`
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
