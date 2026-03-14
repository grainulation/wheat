/**
 * wheat compile — delegates to wheat-compiler.js with --dir
 *
 * Instead of duplicating the compiler, we ship the real one and shell out.
 * This ensures the npm package always produces identical output to the
 * standalone compiler.
 *
 * Zero npm dependencies.
 */

const path = require('path');
const { execFileSync } = require('child_process');

const COMPILER_PATH = path.join(__dirname, '..', 'compiler', 'wheat-compiler.js');

async function run(dir, args) {
  // Build argv for the real compiler: --dir <targetDir> + passthrough flags
  const compilerArgs = [COMPILER_PATH, '--dir', dir, ...args];

  try {
    const result = execFileSync(process.execPath, compilerArgs, {
      cwd: dir,
      timeout: 30_000,
      stdio: ['inherit', 'inherit', 'inherit'],
    });
  } catch (err) {
    // execFileSync throws on non-zero exit — let it propagate
    if (err.status) process.exit(err.status);
    throw err;
  }
}

module.exports = { run };
