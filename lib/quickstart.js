/**
 * wheat quickstart — zero-to-dashboard in under 90 seconds
 *
 * Creates a demo sprint with pre-seeded research claims,
 * compiles them, and opens the dashboard. Designed to show
 * wheat's value in the shortest possible time.
 *
 * Usage:
 *   wheat quickstart [--dir <path>] [--no-open] [--port 9092]
 *
 * Zero npm dependencies.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compile as runCompiler } from "../compiler/wheat-compiler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function target(dir, ...segments) {
	return path.join(dir, ...segments);
}

function packageRoot() {
	return path.resolve(__dirname, "..");
}

function now() {
	return new Date().toISOString();
}

// ── Demo sprint data ────────────────────────────────────────────────────────

const DEMO_QUESTION = "Should we migrate our REST API to GraphQL?";
const DEMO_AUDIENCE = ["backend team", "frontend team", "CTO"];
const DEMO_CONSTRAINTS = [
	"Must maintain backward compatibility with existing REST clients for 6 months",
	"Team has 3 backend engineers, none with production GraphQL experience",
	"Current API serves 200 req/s peak, 50ms p95 latency — cannot regress",
];
const DEMO_DONE =
	"A recommendation with evidence: migrate, don't migrate, or hybrid approach, with risk assessment and migration timeline.";

const DEMO_CLAIMS = [
	{
		id: "d001",
		type: "constraint",
		topic: "backward-compatibility",
		content:
			"Must maintain backward compatibility with existing REST clients for 6 months.",
		source: { origin: "stakeholder", artifact: null, connector: null },
		evidence: "stated",
		status: "active",
		phase_added: "define",
		tags: ["api", "constraint"],
	},
	{
		id: "d002",
		type: "constraint",
		topic: "team-experience",
		content:
			"Team has 3 backend engineers, none with production GraphQL experience.",
		source: { origin: "stakeholder", artifact: null, connector: null },
		evidence: "stated",
		status: "active",
		phase_added: "define",
		tags: ["team", "constraint"],
	},
	{
		id: "d003",
		type: "constraint",
		topic: "performance-baseline",
		content:
			"Current API serves 200 req/s peak, 50ms p95 latency — cannot regress.",
		source: { origin: "stakeholder", artifact: null, connector: null },
		evidence: "stated",
		status: "active",
		phase_added: "define",
		tags: ["performance", "constraint"],
	},
	{
		id: "d004",
		type: "constraint",
		topic: "done-criteria",
		content:
			"Done looks like: A recommendation with evidence — migrate, don't migrate, or hybrid approach, with risk assessment and migration timeline.",
		source: { origin: "stakeholder", artifact: null, connector: null },
		evidence: "stated",
		status: "active",
		phase_added: "define",
		tags: ["done-criteria"],
	},
	{
		id: "r001",
		type: "factual",
		topic: "graphql-adoption-2026",
		content:
			"GraphQL adoption in production backends reached 29% in 2025 (Postman State of APIs). However, 67% of teams that adopted GraphQL still maintain parallel REST endpoints for backward compatibility.",
		source: {
			origin: "research",
			artifact: "research/graphql-landscape.md",
			connector: null,
		},
		evidence: "web",
		status: "active",
		phase_added: "research",
		tags: ["graphql", "adoption", "industry"],
	},
	{
		id: "r002",
		type: "factual",
		topic: "graphql-performance",
		content:
			"GraphQL resolvers add 2-8ms overhead per request compared to direct REST handlers in Node.js benchmarks. For nested queries with N+1 patterns, latency can spike to 200-500ms without DataLoader batching. With DataLoader, overhead drops to 5-15ms for complex queries.",
		source: {
			origin: "research",
			artifact: "research/graphql-landscape.md",
			connector: null,
		},
		evidence: "web",
		status: "active",
		phase_added: "research",
		tags: ["graphql", "performance", "latency"],
	},
	{
		id: "r003",
		type: "risk",
		topic: "learning-curve",
		content:
			"Teams without GraphQL experience report 3-6 month ramp-up period before achieving parity with REST productivity. Schema design mistakes in the first 2 months often require breaking changes later.",
		source: {
			origin: "research",
			artifact: "research/graphql-landscape.md",
			connector: null,
		},
		evidence: "web",
		status: "active",
		phase_added: "research",
		tags: ["graphql", "risk", "team"],
	},
	{
		id: "r004",
		type: "recommendation",
		topic: "hybrid-approach",
		content:
			"A hybrid approach (GraphQL gateway over existing REST services) provides incremental adoption without rewriting the backend. Apollo Federation and GraphQL Mesh both support this pattern. The frontend gets GraphQL benefits while the backend stays REST until individual services are ready to migrate.",
		source: {
			origin: "research",
			artifact: "research/graphql-landscape.md",
			connector: null,
		},
		evidence: "web",
		status: "active",
		phase_added: "research",
		tags: ["graphql", "recommendation", "architecture"],
	},
	{
		id: "r005",
		type: "estimate",
		topic: "migration-timeline",
		content:
			"Estimated timeline for full GraphQL migration with 3 engineers: 2-3 months for schema design + gateway setup, 4-6 months for service-by-service migration, 2 months for REST deprecation. Total: 8-11 months. Hybrid approach can start delivering value in month 2.",
		source: {
			origin: "research",
			artifact: "research/graphql-landscape.md",
			connector: null,
		},
		evidence: "web",
		status: "active",
		phase_added: "research",
		tags: ["graphql", "estimate", "timeline"],
	},
	{
		id: "r006",
		type: "factual",
		topic: "graphql-tooling",
		content:
			"Apollo Server v4 is the most adopted GraphQL server (62% market share among Node.js GraphQL users). Alternatives: Mercurius (Fastify-native, 30% faster in benchmarks), GraphQL Yoga (from The Guild, best DX), Pothos (code-first schema builder).",
		source: {
			origin: "research",
			artifact: "research/graphql-landscape.md",
			connector: null,
		},
		evidence: "web",
		status: "active",
		phase_added: "research",
		tags: ["graphql", "tooling", "ecosystem"],
	},
	{
		id: "x001",
		type: "factual",
		topic: "graphql-performance",
		content:
			"The 2-8ms overhead claim (r002) understates the real-world impact. In production, GraphQL query parsing, validation, and execution planning add consistent 10-20ms overhead for medium-complexity queries. This matters when the p95 budget is 50ms.",
		source: { origin: "challenge", artifact: null, connector: null },
		evidence: "web",
		status: "active",
		phase_added: "research",
		conflicts_with: ["r002"],
		tags: ["graphql", "performance", "challenge"],
	},
];

// ── Main ────────────────────────────────────────────────────────────────────

export async function run(dir, args) {
	const startTime = Date.now();
	const flags = {};
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--no-open") flags.noOpen = true;
		else if (args[i] === "--port" && args[i + 1]) {
			flags.port = args[++i];
		}
	}

	const claimsPath = target(dir, "claims.json");
	if (fs.existsSync(claimsPath) && !args.includes("--force")) {
		console.log();
		console.log("  A sprint already exists here. Use --force to overwrite.");
		console.log();
		process.exit(1);
	}

	console.log();
	console.log("  \x1b[1m\x1b[33mwheat quickstart\x1b[0m — zero to dashboard");
	console.log("  ─────────────────────────────────────────");
	console.log();

	// Step 1: Create claims.json with demo data
	const timestamp = now();
	const claimsData = {
		meta: {
			question: DEMO_QUESTION,
			initiated: new Date().toISOString().split("T")[0],
			audience: DEMO_AUDIENCE,
			phase: "research",
			connectors: [],
			dismissed_blind_spots: [],
			merged_from: [],
		},
		claims: DEMO_CLAIMS.map((c) => ({
			...c,
			timestamp,
			conflicts_with: c.conflicts_with || [],
			resolved_by: c.resolved_by || null,
		})),
	};

	fs.writeFileSync(claimsPath, JSON.stringify(claimsData, null, 2) + "\n");
	const elapsed1 = Date.now() - startTime;
	console.log(
		`  \x1b[32m+\x1b[0m claims.json (${claimsData.claims.length} claims seeded)  \x1b[2m${elapsed1}ms\x1b[0m`,
	);

	// Step 2: Create CLAUDE.md
	const templatePath = path.join(packageRoot(), "templates", "claude.md");
	let claudeMd;
	try {
		claudeMd = fs
			.readFileSync(templatePath, "utf8")
			.replace(/\{\{QUESTION\}\}/g, DEMO_QUESTION)
			.replace(/\{\{AUDIENCE\}\}/g, DEMO_AUDIENCE.join(", "))
			.replace(
				/\{\{CONSTRAINTS\}\}/g,
				DEMO_CONSTRAINTS.map((c) => `- ${c}`).join("\n"),
			)
			.replace(/\{\{DONE_CRITERIA\}\}/g, DEMO_DONE);
	} catch {
		claudeMd = `# Wheat Sprint\n\n**Question:** ${DEMO_QUESTION}\n`;
	}
	fs.writeFileSync(target(dir, "CLAUDE.md"), claudeMd);
	console.log(`  \x1b[32m+\x1b[0m CLAUDE.md`);

	// Step 3: Copy slash commands
	const srcDir = path.join(packageRoot(), "templates", "commands");
	const destDir = target(dir, ".claude", "commands");
	fs.mkdirSync(destDir, { recursive: true });
	let copied = 0;
	try {
		for (const file of fs.readdirSync(srcDir)) {
			if (!file.endsWith(".md")) continue;
			fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
			copied++;
		}
	} catch {
		/* commands dir may not exist in dev */
	}
	console.log(`  \x1b[32m+\x1b[0m .claude/commands/ (${copied} commands)`);

	// Step 4: Create directories
	for (const d of ["output", "research", "prototypes", "evidence"]) {
		const dirPath = target(dir, d);
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
			fs.writeFileSync(path.join(dirPath, ".gitkeep"), "");
		}
	}
	console.log("  \x1b[32m+\x1b[0m output/, research/, prototypes/, evidence/");

	// Step 5: Run the compiler
	console.log();
	console.log("  \x1b[1mCompiling...\x1b[0m");
	try {
		const compilationPath = path.join(dir, "compilation.json");
		runCompiler(claimsPath, compilationPath, dir);
	} catch (err) {
		console.log(`  \x1b[33m!\x1b[0m Compilation skipped: ${err.message}`);
	}

	const elapsed5 = Date.now() - startTime;
	console.log();
	console.log(`  \x1b[32mCompiled in ${elapsed5}ms.\x1b[0m`);

	// Step 6: Start the dashboard
	const port = flags.port || "9092";
	console.log();
	console.log(`  \x1b[1mStarting dashboard on port ${port}...\x1b[0m`);

	// Import and start the server
	try {
		const serverModule = await import(
			path.join(packageRoot(), "lib", "server.js")
		);
		// The server module's run() starts listening — we call it and let it run
		// It will keep the process alive
		const serverArgs = ["--port", port, "--dir", dir];
		if (flags.noOpen) serverArgs.push("--no-open");

		console.log();
		console.log("  ─────────────────────────────────────────");
		const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(
			`  \x1b[1m\x1b[33mQuickstart complete.\x1b[0m  ${totalTime}s total`,
		);
		console.log();
		console.log(`  Sprint:     ${DEMO_QUESTION}`);
		console.log(
			`  Claims:     ${claimsData.claims.length} (${
				DEMO_CLAIMS.filter((c) => c.id.startsWith("d")).length
			} constraints + ${
				DEMO_CLAIMS.filter((c) => c.id.startsWith("r")).length
			} research + ${
				DEMO_CLAIMS.filter((c) => c.id.startsWith("x")).length
			} challenge)`,
		);
		console.log(`  Conflicts:  1 (r002 vs x001 — performance overhead)`);
		console.log(`  Dashboard:  http://localhost:${port}`);
		console.log();
		console.log("  What to do now:");
		console.log(
			"    1. Explore the dashboard — click topics, claims, see the conflict",
		);
		console.log(
			'    2. Open Claude Code here and try: /research "GraphQL security"',
		);
		console.log("    3. Or start YOUR sprint: wheat init");
		console.log();

		// Start server (this blocks — keeps process alive)
		await serverModule.run(dir, serverArgs);
	} catch (err) {
		// If server fails, still show the summary
		console.log(`  \x1b[33m!\x1b[0m Dashboard failed to start: ${err.message}`);
		console.log(`  Run manually: wheat serve --dir ${dir}`);
		console.log();
	}
}
