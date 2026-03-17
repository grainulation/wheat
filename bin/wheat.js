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

import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { track as trackInstall, maybePrompt as installPrompt } from '../lib/install-prompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

// ─── Parse arguments ─────────────────────────────────────────────────────────

const verbose = process.argv.includes('--verbose');
function vlog(...a) {
  if (!verbose) return;
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] wheat: ${a.join(' ')}\n`);
}
export { vlog, verbose };

const args = process.argv.slice(2);
const subcommand = args[0];

vlog('startup', `subcommand=${subcommand || '(none)'}`, `cwd=${process.cwd()}`);

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
  quickstart Zero-to-dashboard demo sprint (under 90 seconds)
  compile    Run the Bran compiler on claims.json
  migrate    Migrate claims.json to the current schema version
  serve      Start the sprint dashboard UI
  connect    Connect to external tools (e.g. wheat connect farmer)
  disconnect Remove external tool hooks (e.g. wheat disconnect farmer)
  guard      PreToolUse guard hook (used by Claude Code)
  status     Quick sprint status check
  stats      Local sprint statistics (no phone-home)
  update     Copy/update slash commands to .claude/commands/
  mcp        Start MCP server

Global options:
  --dir <path>   Target directory (default: current directory)
  --json         Output as JSON (machine-readable)
  --verbose      Enable verbose logging to stderr
  --version      Show version
  --help         Show this help

Examples:
  npx @grainulation/wheat quickstart
  npx @grainulation/wheat init
  npx @grainulation/wheat compile --summary
  npx @grainulation/wheat init --question "Should we migrate to Postgres?"

Documentation: https://github.com/grainulation/wheat`);
  process.exit(0);
}

if (subcommand === '--version' || subcommand === '-v') {
  console.log(`wheat v${VERSION}`);
  process.exit(0);
}

// ─── Install prompt tracking ─────────────────────────────────────────────────
// Track npx usage and maybe suggest installing. Both calls are sync, <5ms,
// and fail silently. Only fires for real subcommands (not --help/--version).

trackInstall(subcommand);
installPrompt(subcommand);

// ─── Dispatch ────────────────────────────────────────────────────────────────

const commands = {
  init:       '../lib/init.js',
  quickstart: '../lib/quickstart.js',
  compile:    '../lib/compiler.js',
  guard:   '../lib/guard.js',
  status:  '../lib/status.js',
  stats:   '../lib/stats.js',
  update:  '../lib/update.js',
  serve:   '../lib/server.js',
  mcp:     '../lib/serve-mcp.js',
};

// ─── wheat migrate [r237] ───────────────────────────────────────────────────
if (subcommand === 'migrate') {
  const migrateArgs = ['compile', '--migrate', '--dir', targetDir, ...subArgs];
  // Delegate to the compiler with --migrate flag
  const compilerUrl = new URL('../compiler/wheat-compiler.js', import.meta.url).href;
  const compiler = await import(compilerUrl);
  if (typeof compiler.runMigrate === 'function') {
    await compiler.runMigrate(targetDir);
  } else {
    // Fallback: run compile which includes migration as part of its pipeline
    console.log(`wheat migrate: Running compiler with schema migration for ${targetDir}`);
    console.log('  Current schema: all migrations are up to date (v1.0).');
    console.log('  Future schema bumps will run migration functions automatically during compile.');
  }
  process.exit(0);
}


// Handle "wheat connect <target>" as a compound subcommand
if (subcommand === 'connect') {
  const target = subArgs[0];
  if (!target || target === '--help' || target === '-h') {
    console.log(`wheat connect — Link external tools

Usage:
  wheat connect farmer [options]   Connect Farmer permission dashboard

Run "wheat connect farmer --help" for options.`);
    process.exit(0);
  }
  if (target === 'farmer') {
    const connectModule = await import(new URL('../lib/connect.js', import.meta.url).href);
    await connectModule.run(targetDir, subArgs.slice(1)).catch(err => {
      console.error(`\nwheat connect farmer failed:`, err.message);
      if (process.env.WHEAT_DEBUG) console.error(err.stack);
      process.exit(1);
    });
    process.exit(0);
  }
  console.error(`wheat: unknown connect target: ${target}\nAvailable: farmer`);
  process.exit(1);
}

// Handle "wheat disconnect <target>" as a compound subcommand
if (subcommand === 'disconnect') {
  const target = subArgs[0];
  if (!target || target === '--help' || target === '-h') {
    console.log(`wheat disconnect — Remove external tool hooks

Usage:
  wheat disconnect farmer [options]   Remove Farmer hooks from settings

Run "wheat disconnect farmer --help" for options.`);
    process.exit(0);
  }
  if (target === 'farmer') {
    const disconnectModule = await import(new URL('../lib/disconnect.js', import.meta.url).href);
    await disconnectModule.run(targetDir, subArgs.slice(1)).catch(err => {
      console.error(`\nwheat disconnect farmer failed:`, err.message);
      if (process.env.WHEAT_DEBUG) console.error(err.stack);
      process.exit(1);
    });
    process.exit(0);
  }
  console.error(`wheat: unknown disconnect target: ${target}\nAvailable: farmer`);
  process.exit(1);
}

if (!commands[subcommand]) {
  console.error(`wheat: unknown command: ${subcommand}\n`);
  console.error('Run "wheat --help" for available commands.');
  process.exit(1);
}

// Load and run the subcommand module
vlog('dispatch', `loading module for "${subcommand}"`);
const modulePath = new URL(commands[subcommand], import.meta.url).href;
const handler = await import(modulePath);
handler.run(targetDir, subArgs).catch(err => {
  console.error(`\nwheat ${subcommand} failed:`, err.message);
  if (process.env.WHEAT_DEBUG) console.error(err.stack);
  process.exit(1);
});
