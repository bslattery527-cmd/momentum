#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';

const STACK_PREFIX = 'stack/';
const DEFAULT_BASE_CANDIDATES = ['master', 'main'];
const isTty = process.stdout.isTTY;

const color = {
  bold: (value) => (isTty ? `\u001b[1m${value}\u001b[22m` : value),
  cyan: (value) => (isTty ? `\u001b[36m${value}\u001b[39m` : value),
  dim: (value) => (isTty ? `\u001b[2m${value}\u001b[22m` : value),
  green: (value) => (isTty ? `\u001b[32m${value}\u001b[39m` : value),
  yellow: (value) => (isTty ? `\u001b[33m${value}\u001b[39m` : value),
  red: (value) => (isTty ? `\u001b[31m${value}\u001b[39m` : value),
};

function fail(message, code = 1) {
  console.error(color.red(`error: ${message}`));
  process.exit(code);
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const suffix = stderr ? `\n${stderr}` : '';
    fail(`git ${args.join(' ')} failed${suffix}`);
  }

  return result.stdout.trim();
}

function gitMaybe(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    return null;
  }

  return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function ensureGitRepo() {
  git(['rev-parse', '--show-toplevel']);
}

function getCurrentBranch() {
  const branch = git(['branch', '--show-current']);
  if (!branch) {
    fail('detached HEAD is not supported for stack operations');
  }
  return branch;
}

function getLocalBranches() {
  const raw = git(['for-each-ref', 'refs/heads', '--format=%(refname:short)']);
  return raw ? raw.split('\n').filter(Boolean).sort() : [];
}

function getStackBranches() {
  return getLocalBranches().filter((branch) => branch.startsWith(STACK_PREFIX));
}

function branchExists(branch) {
  return gitMaybe(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { stdio: 'ignore' }) !== null;
}

function normalizeBranchName(name) {
  if (!name) {
    fail('missing branch name');
  }
  return name.startsWith(STACK_PREFIX) ? name : `${STACK_PREFIX}${name}`;
}

function getDefaultBaseBranch() {
  const originHead = gitMaybe(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (originHead) {
    return originHead.replace('refs/remotes/origin/', '');
  }

  for (const candidate of DEFAULT_BASE_CANDIDATES) {
    if (branchExists(candidate)) {
      return candidate;
    }
  }

  const current = getCurrentBranch();
  return current.startsWith(STACK_PREFIX) ? 'HEAD' : current;
}

function getBranchConfig(branch, key) {
  return gitMaybe(['config', '--local', '--get', `branch.${branch}.${key}`]);
}

function setBranchConfig(branch, key, value) {
  git(['config', '--local', `branch.${branch}.${key}`, value]);
}

function clearBranchConfig(branch, key) {
  spawnSync('git', ['config', '--local', '--unset', `branch.${branch}.${key}`], {
    stdio: 'ignore',
  });
}

function isAncestor(ancestor, branch) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, branch], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function commitDistance(base, branch) {
  return Number(git(['rev-list', '--count', `${base}..${branch}`]));
}

function getBranchSubject(branch) {
  return git(['log', '-1', '--pretty=%s', branch]);
}

function inferParent(branch, stackBranches) {
  const configured = getBranchConfig(branch, 'stackParent');
  if (configured && branchExists(configured)) {
    return configured;
  }

  const candidates = stackBranches
    .filter((candidate) => candidate !== branch)
    .filter((candidate) => isAncestor(candidate, branch))
    .map((candidate) => ({
      branch: candidate,
      distance: commitDistance(candidate, branch),
    }))
    .filter((candidate) => candidate.distance > 0)
    .sort((left, right) => left.distance - right.distance || left.branch.localeCompare(right.branch));

  return candidates[0]?.branch ?? null;
}

function getRootBase(branch, defaultBase) {
  const configured = getBranchConfig(branch, 'stackBase');
  if (configured && (configured === 'HEAD' || branchExists(configured))) {
    return configured;
  }
  return defaultBase;
}

function buildStackState() {
  const stackBranches = getStackBranches();
  const defaultBase = getDefaultBaseBranch();
  const parents = new Map();
  const children = new Map();
  const roots = [];

  for (const branch of stackBranches) {
    const parent = inferParent(branch, stackBranches);
    parents.set(branch, parent);
    if (!children.has(branch)) {
      children.set(branch, []);
    }
    if (parent) {
      if (!children.has(parent)) {
        children.set(parent, []);
      }
      children.get(parent).push(branch);
    } else {
      roots.push(branch);
    }
  }

  for (const branchChildren of children.values()) {
    branchChildren.sort((left, right) => left.localeCompare(right));
  }

  roots.sort((left, right) => left.localeCompare(right));

  return { stackBranches, defaultBase, parents, children, roots };
}

function formatAhead(branch, parent, defaultBase) {
  const compareWith = parent ?? getRootBase(branch, defaultBase);
  if (!compareWith || compareWith === 'HEAD') {
    return color.dim('(working root)');
  }
  const count = commitDistance(compareWith, branch);
  return color.dim(`(+${count} vs ${compareWith})`);
}

function printBranchLine(branch, parent, defaultBase, prefix, isCurrent) {
  const marker = isCurrent ? `${color.green('*')} ` : '';
  const subject = getBranchSubject(branch);
  const ahead = formatAhead(branch, parent, defaultBase);
  console.log(`${prefix}${marker}${color.cyan(branch)} ${ahead} ${subject}`);
}

function renderTree(branch, state, options, prefix = '', isLast = true) {
  const parent = state.parents.get(branch) ?? null;
  const connector = options.isRoot ? '' : isLast ? '└─ ' : '├─ ';
  printBranchLine(branch, parent, state.defaultBase, `${prefix}${connector}`, branch === options.currentBranch);

  const nextPrefix = prefix + (options.isRoot ? '' : isLast ? '   ' : '│  ');
  const branchChildren = state.children.get(branch) ?? [];
  branchChildren.forEach((child, index) => {
    renderTree(child, state, { ...options, isRoot: false }, nextPrefix, index === branchChildren.length - 1);
  });
}

function printStackHeader(root, state) {
  const base = getRootBase(root, state.defaultBase);
  console.log(color.bold(`Stack from ${base}`));
}

function findRoot(branch, parents) {
  let current = branch;
  while (parents.get(current)) {
    current = parents.get(current);
  }
  return current;
}

function listStacks() {
  const state = buildStackState();
  const currentBranch = getCurrentBranch();

  if (state.stackBranches.length === 0) {
    console.log('No local stacked diff branches found.');
    return;
  }

  state.roots.forEach((root, index) => {
    if (index > 0) {
      console.log('');
    }
    printStackHeader(root, state);
    renderTree(root, state, { currentBranch, isRoot: true });
  });
}

function showStack(branchArg) {
  const state = buildStackState();
  const branch = branchArg ? normalizeBranchName(branchArg) : getCurrentBranch();

  if (!state.stackBranches.includes(branch)) {
    fail(`${branch} is not a local stack branch`);
  }

  const root = findRoot(branch, state.parents);
  printStackHeader(root, state);
  renderTree(root, state, { currentBranch: branch, isRoot: true });
}

function createRoot(name, baseArg) {
  const branch = normalizeBranchName(name);
  const base = baseArg ?? getDefaultBaseBranch();

  if (branchExists(branch)) {
    fail(`${branch} already exists`);
  }
  if (base !== 'HEAD' && !branchExists(base)) {
    fail(`base branch ${base} does not exist`);
  }

  git(['switch', '-c', branch, base]);
  clearBranchConfig(branch, 'stackParent');
  setBranchConfig(branch, 'stackBase', base);
  console.log(`Created ${branch} from ${base}`);
}

function createNext(name, fromArg) {
  const parent = fromArg ?? getCurrentBranch();
  const branch = normalizeBranchName(name);

  if (branchExists(branch)) {
    fail(`${branch} already exists`);
  }
  if (!branchExists(parent)) {
    fail(`parent branch ${parent} does not exist`);
  }

  git(['switch', '-c', branch, parent]);
  setBranchConfig(branch, 'stackParent', parent);
  clearBranchConfig(branch, 'stackBase');
  console.log(`Created ${branch} on top of ${parent}`);
}

function trackBranch(branchArg, options) {
  const branch = normalizeBranchName(branchArg);
  if (!branchExists(branch)) {
    fail(`${branch} does not exist`);
  }

  const parent = options.parent ? normalizeBranchName(options.parent) : null;
  const base = options.base ?? null;

  if (!parent && !base) {
    fail('track requires --parent <branch> or --base <branch>');
  }

  if (parent) {
    if (!branchExists(parent)) {
      fail(`parent branch ${parent} does not exist`);
    }
    setBranchConfig(branch, 'stackParent', parent);
    clearBranchConfig(branch, 'stackBase');
    console.log(`Tracked ${branch} on top of ${parent}`);
    return;
  }

  if (base !== 'HEAD' && !branchExists(base)) {
    fail(`base branch ${base} does not exist`);
  }
  clearBranchConfig(branch, 'stackParent');
  setBranchConfig(branch, 'stackBase', base);
  console.log(`Tracked ${branch} from base ${base}`);
}

function printHelp() {
  console.log(`stack-diff\n\nUsage:\n  ./scripts/stack-diff list\n  ./scripts/stack-diff show [branch]\n  ./scripts/stack-diff root <name> [base]\n  ./scripts/stack-diff next <name> [parent]\n  ./scripts/stack-diff track <branch> (--parent <branch> | --base <branch>)\n\nCommands:\n  list           Show every local stack branch grouped by stack.\n  show           Show the stack that contains the current branch or the branch you pass in.\n  root           Create a new root stack branch off the given base branch.\n  next           Create a child branch on top of the current branch or an explicit parent.\n  track          Override stack metadata if ancestry inference is wrong.\n`);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--parent' || token === '--base') {
      const value = args[index + 1];
      if (!value) {
        fail(`missing value for ${token}`);
      }
      options[token.slice(2)] = value;
      index += 1;
      continue;
    }
    options._ = options._ ?? [];
    options._.push(token);
  }
  return options;
}

ensureGitRepo();

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'list':
    listStacks();
    break;
  case 'show':
    showStack(rest[0]);
    break;
  case 'root':
    createRoot(rest[0], rest[1]);
    break;
  case 'next':
    createNext(rest[0], rest[1]);
    break;
  case 'track': {
    const options = parseOptions(rest.slice(1));
    trackBranch(rest[0], options);
    break;
  }
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    printHelp();
    break;
  default:
    fail(`unknown command: ${command}`);
}
