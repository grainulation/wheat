/**
 * wheat serve-mcp -- Local MCP server for Claude Code
 *
 * Exposes wheat compiler tools and resources over stdio transport
 * using the MCP JSON-RPC protocol. Zero npm dependencies.
 *
 * Tools:
 *   wheat/compile   -- Run the compiler, return status + warnings
 *   wheat/add-claim -- Append a typed claim to claims.json
 *   wheat/resolve   -- Adjudicate a specific conflict
 *   wheat/search    -- Query claims by topic, type, evidence tier
 *   wheat/status    -- Return compilation summary
 *   wheat/init      -- Initialize a new research sprint
 *   wheat/deepwiki  -- Fetch DeepWiki docs for a public GitHub repo
 *   wheat/sync-log  -- View sync/publish history
 *
 * Resources:
 *   wheat://compilation -- Current compilation.json
 *   wheat://claims      -- Current claims.json
 *   wheat://brief       -- Latest brief (output/brief.html)
 *   wheat://sync-log    -- Sync/publish history
 *
 * Protocol: MCP over stdio (JSON-RPC 2.0, newline-delimited)
 *
 * Install (recommended):
 *   claude mcp add wheat -- npx @grainulation/wheat-mcp
 *
 * Legacy (still works, but routes through CLI dispatch):
 *   claude mcp add wheat -- npx @grainulation/wheat mcp
 *
 * Zero npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import http from "node:http";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadClaims } from "./load-claims.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Constants ---------------------------------------------------------------

const SERVER_NAME = "wheat";
const SERVER_VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
).version;
const PROTOCOL_VERSION = "2024-11-05";

const VALID_TYPES = [
  "constraint",
  "factual",
  "estimate",
  "risk",
  "recommendation",
  "feedback",
];
const VALID_EVIDENCE = ["stated", "web", "documented", "tested", "production"];

// --- JSON-RPC helpers --------------------------------------------------------

function jsonRpcResponse(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

// --- Paths -------------------------------------------------------------------

function resolvePaths(dir) {
  return {
    claims: path.join(dir, "claims.json"),
    compilation: path.join(dir, "compilation.json"),
    brief: path.join(dir, "output", "brief.html"),
    compiler: path.join(dir, "wheat-compiler.js"),
  };
}

// --- Tool implementations ----------------------------------------------------

function toolCompile(dir) {
  const paths = resolvePaths(dir);

  if (!fs.existsSync(paths.claims)) {
    return {
      status: "error",
      message: "No claims.json found. Run wheat init first.",
    };
  }

  // Find compiler -- check local dir, then package compiler/
  let compilerPath = paths.compiler;
  if (!fs.existsSync(compilerPath)) {
    compilerPath = path.join(__dirname, "..", "compiler", "wheat-compiler.js");
  }
  if (!fs.existsSync(compilerPath)) {
    return {
      status: "error",
      message:
        "Compiler not found. Ensure wheat-compiler.js is in the project root.",
    };
  }

  try {
    const output = execFileSync(
      "node",
      [compilerPath, "--summary", "--dir", dir],
      {
        cwd: dir,
        encoding: "utf8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );
    return { status: "ok", output: output.trim() };
  } catch (err) {
    return {
      status: "error",
      output: (err.stdout || "").trim(),
      error: (err.stderr || "").trim(),
    };
  }
}

function toolAddClaim(dir, args) {
  const paths = resolvePaths(dir);
  if (!fs.existsSync(paths.claims)) {
    return {
      status: "error",
      message: "No claims.json found. Run wheat init first.",
    };
  }

  const { id, type, topic, content, evidence, tags } = args;

  // Validate
  if (!id || !type || !topic || !content) {
    return {
      status: "error",
      message: "Required fields: id, type, topic, content",
    };
  }
  if (!VALID_TYPES.includes(type)) {
    return {
      status: "error",
      message: `Invalid type "${type}". Valid: ${VALID_TYPES.join(", ")}`,
    };
  }
  if (evidence && !VALID_EVIDENCE.includes(evidence)) {
    return {
      status: "error",
      message: `Invalid evidence "${evidence}". Valid: ${VALID_EVIDENCE.join(
        ", "
      )}`,
    };
  }

  const { data, errors: loadErrors } = loadClaims(dir);
  if (!data) {
    return {
      status: "error",
      message: loadErrors[0]?.message || "Failed to load claims.json",
    };
  }

  // Check for duplicate ID
  if (data.claims.some((c) => c.id === id)) {
    return { status: "error", message: `Claim ID "${id}" already exists.` };
  }

  const claim = {
    id,
    type,
    topic,
    content,
    source: { origin: "mcp", artifact: null, connector: null },
    evidence: evidence || "stated",
    status: "active",
    phase_added: data.meta.phase || "research",
    timestamp: new Date().toISOString(),
    conflicts_with: [],
    resolved_by: null,
    tags: tags || [],
  };

  data.claims.push(claim);
  fs.writeFileSync(paths.claims, JSON.stringify(data, null, 2) + "\n");

  return { status: "ok", message: `Claim ${id} added.`, claim };
}

function toolResolve(dir, args) {
  const paths = resolvePaths(dir);
  if (!fs.existsSync(paths.claims)) {
    return { status: "error", message: "No claims.json found." };
  }

  const { winner, loser, reason } = args;
  if (!winner || !loser) {
    return { status: "error", message: "Required fields: winner, loser" };
  }

  const { data, errors: loadErrors } = loadClaims(dir);
  if (!data) {
    return {
      status: "error",
      message: loadErrors[0]?.message || "Failed to load claims.json",
    };
  }
  const winnerClaim = data.claims.find((c) => c.id === winner);
  const loserClaim = data.claims.find((c) => c.id === loser);

  if (!winnerClaim)
    return { status: "error", message: `Claim "${winner}" not found.` };
  if (!loserClaim)
    return { status: "error", message: `Claim "${loser}" not found.` };

  // Clear conflict references
  winnerClaim.conflicts_with = (winnerClaim.conflicts_with || []).filter(
    (cid) => cid !== loser
  );
  loserClaim.conflicts_with = [];
  loserClaim.status = "superseded";
  loserClaim.resolved_by = winner;

  fs.writeFileSync(paths.claims, JSON.stringify(data, null, 2) + "\n");

  return {
    status: "ok",
    message: `Resolved: ${winner} wins over ${loser}${
      reason ? ` (${reason})` : ""
    }.`,
    winner: winnerClaim.id,
    loser: loserClaim.id,
  };
}

function toolSearch(dir, args) {
  const { data, errors: loadErrors } = loadClaims(dir);
  if (!data) {
    return {
      status: "error",
      message: loadErrors[0]?.message || "No claims.json found.",
    };
  }
  let results = data.claims.filter((c) => c.status === "active");

  if (args.topic) {
    results = results.filter((c) => c.topic === args.topic);
  }
  if (args.type) {
    results = results.filter((c) => c.type === args.type);
  }
  if (args.evidence) {
    results = results.filter((c) => c.evidence === args.evidence);
  }
  if (args.query) {
    const q = args.query.toLowerCase();
    results = results.filter((c) => c.content.toLowerCase().includes(q));
  }

  return {
    status: "ok",
    count: results.length,
    claims: results.map((c) => ({
      id: c.id,
      type: c.type,
      topic: c.topic,
      evidence: c.evidence,
      content: c.content.slice(0, 200) + (c.content.length > 200 ? "..." : ""),
    })),
  };
}

function toolStatus(dir) {
  const { data, errors: loadErrors } = loadClaims(dir);
  if (!data) {
    return {
      status: "no_sprint",
      message:
        loadErrors[0]?.message ||
        "No claims.json found. Run wheat init to start a sprint.",
    };
  }

  const claims = data.claims || [];
  const active = claims.filter((c) => c.status === "active");
  const conflicted = claims.filter(
    (c) =>
      c.status === "conflicted" ||
      (c.conflicts_with && c.conflicts_with.length > 0 && c.status === "active")
  );
  const topics = [...new Set(active.map((c) => c.topic))];
  const types = {};
  active.forEach((c) => {
    types[c.type] = (types[c.type] || 0) + 1;
  });

  const paths = resolvePaths(dir);
  let compilationStatus = "unknown";
  if (fs.existsSync(paths.compilation)) {
    try {
      const comp = JSON.parse(fs.readFileSync(paths.compilation, "utf8"));
      compilationStatus = comp.status || "unknown";
    } catch {
      /* ignore */
    }
  }

  return {
    status: "ok",
    question: data.meta.question,
    phase: data.meta.phase,
    total_claims: claims.length,
    active_claims: active.length,
    conflicted_claims: conflicted.length,
    topics: topics.length,
    type_distribution: types,
    compilation_status: compilationStatus,
  };
}

function toolInit(dir, args) {
  const paths = resolvePaths(dir);

  if (!args.question) {
    return { status: "error", message: "Required field: question" };
  }

  if (fs.existsSync(paths.claims) && !args.force) {
    return {
      status: "error",
      message:
        "Sprint already exists (claims.json found). Pass force: true to reinitialize.",
    };
  }

  const initArgs = [
    path.join(__dirname, "..", "bin", "wheat.js"),
    "init",
    "--headless",
    "--question",
    args.question,
    "--audience",
    args.audience || "self",
    "--constraints",
    args.constraints || "none",
    "--done",
    args.done || "A recommendation with evidence",
    "--dir",
    dir,
  ];

  if (args.force) initArgs.push("--force");

  try {
    const output = execFileSync("node", initArgs, {
      cwd: dir,
      encoding: "utf8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      status: "ok",
      message: "Sprint initialized.",
      output: output.trim(),
    };
  } catch (err) {
    return {
      status: "error",
      message: (err.stderr || err.stdout || err.message).trim(),
    };
  }
}

function toolDeepwiki(_dir, args) {
  const repo = args.repo;
  if (!repo || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
    return {
      status: "error",
      message:
        'Required: repo in "org/name" format (e.g., "grainulation/wheat")',
    };
  }

  const url = `https://deepwiki.com/${repo}`;

  return new Promise((resolve) => {
    const req = https.get(
      url,
      { timeout: 15000, headers: { Accept: "text/html" } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          resolve({
            status: "ok",
            repo,
            url,
            note: `DeepWiki redirects for ${repo} — repo may not be indexed yet. Visit ${url} to trigger indexing.`,
            content: null,
          });
          res.resume();
          return;
        }
        if (res.statusCode !== 200) {
          resolve({
            status: "error",
            message: `DeepWiki returned HTTP ${res.statusCode} for ${repo}. The repo may not be indexed — visit ${url} to trigger indexing.`,
          });
          res.resume();
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          // Extract useful content from DeepWiki HTML
          // Strip script/style tags, extract text content from main sections
          const cleaned = body
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<nav[\s\S]*?<\/nav>/gi, "")
            .replace(/<footer[\s\S]*?<\/footer>/gi, "");

          // Extract headings and their content for structured output
          const sections = [];
          const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
          let match;
          while ((match = headingRegex.exec(cleaned)) !== null) {
            const level = parseInt(match[1], 10);
            const title = match[2].replace(/<[^>]+>/g, "").trim();
            if (title) sections.push({ level, title });
          }

          // Extract paragraph text
          const paragraphs = [];
          const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
          while ((match = pRegex.exec(cleaned)) !== null) {
            const text = match[1].replace(/<[^>]+>/g, "").trim();
            if (text && text.length > 30) paragraphs.push(text);
          }

          // Limit output to avoid overwhelming context
          const truncatedParagraphs = paragraphs.slice(0, 30);

          resolve({
            status: "ok",
            repo,
            url,
            sections: sections.slice(0, 50),
            content_preview: truncatedParagraphs,
            note: `Full DeepWiki documentation available at ${url}. Use /pull deepwiki ${repo} to extract claims from this content.`,
          });
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        status: "error",
        message: `Failed to reach DeepWiki: ${err.message}. Visit ${url} manually.`,
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({
        status: "error",
        message: `DeepWiki request timed out. Visit ${url} manually.`,
      });
    });
  });
}

function toolSyncLog(dir) {
  const logPath = path.join(dir, "output", "sync-log.json");
  if (!fs.existsSync(logPath)) {
    return {
      status: "ok",
      message: "No sync history found. Use /sync to publish sprint artifacts.",
      entries: [],
    };
  }
  try {
    const entries = JSON.parse(fs.readFileSync(logPath, "utf8"));
    return { status: "ok", count: entries.length, entries };
  } catch {
    return { status: "error", message: "sync-log.json is corrupted." };
  }
}

// --- Tool & Resource definitions ---------------------------------------------

const TOOLS = [
  {
    name: "wheat/compile",
    description:
      "Run the wheat compiler on claims.json. Returns compilation status, warnings, and errors.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "wheat/add-claim",
    description:
      "Append a typed claim to claims.json. Validates type, evidence tier, and checks for duplicate IDs.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Claim ID (e.g., r001, x001, d001)",
        },
        type: { type: "string", enum: VALID_TYPES, description: "Claim type" },
        topic: {
          type: "string",
          description: "Topic slug (e.g., database-migration)",
        },
        content: {
          type: "string",
          description: "The claim content -- specific, verifiable finding",
        },
        evidence: {
          type: "string",
          enum: VALID_EVIDENCE,
          description: "Evidence tier (default: stated)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags",
        },
      },
      required: ["id", "type", "topic", "content"],
    },
  },
  {
    name: "wheat/resolve",
    description:
      "Resolve a conflict between two claims. The winner stays active; the loser is superseded.",
    inputSchema: {
      type: "object",
      properties: {
        winner: { type: "string", description: "ID of the winning claim" },
        loser: { type: "string", description: "ID of the losing claim" },
        reason: {
          type: "string",
          description: "Optional reason for the resolution",
        },
      },
      required: ["winner", "loser"],
    },
  },
  {
    name: "wheat/search",
    description:
      "Search active claims by topic, type, evidence tier, or free-text query.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Filter by topic slug" },
        type: {
          type: "string",
          enum: VALID_TYPES,
          description: "Filter by claim type",
        },
        evidence: {
          type: "string",
          enum: VALID_EVIDENCE,
          description: "Filter by evidence tier",
        },
        query: {
          type: "string",
          description: "Free-text search in claim content",
        },
      },
    },
  },
  {
    name: "wheat/status",
    description:
      "Get sprint status: question, phase, claim counts, topic count, compilation status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "wheat/init",
    description:
      "Initialize a new research sprint. Creates claims.json, CLAUDE.md, and slash commands.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The research question for this sprint",
        },
        audience: {
          type: "string",
          description: "Comma-separated list of audience (default: self)",
        },
        constraints: {
          type: "string",
          description: "Semicolon-separated constraints (default: none)",
        },
        done: {
          type: "string",
          description:
            'What "done" looks like (default: A recommendation with evidence)',
        },
        force: {
          type: "boolean",
          description: "Reinitialize even if sprint exists (default: false)",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "wheat/deepwiki",
    description:
      "Fetch AI-generated documentation from DeepWiki for a public GitHub repo. Returns architecture overview, component descriptions, and section structure. Use with /pull to extract claims.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            'GitHub repo in "org/name" format (e.g., "grainulation/wheat")',
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "wheat/sync-log",
    description:
      "View the sync history — records of when sprint artifacts were published to Confluence, Slack, or other targets.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

const RESOURCES = [
  {
    uri: "wheat://compilation",
    name: "Compilation Output",
    description:
      "Current compilation.json -- the checked, certified output from the wheat compiler.",
    mimeType: "application/json",
  },
  {
    uri: "wheat://claims",
    name: "Claims Data",
    description: "Current claims.json -- all typed claims in the sprint.",
    mimeType: "application/json",
  },
  {
    uri: "wheat://brief",
    name: "Decision Brief",
    description:
      "Latest compiled brief (output/brief.html) -- self-contained HTML.",
    mimeType: "text/html",
  },
  {
    uri: "wheat://sync-log",
    name: "Sync History",
    description:
      "Log of sprint artifact publishes to Confluence, Slack, Notion, etc.",
    mimeType: "application/json",
  },
];

// --- Request handler ---------------------------------------------------------

async function handleRequest(dir, method, params, id) {
  switch (method) {
    case "initialize":
      return jsonRpcResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });

    case "notifications/initialized":
      // No response needed for notifications
      return null;

    case "tools/list":
      return jsonRpcResponse(id, { tools: TOOLS });

    case "tools/call": {
      const toolName = params.name;
      const toolArgs = params.arguments || {};
      let result;

      switch (toolName) {
        case "wheat/compile":
          result = toolCompile(dir);
          break;
        case "wheat/add-claim":
          result = toolAddClaim(dir, toolArgs);
          break;
        case "wheat/resolve":
          result = toolResolve(dir, toolArgs);
          break;
        case "wheat/search":
          result = toolSearch(dir, toolArgs);
          break;
        case "wheat/status":
          result = toolStatus(dir);
          break;
        case "wheat/init":
          result = toolInit(dir, toolArgs);
          break;
        case "wheat/deepwiki":
          result = await toolDeepwiki(dir, toolArgs);
          break;
        case "wheat/sync-log":
          result = toolSyncLog(dir);
          break;
        default:
          return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
      }

      const isError = result.status === "error";
      return jsonRpcResponse(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError,
      });
    }

    case "resources/list":
      return jsonRpcResponse(id, { resources: RESOURCES });

    case "resources/read": {
      const uri = params.uri;
      const paths = resolvePaths(dir);
      let filePath, mimeType;

      switch (uri) {
        case "wheat://compilation":
          filePath = paths.compilation;
          mimeType = "application/json";
          break;
        case "wheat://claims":
          filePath = paths.claims;
          mimeType = "application/json";
          break;
        case "wheat://brief":
          filePath = paths.brief;
          mimeType = "text/html";
          break;
        case "wheat://sync-log":
          filePath = path.join(dir, "output", "sync-log.json");
          mimeType = "application/json";
          break;
        default:
          return jsonRpcError(id, -32602, `Unknown resource: ${uri}`);
      }

      if (!fs.existsSync(filePath)) {
        return jsonRpcResponse(id, {
          contents: [
            { uri, mimeType, text: `Resource not found: ${filePath}` },
          ],
        });
      }

      const text = fs.readFileSync(filePath, "utf8");
      return jsonRpcResponse(id, {
        contents: [{ uri, mimeType, text }],
      });
    }

    case "ping":
      return jsonRpcResponse(id, {});

    default:
      // Ignore unknown notifications (no id = notification)
      if (id === undefined || id === null) return null;
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

// --- Stdio transport ---------------------------------------------------------

function startServer(dir) {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  // Disable output buffering on stdout
  if (process.stdout._handle && process.stdout._handle.setBlocking) {
    process.stdout._handle.setBlocking(true);
  }

  rl.on("line", async (line) => {
    if (!line.trim()) return;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      const resp = jsonRpcError(null, -32700, "Parse error");
      process.stdout.write(resp + "\n");
      return;
    }

    const response = await handleRequest(
      dir,
      msg.method,
      msg.params || {},
      msg.id
    );

    // Notifications don't get responses
    if (response !== null) {
      process.stdout.write(response + "\n");
    }
  });

  // Keep the server alive — don't exit on stdin close.
  // Claude Code's plugin transport may briefly close/reopen stdin.
  process.stdin.on("end", () => {
    process.exit(0);
  });

  // Log to stderr (stdout is reserved for JSON-RPC)
  process.stderr.write(`wheat MCP server v${SERVER_VERSION} ready on stdio\n`);
  process.stderr.write(`  Target directory: ${dir}\n`);
  process.stderr.write(
    `  Tools: ${TOOLS.length} | Resources: ${RESOURCES.length}\n`
  );
}

// --- CLI handler -------------------------------------------------------------

export async function run(dir, args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`wheat mcp -- Local MCP server for Claude Code

Usage:
  wheat-mcp [--dir <path>]      (recommended)
  wheat mcp [--dir <path>]      (legacy, still works)

Install in Claude Code:
  claude mcp add wheat -- npx @grainulation/wheat-mcp

Tools exposed:
  wheat/compile     Run the compiler
  wheat/add-claim   Append a typed claim
  wheat/resolve     Resolve a conflict
  wheat/search      Search claims
  wheat/status      Sprint status
  wheat/init        Initialize a new sprint
  wheat/deepwiki    Fetch DeepWiki docs for a GitHub repo
  wheat/sync-log    View sync/publish history

Resources exposed:
  wheat://compilation   compilation.json
  wheat://claims        claims.json
  wheat://brief         output/brief.html
  wheat://sync-log      output/sync-log.json

Protocol: MCP over stdio (JSON-RPC 2.0, newline-delimited)`);
    return;
  }

  startServer(dir);
}

export { startServer, handleRequest, TOOLS, RESOURCES };
