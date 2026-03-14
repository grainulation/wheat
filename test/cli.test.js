/**
 * Integration test: wheat CLI entrypoint
 *
 * Verifies that `bin/wheat.js` responds correctly to:
 *   - --help (shows usage text)
 *   - --version (shows version string)
 *   - unknown command (exits non-zero)
 *
 * Uses node:test + node:assert — zero dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const WHEAT_BIN = path.resolve(__dirname, '..', 'bin', 'wheat.js');
const PKG = require('../package.json');

describe('wheat CLI', () => {
  it('--help outputs usage text with expected commands', () => {
    const output = execFileSync(process.execPath, [WHEAT_BIN, '--help'], {
      encoding: 'utf8',
      timeout: 5_000,
    });

    assert.ok(output.includes('wheat'), 'help should mention wheat');
    assert.ok(output.includes('Usage:'), 'help should include Usage section');
    assert.ok(output.includes('init'), 'help should list init command');
    assert.ok(output.includes('compile'), 'help should list compile command');
    assert.ok(output.includes('guard'), 'help should list guard command');
    assert.ok(output.includes('status'), 'help should list status command');
    assert.ok(output.includes('--dir'), 'help should mention --dir flag');
  });

  it('-h is an alias for --help', () => {
    const output = execFileSync(process.execPath, [WHEAT_BIN, '-h'], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    assert.ok(output.includes('Usage:'), '-h should show help');
  });

  it('no arguments shows help', () => {
    const output = execFileSync(process.execPath, [WHEAT_BIN], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    assert.ok(output.includes('Usage:'), 'no args should show help');
  });

  it('--version outputs correct version from package.json', () => {
    const output = execFileSync(process.execPath, [WHEAT_BIN, '--version'], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    assert.ok(
      output.trim().includes(PKG.version),
      `version output "${output.trim()}" should include "${PKG.version}"`
    );
  });

  it('-v is an alias for --version', () => {
    const output = execFileSync(process.execPath, [WHEAT_BIN, '-v'], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    assert.ok(output.trim().includes(PKG.version), '-v should show version');
  });

  it('unknown command exits non-zero', () => {
    assert.throws(() => {
      execFileSync(process.execPath, [WHEAT_BIN, 'nonexistent'], {
        encoding: 'utf8',
        timeout: 5_000,
        stdio: 'pipe',
      });
    }, 'unknown command should exit non-zero');
  });

  it('unknown command mentions available help', () => {
    let stderr = '';
    try {
      execFileSync(process.execPath, [WHEAT_BIN, 'nonexistent'], {
        encoding: 'utf8',
        timeout: 5_000,
        stdio: 'pipe',
      });
    } catch (err) {
      stderr = err.stderr || '';
    }
    assert.ok(stderr.includes('--help'), 'error should suggest --help');
  });
});
