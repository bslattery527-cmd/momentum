#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const appDir = path.join(repoRoot, 'momentum-app');
const apiDir = path.join(repoRoot, 'momentum-api');
const logsDir = path.join(repoRoot, '.logs');
const LOCAL_API_PORT = 3001;
const DEV_SERVER_PORTS = [8081, 19000, 19001, 19002];
const DEFAULT_IOS_SIMULATOR = process.env.IOS_SIMULATOR_NAME || 'iPhone 16 Pro';

function usage() {
  console.log(
    'Usage: node scripts/mobile-workflow.mjs <ios|android> <local|prod> [--dry-run] [--fresh-backend] [--fresh-dev-server]\n'
  );
}

function ensureLogsDir() {
  fs.mkdirSync(logsDir, { recursive: true });
}

function createLogFile(workflowName, streamName) {
  ensureLogsDir();
  const logPath = path.join(logsDir, `${workflowName}.${streamName}.log`);
  const header = `\n=== ${new Date().toISOString()} ${workflowName} ${streamName} ===\n`;
  fs.writeFileSync(logPath, header, 'utf8');
  return {
    logPath,
    stream: fs.createWriteStream(logPath, { flags: 'a' }),
  };
}

function attachLogging(child, workflowName, streamName, label) {
  const { logPath, stream } = createLogFile(workflowName, streamName);

  const pipe = (source, target) => {
    source?.on('data', (chunk) => {
      stream.write(chunk);
      target.write(`[${label}] ${chunk.toString()}`);
    });
  };

  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('close', () => {
    stream.end();
  });

  return logPath;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
      }
    });
  });
}

async function findProcessesOnPort(port) {
  try {
    const { stdout } = await run('lsof', ['-ti', `tcp:${port}`]);
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function terminateProcessesOnPort(port) {
  const pids = await findProcessesOnPort(port);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      // Ignore dead or inaccessible processes.
    }
  }

  if (pids.length > 0) {
    const closed = await waitForPortToClose(port, 10000);
    if (!closed) {
      throw new Error(`Port ${port} is still in use after attempting to stop existing processes.`);
    }
  }
}

async function terminateProcessesOnPorts(ports) {
  for (const port of ports) {
    await terminateProcessesOnPort(port);
  }
}

const [platform, target, ...restArgs] = process.argv.slice(2);
const dryRun = restArgs.includes('--dry-run');
const freshBackend = restArgs.includes('--fresh-backend');
const freshDevServer = restArgs.includes('--fresh-dev-server');

if (!platform || !target || !['ios', 'android'].includes(platform) || !['local', 'prod'].includes(target)) {
  usage();
  process.exit(1);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPreferredLanIp() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return null;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port)) {
      return true;
    }
    await wait(500);
  }
  return false;
}

async function waitForPortToClose(port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isPortOpen(port))) {
      return true;
    }
    await wait(500);
  }
  return false;
}

let backendProcess = null;
let appProcess = null;
let shuttingDown = false;

function killChild(child) {
  if (child && !child.killed) {
    child.kill('SIGINT');
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  killChild(appProcess);
  killChild(backendProcess);
  setTimeout(() => process.exit(code), 100);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

async function resolveIosSimulator() {
  try {
    const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', 'available']);
    const lines = stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    const booted = lines.find((line) => line.includes('(Booted)') && line.startsWith('iPhone '));
    if (booted) {
      return booted.split(' (')[0];
    }

    const fallback = lines.find((line) => line.startsWith(`${DEFAULT_IOS_SIMULATOR} (`));
    if (fallback) {
      return DEFAULT_IOS_SIMULATOR;
    }
  } catch {
    // Fall through to default.
  }

  return DEFAULT_IOS_SIMULATOR;
}

async function main() {
  const appEnv = { ...process.env };
  const workflowName = `${platform}-${target}`;
  appEnv.LANG = 'en_US.UTF-8';
  appEnv.LC_ALL = 'en_US.UTF-8';

  if (target === 'local') {
    appEnv.EXPO_PUBLIC_API_MODE = 'local';

    if (platform === 'ios' && !appEnv.EXPO_PUBLIC_LOCAL_API_HOST) {
      const lanIp = getPreferredLanIp();
      if (lanIp) {
        appEnv.EXPO_PUBLIC_LOCAL_API_HOST = lanIp;
      }
    }
  } else {
    delete appEnv.EXPO_PUBLIC_API_MODE;
  }

  const appArgs = ['expo', 'run:' + platform];
  if (platform === 'ios') {
    const simulator = await resolveIosSimulator();
    appArgs.push('-d', simulator);
  }

  console.log(`Workflow: ${platform} simulator -> ${target} backend`);
  console.log(`App command: npx ${appArgs.join(' ')} (cwd: momentum-app)`);
  if (freshDevServer) {
    console.log('Dev server startup mode: force fresh process');
  }
  if (target === 'local') {
    console.log('Backend command: npm run dev (cwd: momentum-api)');
    console.log(
      `Local API base: http://${appEnv.EXPO_PUBLIC_LOCAL_API_HOST || (platform === 'android' ? '10.0.2.2' : 'localhost')}:${appEnv.EXPO_PUBLIC_LOCAL_API_PORT || LOCAL_API_PORT}/api/v1`
    );
    if (freshBackend) {
      console.log('Backend startup mode: force fresh process');
    }
  }
  console.log(`App logs: .logs/${workflowName}.app.log`);
  if (target === 'local') {
    console.log(`Backend logs: .logs/${workflowName}.backend.log`);
  }

  if (dryRun) {
    return;
  }

  if (freshDevServer) {
    console.log('Stopping existing Metro/dev server processes...');
    await terminateProcessesOnPorts(DEV_SERVER_PORTS);
  }

  if (target === 'local') {
    if (!freshBackend && (await isPortOpen(LOCAL_API_PORT))) {
      console.log(`Reusing local backend on port ${LOCAL_API_PORT}`);
      console.log('Backend logs are not being captured because the process was already running.');
    } else {
      if (freshBackend) {
        console.log('Starting a fresh local backend on port 3001...');
        await terminateProcessesOnPort(LOCAL_API_PORT);
      } else {
        console.log('Starting local backend on port 3001...');
      }
      backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: apiDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      attachLogging(backendProcess, workflowName, 'backend', 'backend');

      backendProcess.on('exit', (code) => {
        if (!shuttingDown && code !== 0) {
          console.error(`Backend exited early with code ${code ?? 'unknown'}`);
          shutdown(code ?? 1);
        }
      });

      const ready = await waitForPort(LOCAL_API_PORT, 20000);
      if (!ready) {
        console.error('Backend did not start listening on port 3001 within 20 seconds.');
        shutdown(1);
      }
    }
  }

  appProcess = spawn('npx', appArgs, {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: appEnv,
  });

  attachLogging(appProcess, workflowName, 'app', 'app');

  appProcess.on('exit', (code) => {
    shutdown(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
});
