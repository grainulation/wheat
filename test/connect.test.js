/**
 * Unit tests: lib/connect.js
 *
 * connect.js only exports `run(dir, args)`. We drive it end-to-end against a
 * local loopback HTTP server that mimics farmer's /api/state, /events, and
 * /hooks/* endpoints — this exercises the whole pipeline (readSettings,
 * mergeHooks, buildHooksConfig, hookCommand, isFarmerHookEntry,
 * writeSettingsAtomic) without touching the network or user state.
 *
 * Covers:
 *   - --help returns without mutating files
 *   - --dry-run --json produces the expected merged-settings envelope
 *   - default (write) mode writes .claude/settings.local.json + .farmer-config.json
 *     inside the tempdir
 *   - existing hooks are preserved (non-farmer entries are kept)
 *   - second invocation without --force refuses to overwrite existing farmer hooks
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { run } from "../lib/connect.js";

// ── Mock farmer ─────────────────────────────────────────────────────────────
function startMockFarmer() {
	return new Promise((resolve) => {
		const server = http.createServer((req, res) => {
			if (req.url === "/api/state" && req.method === "GET") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true, name: "farmer" }));
				return;
			}
			if (req.url === "/hooks/permission" && req.method === "POST") {
				let body = "";
				req.on("data", (c) => {
					body += c;
				});
				req.on("end", () => {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							hookSpecificOutput: {
								hookEventName: "PreToolUse",
								permissionDecision: "allow",
							},
						}),
					);
				});
				return;
			}
			if (req.url === "/events" && req.method === "GET") {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.write(": heartbeat\n\n");
				// Leave the stream open — server.close(force=true) on teardown.
				return;
			}
			res.writeHead(404);
			res.end();
		});
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			resolve({ server, url: `http://127.0.0.1:${port}` });
		});
	});
}

// Capture stdout during a call to run() (run uses console.log).
async function captureConsole(fn) {
	const origLog = console.log;
	const chunks = [];
	console.log = (...a) => {
		chunks.push(a.join(" "));
	};
	try {
		await fn();
	} finally {
		console.log = origLog;
	}
	return chunks.join("\n");
}

describe("connect: --help", () => {
	it("prints usage text and does not mutate files", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wheat-connect-help-"));
		try {
			const out = await captureConsole(() => run(dir, ["--help"]));
			assert.match(out, /wheat connect farmer/);
			assert.match(out, /--dry-run/);
			assert.ok(!fs.existsSync(path.join(dir, ".claude")));
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("connect: --dry-run against mock farmer", () => {
	let mock;
	let dir;

	before(async () => {
		mock = await startMockFarmer();
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "wheat-connect-dry-"));
	});

	after(() => {
		mock.server.close();
		// force-close any lingering sockets (SSE)
		mock.server.closeAllConnections?.();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("emits --json envelope with merged settings and does not write", async () => {
		const out = await captureConsole(() =>
			run(dir, ["--url", mock.url, "--dry-run", "--json"]),
		);
		// The last line should be the JSON payload.
		const jsonLine = out
			.split("\n")
			.filter(Boolean)
			.reverse()
			.find((l) => l.trim().startsWith("{"));
		assert.ok(jsonLine, "expected a JSON payload in output");
		const payload = JSON.parse(jsonLine);
		assert.equal(payload.success, true);
		assert.equal(payload.dryRun, true);
		assert.equal(payload.url, mock.url);
		// Hooks config shape
		assert.ok(payload.settings.hooks);
		assert.ok(Array.isArray(payload.settings.hooks.PreToolUse));
		assert.ok(Array.isArray(payload.settings.hooks.PostToolUse));
		assert.ok(Array.isArray(payload.settings.hooks.Notification));
		const pre = payload.settings.hooks.PreToolUse[0];
		assert.ok(pre.hooks[0].command.includes("/hooks/permission"));
		assert.ok(pre.hooks[0].command.includes(mock.url));
		// Verify no files were written (dry-run)
		assert.ok(!fs.existsSync(path.join(dir, ".claude", "settings.local.json")));
		assert.ok(!fs.existsSync(path.join(dir, ".farmer-config.json")));
	});
});

describe("connect: full write against mock farmer", () => {
	let mock;
	let dir;

	before(async () => {
		mock = await startMockFarmer();
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "wheat-connect-write-"));
	});

	after(() => {
		mock.server.close();
		mock.server.closeAllConnections?.();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("merges with existing non-farmer hooks and writes settings + farmer-config", async () => {
		// Pre-seed settings with a non-farmer PreToolUse hook that should be preserved.
		const settingsPath = path.join(dir, ".claude", "settings.local.json");
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(
			settingsPath,
			JSON.stringify(
				{
					hooks: {
						PreToolUse: [
							{
								matcher: "",
								hooks: [
									{
										type: "command",
										command: "echo 'not a farmer hook' || true",
									},
								],
							},
						],
					},
					otherSetting: "preserved",
				},
				null,
				2,
			),
		);

		await captureConsole(() => run(dir, ["--url", mock.url, "--json"]));

		assert.ok(fs.existsSync(settingsPath));
		const written = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
		// Preserved top-level setting
		assert.equal(written.otherSetting, "preserved");
		// Non-farmer PreToolUse hook preserved alongside new farmer hook
		const pre = written.hooks.PreToolUse;
		assert.equal(pre.length, 2);
		assert.ok(
			pre.some((e) => e.hooks[0].command.includes("not a farmer hook")),
		);
		assert.ok(
			pre.some((e) => e.hooks[0].command.includes("/hooks/permission")),
		);

		// .farmer-config.json written with sprint paths + farmerUrl
		const cfgPath = path.join(dir, ".farmer-config.json");
		assert.ok(fs.existsSync(cfgPath));
		const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
		assert.equal(cfg.farmerUrl, mock.url);
		assert.equal(cfg.claimsPath, path.join(dir, "claims.json"));
		assert.ok(Array.isArray(cfg.registeredProjects));
		assert.ok(cfg.registeredProjects.includes(dir));
	});

	it("refuses to overwrite farmer hooks without --force", async () => {
		// The previous test already wrote farmer hooks into `dir`.
		const out = await captureConsole(() =>
			run(dir, ["--url", mock.url, "--json"]),
		);
		const jsonLine = out
			.split("\n")
			.filter(Boolean)
			.reverse()
			.find((l) => l.trim().startsWith("{"));
		assert.ok(jsonLine, "expected JSON output");
		const payload = JSON.parse(jsonLine);
		assert.equal(payload.alreadyConfigured, true);
	});
});

describe("connect: --url unreachable (error path)", () => {
	it("exits with error JSON when the URL is unreachable", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wheat-connect-err-"));
		// Pick a closed port (reserve then immediately close).
		const probe = await new Promise((resolve) => {
			const s = http.createServer();
			s.listen(0, "127.0.0.1", () => {
				const { port } = s.address();
				s.close(() => resolve(port));
			});
		});
		const badUrl = `http://127.0.0.1:${probe}`;

		// run() calls process.exit(1) on failure. We need to intercept that.
		const origExit = process.exit;
		let exitCode = null;
		process.exit = (code) => {
			exitCode = code;
			throw new Error("__intercepted_exit__");
		};
		try {
			const out = await captureConsole(async () => {
				try {
					await run(dir, ["--url", badUrl, "--json"]);
				} catch (e) {
					if (e.message !== "__intercepted_exit__") throw e;
				}
			});
			assert.equal(exitCode, 1);
			const jsonLine = out
				.split("\n")
				.filter(Boolean)
				.reverse()
				.find((l) => l.trim().startsWith("{"));
			assert.ok(jsonLine);
			const payload = JSON.parse(jsonLine);
			assert.equal(payload.success, false);
			assert.ok(payload.error);
		} finally {
			process.exit = origExit;
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
