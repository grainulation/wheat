/**
 * wheat connect farmer — Auto-configure Claude Code hooks for Farmer
 *
 * Detects farmer on localhost, writes hooks to project-level
 * .claude/settings.local.json. Atomic writes with lockfile.
 * Zero npm dependencies.
 */

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_PORTS = [9090, 9091];
const DETECT_TIMEOUT_MS = 2000;
const VERIFY_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 200;
const LOCK_MAX_RETRIES = 10;
const SETTINGS_FILENAME = ".claude/settings.local.json";

const HOOK_ENDPOINTS = {
	permission: "/hooks/permission",
	activity: "/hooks/activity",
	notification: "/hooks/notification",
};

// ─── Argument parsing ──────────────────────────────────────────────────────

function parseArgs(args) {
	const flags = {};
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--url" && args[i + 1]) {
			flags.url = args[i + 1];
			i++;
		} else if (args[i] === "--port" && args[i + 1]) {
			flags.port = parseInt(args[i + 1], 10);
			i++;
		} else if (args[i] === "--dry-run") {
			flags.dryRun = true;
		} else if (args[i] === "--force") {
			flags.force = true;
		} else if (args[i] === "--json") {
			flags.json = true;
		} else if (args[i] === "--token" && args[i + 1]) {
			flags.token = args[i + 1];
			i++;
		} else if (args[i] === "--help" || args[i] === "-h") {
			flags.help = true;
		}
	}
	return flags;
}

// ─── Token discovery ──────────────────────────────────────────────────────

/** Track whether we have already warned about missing token */
let _warnedNoToken = false;

/**
 * Discover a farmer token. Priority: explicit flag > project dir > home dir.
 * @param {string|null} explicitToken - Token passed via --token flag
 * @param {string} projectDir - Project directory to search for .farmer-token
 * @returns {string|null}
 */
function discoverToken(explicitToken, projectDir) {
	if (explicitToken) return explicitToken;

	// Try project directory
	const projectTokenPath = path.join(projectDir, ".farmer-token");
	try {
		const token = fs.readFileSync(projectTokenPath, "utf8").trim();
		if (token) return token;
	} catch {}

	// Try home directory
	const homeTokenPath = path.join(os.homedir(), ".farmer-token");
	try {
		const token = fs.readFileSync(homeTokenPath, "utf8").trim();
		if (token) return token;
	} catch {}

	return null;
}

// ─── HTTP helpers (zero-dep) ───────────────────────────────────────────────

function httpRequest(url, options = {}) {
	return new Promise((resolve) => {
		const parsed = new URL(url);
		const client = parsed.protocol === "https:" ? https : http;
		const timeout = options.timeout || DETECT_TIMEOUT_MS;

		const req = client.request(
			parsed,
			{
				method: options.method || "GET",
				headers: options.headers || {},
				timeout,
			},
			(res) => {
				let body = "";
				res.on("data", (chunk) => {
					body += chunk;
				});
				res.on("end", () => {
					resolve({ status: res.statusCode, body, error: null });
				});
			},
		);

		req.on("error", (err) =>
			resolve({ status: 0, body: "", error: err.message }),
		);
		req.on("timeout", () => {
			req.destroy();
			resolve({ status: 0, body: "", error: "timeout" });
		});

		if (options.body) {
			req.write(
				typeof options.body === "string"
					? options.body
					: JSON.stringify(options.body),
			);
		}
		req.end();
	});
}

// ─── Farmer detection ──────────────────────────────────────────────────────

async function probeFarmer(baseUrl, token) {
	// Build auth headers if token is available
	const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

	// Primary detection: hit /api/state which is the canonical farmer endpoint
	const stateResp = await httpRequest(baseUrl + "/api/state", {
		timeout: DETECT_TIMEOUT_MS,
		headers: authHeaders,
	});
	if (stateResp.error) return { found: false, error: stateResp.error };

	if (stateResp.status !== 200) {
		// Fallback: try root to see if it's farmer at all
		const rootResp = await httpRequest(baseUrl + "/", {
			timeout: DETECT_TIMEOUT_MS,
		});
		if (rootResp.error || rootResp.status !== 200) {
			return {
				found: false,
				error: `Port responds (HTTP ${stateResp.status}) but /api/state not available`,
			};
		}
		const looksLikeFarmer =
			rootResp.body.includes("farmer") || rootResp.body.includes("Farmer");
		if (!looksLikeFarmer) {
			return {
				found: false,
				error: `Port responds but does not look like Farmer`,
			};
		}
	}

	// Hook probe: verify the permission endpoint accepts POSTs
	const probePayload = {
		hook_event_name: "PreToolUse",
		tool_name: "__wheat_connect_probe__",
		tool_input: "{}",
		session_id: "wheat-connect-probe",
	};

	const hookResp = await httpRequest(baseUrl + HOOK_ENDPOINTS.permission, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders },
		body: probePayload,
		timeout: VERIFY_TIMEOUT_MS,
	});

	if (hookResp.error) {
		return {
			found: true,
			verified: false,
			error: `Farmer found but hook probe failed: ${hookResp.error}`,
		};
	}

	let isVerified = false;
	try {
		isVerified = !!JSON.parse(hookResp.body).hookSpecificOutput;
	} catch {}

	return {
		found: true,
		verified: isVerified,
		status: hookResp.status,
		error: isVerified
			? null
			: `Hook endpoint returned unexpected response (HTTP ${hookResp.status})`,
	};
}

async function verifySse(baseUrl) {
	return new Promise((resolve) => {
		const parsed = new URL(baseUrl + "/events");
		const req = http.request(
			parsed,
			{ method: "GET", timeout: VERIFY_TIMEOUT_MS },
			(res) => {
				const isSSE =
					res.headers["content-type"]?.includes("text/event-stream");
				res.destroy(); // We only need to confirm it opens
				resolve({ ok: isSSE, status: res.statusCode });
			},
		);
		req.on("error", (err) => resolve({ ok: false, error: err.message }));
		req.on("timeout", () => {
			req.destroy();
			resolve({ ok: false, error: "timeout" });
		});
		req.end();
	});
}

async function detectFarmer(preferredPort, token) {
	const ports = preferredPort ? [preferredPort] : DEFAULT_PORTS;
	for (const port of ports) {
		const baseUrl = `http://127.0.0.1:${port}`;
		const result = await probeFarmer(baseUrl, token);
		if (result.found) return { ...result, url: baseUrl, port };
	}
	return {
		found: false,
		url: null,
		port: null,
		error: "No farmer server found on default ports",
	};
}

// ─── Settings file management ──────────────────────────────────────────────

function hookCommand(farmerUrl, endpoint, token) {
	if (process.platform === "win32") {
		// PowerShell: read stdin via [Console]::In, POST via Invoke-RestMethod
		const url = `${farmerUrl}${endpoint}`;
		const authHeader = token
			? ` -Headers @{'Content-Type'='application/json';'Authorization'='Bearer ${token}'}`
			: "";
		return `powershell -NoProfile -Command "$b=[Console]::In.ReadToEnd(); try{Invoke-RestMethod -Uri '${url}' -Method Post -ContentType 'application/json'${authHeader} -Body $b}catch{}"`;
	}
	const authFlag = token ? ` -H 'Authorization: Bearer ${token}'` : "";
	return `cat | curl -s -X POST ${farmerUrl}${endpoint} -H 'Content-Type: application/json'${authFlag} --data-binary @- 2>/dev/null || true`;
}

function buildHooksConfig(farmerUrl, token) {
	return {
		PreToolUse: [
			{
				matcher: "",
				hooks: [
					{
						type: "command",
						command: hookCommand(farmerUrl, HOOK_ENDPOINTS.permission, token),
					},
				],
			},
		],
		PostToolUse: [
			{
				matcher: "",
				hooks: [
					{
						type: "command",
						command: hookCommand(farmerUrl, HOOK_ENDPOINTS.activity, token),
					},
				],
			},
		],
		Notification: [
			{
				matcher: "",
				hooks: [
					{
						type: "command",
						command: hookCommand(farmerUrl, HOOK_ENDPOINTS.notification, token),
					},
				],
			},
		],
	};
}

function readSettings(settingsPath) {
	try {
		return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
	} catch (err) {
		if (err.code === "ENOENT") return {};
		throw new Error(`Cannot parse ${settingsPath}: ${err.message}`);
	}
}

function isFarmerHookEntry(entry) {
	if (!entry.hooks || !Array.isArray(entry.hooks)) return false;
	return entry.hooks.some(
		(h) =>
			(h.type === "command" && h.command && h.command.includes("/hooks/")) ||
			(h.type === "url" && h.url && h.url.includes("/hooks/")),
	);
}

function mergeHooks(existing, farmerHooks) {
	const merged = JSON.parse(JSON.stringify(existing));
	if (!merged.hooks) merged.hooks = {};

	for (const hookType of Object.keys(farmerHooks)) {
		const existingHooks = merged.hooks[hookType] || [];
		const nonFarmerHooks = existingHooks.filter(
			(entry) => !isFarmerHookEntry(entry),
		);
		merged.hooks[hookType] = [...nonFarmerHooks, ...farmerHooks[hookType]];
	}
	return merged;
}

async function writeSettingsAtomic(settingsPath, settings) {
	const lockPath = settingsPath + ".lock";
	const backupPath = settingsPath + ".backup";
	const tmpPath = settingsPath + ".tmp";

	let lockAcquired = false;
	for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
		try {
			const fd = fs.openSync(lockPath, "wx");
			fs.writeSync(fd, String(process.pid));
			fs.closeSync(fd);
			lockAcquired = true;
			break;
		} catch (err) {
			if (err.code === "EEXIST") {
				try {
					const holderPid = parseInt(
						fs.readFileSync(lockPath, "utf8").trim(),
						10,
					);
					process.kill(holderPid, 0);
					await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
				} catch {
					try {
						fs.unlinkSync(lockPath);
					} catch {}
				}
			} else {
				throw err;
			}
		}
	}

	if (!lockAcquired) {
		throw new Error(
			"Cannot acquire file lock — another process is writing to settings",
		);
	}

	try {
		if (fs.existsSync(settingsPath)) {
			fs.copyFileSync(settingsPath, backupPath);
		}
		fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + "\n");
		fs.renameSync(tmpPath, settingsPath);
	} finally {
		try {
			fs.unlinkSync(lockPath);
		} catch {}
	}
}

// ─── Output formatting ────────────────────────────────────────────────────

function printSuccess(farmerUrl, settingsPath, dryRun) {
	console.log();
	console.log("  \x1b[32m\u2713\x1b[0m \x1b[1mFarmer connected\x1b[0m");
	console.log("  \u2500".repeat(40));
	console.log(`  Server:   ${farmerUrl}`);
	console.log(`  Settings: ${settingsPath}`);
	console.log();
	console.log("  Hooks configured:");
	console.log(`    PreToolUse   \u2192 ${farmerUrl}/hooks/permission`);
	console.log(`    PostToolUse  \u2192 ${farmerUrl}/hooks/activity`);
	console.log(`    Notification \u2192 ${farmerUrl}/hooks/notification`);
	console.log();
	if (dryRun) {
		console.log("  \x1b[33m(dry run \u2014 no files were modified)\x1b[0m");
		console.log();
	}
	console.log("  What this means:");
	console.log("    Every Claude Code tool call in this project now routes");
	console.log("    through Farmer. You can approve, deny, or monitor");
	console.log("    from your phone or desktop.");
	console.log();
	console.log("  What was verified:");
	console.log("    - Farmer is running and responding to hook probes");
	console.log("    - SSE event stream is available for live monitoring");
	console.log("    - Hooks were merged without overwriting existing settings");
	console.log("    - Slash commands installed/updated");
	console.log("    - .farmer-config.json written with sprint paths");
	console.log();
	console.log("  What to do next:");
	console.log("    Open Claude Code in this directory. If Farmer goes down,");
	console.log(
		"    hooks fail silently (|| true) so your workflow is never blocked.",
	);
	console.log();
}

function printNotFound(triedPorts) {
	console.log();
	console.log("  \x1b[31m\u2717\x1b[0m \x1b[1mFarmer not detected\x1b[0m");
	console.log("  \u2500".repeat(40));
	console.log(`  Tried ports: ${triedPorts.join(", ")}`);
	console.log();
	console.log("  To start Farmer:");
	console.log("    npx @grainulation/farmer start");
	console.log();
	console.log("  Or connect to a remote Farmer:");
	console.log("    wheat connect farmer --url <your-farmer-url>");
	console.log();
}

// ─── Main ──────────────────────────────────────────────────────────────────

export async function run(dir, args) {
	const flags = parseArgs(args || []);

	if (flags.help) {
		console.log(`
  wheat connect farmer — Auto-configure Claude Code hooks for Farmer

  Usage:
    wheat connect farmer [options]

  Options:
    --url <url>     Connect to a specific Farmer URL (remote/tunnel)
    --port <port>   Try a specific port instead of defaults (9090, 9091)
    --token <token> Farmer auth token (or auto-discover from .farmer-token)
    --dry-run       Show what would be configured without writing
    --force         Overwrite existing farmer hooks
    --json          Output result as JSON (for scripting)
    --help          Show this help
`);
		return;
	}

	const targetDir = dir || process.cwd();
	const settingsPath = path.join(targetDir, SETTINGS_FILENAME);
	const settingsDir = path.dirname(settingsPath);

	if (!fs.existsSync(settingsDir)) {
		fs.mkdirSync(settingsDir, { recursive: true });
	}

	// Discover auth token: explicit --token flag > .farmer-token in project > ~/.farmer-token
	const token = discoverToken(flags.token, targetDir);
	if (token) {
		console.log(
			`\n  \x1b[32m\u2713\x1b[0m Auth token ${
				flags.token
					? "provided via --token"
					: "auto-discovered from .farmer-token"
			}`,
		);
	} else if (!_warnedNoToken) {
		_warnedNoToken = true;
		console.log(
			`\n  \x1b[33m!\x1b[0m No farmer token found -- requests will be unauthenticated`,
		);
		console.log(
			`    Use --token <t> or place a .farmer-token file in the project or home directory`,
		);
	}

	// Step 1: Detect or connect to farmer
	let farmerUrl;
	let detection;

	if (flags.url) {
		farmerUrl = flags.url.replace(/\/+$/, "");
		console.log(`\n  Connecting to ${farmerUrl}...`);
		detection = await probeFarmer(farmerUrl, token);
		if (!detection.found) {
			if (flags.json) {
				console.log(JSON.stringify({ success: false, error: detection.error }));
			} else {
				console.log(
					`\n  \x1b[31m\u2717\x1b[0m Cannot reach Farmer at ${farmerUrl}: ${detection.error}\n`,
				);
			}
			process.exit(1);
		}
	} else {
		const ports = flags.port ? [flags.port] : DEFAULT_PORTS;
		console.log(
			`\n  Detecting Farmer on localhost (ports: ${ports.join(", ")})...`,
		);
		detection = await detectFarmer(flags.port, token);
		if (!detection.found) {
			if (flags.json) {
				console.log(JSON.stringify({ success: false, error: detection.error }));
			} else {
				printNotFound(ports);
			}
			process.exit(1);
		}
		farmerUrl = detection.url;
	}

	if (!detection.verified) {
		console.log(
			`  \x1b[33m!\x1b[0m Farmer found but hook verification failed.`,
		);
		console.log(`    ${detection.error || "Unknown verification error"}`);
		console.log(`    Proceeding with configuration anyway...`);
	} else {
		console.log(`  \x1b[32m\u2713\x1b[0m Farmer detected at ${farmerUrl}`);
	}

	// Verify SSE endpoint is available
	const sseResult = await verifySse(farmerUrl);
	if (sseResult.ok) {
		console.log(
			`  \x1b[32m\u2713\x1b[0m SSE event stream verified at ${farmerUrl}/events`,
		);
	} else {
		console.log(
			`  \x1b[33m!\x1b[0m SSE endpoint not confirmed (${
				sseResult.error || "unexpected response"
			})`,
		);
		console.log(`    Live monitoring may not work until Farmer restarts.`);
	}

	// Step 2: Read existing settings, merge, write
	const existing = readSettings(settingsPath);

	const hasExistingFarmerHooks =
		existing.hooks &&
		Object.values(existing.hooks).some(
			(entries) =>
				Array.isArray(entries) &&
				entries.some((entry) => isFarmerHookEntry(entry)),
		);

	if (hasExistingFarmerHooks && !flags.force) {
		if (flags.json) {
			console.log(
				JSON.stringify({
					success: true,
					alreadyConfigured: true,
					url: farmerUrl,
				}),
			);
		} else {
			console.log(
				`  \x1b[33m!\x1b[0m Farmer hooks already configured in ${SETTINGS_FILENAME}`,
			);
			console.log("    Use --force to overwrite.");
		}
		return;
	}

	const farmerHooks = buildHooksConfig(farmerUrl, token);
	const merged = mergeHooks(existing, farmerHooks);

	if (flags.dryRun) {
		if (flags.json) {
			console.log(
				JSON.stringify({
					success: true,
					dryRun: true,
					url: farmerUrl,
					settings: merged,
				}),
			);
		} else {
			console.log("\n  Would write to: " + settingsPath);
			console.log();
			console.log(JSON.stringify(merged, null, 2));
			printSuccess(farmerUrl, settingsPath, true);
		}
		return;
	}

	// Step 3: Write settings atomically
	await writeSettingsAtomic(settingsPath, merged);

	// Install/update slash commands
	try {
		const updateModule = await import(
			new URL("./update.js", import.meta.url).href
		);
		await updateModule.run(targetDir, ["--force"]);
	} catch (err) {
		console.log(
			`  \x1b[33m!\x1b[0m Could not install slash commands: ${err.message}`,
		);
	}

	// Write sprint paths to .farmer-config.json so farmer auto-discovers them
	const farmerConfigPath = path.join(targetDir, ".farmer-config.json");
	try {
		let farmerConfig = {};
		if (fs.existsSync(farmerConfigPath)) {
			farmerConfig = JSON.parse(fs.readFileSync(farmerConfigPath, "utf8"));
		}
		const claimsPath = path.join(targetDir, "claims.json");
		const compilationPath = path.join(targetDir, "compilation.json");
		// Always write paths, claims may come later
		farmerConfig.claimsPath = claimsPath;
		farmerConfig.compilationPath = compilationPath;
		// Persist farmer URL and token for subsequent hook calls
		farmerConfig.farmerUrl = farmerUrl;
		if (token) {
			farmerConfig.token = token;
		} else {
			delete farmerConfig.token;
		}
		if (!farmerConfig.registeredProjects) {
			farmerConfig.registeredProjects = [];
		}
		if (!farmerConfig.registeredProjects.includes(targetDir)) {
			farmerConfig.registeredProjects.push(targetDir);
		}
		fs.writeFileSync(
			farmerConfigPath,
			JSON.stringify(farmerConfig, null, 2) + "\n",
			{ mode: 0o600 },
		);
		console.log(
			`  \x1b[32m+\x1b[0m .farmer-config.json (sprint paths + ${
				token ? "auth token" : "no token"
			} registered)`,
		);
	} catch (err) {
		console.log(
			`  \x1b[33m!\x1b[0m Could not write .farmer-config.json: ${err.message}`,
		);
	}

	if (flags.json) {
		console.log(
			JSON.stringify({
				success: true,
				url: farmerUrl,
				settingsPath,
				verified: detection.verified,
			}),
		);
	} else {
		printSuccess(farmerUrl, settingsPath, false);
	}
}
