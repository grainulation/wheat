# @grainulation/wheat

[![npm version](https://img.shields.io/npm/v/@grainulation/wheat)](https://www.npmjs.com/package/@grainulation/wheat) [![npm downloads](https://img.shields.io/npm/dm/@grainulation/wheat)](https://www.npmjs.com/package/@grainulation/wheat) [![license](https://img.shields.io/npm/l/@grainulation/wheat)](https://github.com/grainulation/wheat/blob/main/LICENSE) [![node](https://img.shields.io/node/v/@grainulation/wheat)](https://nodejs.org) [![CI](https://github.com/grainulation/wheat/actions/workflows/ci.yml/badge.svg)](https://github.com/grainulation/wheat/actions)

**The structured research engine for AI-assisted decisions.**

You're about to mass-migrate 200 microservices. Slow down.

The migration will take months. It will cost real money. And right now, the decision to move is based on a Slack thread, a blog post, and a gut feeling from someone who left the company.

Wheat exists because the most expensive engineering decisions are made with the least structured evidence. Not because people are careless -- because there's no tool that makes structured investigation feel natural.

## Install

```bash
npx @grainulation/wheat init
```

No dependencies are added to your project. No `node_modules` pollution. Wheat is a tool you run, not a library you import.

## See it in 30 seconds

```bash
npx @grainulation/wheat quickstart
```

Creates a demo sprint with pre-seeded claims, an intentional conflict, compiles everything, and opens a dashboard. You'll see the compiler flag the conflict and block output until it's resolved.

## Start a real sprint

```bash
npx @grainulation/wheat init
```

Wheat asks a few questions -- what you're investigating, who needs the answer, what constraints exist. Then it sets up the sprint in your repo:

```
claims.json          # Your evidence database
CLAUDE.md            # AI assistant configuration
.claude/commands/    # 17 research slash commands
output/              # Where compiled artifacts land
```

Open Claude Code and start investigating:

```
/research "Postgres migration risks"
/prototype                              # build something testable
/challenge r003                         # stress-test a finding
/blind-spot                             # what are we missing?
/brief                                  # compile the decision document
```

## How it works

Wheat uses a claim-based system inspired by compiler design:

```
You investigate  -->  Claims accumulate  -->  Compiler validates  -->  Artifacts compile
   /research          claims.json            wheat compile            /brief, /present
   /prototype         (typed, graded)        (7-pass pipeline)        (backed by evidence)
   /challenge
```

**Claim types:** constraint, factual, estimate, risk, recommendation, feedback

**Evidence tiers:** stated > web > documented > tested > production

The compiler catches conflicts, warns about weak evidence, and blocks output when issues exist. You cannot ship a brief built on unresolved contradictions.

## Commands

| Command | What it does |
|---------|-------------|
| `/init` | Bootstrap a new research sprint |
| `/research <topic>` | Deep dive on a topic, creates claims |
| `/prototype` | Build something testable |
| `/challenge <id>` | Adversarial stress-test of a claim |
| `/witness <id> <url>` | External corroboration |
| `/blind-spot` | Find gaps in your investigation |
| `/status` | Sprint dashboard |
| `/brief` | Compile the decision document |
| `/present` | Generate a stakeholder presentation |
| `/feedback` | Incorporate stakeholder input |
| `/resolve` | Adjudicate conflicts between claims |
| `/replay` | Time-travel through sprint history |
| `/calibrate` | Score predictions against actual outcomes |
| `/handoff` | Package sprint for knowledge transfer |
| `/merge <path>` | Combine findings across sprints |
| `/connect <type>` | Link external tools (Jira, docs, etc.) |

## Guard rails

Wheat installs two guard mechanisms:

1. **Git pre-commit hook** -- prevents committing broken `claims.json`
2. **Claude Code guard hook** -- prevents generating output artifacts from stale or blocked compilations

Both are optional and can be removed.

## Works in any repo

Wheat doesn't care what language you use. Your Scala project, your Python monorepo, your Flutter app -- wheat works the same everywhere. Node 18+ is the only requirement.

## Zero dependencies

Node built-in modules only. No npm install waterfall. No supply chain anxiety.

## Part of the grainulation ecosystem

| Tool | Role |
|------|------|
| **wheat** | Research engine -- grow structured evidence |
| [farmer](https://github.com/grainulation/farmer) | Permission dashboard -- approve AI actions in real time |
| [barn](https://github.com/grainulation/barn) | Shared tools -- templates, validators, sprint detection |
| [mill](https://github.com/grainulation/mill) | Format conversion -- export to PDF, CSV, slides, 24 formats |
| [silo](https://github.com/grainulation/silo) | Knowledge storage -- reusable claim libraries and packs |
| [harvest](https://github.com/grainulation/harvest) | Analytics -- cross-sprint patterns and prediction scoring |
| [orchard](https://github.com/grainulation/orchard) | Orchestration -- multi-sprint coordination and dependencies |
| [grainulation](https://github.com/grainulation/grainulation) | Unified CLI -- single entry point to the ecosystem |

## License

MIT
