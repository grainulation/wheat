<p align="center">
  <img src="site/wordmark.svg" alt="Wheat" width="400">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@grainulation/wheat"><img src="https://img.shields.io/npm/v/@grainulation/wheat?label=%40grainulation%2Fwheat" alt="npm version"></a> <a href="https://www.npmjs.com/package/@grainulation/wheat"><img src="https://img.shields.io/npm/dm/@grainulation/wheat" alt="npm downloads"></a>
  <a href="https://github.com/grainulation/wheat/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a>
  <a href="https://github.com/grainulation/wheat/actions"><img src="https://github.com/grainulation/wheat/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://deepwiki.com/grainulation/wheat"><img src="https://deepwiki.com/badge.svg" alt="Explore on DeepWiki"></a>
</p>

## The problem

You're about to mass-migrate 200 microservices. The decision is based on a Slack thread, a blog post, and a gut feeling from someone who left the company.

Claude contradicts itself over long sessions. Decisions accumulate silently conflicting evidence. And nobody notices until the migration is six months in and the original assumptions were wrong.

**You'd never ship code without tests. Why ship a decision without validated evidence?**

## What wheat does

Wheat is a CLI that turns your AI coding tool into a structured research engine. Every finding becomes a typed, evidence-graded claim. A 7-pass compiler catches contradictions, flags weak evidence, and blocks output until issues are resolved.

```
You investigate  →  Claims accumulate  →  Compiler validates  →  Brief compiles
  /research          typed + graded        catches conflicts      backed by evidence
  /prototype         with evidence tiers   blocks on issues
  /challenge
```

The result: a decision document backed by validated evidence, not vibes.

## Quick start

```bash
npx @grainulation/wheat "Should we migrate to GraphQL?"
```

One command. Zero config. Sprint ready in under 3 seconds.

Then open your AI coding tool and start investigating:

```bash
wheat add r001 --type factual --topic "graphql-performance" \
  --content "GraphQL N+1 queries cause 3-10x latency without DataLoader" \
  --evidence documented

wheat search --topic "graphql"

wheat compile   # 7-pass validation: conflicts, weak evidence, coverage gaps

wheat resolve   # fix what the compiler flags
```

Works with [Claude Code](https://claude.com/claude-code), [Cursor](https://cursor.com), [GitHub Copilot](https://github.com/features/copilot), or standalone via CLI.

## See it in 30 seconds

```bash
npx @grainulation/wheat quickstart
```

Creates a demo sprint with pre-seeded claims, an intentional conflict, compiles everything, and opens a dashboard. The compiler flags the conflict and blocks output until it's resolved.

## What you get

After a sprint, `wheat compile` produces a `compilation.json` with:

- **Conflict detection** -- contradictory claims are surfaced and must be resolved
- **Evidence coverage** -- which topics have only "someone said so" vs. tested proof
- **Type diversity** -- flags when every claim is the same type (all risks, no facts)
- **Echo chamber warnings** -- same source corroborating itself

The compiler is the enforcement layer. If it says blocked, no brief gets produced. Same principle as CI: red build = no deploy.

## MCP integration (optional)

For native tool access in Claude Code:

```bash
claude mcp add wheat -- npx -y -p @grainulation/wheat wheat-mcp
```

This gives Claude direct access to wheat's claims engine -- add-claim, compile, search, status -- without shelling out.

## Commands

| Command | What it does |
|---------|-------------|
| `/research <topic>` | Deep dive, creates evidence-graded claims |
| `/prototype` | Build something testable, upgrade evidence to `tested` |
| `/challenge <id>` | Adversarial stress-test of a claim |
| `/witness <id> <url>` | External corroboration from primary sources |
| `/blind-spot` | Find gaps in your investigation |
| `/resolve` | Adjudicate conflicts between claims |
| `/brief` | Compile the decision document |
| `/status` | Sprint dashboard |

## Claim types and evidence tiers

**Types:** constraint, factual, estimate, risk, recommendation, feedback

**Evidence tiers** (lowest to highest): stated → web → documented → tested → production

The compiler uses these to score coverage. A topic with 5 `stated` claims is weaker than one with 2 `tested` claims.

## Guard rails

Wheat installs two optional guard mechanisms:

1. **Git pre-commit hook** -- prevents committing broken claims
2. **Claude Code guard hook** -- prevents generating output from stale compilations

## Requirements

Node 20+. Zero npm dependencies.

Wheat doesn't care what language your project uses. Your Scala project, your Python monorepo, your Flutter app -- wheat validates decisions, not code.

## Part of the grainulation ecosystem

Start with wheat. That's the only tool you need.

If you grow into multi-sprint coordination, the ecosystem has you covered: [orchard](https://github.com/grainulation/orchard) for orchestration, [farmer](https://github.com/grainulation/farmer) for permission management, and more at [grainulation.com](https://grainulation.com).

## Removing Wheat

```bash
# Remove sprint files
rm -f claims.json compilation.json CLAUDE.md.bak

# Remove wheat section from CLAUDE.md (or delete if wheat created it)
rm -f CLAUDE.md

# Remove slash commands and MCP config
rm -rf .claude/commands/wheat/
rm -f .mcp.json   # or remove just the "wheat" entry

# Remove pre-commit hook snippet (or delete .git/hooks/pre-commit)
```

## License

MIT
