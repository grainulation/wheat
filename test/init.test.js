/**
 * Integration test: wheat init --question "..."
 *
 * Verifies that `wheat init` in quick mode creates the expected files:
 *   - claims.json (with meta.question and claims array)
 *   - CLAUDE.md (with sprint question)
 *   - .claude/commands/ (populated with slash commands)
 *
 * Uses node:test + node:assert — zero dependencies.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const WHEAT_BIN = path.resolve(__dirname, '..', 'bin', 'wheat.js');
const QUESTION = 'Should we migrate the database to Postgres?';

describe('wheat init --question (quick mode)', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wheat-init-test-'));
    // Initialize a git repo so the init command can find git root
    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates claims.json with correct structure', () => {
    execFileSync(process.execPath, [
      WHEAT_BIN, 'init',
      '--question', QUESTION,
      '--audience', 'engineering,product',
      '--constraints', 'Budget under 10k;Timeline 2 weeks',
      '--done', 'A go/no-go recommendation',
      '--dir', tmpDir,
    ], { timeout: 10_000 });

    const claimsPath = path.join(tmpDir, 'claims.json');
    assert.ok(fs.existsSync(claimsPath), 'claims.json should exist');

    const claims = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
    assert.equal(claims.meta.question, QUESTION);
    assert.ok(Array.isArray(claims.meta.audience), 'audience should be array');
    assert.ok(claims.meta.audience.includes('engineering'));
    assert.ok(Array.isArray(claims.claims), 'claims should be array');
    assert.ok(claims.claims.length >= 2, 'should have at least 2 constraint claims (constraints + done)');
    assert.equal(claims.meta.phase, 'define');
  });

  it('creates CLAUDE.md with sprint question', () => {
    const claudePath = path.join(tmpDir, 'CLAUDE.md');
    assert.ok(fs.existsSync(claudePath), 'CLAUDE.md should exist');

    const content = fs.readFileSync(claudePath, 'utf8');
    assert.ok(content.includes(QUESTION), 'CLAUDE.md should contain the question');
    assert.ok(content.includes('engineering'), 'CLAUDE.md should contain audience');
  });

  it('creates .claude/commands/ with slash command files', () => {
    const commandsDir = path.join(tmpDir, '.claude', 'commands');
    assert.ok(fs.existsSync(commandsDir), '.claude/commands/ should exist');

    const files = fs.readdirSync(commandsDir);
    assert.ok(files.length > 0, 'should have at least one command file');
    assert.ok(files.some(f => f.endsWith('.md')), 'command files should be .md');
    // Verify known commands exist
    assert.ok(files.includes('research.md'), 'research.md command should exist');
    assert.ok(files.includes('status.md'), 'status.md command should exist');
  });

  it('creates output directories with .gitkeep', () => {
    for (const dir of ['output', 'research', 'prototypes', 'evidence']) {
      const dirPath = path.join(tmpDir, dir);
      assert.ok(fs.existsSync(dirPath), `${dir}/ should exist`);
      assert.ok(
        fs.existsSync(path.join(dirPath, '.gitkeep')),
        `${dir}/.gitkeep should exist`
      );
    }
  });

  it('refuses to reinitialize without --force', () => {
    assert.throws(() => {
      execFileSync(process.execPath, [
        WHEAT_BIN, 'init',
        '--question', 'Another question',
        '--dir', tmpDir,
      ], { timeout: 10_000, stdio: 'pipe' });
    }, 'should exit non-zero when sprint already exists');
  });
});
