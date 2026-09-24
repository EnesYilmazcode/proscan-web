// Runs the Firebase emulators on ports taken from the environment, so two
// checkouts (or a stuck Java process on 8080) don't collide.
//
//   node scripts/emulators.mjs start [extra firebase args]
//   node scripts/emulators.mjs exec "<command>"
//
// Ports: EMU_AUTH_PORT, EMU_FIRESTORE_PORT, EMU_HOSTING_PORT, EMU_UI_PORT,
// EMU_HUB_PORT, EMU_LOGGING_PORT. Unset ones keep the firebase.json value.
// `exec` also hands the ports to the child as FIREBASE_AUTH_EMULATOR_HOST /
// FIRESTORE_EMULATOR_HOST (set by firebase itself) and VITE_*_EMULATOR_PORT.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const base = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
const emu = base.emulators;

const pick = (name, fallback) => {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name}=${v} is not a port`);
  return n;
};

const ports = {
  auth: pick('EMU_AUTH_PORT', emu.auth.port),
  firestore: pick('EMU_FIRESTORE_PORT', emu.firestore.port),
  hosting: pick('EMU_HOSTING_PORT', emu.hosting.port),
  ui: pick('EMU_UI_PORT', emu.ui.port),
  hub: pick('EMU_HUB_PORT', emu.hub?.port ?? 4400),
  logging: pick('EMU_LOGGING_PORT', emu.logging?.port ?? 4500),
};

const config = {
  ...base,
  emulators: {
    ...emu,
    auth: { ...emu.auth, port: ports.auth },
    firestore: { ...emu.firestore, port: ports.firestore },
    hosting: { ...emu.hosting, port: ports.hosting },
    ui: { ...emu.ui, port: ports.ui },
    hub: { port: ports.hub },
    logging: { port: ports.logging },
  },
};

// Must sit next to firebase.json so the rules and hosting paths resolve.
const configPath = resolve(root, '.firebase.emulators.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));

const [mode, ...rest] = process.argv.slice(2);
let args;
if (mode === 'start') {
  args = ['emulators:start', ...rest];
} else if (mode === 'exec' && rest.length === 1) {
  args = ['emulators:exec', '--only', 'auth,firestore', JSON.stringify(rest[0])];
} else {
  console.error('usage: emulators.mjs start [args] | exec "<command>"');
  process.exit(2);
}
args.push('--project', 'demo-proscan', '--config', '.firebase.emulators.json');

console.log(`[emulators] auth ${ports.auth}, firestore ${ports.firestore}, ui ${ports.ui}`);
const child = spawn('firebase', args, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_AUTH_EMULATOR_PORT: String(ports.auth),
    VITE_FIRESTORE_EMULATOR_PORT: String(ports.firestore),
  },
});

const cleanup = () => rmSync(configPath, { force: true });
child.on('exit', (code, signal) => {
  cleanup();
  process.exit(signal ? 1 : (code ?? 1));
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
