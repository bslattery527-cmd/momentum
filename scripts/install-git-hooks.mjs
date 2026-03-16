import { chmodSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

function isGitWorktree() {
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

if (!isGitWorktree()) {
  process.exit(0);
}

const hookPath = join(root, '.githooks', 'pre-commit');

if (!existsSync(hookPath)) {
  console.error(`Missing git hook: ${hookPath}`);
  process.exit(1);
}

chmodSync(hookPath, 0o755);
execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: root,
  stdio: 'inherit',
});

console.log('Installed git hooks: .githooks');
