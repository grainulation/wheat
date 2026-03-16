/**
 * wheat serve — local HTTP server for the wheat sprint dashboard
 *
 * Three-column IDE-shell layout: topics | claims | detail.
 * SSE for live updates, POST endpoint for recompilation.
 * Zero npm dependencies (node:http only).
 *
 * Usage:
 *   wheat serve [--port 9092] [--dir /path/to/sprint]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ── Verbose logging ──────────────────────────────────────────────────────────

const verbose = process.argv.includes('--verbose');
function vlog(...a) {
  if (!verbose) return;
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] wheat: ${a.join(' ')}\n`);
}

// ── Routes manifest ──────────────────────────────────────────────────────────

const ROUTES = [
  { method: 'GET', path: '/events', description: 'SSE event stream for live sprint updates' },
  { method: 'GET', path: '/api/state', description: 'Current sprint state (claims, compilation, sprints)' },
  { method: 'GET', path: '/api/claims', description: 'Claims list with optional ?topic, ?type, ?evidence, ?status filters' },
  { method: 'GET', path: '/api/coverage', description: 'Compilation coverage data' },
  { method: 'GET', path: '/api/compilation', description: 'Full compilation result' },
  { method: 'POST', path: '/api/compile', description: 'Trigger recompilation of claims' },
  { method: 'GET', path: '/api/docs', description: 'This API documentation page' },
];

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  claims: [],
  compilation: null,
  sprints: [],
  activeSprint: null,
  meta: null,
};

const sseClients = new Set();

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

function loadClaims(root) {
  const claimsPath = path.join(root, 'claims.json');
  vlog('read', claimsPath);
  if (!fs.existsSync(claimsPath)) return { meta: null, claims: [] };
  try {
    const data = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
    return { meta: data.meta || null, claims: data.claims || [] };
  } catch {
    return { meta: null, claims: [] };
  }
}

function loadCompilation(root) {
  const compilationPath = path.join(root, 'compilation.json');
  vlog('read', compilationPath);
  if (!fs.existsSync(compilationPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(compilationPath, 'utf8'));
  } catch {
    return null;
  }
}

function loadSprints(root) {
  try {
    const compilerDir = path.join(__dirname, '..', 'compiler');
    const mod = path.join(compilerDir, 'detect-sprints.js');
    if (!fs.existsSync(mod)) return { sprints: [], active: null };

    const result = execFileSync('node', [mod, '--json', '--root', root], {
      timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const data = JSON.parse(result.toString());
    return {
      sprints: data.sprints || [],
      active: (data.sprints || []).find(s => s.status === 'active') || null,
    };
  } catch {
    return { sprints: [], active: null };
  }
}

function runCompile(root) {
  try {
    const compiler = path.join(__dirname, '..', 'compiler', 'wheat-compiler.js');
    if (!fs.existsSync(compiler)) return null;
    execFileSync('node', [compiler, '--root', root], {
      timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
      cwd: root,
    });
    return loadCompilation(root);
  } catch {
    return loadCompilation(root);
  }
}

function refreshState(root) {
  const claimsData = loadClaims(root);
  state.meta = claimsData.meta;
  state.claims = claimsData.claims;
  state.compilation = loadCompilation(root);
  const sprintData = loadSprints(root);
  state.sprints = sprintData.sprints;
  state.activeSprint = sprintData.active;
  broadcast({ type: 'state', data: state });
}

// ── MIME types ────────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// ── HTTP server ───────────────────────────────────────────────────────────────

function createWheatServer(root, port, corsOrigin) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    // CORS (only when --cors is passed)
    if (corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS' && corsOrigin) {
      res.writeHead(204); res.end(); return;
    }

    vlog('request', req.method, url.pathname);

    // ── API: docs ──
    if (req.method === 'GET' && url.pathname === '/api/docs') {
      const html = `<!DOCTYPE html><html><head><title>wheat API</title>
<style>body{font-family:system-ui;background:#0a0e1a;color:#e8ecf1;max-width:800px;margin:40px auto;padding:0 20px}
table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;border-bottom:1px solid #1e293b;text-align:left}
th{color:#9ca3af}code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:13px}</style></head>
<body><h1>wheat API</h1><p>${ROUTES.length} endpoints</p>
<table><tr><th>Method</th><th>Path</th><th>Description</th></tr>
${ROUTES.map(r => '<tr><td><code>'+r.method+'</code></td><td><code>'+r.path+'</code></td><td>'+r.description+'</td></tr>').join('')}
</table></body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    // ── SSE ──
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'state', data: state })}\n\n`);
      sseClients.add(res);
      vlog('sse', `client connected (${sseClients.size} total)`);
      req.on('close', () => { sseClients.delete(res); vlog('sse', `client disconnected (${sseClients.size} total)`); });
      return;
    }

    // ── API: state ──
    if (req.method === 'GET' && url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    // ── API: claims (with optional filters) ──
    if (req.method === 'GET' && url.pathname === '/api/claims') {
      let claims = state.claims;
      const topic = url.searchParams.get('topic');
      const evidence = url.searchParams.get('evidence');
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      if (topic) claims = claims.filter(c => c.topic === topic);
      if (evidence) claims = claims.filter(c => c.evidence === evidence);
      if (type) claims = claims.filter(c => c.type === type);
      if (status) claims = claims.filter(c => c.status === status);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(claims));
      return;
    }

    // ── API: coverage ──
    if (req.method === 'GET' && url.pathname === '/api/coverage') {
      const coverage = state.compilation?.coverage || {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(coverage));
      return;
    }

    // ── API: compilation ──
    if (req.method === 'GET' && url.pathname === '/api/compilation') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state.compilation));
      return;
    }

    // ── API: compile (trigger recompilation) ──
    if (req.method === 'POST' && url.pathname === '/api/compile') {
      state.compilation = runCompile(root);
      refreshState(root);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    // ── Static files ──
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const resolved = path.resolve(PUBLIC_DIR, '.' + filePath);
    if (!resolved.startsWith(PUBLIC_DIR)) {
      res.writeHead(403); res.end('forbidden'); return;
    }

    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(resolved));
      return;
    }

    res.writeHead(404); res.end('not found');
  });

  // ── File watching ──
  const claimsPath = path.join(root, 'claims.json');
  const compilationPath = path.join(root, 'compilation.json');
  if (fs.existsSync(claimsPath)) {
    fs.watchFile(claimsPath, { interval: 2000 }, () => refreshState(root));
  }
  if (fs.existsSync(compilationPath)) {
    fs.watchFile(compilationPath, { interval: 2000 }, () => refreshState(root));
  }

  // ── Start ──
  refreshState(root);

  server.listen(port, '127.0.0.1', () => {
    vlog('listen', `port=${port}`, `root=${root}`);
    console.log(`wheat: serving on http://localhost:${port}`);
    console.log(`  claims: ${state.claims.length} loaded`);
    console.log(`  compilation: ${state.compilation ? state.compilation.status : 'not found'}`);
    console.log(`  sprints: ${state.sprints.length} detected`);
    if (state.activeSprint) {
      console.log(`  active: ${state.activeSprint.name} (${state.activeSprint.phase})`);
    }
    console.log(`  root: ${root}`);
  });

  return server;
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

export async function run(targetDir, subArgs) {
  let port = 9092;
  const portIdx = subArgs.indexOf('--port');
  if (portIdx !== -1 && subArgs[portIdx + 1]) {
    port = parseInt(subArgs[portIdx + 1], 10);
  }
  const corsIdx = subArgs.indexOf('--cors');
  const corsOrigin = (corsIdx !== -1 && subArgs[corsIdx + 1]) ? subArgs[corsIdx + 1] : null;
  createWheatServer(targetDir, port, corsOrigin);
}
