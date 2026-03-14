# Wheat Concepts

This guide explains the six core ideas behind wheat. If you've run `npx @grainulator/wheat init` and are wondering "what does all this mean?" — start here.

## Claims

A claim is a single finding. Every time you discover something during a sprint — a hard constraint, a risk, a recommendation — wheat records it as a claim in `claims.json`.

Each claim has:

- **ID** — a prefix + number (e.g., `r003`). The prefix tells you which phase created it.
- **Type** — what kind of finding it is:
  - `constraint` — non-negotiable boundary ("must support Postgres 14+")
  - `factual` — verifiable statement ("the API returns paginated results")
  - `estimate` — a projection or range ("migration will take 2-4 weeks")
  - `risk` — a potential failure mode ("connection pooling may bottleneck at 500 concurrent users")
  - `recommendation` — a proposed course of action ("use pgBouncer for connection management")
  - `feedback` — stakeholder input ("the VP wants this done by Q3")
- **Evidence tier** — how much you should trust it (see below)
- **Status** — `active`, `challenged`, `superseded`, or `retracted`

You never edit `claims.json` by hand. Slash commands create and update claims automatically.

## Phases

A wheat sprint moves through phases. Each phase has commands that produce claims with matching ID prefixes:

| Phase | What happens | Commands | Claim prefix |
|-------|-------------|----------|-------------|
| **Define** | Frame the question, set constraints | `/init` | `d###` |
| **Research** | Gather evidence, explore the problem space | `/research`, `/witness` | `r###`, `w###` |
| **Prototype** | Build something testable, validate findings | `/prototype` | `p###` |
| **Evaluate** | Challenge assumptions, find blind spots | `/challenge`, `/blind-spot` | `x###` |
| **Feedback** | Incorporate stakeholder input, recalibrate | `/feedback`, `/calibrate` | `f###`, `cal###` |
| **Output** | Compile the decision document | `/brief`, `/present`, `/handoff` | (consumes claims, doesn't create them) |

Phases are not strictly sequential. You can jump back to research after a prototype reveals gaps, or challenge a claim at any point. The claim IDs tell you where each finding came from.

## Evidence Tiers

Not all evidence is equal. Wheat grades every claim on a five-tier scale:

| Tier | Meaning | Example |
|------|---------|---------|
| `stated` | Someone said it, no verification | "The CTO mentioned we need HIPAA compliance" |
| `web` | Found online, not independently verified | "Stack Overflow says this library handles 10k connections" |
| `documented` | In source code, official docs, or ADRs | "The Postgres docs say JSONB supports GIN indexes" |
| `tested` | Verified via prototype or benchmark | "Our prototype handled 500 concurrent connections in 43ms" |
| `production` | Measured from live production systems | "Our APM shows p99 latency of 120ms under real traffic" |

The compiler uses evidence tiers to warn you. A recommendation backed only by `stated` evidence gets flagged. A brief full of `web`-tier claims gets a warning. You don't have to fix every warning, but you have to see them.

## The Compiler

The compiler is what makes wheat more than a note-taking tool. Run it with:

```bash
npx @grainulator/wheat compile --summary
```

It reads `claims.json` and runs a multi-pass validation pipeline:

1. **Parse** — validates claim structure and types
2. **Link** — resolves cross-references between claims
3. **Conflict detection** — finds claims that contradict each other
4. **Evidence audit** — flags weak or missing evidence
5. **Coverage check** — identifies topics with only one claim type
6. **Status resolution** — tracks challenged/superseded claims
7. **Emit** — produces `compilation.json` with a health report

The output is `compilation.json` — a validated, scored snapshot of your sprint. Every output artifact (`/brief`, `/present`, `/handoff`) reads from `compilation.json`, never directly from `claims.json`. This means you cannot generate a brief from broken or conflicting data.

If the compiler says "blocked" — you have unresolved conflicts that must be addressed with `/resolve` before shipping output.

## Guard Hooks

Wheat installs two optional safeguards:

**Git pre-commit hook** — runs before every `git commit`. If `claims.json` is malformed or has structural errors, the commit is rejected. This prevents corrupted sprint data from entering your repo history.

**Claude Code guard hook** — runs before AI-generated output commands. If the compilation is stale (claims changed since last compile) or blocked (unresolved conflicts), the guard prevents artifact generation. This ensures you never ship a brief built on outdated or contradictory evidence.

Both hooks can be removed. They exist because the riskiest moment in a research sprint is when you skip validation under time pressure.

## Slash Commands

Wheat provides 17 slash commands inside Claude Code. Each command follows a pattern: investigate, record claims, compile, and suggest what to do next. See [commands.md](commands.md) for the full reference.

## How It All Fits Together

```
You ask a question
    |
    v
/init creates the sprint (constraints, audience, done-criteria)
    |
    v
/research, /prototype, /witness --> claims accumulate in claims.json
    |
    v
/challenge, /blind-spot ----------> claims get stress-tested
    |
    v
wheat compile ---------------------> compilation.json (validated snapshot)
    |
    v
/brief, /present, /handoff -------> output artifacts (backed by evidence)
```

The key insight: claims are the intermediate representation. Just like a compiler turns source code into machine code through an IR, wheat turns messy research into defensible decisions through typed, evidence-graded claims. The compiler is the enforcement layer that keeps you honest.
