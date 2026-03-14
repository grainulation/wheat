#!/usr/bin/env node
/**
 * wheat — CLI entrypoint for the Wheat research sprint framework
 *
 * Usage:
 *   wheat init                    Bootstrap a new sprint (conversational)
 *   wheat init --question "..."   Quick mode (skip conversation)
 *   wheat init --headless         Non-interactive mode (requires all flags)
 *   wheat compile [--summary|--check|--gate]   Run the Bran compiler
 *   wheat guard                   Run the PreToolUse guard hook
 *   wheat status                  Quick sprint status
 *   wheat stats                   Local sprint statistics (no phone-home)
 *   wheat update                  Update slash commands in .claude/commands/
 *   wheat mcp                     Start MCP server (future)
 *
 * All operations resolve paths relative to --dir or process.cwd().
 * The package ships framework code; sprint data stays in YOUR repo.
 *
 * Zero npm dependencies.
 */

const path = require('path');

const VERSION = require('../package.json').version;

// ─── Parse arguments ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const subcommand = args[0];

// Extract --dir flag (applies to all subcommands)
let targetDir = process.cwd();
const dirIdx = args.indexOf('--dir');
if (dirIdx !== -1 && args[dirIdx + 1]) {
  targetDir = path.resolve(args[dirIdx + 1]);
  args.splice(dirIdx, 2);
}

// Pass remaining args (minus subcommand) to subcommand handlers
const subArgs = args.slice(1);

// ─── Help / Version ──────────────────────────────────────────────────────────

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  console.log(`wheat v${VERSION} — Research-driven development framework

Usage:
  wheat <command> [options]

Commands:
  init       Bootstrap a new research sprint in this repo
  compile    Run the Bran compiler on claims.json
  guard      PreToolUse guard hook (used by Claude Code)
  status     Quick sprint status check
  stats      Local sprint statistics (no phone-home)
  update     Copy/update slash commands to .claude/commands/
  mcp        Start MCP server (coming soon)

Global options:
  --dir <path>   Target directory (default: current directory)
  --version      Show version
  --help         Show this help

Examples:
  npx @grainulator/wheat init
  npx @grainulator/wheat compile --summary
  npx @grainulator/wheat init --question "Should we migrate to Postgres?"

Documentation: https://github.com/grainulator/wheat`);
  process.exit(0);
}

if (subcommand === '--version' || subcommand === '-v') {
  console.log(`wheat v${VERSION}`);
  process.exit(0);
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

const commands = {
  init:    '../lib/init.js',
  compile: '../lib/compiler.js',
  guard:   '../lib/guard.js',
  status:  '../lib/status.js',
  stats:   '../lib/stats.js',
  update:  '../lib/update.js',
  mcp:     null,
};

if (subcommand === 'mcp') {
  console.log('MCP server is not yet implemented. Coming in v0.2.0.');
  process.exit(0);
}

if (!commands[subcommand]) {
  console.error(`Unknown command: ${subcommand}\n`);
  console.error('Run "wheat --help" for available commands.');
  process.exit(1);
}

// Load and run the subcommand module
const handler = require(commands[subcommand]);
handler.run(targetDir, subArgs).catch(err => {
  console.error(`\nwheat ${subcommand} failed:`, err.message);
  if (process.env.WHEAT_DEBUG) console.error(err.stack);
  process.exit(1);
});
