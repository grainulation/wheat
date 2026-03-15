# Contributing to Wheat

Thanks for considering contributing. Wheat is a small project with big ambitions, and every contribution matters.

## Quick setup

```bash
git clone https://github.com/grainulation/wheat.git
cd wheat
node bin/wheat.js --help
```

No `npm install` needed — wheat has zero dependencies.

## How to contribute

### Report a bug
Open an issue with:
- What you expected
- What happened instead
- Your Node version (`node --version`)
- Steps to reproduce

### Suggest a feature
Open an issue describing the use case, not just the solution. "I need X because Y" is more useful than "add X."

### Submit a PR
1. Fork the repo
2. Create a branch (`git checkout -b fix/description`)
3. Make your changes
4. Run the compiler to verify: `node compiler/wheat-compiler.js --check`
5. Commit with a clear message
6. Open a PR

### Add a slash command
Slash commands live in `templates/commands/`. Each is a Markdown file that Claude Code reads as a prompt. To add one:

1. Create `templates/commands/your-command.md`
2. Follow the pattern of existing commands
3. Make sure it references `npx @grainulation/wheat compile` (not hardcoded paths)
4. Add it to the README commands table

## Architecture

```
bin/wheat.js          CLI entrypoint — dispatches subcommands
lib/init.js           Conversational sprint bootstrapper
lib/compiler.js       Thin wrapper → delegates to real compiler
lib/guard.js          PreToolUse hook for Claude Code
lib/status.js         Sprint status checker
lib/update.js         Slash command updater
compiler/             Full Bran compiler (7-pass pipeline)
templates/            CLAUDE.md + slash command templates
```

The key architectural principle: **wheat runs in your project but doesn't live in it.** The package ships the framework; your repo stores the sprint data.

## Code style

- Zero dependencies. If you need something, write it or use Node built-ins.
- No transpilation. Ship what you write.
- CommonJS (`require`). The package must work with Node 18+ without flags.
- Keep functions small. If a function needs a scroll, split it.

## Testing

```bash
node --test test/
```

Tests use Node's built-in test runner. No test framework dependencies.

## Commit messages

Follow the existing pattern:
```
wheat: <what changed> (<claim IDs if applicable>)
```

Examples:
```
wheat: add /calibrate command
wheat: fix compiler conflict detection for same-tier claims
wheat: guard blocks output when compilation stale (p008)
```
