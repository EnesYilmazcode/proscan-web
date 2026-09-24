// Refuses to deploy from a tree that doesn't match a commit, so the SHA in
// /version.json always names exactly what is live, and from a main that
// matches origin/main so a stale checkout never overwrites newer production.

import { execSync } from 'node:child_process';

const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('deploy: commit or stash these first, so version.json names a real commit:\n' + dirty);
  process.exit(1);
}
const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
if (branch !== 'main' && !process.env.PROSCAN_DEPLOY_ANY_BRANCH) {
  console.error(`deploy: on "${branch}", not main. Set PROSCAN_DEPLOY_ANY_BRANCH=1 to override.`);
  process.exit(1);
}
if (!process.env.PROSCAN_DEPLOY_ANY_BRANCH) {
  // A stale local main would push older hosting and rules over production.
  execSync('git fetch origin main', { stdio: 'ignore' });
  const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const remote = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();
  if (head !== remote) {
    console.error(
      `deploy: HEAD ${head.slice(0, 7)} is not origin/main ${remote.slice(0, 7)}. Pull or push first, or set PROSCAN_DEPLOY_ANY_BRANCH=1 to override.`,
    );
    process.exit(1);
  }
}
