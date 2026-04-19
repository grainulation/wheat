/**
 * Integration test: wheat MCP server
 *
 * Verifies that the MCP server:
 *   - Binary exists and is executable
 *   - Responds to initialize within 5 seconds
 *   - Stays alive after initialize
 *   - Lists tools via tools/list
 *   - Produces no stdout pollution before first JSON-RPC response
 *   - Works via old path (wheat.js mcp)
 *   - Exits cleanly on stdin close
 *
 * Uses node:test + node:assert — zero dependencies.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCP_BIN = path.resolve(__dirname, "..", "bin", "wheat-mcp.js");
const WHEAT_BIN = path.resolve(__dirname, "..", "bin", "wheat.js");

/**
 * Send a JSON-RPC message to a child process via stdin.
 */
function sendJsonRpc(child, obj) {
	child.stdin.write(JSON.stringify(obj) + "\n");
}

/**
 * Spawn the MCP server and collect the first JSON-RPC response from stdout.
 * Returns a promise that resolves with { response, child }.
 */
function spawnAndInitialize(bin, args = []) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [bin, ...args], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let resolved = false;

		const timer = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				child.kill();
				reject(new Error("Timed out waiting for initialize response"));
			}
		}, 5_000);

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
			const lines = stdout.split("\n").filter((l) => l.trim());
			if (lines.length > 0 && !resolved) {
				resolved = true;
				clearTimeout(timer);
				try {
					const response = JSON.parse(lines[0]);
					resolve({ response, child, rawStdout: stdout });
				} catch (err) {
					child.kill();
					reject(
						new Error(
							`Failed to parse response: ${err.message}\nRaw: ${stdout}`,
						),
					);
				}
			}
		});

		child.on("error", (err) => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timer);
				reject(err);
			}
		});

		// Send initialize request
		sendJsonRpc(child, {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "test", version: "0.0.0" },
			},
		});
	});
}

/**
 * Collect the next JSON-RPC response from stdout after the initial one.
 */
function waitForResponse(child, timeout = 5_000) {
	return new Promise((resolve, reject) => {
		let buf = "";
		const timer = setTimeout(() => {
			reject(new Error("Timed out waiting for response"));
		}, timeout);

		function onData(chunk) {
			buf += chunk.toString();
			const lines = buf.split("\n").filter((l) => l.trim());
			if (lines.length > 0) {
				clearTimeout(timer);
				child.stdout.removeListener("data", onData);
				try {
					resolve(JSON.parse(lines[0]));
				} catch (err) {
					reject(new Error(`Parse error: ${err.message}\nRaw: ${buf}`));
				}
			}
		}

		child.stdout.on("data", onData);
	});
}

/**
 * Kill a child process and suppress errors.
 */
function cleanup(child) {
	try {
		child.kill();
	} catch {
		/* already dead */
	}
}

describe("wheat MCP server", () => {
	it("wheat-mcp binary exists and is executable", () => {
		accessSync(MCP_BIN, constants.R_OK);
		// Verify it is a file we can execute with node (read access is sufficient
		// since we invoke via `node bin/wheat-mcp.js`)
	});

	it("MCP server responds to initialize within 5 seconds", async () => {
		const { response, child } = await spawnAndInitialize(MCP_BIN);
		try {
			assert.equal(response.jsonrpc, "2.0");
			assert.equal(response.id, 1);
			assert.ok(response.result, "response should have result");
			assert.ok(response.result.serverInfo, "result should have serverInfo");
			assert.equal(response.result.serverInfo.name, "wheat");
			assert.ok(
				response.result.protocolVersion,
				"result should have protocolVersion",
			);
		} finally {
			cleanup(child);
		}
	});

	it("MCP server stays alive after initialize", async () => {
		const { child } = await spawnAndInitialize(MCP_BIN);
		try {
			// Wait 2 seconds, then check the process is still running
			await new Promise((resolve) => setTimeout(resolve, 2_000));
			assert.equal(
				child.exitCode,
				null,
				"process should still be running (exitCode should be null)",
			);
			assert.ok(!child.killed, "process should not have been killed");
		} finally {
			cleanup(child);
		}
	});

	it("MCP server lists tools", async () => {
		const { child } = await spawnAndInitialize(MCP_BIN);
		try {
			// Send tools/list request
			const responsePromise = waitForResponse(child);
			sendJsonRpc(child, {
				jsonrpc: "2.0",
				id: 2,
				method: "tools/list",
				params: {},
			});

			const response = await responsePromise;
			assert.equal(response.jsonrpc, "2.0");
			assert.equal(response.id, 2);
			assert.ok(response.result, "response should have result");
			assert.ok(
				Array.isArray(response.result.tools),
				"result.tools should be an array",
			);
			assert.ok(
				response.result.tools.length > 0,
				"tools array should not be empty",
			);

			// Verify some expected tool names
			const toolNames = response.result.tools.map((t) => t.name);
			assert.ok(
				toolNames.includes("wheat/compile"),
				"should include wheat/compile tool",
			);
			assert.ok(
				toolNames.includes("wheat/status"),
				"should include wheat/status tool",
			);
		} finally {
			cleanup(child);
		}
	});

	it("no stdout pollution before first JSON-RPC response", async () => {
		const { rawStdout, child } = await spawnAndInitialize(MCP_BIN);
		try {
			// The raw stdout should start with a valid JSON object (the response).
			// Any non-JSON output before it would corrupt the protocol.
			const trimmed = rawStdout.trimStart();
			assert.ok(
				trimmed.startsWith("{"),
				`stdout should start with JSON object, got: ${trimmed.slice(0, 100)}`,
			);

			// Verify the first line parses as valid JSON-RPC
			const firstLine = trimmed.split("\n")[0];
			const parsed = JSON.parse(firstLine);
			assert.equal(parsed.jsonrpc, "2.0", "first line should be JSON-RPC 2.0");
		} finally {
			cleanup(child);
		}
	});

	it("old path (wheat.js mcp) still works", async () => {
		const { response, child } = await spawnAndInitialize(WHEAT_BIN, ["mcp"]);
		try {
			assert.equal(response.jsonrpc, "2.0");
			assert.equal(response.id, 1);
			assert.ok(response.result, "response should have result");
			assert.equal(
				response.result.serverInfo.name,
				"wheat",
				"old path should start the same wheat MCP server",
			);
		} finally {
			cleanup(child);
		}
	});

	it("process exits cleanly on stdin close", async () => {
		const { child } = await spawnAndInitialize(MCP_BIN);

		const exitPromise = new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				child.kill();
				reject(
					new Error("Process did not exit within 5 seconds after stdin close"),
				);
			}, 5_000);

			child.on("close", (code) => {
				clearTimeout(timer);
				resolve(code);
			});
		});

		// Close stdin to signal the server to shut down
		child.stdin.end();

		const exitCode = await exitPromise;
		assert.equal(
			exitCode,
			0,
			`process should exit with code 0, got ${exitCode}`,
		);
	});
});
