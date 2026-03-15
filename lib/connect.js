/**
 * wheat connect farmer — Auto-configure Claude Code hooks for Farmer
 *
 * Detects farmer on localhost, writes hooks to project-level
 * .claude/settings.local.json. Atomic writes with lockfile.
 * Zero npm dependencies.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_PORTS = [9090, 9091];
const DETECT_TIMEOUT_MS = 2000;
const VERIFY_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 200;
const LOCK_MAX_RETRIES = 10;
const SETTINGS_FILENAME = '.claude/settings.local.json';

const HOOK_ENDPOINTS = {
  permission:   '/hooks/permission',
  activity:     '/hooks/activity',
  notification: '/hooks/notification',
};

// ─── Argument parsing ──────────────────────────────────────────────────────

function parseArgs(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      flags.url = args[i + 1]; i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      flags.port = parseInt(args[i + 1], 10); i++;
    } else if (args[i] === '--dry-run') {
      flags.dryRun = true;
    } else if (args[i] === '--force') {
      flags.force = true;
    } else if (args[i] === '--json') {
      flags.json = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      flags.help = true;
    }
  }
  return flags;
}

// ─── HTTP helpers (zero-dep) ───────────────────────────────────────────────

function httpRequest(url, options = {}) {
  return new Promise(resolve => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const timeout = options.timeout || DETECT_TIMEOUT_MS;

    const req = client.request(parsed, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout,
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body, error: null });
      });
    });

    req.on('error', err => resolve({ status: 0, body: '', error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', error: 'timeout' }); });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// ─── Farmer detection ──────────────────────────────────────────────────────

async function probeFarmer(baseUrl) {
  const rootResp = await httpRequest(baseUrl + '/', { timeout: DETECT_TIMEOUT_MS });
  if (rootResp.error) return { found: false, error: rootResp.error };

  const looksLikeFarmer = rootResp.status === 200
    && (rootResp.body.includes('farmer') || rootResp.body.includes('Farmer'));

  if (!looksLikeFarmer && rootResp.status !== 401 && rootResp.status !== 403) {
    return { found: false, error: `Port responds (HTTP ${rootResp.status}) but does not look like Farmer` };
  }

  const probePayload = {
    hook_event_name: 'PreToolUse',
    tool_name: '__wheat_connect_probe__',
    tool_input: '{}',
    session_id: 'wheat-connect-probe',
  };

  const hookResp = await httpRequest(baseUrl + HOOK_ENDPOINTS.permission, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: probePayload,
    timeout: VERIFY_TIMEOUT_MS,
  });

  if (hookResp.error) {
    return { found: true, verified: false, error: `Farmer found but hook probe failed: ${hookResp.error}` };
  }

  let isVerified = false;
  try {
    isVerified = !!JSON.parse(hookResp.body).hookSpecificOutput;
  } catch {}

  return {
    found: true,
    verified: isVerified,
    status: hookResp.status,
    error: isVerified ? null : `Hook endpoint returned unexpected response (HTTP ${hookResp.status})`,
  };
}

async function detectFarmer(preferredPort) {
  const ports = preferredPort ? [preferredPort] : DEFAULT_PORTS;
  for (const port of ports) {
    const baseUrl = `http://localhost:${port}`;
    const result = await probeFarmer(baseUrl);
    if (result.found) return { ...result, url: baseUrl, port };
  }
  return { found: false, url: null, port: null, error: 'No farmer server found on default ports' };
}

// ─── Settings file management ──────────────────────────────────────────────

function buildHooksConfig(farmerUrl) {
  return {
    PreToolUse: [{
      matcher: '',
      hooks: [{ type: 'url', url: `${farmerUrl}${HOOK_ENDPOINTS.permission}` }],
    }],
    PostToolUse: [{
      matcher: '',
      hooks: [{ type: 'url', url: `${farmerUrl}${HOOK_ENDPOINTS.activity}` }],
    }],
    Notification: [{
      matcher: '',
      hooks: [{ type: 'url', url: `${farmerUrl}${HOOK_ENDPOINTS.notification}` }],
    }],
  };
}

function readSettings(settingsPath) {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`Cannot parse ${settingsPath}: ${err.message}`);
  }
}

function mergeHooks(existing, farmerHooks) {
  const merged = JSON.parse(JSON.stringify(existing));
  if (!merged.hooks) merged.hooks = {};

  for (const hookType of Object.keys(farmerHooks)) {
    const existingHooks = merged.hooks[hookType] || [];
    const nonFarmerHooks = existingHooks.filter(entry => {
      if (!entry.hooks || !Array.isArray(entry.hooks)) return true;
      return !entry.hooks.some(h => h.type === 'url' && h.url && h.url.includes('/hooks/'));
    });
    merged.hooks[hookType] = [...nonFarmerHooks, ...farmerHooks[hookType]];
  }
  return merged;
}

async function writeSettingsAtomic(settingsPath, settings) {
  const lockPath = settingsPath + '.lock';
  const backupPath = settingsPath + '.backup';
  const tmpPath = settingsPath + '.tmp';

  let lockAcquired = false;
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      lockAcquired = true;
      break;
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const holderPid = parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
          process.kill(holderPid, 0);
          await new Promise(r => setTimeout(r, LOCK_RETRY_MS));
        } catch {
          try { fs.unlinkSync(lockPath); } catch {}
        }
      } else {
        throw err;
      }
    }
  }

  if (!lockAcquired) {
    throw new Error('Cannot acquire file lock — another process is writing to settings');
  }

  try {
    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(tmpPath, settingsPath);
  } finally {
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

// ─── Output formatting ────────────────────────────────────────────────────

function printSuccess(farmerUrl, settingsPath, dryRun) {
  console.log();
  console.log('  \x1b[32m\u2713\x1b[0m \x1b[1mFarmer connected\x1b[0m');
  console.log('  \u2500'.repeat(40));
  console.log(`  Server:   ${farmerUrl}`);
  console.log(`  Settings: ${settingsPath}`);
  console.log();
  console.log('  Hooks configured:');
  console.log(`    PreToolUse   \u2192 ${farmerUrl}/hooks/permission`);
  console.log(`    PostToolUse  \u2192 ${farmerUrl}/hooks/activity`);
  console.log(`    Notification \u2192 ${farmerUrl}/hooks/notification`);
  console.log();
  if (dryRun) {
    console.log('  \x1b[33m(dry run \u2014 no files were modified)\x1b[0m');
    console.log();
  }
  console.log('  Next: open Claude Code in this directory. All tool');
  console.log('  calls will route through Farmer for approval.');
  console.log();
}

function printNotFound(triedPorts) {
  console.log();
  console.log('  \x1b[31m\u2717\x1b[0m \x1b[1mFarmer not detected\x1b[0m');
  console.log('  \u2500'.repeat(40));
  console.log(`  Tried ports: ${triedPorts.join(', ')}`);
  console.log();
  console.log('  To start Farmer:');
  console.log('    npx @grainulation/farmer start');
  console.log();
  console.log('  Or connect to a remote Farmer:');
  console.log('    wheat connect farmer --url https://your-tunnel.trycloudflare.com');
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

  // Step 1: Detect or connect to farmer
  let farmerUrl;
  let detection;

  if (flags.url) {
    farmerUrl = flags.url.replace(/\/+$/, '');
    console.log(`\n  Connecting to ${farmerUrl}...`);
    detection = await probeFarmer(farmerUrl);
    if (!detection.found) {
      if (flags.json) {
        console.log(JSON.stringify({ success: false, error: detection.error }));
      } else {
        console.log(`\n  \x1b[31m\u2717\x1b[0m Cannot reach Farmer at ${farmerUrl}: ${detection.error}\n`);
      }
      process.exit(1);
    }
  } else {
    const ports = flags.port ? [flags.port] : DEFAULT_PORTS;
    console.log(`\n  Detecting Farmer on localhost (ports: ${ports.join(', ')})...`);
    detection = await detectFarmer(flags.port);
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
    console.log(`  \x1b[33m!\x1b[0m Farmer found but hook verification failed.`);
    console.log(`    ${detection.error || 'Unknown verification error'}`);
    console.log(`    Proceeding with configuration anyway...`);
  } else {
    console.log(`  \x1b[32m\u2713\x1b[0m Farmer detected at ${farmerUrl}`);
  }

  // Step 2: Read existing settings, merge, write
  const existing = readSettings(settingsPath);

  const hasExistingFarmerHooks = existing.hooks && Object.values(existing.hooks).some(
    entries => Array.isArray(entries) && entries.some(
      entry => entry.hooks && entry.hooks.some(h => h.type === 'url' && h.url && h.url.includes('/hooks/'))
    )
  );

  if (hasExistingFarmerHooks && !flags.force) {
    if (flags.json) {
      console.log(JSON.stringify({ success: true, alreadyConfigured: true, url: farmerUrl }));
    } else {
      console.log(`  \x1b[33m!\x1b[0m Farmer hooks already configured in ${SETTINGS_FILENAME}`);
      console.log('    Use --force to overwrite.');
    }
    return;
  }

  const farmerHooks = buildHooksConfig(farmerUrl);
  const merged = mergeHooks(existing, farmerHooks);

  if (flags.dryRun) {
    if (flags.json) {
      console.log(JSON.stringify({ success: true, dryRun: true, url: farmerUrl, settings: merged }));
    } else {
      console.log('\n  Would write to: ' + settingsPath);
      console.log();
      console.log(JSON.stringify(merged, null, 2));
      printSuccess(farmerUrl, settingsPath, true);
    }
    return;
  }

  // Step 3: Write settings atomically
  await writeSettingsAtomic(settingsPath, merged);

  if (flags.json) {
    console.log(JSON.stringify({ success: true, url: farmerUrl, settingsPath, verified: detection.verified }));
  } else {
    printSuccess(farmerUrl, settingsPath, false);
  }
}
