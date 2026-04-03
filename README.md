<p align="center">
  <img src="site/wordmark.svg" alt="Wheat" width="400">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@grainulation/wheat"><img src="https://img.shields.io/npm/v/@grainulation/wheat?label=%40grainulation%2Fwheat" alt="npm version"></a> <a href="https://www.npmjs.com/package/@grainulation/wheat"><img src="https://img.shields.io/npm/dm/@grainulation/wheat" alt="npm downloads"></a> <a href="https://github.com/grainulation/wheat/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a> <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@grainulation/wheat" alt="node"></a> <a href="https://github.com/grainulation/wheat/actions"><img src="https://github.com/grainulation/wheat/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://deepwiki.com/grainulation/wheat"><img src="https://deepwiki.com/badge.svg" alt="Explore on DeepWiki"></a>
</p>

<p align="center"><strong>CI/CD for technical decisions.</strong></p>

You're about to mass-migrate 200 microservices. Slow down.

The migration will take months. It will cost real money. And right now, the decision to move is based on a Slack thread, a blog post, and a gut feeling from someone who left the company.

You'd never ship code without tests. Why ship a decision without validated evidence?

## Quick start

```bash
npx @grainulation/wheat "Should we migrate to GraphQL?"
```

One command. Zero prompts. Sprint ready in under 3 seconds.

Then open your AI coding tool and start investigating:

```
/research "GraphQL performance vs REST"
/challenge r003
/blind-spot
/brief
```

Works with [Claude Code](https://claude.com/claude-code), [Cursor](https://cursor.com), [GitHub Copilot](https://github.com/features/copilot), or standalone via CLI.

## Full MCP integration (optional)

For native tool access in Claude Code:

```bash
claude mcp add wheat -- npx -y @grainulation/wheat-mcp
```

This gives Claude direct access to wheat's claims engine — add-claim, compile, search, status — without shelling out.

> **Note:** `wheat mcp` still works as a subcommand, but the dedicated `wheat-mcp` entry point is recommended for MCP integrations — it bypasses CLI dispatch and starts the server directly.

### Sub-sprints

Every MCP tool accepts an optional `dir` parameter to target a sub-sprint in a different directory. This lets you run multiple sprints without restarting the MCP server:

```json
{ "name": "wheat/add-claim", "arguments": { "dir": "./sub-sprint", "id": "r001", ... } }
```

If omitted, tools default to the server's startup directory.

## See it in 30 seconds

```bash
npx @grainulation/wheat quickstart
```

Creates a demo sprint with pre-seeded claims, an intentional conflict, compiles everything, and opens a dashboard. The compiler flags the conflict and blocks output until it's resolved.

## How it works

Wheat is a continuous planning pipeline. Findings are validated as they come in:

```
You investigate  →  Claims accumulate  →  Compiler validates  →  Brief compiles
  /research          typed, evidence-graded   7-pass pipeline       backed by evidence
  /prototype
  /challenge
```

**Claim types:** constraint, factual, estimate, risk, recommendation, feedback

**Evidence tiers:** stated → web → documented → tested → production

The compiler catches conflicts, flags weak evidence, and blocks the build when issues exist. You can't ship a brief built on contradictions — same as you can't merge with failing tests.

## Commands

| Command | What it does |
|---------|-------------|
| `/research <topic>` | Deep dive on a topic, creates claims |
| `/prototype` | Build something testable |
| `/challenge <id>` | Adversarial stress-test of a claim |
| `/witness <id> <url>` | External corroboration |
| `/blind-spot` | Find gaps in your investigation |
| `/brief` | Compile the decision document |
| `/status` | Sprint dashboard |
| `/present` | Generate a stakeholder presentation |
| `/resolve` | Adjudicate conflicts between claims |

## Guard rails

Wheat installs two optional guard mechanisms:

1. **Git pre-commit hook** — prevents committing broken claims
2. **Claude Code guard hook** — prevents generating output from stale compilations

## Works everywhere

Wheat doesn't care what language you use or what AI tool you run. Your Scala project, your Python monorepo, your Flutter app — wheat works the same everywhere. Node 20+ is the only requirement. Zero npm dependencies.

## Part of the grainulation ecosystem

| Tool | Role |
|------|------|
| **wheat** | Research engine — grow structured evidence |
| [farmer](https://github.com/grainulation/farmer) | Permission dashboard — approve AI actions in real time |
| [barn](https://github.com/grainulation/barn) | Shared tools — templates, validators, sprint detection |
| [mill](https://github.com/grainulation/mill) | Format conversion — export to PDF, CSV, slides |
| [silo](https://github.com/grainulation/silo) | Knowledge storage — reusable claim libraries |
| [harvest](https://github.com/grainulation/harvest) | Analytics — cross-sprint patterns and prediction scoring |
| [orchard](https://github.com/grainulation/orchard) | Orchestration — multi-sprint coordination |
| [grainulation](https://github.com/grainulation/grainulation) | Unified CLI — single entry point to the ecosystem |

**You don't need all eight.** Start with wheat. That's it.

## License

MIT
