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
 *   wheat mcp                     Start MCP server
 *
 * All operations resolve paths relative to --dir or process.cwd().
 * The package ships framework code; sprint data stays in YOUR repo.
 *
 * Zero npm dependencies.
 */

import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import {
  track as trackInstall,
  maybePrompt as installPrompt,
} from "../lib/install-prompt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = JSON.parse(
  readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
).version;

// ─── Parse arguments ─────────────────────────────────────────────────────────

const verbose = process.argv.includes("--verbose");
function vlog(...a) {
  if (!verbose) return;
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] wheat: ${a.join(" ")}\n`);
}
export { vlog, verbose };

const args = process.argv.slice(2);
const subcommand = args[0];

vlog("startup", `subcommand=${subcommand || "(none)"}`, `cwd=${process.cwd()}`);

// Extract --dir or --root flag (applies to all subcommands)
let targetDir = process.cwd();
const dirIdx =
  args.indexOf("--dir") !== -1 ? args.indexOf("--dir") : args.indexOf("--root");
if (dirIdx !== -1 && args[dirIdx + 1]) {
  targetDir = path.resolve(args[dirIdx + 1]);
  args.splice(dirIdx, 2);
}

// Pass remaining args (minus subcommand) to subcommand handlers
const subArgs = args.slice(1);

// ─── Help / Version ──────────────────────────────────────────────────────────

if (!subcommand || subcommand === "--help" || subcommand === "-h") {
  console.log(`wheat v${VERSION} — Research-driven development framework

Usage:
  wheat "your question"          Start a sprint instantly (recommended)
  wheat <command> [options]      Run a specific command

Commands:
  init       Bootstrap a new research sprint in this repo
  quickstart Zero-to-dashboard demo sprint (under 90 seconds)
  compile    Run the Bran compiler on claims.json
  add        Add a typed claim to the sprint
  search     Search claims by topic, type, evidence, or text
  resolve    Resolve a conflict between two claims
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
  npx @grainulation/wheat "Should we migrate to Postgres?"
  npx @grainulation/wheat init
  npx @grainulation/wheat compile --summary

Documentation: https://github.com/grainulation/wheat`);
  process.exit(0);
}

if (subcommand === "--version" || subcommand === "-v") {
  console.log(`wheat v${VERSION}`);
  process.exit(0);
}

// ─── Fast MCP dispatch ──────────────────────────────────────────────────────
// MCP is machine-invoked via stdio — skip install-prompt and arg parsing.
// This matches mill/silo's pattern of early bail-out before any overhead.
if (subcommand === "mcp") {
  const { startServer } = await import(
    new URL("../lib/serve-mcp.js", import.meta.url).href
  );
  startServer(targetDir);
} else {

// ─── Install prompt tracking ─────────────────────────────────────────────────
// Track npx usage and maybe suggest installing. Both calls are sync, <5ms,
// and fail silently. Only fires for real subcommands (not --help/--version).

trackInstall(subcommand);
installPrompt(subcommand);

// ─── Dispatch ────────────────────────────────────────────────────────────────

const commands = {
  init: "../lib/init.js",
  quickstart: "../lib/quickstart.js",
  compile: "../lib/compiler.js",
  add: "../lib/cli-add.js",
  search: "../lib/cli-search.js",
  resolve: "../lib/cli-resolve.js",
  guard: "../lib/guard.js",
  status: "../lib/status.js",
  stats: "../lib/stats.js",
  update: "../lib/update.js",
  serve: "../lib/server.js",
  mcp: "../lib/serve-mcp.js",
};

// ─── wheat migrate (not yet implemented) ────────────────────────────────────
if (subcommand === "migrate") {
  console.error("wheat migrate is not yet available");
  process.exit(1);
}

// Handle "wheat connect <target>" as a compound subcommand
if (subcommand === "connect") {
  const target = subArgs[0];
  if (!target || target === "--help" || target === "-h") {
    console.log(`wheat connect — Link external tools

Usage:
  wheat connect farmer [options]   Connect Farmer permission dashboard

Run "wheat connect farmer --help" for options.`);
    process.exit(0);
  }
  if (target === "farmer") {
    const connectModule = await import(
      new URL("../lib/connect.js", import.meta.url).href
    );
    await connectModule.run(targetDir, subArgs.slice(1)).catch((err) => {
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
if (subcommand === "disconnect") {
  const target = subArgs[0];
  if (!target || target === "--help" || target === "-h") {
    console.log(`wheat disconnect — Remove external tool hooks

Usage:
  wheat disconnect farmer [options]   Remove Farmer hooks from settings

Run "wheat disconnect farmer --help" for options.`);
    process.exit(0);
  }
  if (target === "farmer") {
    const disconnectModule = await import(
      new URL("../lib/disconnect.js", import.meta.url).href
    );
    await disconnectModule.run(targetDir, subArgs.slice(1)).catch((err) => {
      console.error(`\nwheat disconnect farmer failed:`, err.message);
      if (process.env.WHEAT_DEBUG) console.error(err.stack);
      process.exit(1);
    });
    process.exit(0);
  }
  console.error(
    `wheat: unknown disconnect target: ${target}\nAvailable: farmer`
  );
  process.exit(1);
}

if (!commands[subcommand]) {
  // Verb-less mode: wheat "my question" → dispatch to init with auto defaults
  const compoundCmds = ["connect", "disconnect", "migrate"];
  if (subcommand && !subcommand.startsWith("-") && !compoundCmds.includes(subcommand)) {
    vlog("dispatch", `verb-less mode: treating "${subcommand}" as question`);
    const initHandler = await import("../lib/init.js");
    await initHandler.run(targetDir, ["--question", subcommand, "--auto"]).catch((err) => {
      console.error(`\nwheat failed:`, err.message);
      if (process.env.WHEAT_DEBUG) console.error(err.stack);
      process.exit(1);
    });
    process.exit(0);
  }
  console.error(`wheat: unknown command: ${subcommand}\n`);
  console.error('Run "wheat --help" for available commands.');
  process.exit(1);
}

// Load and run the subcommand module — static switch eliminates computed dynamic import
vlog("dispatch", `loading module for "${subcommand}"`);
let handler;
switch (subcommand) {
  case "init":       handler = await import("../lib/init.js"); break;
  case "quickstart": handler = await import("../lib/quickstart.js"); break;
  case "compile":    handler = await import("../lib/compiler.js"); break;
  case "add":        handler = await import("../lib/cli-add.js"); break;
  case "search":     handler = await import("../lib/cli-search.js"); break;
  case "resolve":    handler = await import("../lib/cli-resolve.js"); break;
  case "guard":      handler = await import("../lib/guard.js"); break;
  case "status":     handler = await import("../lib/status.js"); break;
  case "stats":      handler = await import("../lib/stats.js"); break;
  case "update":     handler = await import("../lib/update.js"); break;
  case "serve":      handler = await import("../lib/server.js"); break;
  case "mcp":        handler = await import("../lib/serve-mcp.js"); break;
  default:
    console.error(`wheat: unknown command: ${subcommand}\n`);
    process.exit(1);
}
handler.run(targetDir, subArgs).catch((err) => {
  console.error(`\nwheat ${subcommand} failed:`, err.message);
  if (process.env.WHEAT_DEBUG) console.error(err.stack);
  process.exit(1);
});
} // end else (non-mcp subcommands)
