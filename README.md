<p align="center">
  <img src="site/wordmark.svg" alt="Wheat" width="400">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@grainulation/wheat"><img src="https://img.shields.io/npm/v/@grainulation/wheat" alt="npm version"></a> <a href="https://www.npmjs.com/package/@grainulation/wheat"><img src="https://img.shields.io/npm/dm/@grainulation/wheat" alt="npm downloads"></a> <a href="https://github.com/grainulation/wheat/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a> <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@grainulation/wheat" alt="node"></a> <a href="https://github.com/grainulation/wheat/actions"><img src="https://github.com/grainulation/wheat/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://deepwiki.com/grainulation/wheat"><img src="https://deepwiki.com/badge.svg" alt="Explore on DeepWiki"></a>
</p>

<p align="center"><strong>CI/CD for technical decisions.</strong></p>

You're about to mass-migrate 200 microservices. Slow down.

The migration will take months. It will cost real money. And right now, the decision to move is based on a Slack thread, a blog post, and a gut feeling from someone who left the company.

You'd never ship code without tests. Why ship a decision without validated evidence?

Wheat is a continuous planning pipeline. Every finding is a typed assertion. A compiler validates them. You can't ship with contradictions, same as you can't merge with failing tests.

## Install

```bash
npx @grainulation/wheat init
```

No dependencies are added to your project. No `node_modules` pollution. Wheat is a tool you run, not a library you import.

## See it in 30 seconds

```bash
npx @grainulation/wheat quickstart
```

Creates a demo build with pre-seeded assertions, an intentional conflict, compiles everything, and opens a dashboard. You'll see the compiler flag the conflict and block output until it's resolved.

## Start a real investigation

```bash
npx @grainulation/wheat init
```

Wheat asks a few questions -- what you're investigating, who needs the answer, what constraints exist. Then it scaffolds the investigation in your repo:

```
claims.json          # Typed assertions (the test suite for your decision)
CLAUDE.md            # AI assistant configuration
.claude/commands/    # 18 slash commands
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

Wheat is a continuous planning pipeline. Findings are validated as they come in, not after the fact:

```
You investigate  -->  Assertions accumulate  -->  Compiler validates  -->  Artifacts compile
   /research          claims.json                 wheat compile            /brief, /present
   /prototype         (typed, evidence-graded)    (7-pass pipeline)        (backed by evidence)
   /challenge
```

**Assertion types:** constraint, factual, estimate, risk, recommendation, feedback

**Evidence tiers** (like test coverage): stated (untested) > web > documented > tested > production (battle-hardened)

The compiler catches conflicts, warns about weak evidence, and blocks the build when issues exist. You cannot ship a brief built on unresolved contradictions — same as you can't merge with failing tests.

## Commands

| Command               | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `/init`               | Bootstrap a new research sprint                   |
| `/research <topic>`   | Deep dive on a topic, creates claims              |
| `/prototype`          | Build something testable                          |
| `/challenge <id>`     | Adversarial stress-test of a claim                |
| `/witness <id> <url>` | External corroboration                            |
| `/blind-spot`         | Find gaps in your investigation                   |
| `/status`             | Sprint dashboard                                  |
| `/brief`              | Compile the decision document                     |
| `/present`            | Generate a stakeholder presentation               |
| `/feedback`           | Incorporate stakeholder input                     |
| `/resolve`            | Adjudicate conflicts between claims               |
| `/replay`             | Time-travel through sprint history                |
| `/calibrate`          | Score predictions against actual outcomes         |
| `/handoff`            | Package sprint for knowledge transfer             |
| `/merge <path>`       | Combine findings across sprints                   |
| `/connect <type>`     | Link external tools (Jira, docs, etc.)            |
| `/evaluate`           | Test claims against reality, resolve conflicts    |
| `/next`               | Route next steps through Farmer (mobile feedback) |

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

| Tool                                                         | Role                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **wheat**                                                    | Research engine -- grow structured evidence                                    |
| [farmer](https://github.com/grainulation/farmer)             | Permission dashboard -- approve AI actions in real time (admin + viewer roles) |
| [barn](https://github.com/grainulation/barn)                 | Shared tools -- templates, validators, sprint detection                        |
| [mill](https://github.com/grainulation/mill)                 | Format conversion -- export to PDF, CSV, slides, 24 formats                    |
| [silo](https://github.com/grainulation/silo)                 | Knowledge storage -- reusable claim libraries and packs                        |
| [harvest](https://github.com/grainulation/harvest)           | Analytics -- cross-sprint patterns and prediction scoring                      |
| [orchard](https://github.com/grainulation/orchard)           | Orchestration -- multi-sprint coordination and dependencies                    |
| [grainulation](https://github.com/grainulation/grainulation) | Unified CLI -- single entry point to the ecosystem                             |

## License

MIT
