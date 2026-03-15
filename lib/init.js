/**
 * wheat init — Bootstrap a research sprint in the target repo
 *
 * Three modes:
 *   1. Interactive (default) — conversational readline session
 *   2. Quick (--question "...") — skip conversation, seed from flags
 *   3. Headless (--headless) — non-interactive, requires all flags
 *
 * Creates in the TARGET repo:
 *   - claims.json (seeded with constraint claims)
 *   - CLAUDE.md (sprint configuration for Claude Code)
 *   - .claude/commands/*.md (slash commands)
 *   - wheat.config.json (local config pointing back to package)
 *
 * Zero npm dependencies.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve a path relative to the target directory */
function target(dir, ...segments) {
  return path.join(dir, ...segments);
}

/** Get the package root (where templates live) */
function packageRoot() {
  return path.resolve(__dirname, '..');
}

/** Ask a question and return the answer */
function ask(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

/** Generate an ISO timestamp */
function now() {
  return new Date().toISOString();
}

/** Parse --flag value pairs from args */
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (args[i].startsWith('--')) {
      flags[args[i].slice(2)] = true;
    }
  }
  return flags;
}

// ─── Conversation ────────────────────────────────────────────────────────────

async function conversationalInit(dir) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log();
  console.log('  \x1b[1m\x1b[33mwheat\x1b[0m — let\'s set up a research sprint');
  console.log('  ─────────────────────────────────────────');
  console.log();
  console.log('  Before you commit to anything big, let\'s figure out');
  console.log('  what you actually need to know. Four questions.\n');

  // Question
  const question = await ask(rl,
    '  What question are you trying to answer?\n' +
    '  (The more specific, the better. "Should we migrate to X?" beats "what database?")\n\n' +
    '  > '
  );

  if (!question) {
    console.log('\n  No question, no sprint. Come back when you have one.\n');
    rl.close();
    process.exit(1);
  }

  console.log();

  // Audience
  const audienceRaw = await ask(rl,
    '  Who needs the answer?\n' +
    '  Could be your team, a VP, a client, or just yourself.\n\n' +
    '  > '
  );

  console.log();

  // Constraints
  const constraintsRaw = await ask(rl,
    '  Any constraints?\n' +
    '  Budget, timeline, tech stack, team size — whatever narrows the space.\n' +
    '  (Leave blank if none.)\n\n' +
    '  > '
  );

  console.log();

  // Done criteria
  const doneCriteria = await ask(rl,
    '  How will you know you\'re done?\n' +
    '  A recommendation? A prototype? A go/no-go? A deck for the meeting?\n\n' +
    '  > '
  );

  rl.close();

  // Parse audience into array
  const audience = audienceRaw
    ? audienceRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    : ['self'];

  // Parse constraints into individual items
  const constraints = constraintsRaw
    ? constraintsRaw.split(/[.;]/).map(s => s.trim()).filter(s => s.length > 5)
    : [];

  return { question, audience, constraints, doneCriteria };
}

// ─── File generation ─────────────────────────────────────────────────────────

function buildClaims(meta, constraints) {
  const claims = [];
  const timestamp = now();

  constraints.forEach((constraint, i) => {
    claims.push({
      id: `d${String(i + 1).padStart(3, '0')}`,
      type: 'constraint',
      topic: 'sprint-scope',
      content: constraint,
      source: { origin: 'stakeholder', artifact: null, connector: null },
      evidence: 'stated',
      status: 'active',
      phase_added: 'define',
      timestamp,
      conflicts_with: [],
      resolved_by: null,
      tags: [],
    });
  });

  // Add done-criteria as a constraint if provided
  if (meta.doneCriteria) {
    claims.push({
      id: `d${String(constraints.length + 1).padStart(3, '0')}`,
      type: 'constraint',
      topic: 'done-criteria',
      content: `Done looks like: ${meta.doneCriteria}`,
      source: { origin: 'stakeholder', artifact: null, connector: null },
      evidence: 'stated',
      status: 'active',
      phase_added: 'define',
      timestamp,
      conflicts_with: [],
      resolved_by: null,
      tags: ['done-criteria'],
    });
  }

  return {
    schema_version: '1.0',
    meta: {
      question: meta.question,
      initiated: new Date().toISOString().split('T')[0],
      audience: meta.audience,
      phase: 'define',
      connectors: [],
    },
    claims,
  };
}

function buildClaudeMd(meta) {
  const templatePath = path.join(packageRoot(), 'templates', 'claude.md');
  let template;
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch {
    // Fallback if template is missing (shouldn't happen in installed package)
    console.error('  Warning: CLAUDE.md template not found, using minimal template');
    template = '# Wheat — Research Sprint\n\n## Sprint\n\n**Question:** {{QUESTION}}\n\n**Audience:** {{AUDIENCE}}\n\n**Constraints:**\n{{CONSTRAINTS}}\n\n**Done looks like:** {{DONE_CRITERIA}}\n';
  }

  const constraintList = meta.constraints.length > 0
    ? meta.constraints.map(c => `- ${c}`).join('\n')
    : '- (none specified)';

  return template
    .replace(/\{\{QUESTION\}\}/g, meta.question)
    .replace(/\{\{AUDIENCE\}\}/g, meta.audience.join(', '))
    .replace(/\{\{CONSTRAINTS\}\}/g, constraintList)
    .replace(/\{\{DONE_CRITERIA\}\}/g, meta.doneCriteria || 'A recommendation with evidence');
}

function copyCommands(dir) {
  const srcDir = path.join(packageRoot(), 'templates', 'commands');
  const destDir = target(dir, '.claude', 'commands');

  // Create .claude/commands/ if it doesn't exist
  fs.mkdirSync(destDir, { recursive: true });

  let copied = 0;
  try {
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);

      // Don't overwrite existing commands (user may have customized)
      if (fs.existsSync(dest)) {
        console.log(`  Skipped .claude/commands/${file} (already exists)`);
        continue;
      }

      fs.copyFileSync(src, dest);
      copied++;
    }
  } catch (err) {
    console.error(`  Warning: could not copy commands: ${err.message}`);
  }

  return copied;
}

// ─── Git Hook Installation ─────────────────────────────────────────────────

function installGitHook(dir) {
  // Find git root (might be different from target dir in monorepos)
  let gitRoot;
  try {
    gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir, timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'],
    }).toString().trim();
  } catch {
    console.log('  \x1b[33m!\x1b[0m Not a git repo — skipping pre-commit hook');
    return;
  }

  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  const hookPath = path.join(hooksDir, 'pre-commit');

  // The hook snippet — runs wheat compile --check before allowing commits
  // Uses Node for the check logic so it works on both Unix (sh) and Windows (Git Bash)
  const WHEAT_MARKER = '# wheat-guard';
  const escapedDir = dir.replace(/\\/g, '/');   // Normalize Windows backslashes for shell
  const hookSnippet = `
${WHEAT_MARKER}
# Wheat pre-commit: verify claims compile before committing
if git diff --cached --name-only | grep -q 'claims.json'; then
  npx --yes @grainulation/wheat compile --check --dir "${escapedDir}" 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "wheat: claims.json has compilation errors. Run 'wheat compile --summary' to see details."
    exit 1
  fi
fi
`;

  try {
    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, 'utf8');
      if (existing.includes(WHEAT_MARKER)) {
        console.log('  \x1b[34m-\x1b[0m pre-commit hook (already installed)');
        return;
      }
      // Append to existing hook
      fs.appendFileSync(hookPath, hookSnippet);
    } else {
      // Create new hook
      fs.writeFileSync(hookPath, '#!/bin/sh\n' + hookSnippet);
      fs.chmodSync(hookPath, 0o755);
    }
    console.log('  \x1b[32m+\x1b[0m .git/hooks/pre-commit (wheat guard)');
  } catch (err) {
    console.log(`  \x1b[33m!\x1b[0m Could not install git hook: ${err.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function run(dir, args) {
  const flags = parseFlags(args);

  // Check if sprint already exists
  const claimsPath = target(dir, 'claims.json');
  if (fs.existsSync(claimsPath) && !flags.force) {
    console.log();
    console.log('  A sprint already exists in this directory (claims.json found).');
    console.log('  Use --force to reinitialize, or run "wheat compile" to continue.');
    console.log();
    process.exit(1);
  }

  let meta;

  if (flags.headless) {
    // ── Headless mode — all flags required ──
    const missing = [];
    if (!flags.question) missing.push('--question');
    if (!flags.audience) missing.push('--audience');
    if (!flags.constraints) missing.push('--constraints');
    if (!flags.done) missing.push('--done');
    if (missing.length > 0) {
      console.error();
      console.error(`  --headless requires all flags: --question, --audience, --constraints, --done`);
      console.error(`  Missing: ${missing.join(', ')}`);
      console.error();
      console.error('  Example:');
      console.error('    wheat init --headless \\');
      console.error('      --question "Should we migrate to Postgres?" \\');
      console.error('      --audience "Backend team" \\');
      console.error('      --constraints "Must support zero-downtime; Budget under 10k" \\');
      console.error('      --done "Migration plan with risk assessment and rollback strategy"');
      console.error();
      process.exit(1);
    }
    meta = {
      question: flags.question,
      audience: flags.audience.split(',').map(s => s.trim()),
      constraints: flags.constraints.split(';').map(s => s.trim()).filter(Boolean),
      doneCriteria: flags.done,
    };
    console.log();
    console.log('  \x1b[1m\x1b[33mwheat\x1b[0m — headless sprint init');
    console.log('  ─────────────────────────────────────────');
    console.log(`  Question:    ${meta.question.slice(0, 70)}${meta.question.length > 70 ? '...' : ''}`);
    console.log(`  Audience:    ${meta.audience.join(', ')}`);
    console.log(`  Constraints: ${meta.constraints.length}`);
    console.log(`  Done:        ${meta.doneCriteria.slice(0, 70)}${meta.doneCriteria.length > 70 ? '...' : ''}`);
  } else if (flags.question) {
    // ── Quick mode — question pre-filled, prompt for the rest if missing ──
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log();
    console.log('  \x1b[1m\x1b[33mwheat\x1b[0m — quick sprint init');
    console.log('  ─────────────────────────────────────────');
    console.log(`  Question: ${flags.question}`);
    console.log();

    const audience = flags.audience
      ? flags.audience.split(',').map(s => s.trim())
      : (await ask('  Who is this for? (comma-separated, default: self)\n  > ')).split(',').map(s => s.trim()).filter(Boolean) || ['self'];

    const constraints = flags.constraints
      ? flags.constraints.split(';').map(s => s.trim()).filter(Boolean)
      : (await ask('  Any constraints? (semicolon-separated, or press Enter to skip)\n  > ')).split(';').map(s => s.trim()).filter(Boolean);

    const doneCriteria = flags.done
      || await ask('  What does "done" look like?\n  > ');

    rl.close();

    meta = {
      question: flags.question,
      audience: audience.length ? audience : ['self'],
      constraints,
      doneCriteria,
    };
  } else {
    // ── Interactive mode ──
    meta = await conversationalInit(dir);
  }

  // Build claims.json
  const claims = buildClaims(meta, meta.constraints);

  // Build CLAUDE.md
  const claudeMd = buildClaudeMd(meta);

  // Write files
  console.log();
  console.log('  \x1b[1mCreating sprint files...\x1b[0m');
  console.log();

  // claims.json
  fs.writeFileSync(claimsPath, JSON.stringify(claims, null, 2) + '\n');
  console.log('  \x1b[32m+\x1b[0m claims.json');

  // CLAUDE.md
  const claudePath = target(dir, 'CLAUDE.md');
  fs.writeFileSync(claudePath, claudeMd);
  console.log('  \x1b[32m+\x1b[0m CLAUDE.md');

  // .claude/commands/
  const copied = copyCommands(dir);
  console.log(`  \x1b[32m+\x1b[0m .claude/commands/ (${copied} commands installed)`);

  // Create output directories
  const dirs = ['output', 'research', 'prototypes', 'evidence'];
  for (const d of dirs) {
    const dirPath = target(dir, d);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
      console.log(`  \x1b[32m+\x1b[0m ${d}/`);
    }
  }

  // Install git pre-commit hook (like husky — stakeholder insight)
  installGitHook(dir);

  // Summary
  console.log();
  console.log('  ─────────────────────────────────────────');
  console.log(`  \x1b[1m\x1b[33mSprint ready.\x1b[0m`);
  console.log();
  console.log(`  Question:  ${meta.question}`);
  console.log(`  Audience:  ${meta.audience.join(', ')}`);
  console.log(`  Claims:    ${claims.claims.length} constraint(s) seeded`);
  console.log();
  console.log('  What to do now:');
  console.log('    1. Open Claude Code in this directory');
  console.log('    2. Run  /research <topic>  to start investigating');
  console.log('    3. Run  /status  anytime to see where you are');
  console.log();
  console.log('  Trust the process. The evidence will compound.');
  console.log();
}
