/**
 * claims-ops — Shared claim operations for MCP + CLI
 *
 * Pure business logic extracted from serve-mcp.js.
 * Both the MCP tool handlers and the CLI commands import from here.
 *
 * Every function takes (dir, args) and returns a result object.
 *
 * Zero npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { loadClaims } from "./load-claims.js";

// --- Constants ---------------------------------------------------------------

const VALID_TYPES = [
  "constraint",
  "factual",
  "estimate",
  "risk",
  "recommendation",
  "feedback",
];
const VALID_EVIDENCE = ["stated", "web", "documented", "tested", "production"];

// --- Paths -------------------------------------------------------------------

function resolvePaths(dir) {
  return {
    claims: path.join(dir, "claims.json"),
    compilation: path.join(dir, "compilation.json"),
    brief: path.join(dir, "output", "brief.html"),
    compiler: path.join(dir, "wheat-compiler.js"),
  };
}

// --- Operations --------------------------------------------------------------

function addClaim(dir, args) {
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
  const claims = data.claims || [];
  if (claims.some((c) => c.id === id)) {
    return { status: "error", message: `Claim ID "${id}" already exists.` };
  }

  const claim = {
    id,
    type,
    topic,
    content,
    source: { origin: "cli", artifact: null, connector: null },
    evidence: evidence || "stated",
    status: "active",
    phase_added: (data.meta || {}).phase || "research",
    timestamp: new Date().toISOString(),
    conflicts_with: [],
    resolved_by: null,
    tags: tags || [],
  };

  (data.claims || (data.claims = [])).push(claim);
  try {
    fs.writeFileSync(paths.claims, JSON.stringify(data, null, 2) + "\n");
  } catch (err) {
    return {
      status: "error",
      message: `Failed to write claims.json: ${err.message}`,
    };
  }

  return { status: "ok", message: `Claim ${id} added.`, claim };
}

function searchClaims(dir, args) {
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

function resolveClaim(dir, args) {
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

  const winnerConflicts = winnerClaim.conflicts_with || [];
  const loserConflicts = loserClaim.conflicts_with || [];
  if (!winnerConflicts.includes(loser) && !loserConflicts.includes(winner)) {
    return {
      status: "error",
      message: `Cannot resolve: "${winner}" and "${loser}" have no conflicts_with relationship.`,
    };
  }

  // Clear conflict references
  winnerClaim.conflicts_with = (winnerClaim.conflicts_with || []).filter(
    (cid) => cid !== loser
  );
  loserClaim.conflicts_with = [];
  loserClaim.status = "superseded";
  loserClaim.resolved_by = winner;

  try {
    fs.writeFileSync(paths.claims, JSON.stringify(data, null, 2) + "\n");
  } catch (err) {
    return {
      status: "error",
      message: `Failed to write claims.json: ${err.message}`,
    };
  }

  return {
    status: "ok",
    message: `Resolved: ${winner} wins over ${loser}${
      reason ? ` (${reason})` : ""
    }.`,
    winner: winnerClaim.id,
    loser: loserClaim.id,
  };
}

function getStatus(dir) {
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
      (c.conflicts_with &&
        c.conflicts_with.length > 0 &&
        c.status === "active")
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
    question: (data.meta || {}).question || "(no question set)",
    phase: (data.meta || {}).phase || "unknown",
    total_claims: claims.length,
    active_claims: active.length,
    conflicted_claims: conflicted.length,
    topics: topics.length,
    type_distribution: types,
    compilation_status: compilationStatus,
  };
}

export {
  addClaim,
  searchClaims,
  resolveClaim,
  getStatus,
  VALID_TYPES,
  VALID_EVIDENCE,
  resolvePaths,
};
