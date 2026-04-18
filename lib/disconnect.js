/**
 * wheat disconnect farmer — Remove Farmer hooks from Claude Code settings
 *
 * Reads .claude/settings.local.json, strips any hook entries whose
 * command or URL contains "/hooks/", writes back atomically (tmp + rename).
 * Zero npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";

// ─── Constants ─────────────────────────────────────────────────────────────

const SETTINGS_FILENAME = ".claude/settings.local.json";

// ─── Argument parsing ──────────────────────────────────────────────────────

function parseArgs(args) {
	const flags = {};
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--dry-run") {
			flags.dryRun = true;
		} else if (args[i] === "--json") {
			flags.json = true;
		} else if (args[i] === "--help" || args[i] === "-h") {
			flags.help = true;
		}
	}
	return flags;
}

// ─── Hook detection (matches connect.js logic) ────────────────────────────

function isFarmerHookEntry(entry) {
	if (!entry.hooks || !Array.isArray(entry.hooks)) return false;
	return entry.hooks.some(
		(h) =>
			(h.type === "command" && h.command && h.command.includes("/hooks/")) ||
			(h.type === "url" && h.url && h.url.includes("/hooks/")),
	);
}

// ─── Settings I/O ─────────────────────────────────────────────────────────

function readSettings(settingsPath) {
	try {
		return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
	} catch (err) {
		if (err.code === "ENOENT") return null;
		throw new Error(`Cannot parse ${settingsPath}: ${err.message}`);
	}
}

function writeSettingsAtomic(settingsPath, settings) {
	const tmpPath = settingsPath + ".tmp";
	fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + "\n");
	fs.renameSync(tmpPath, settingsPath);
}

// ─── Core logic ───────────────────────────────────────────────────────────

function findFarmerHooks(settings) {
	const found = [];
	if (!settings || !settings.hooks) return found;
	for (const [hookType, entries] of Object.entries(settings.hooks)) {
		if (!Array.isArray(entries)) continue;
		for (const entry of entries) {
			if (isFarmerHookEntry(entry)) {
				found.push({ hookType, entry });
			}
		}
	}
	return found;
}

function removeFarmerHooks(settings) {
	const cleaned = JSON.parse(JSON.stringify(settings));
	if (!cleaned.hooks) return cleaned;
	for (const hookType of Object.keys(cleaned.hooks)) {
		if (!Array.isArray(cleaned.hooks[hookType])) continue;
		cleaned.hooks[hookType] = cleaned.hooks[hookType].filter(
			(entry) => !isFarmerHookEntry(entry),
		);
		// Remove empty arrays to keep the file clean
		if (cleaned.hooks[hookType].length === 0) {
			delete cleaned.hooks[hookType];
		}
	}
	// Remove empty hooks object
	if (Object.keys(cleaned.hooks).length === 0) {
		delete cleaned.hooks;
	}
	return cleaned;
}

// ─── Main ──────────────────────────────────────────────────────────────────

export async function run(dir, args) {
	const flags = parseArgs(args || []);

	if (flags.help) {
		console.log(`
  wheat disconnect farmer -- Remove Farmer hooks from Claude Code settings

  Usage:
    wheat disconnect farmer [options]

  Options:
    --dry-run       Show what would be removed without writing
    --json          Output result as JSON (for scripting)
    --help          Show this help

  This removes all hook entries in .claude/settings.local.json whose
  command or URL contains "/hooks/". Other settings are preserved.
`);
		return;
	}

	const targetDir = dir || process.cwd();
	const settingsPath = path.join(targetDir, SETTINGS_FILENAME);

	const settings = readSettings(settingsPath);

	if (!settings) {
		if (flags.json) {
			console.log(
				JSON.stringify({
					success: true,
					removed: 0,
					message: "No settings file found",
				}),
			);
		} else {
			console.log(
				"\n  No farmer hooks found (settings file does not exist).\n",
			);
		}
		return;
	}

	const farmerHooks = findFarmerHooks(settings);

	if (farmerHooks.length === 0) {
		if (flags.json) {
			console.log(
				JSON.stringify({
					success: true,
					removed: 0,
					message: "No farmer hooks found",
				}),
			);
		} else {
			console.log("\n  No farmer hooks found in " + SETTINGS_FILENAME + ".\n");
		}
		return;
	}

	// Show what will be removed
	if (flags.dryRun) {
		if (flags.json) {
			console.log(
				JSON.stringify({
					success: true,
					dryRun: true,
					removed: farmerHooks.length,
					hookTypes: farmerHooks.map((h) => h.hookType),
				}),
			);
		} else {
			console.log(
				"\n  Would remove " + farmerHooks.length + " farmer hook(s):",
			);
			for (const { hookType } of farmerHooks) {
				console.log("    - " + hookType);
			}
			console.log("\n  (dry run -- no files were modified)\n");
		}
		return;
	}

	// Remove and write
	const cleaned = removeFarmerHooks(settings);
	writeSettingsAtomic(settingsPath, cleaned);

	if (flags.json) {
		console.log(
			JSON.stringify({
				success: true,
				removed: farmerHooks.length,
				hookTypes: farmerHooks.map((h) => h.hookType),
				settingsPath,
			}),
		);
	} else {
		console.log();
		console.log("  \x1b[32m\u2713\x1b[0m \x1b[1mFarmer disconnected\x1b[0m");
		console.log("  \u2500".repeat(40));
		console.log("  Removed " + farmerHooks.length + " hook(s):");
		for (const { hookType } of farmerHooks) {
			console.log("    - " + hookType);
		}
		console.log();
		console.log("  Settings: " + settingsPath);
		console.log();
		console.log("  To reconnect:");
		console.log("    wheat connect farmer");
		console.log();
	}
}
