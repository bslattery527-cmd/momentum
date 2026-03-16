#!/usr/bin/env node

import { spawn } from 'node:child_process';

const PORTS = [3001, 8081, 19000, 19001, 19002];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
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

async function findPidsOnPort(port) {
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

async function pidCommand(pid) {
  try {
    const { stdout } = await run('ps', ['-p', pid, '-o', 'command=']);
    return stdout.trim();
  } catch {
    return '';
  }
}

async function isPidAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminatePid(pid) {
  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch {
    return false;
  }

  for (let i = 0; i < 10; i += 1) {
    if (!(await isPidAlive(pid))) {
      return true;
    }
    await wait(250);
  }

  try {
    process.kill(Number(pid), 'SIGKILL');
  } catch {
    return false;
  }

  for (let i = 0; i < 10; i += 1) {
    if (!(await isPidAlive(pid))) {
      return true;
    }
    await wait(100);
  }

  return false;
}

async function main() {
  const pidToPorts = new Map();

  for (const port of PORTS) {
    const pids = await findPidsOnPort(port);
    for (const pid of pids) {
      const ports = pidToPorts.get(pid) || [];
      ports.push(port);
      pidToPorts.set(pid, ports);
    }
  }

  if (pidToPorts.size === 0) {
    console.log('No local dev processes found on tracked ports.');
    return;
  }

  console.log('Stopping local dev processes:');

  for (const [pid, ports] of pidToPorts.entries()) {
    const command = await pidCommand(pid);
    const stopped = await terminatePid(pid);
    const portList = ports.sort((a, b) => a - b).join(', ');
    console.log(
      `${stopped ? 'stopped' : 'failed'} pid ${pid} on port${ports.length > 1 ? 's' : ''} ${portList}${command ? ` :: ${command}` : ''}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
