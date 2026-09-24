// Refuses to deploy from a tree that doesn't match a commit, so the SHA in
// /version.json always names exactly what is live.

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
