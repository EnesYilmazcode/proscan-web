// Runs the Firebase emulators on ports taken from the environment, so two
// checkouts (or a stuck Java process on 8080) don't collide. Ports that were
// already taken when it started are never killed on exit.
//
//   node scripts/emulators.mjs start [extra firebase args]
//   node scripts/emulators.mjs exec [--only auth,firestore] "<command>"
//
// Ports: EMU_AUTH_PORT, EMU_FIRESTORE_PORT, EMU_HOSTING_PORT, EMU_UI_PORT,
// EMU_HUB_PORT, EMU_LOGGING_PORT. Unset ones keep the firebase.json value.
// `exec` also hands the ports to the child as FIREBASE_AUTH_EMULATOR_HOST /
// FIRESTORE_EMULATOR_HOST (set by firebase itself), VITE_*_EMULATOR_PORT and
// EMU_HOSTING_PORT.

import { execSync, spawn } from 'node:child_process';
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
} else if (mode === 'exec' && (rest.length === 1 || (rest.length === 3 && rest[0] === '--only'))) {
  const only = rest.length === 3 ? rest[1] : 'auth,firestore';
  args = ['emulators:exec', '--only', only, JSON.stringify(rest[rest.length - 1])];
} else {
  console.error('usage: emulators.mjs start [args] | exec [--only list] "<command>"');
  process.exit(2);
}
args.push('--project', 'demo-proscan', '--config', '.firebase.emulators.json');

// On Windows the Firestore emulator's java.exe outlives firebase and keeps
// its port. On exit, kill what still listens on our emulator ports, but only
// ports that were free before we started: a port someone else already held
// (another checkout's emulators, a dev server) is theirs, not ours.
const reapPorts = [ports.firestore, ports.auth, ports.hosting, ports.hub, ports.logging].map(String);

function listeners() {
  const byPort = new Map();
  if (process.platform !== 'win32') return byPort;
  let out = '';
  try {
    out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
  } catch {
    return byPort;
  }
  for (const line of out.split('\n')) {
    const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
    if (!m) continue;
    if (!byPort.has(m[1])) byPort.set(m[1], new Set());
    byPort.get(m[1]).add(m[2]);
  }
  return byPort;
}

const heldBefore = new Set([...listeners().keys()].filter((p) => reapPorts.includes(p)));
if (heldBefore.size) {
  console.log(`[emulators] already in use, will not touch: ${[...heldBefore].join(', ')}`);
}

function freePorts() {
  if (process.platform !== 'win32') return;
  const pids = new Set();
  for (const [port, set] of listeners()) {
    if (reapPorts.includes(port) && !heldBefore.has(port)) for (const pid of set) pids.add(pid);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  }
}

console.log(`[emulators] auth ${ports.auth}, firestore ${ports.firestore}, ui ${ports.ui}`);
const child = spawn('firebase', args, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_AUTH_EMULATOR_PORT: String(ports.auth),
    VITE_FIRESTORE_EMULATOR_PORT: String(ports.firestore),
    EMU_HOSTING_PORT: String(ports.hosting),
  },
});

const cleanup = () => {
  rmSync(configPath, { force: true });
  freePorts();
};
child.on('exit', (code, signal) => {
  cleanup();
  process.exit(signal ? 1 : (code ?? 1));
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
