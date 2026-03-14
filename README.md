# wheat

**You're about to mass-migrate 200 microservices. Slow down.**

The migration will take months. It will cost real money. And right now, the decision to move is based on a Slack thread, a blog post, and a gut feeling from someone who left the company.

Wheat exists because the most expensive engineering decisions are made with the least structured evidence. Not because people are careless -- because there's no tool that makes structured investigation feel natural.

## The idea

Wheat is a research sprint framework. You point it at a question -- "Should we migrate to Postgres?", "Is this architecture going to scale?", "Which vendor should we pick?" -- and it helps you build an evidence base before you commit.

Every finding becomes a typed, evidence-graded claim. A constraint from your VP is different from a benchmark you ran, and wheat tracks the difference. When two findings contradict each other, the compiler catches it. When you try to ship a recommendation backed by nothing but blog posts, it warns you.

The process is intentionally slow. You gather evidence from multiple sources. You grade how much you trust each piece. You challenge your own assumptions. Then -- and only then -- you compile it into a recommendation you can defend.

If that sounds like a lot of work: it is. That's the point. The work happens before you commit a team to six months of migration, not after.

## Quick start

```bash
npx @grainulator/wheat init
```

Wheat asks you a few questions in a conversational flow -- what you're investigating, who needs the answer, what constraints you're working under. No config wizard, just a conversation.

Then it sets up the sprint in your repo:

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

**Evidence tiers:** stated -> web -> documented -> tested -> production

The compiler catches conflicts, warns about weak evidence, and blocks output when issues exist. You cannot ship a brief built on unresolved contradictions.

## Works in any repo

Wheat doesn't care what language you use. It runs via npx and stores sprint data in your repo. Your Scala project, your Python monorepo, your Flutter app -- wheat works the same everywhere.

```bash
# In a Scala repo
npx @grainulator/wheat init

# In a Python repo
npx @grainulator/wheat init

# Compiles anywhere Node 18+ is available
npx @grainulator/wheat compile --summary
```

No dependencies are added to your project. No `node_modules` pollution. Wheat is a tool you run, not a library you import.

## Without npm

If your team doesn't use Node:

```bash
# macOS
brew install grainulator/tap/wheat

# Or download directly
curl -fsSL https://get.grainulator.dev/wheat | sh
```

## Guard rails

Wheat installs two guard mechanisms:

1. **Git pre-commit hook** -- prevents committing broken `claims.json`
2. **Claude Code guard hook** -- prevents generating output artifacts from stale or blocked compilations

Both are optional and can be removed. But they exist because the most dangerous moment in a research sprint is when you skip the process.

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

## Documentation

- **[Concepts](docs/concepts.md)** -- claims, phases, evidence tiers, the compiler
- **[Commands](docs/commands.md)** -- every slash command with usage examples
- **[FAQ](docs/faq.md)** -- setup, data, usage, and troubleshooting

## Platform support

Wheat runs on macOS, Linux, and Windows. All path handling uses `path.join`/`path.sep` internally, and git commands are invoked via `execFileSync` (no shell). The pre-commit hook requires Git Bash on Windows (bundled with Git for Windows).

The `brew` and `curl | sh` install methods are Unix-only. On Windows, use `npx @grainulator/wheat` directly -- Node 18+ is the only requirement.

## Contributing

We'd love your help. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Good first issues are labeled [`good first issue`](https://github.com/grainulator/wheat/labels/good%20first%20issue).

## License

MIT
