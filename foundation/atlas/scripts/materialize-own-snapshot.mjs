#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = process.cwd();
const SNAPSHOT_TARGET = join(ROOT, 'OWN-SNAPSHOT.json');
const SKILLS_TARGET = join(ROOT, '.opencode', 'skills', 'own');
const IMPLEMENTATION = process.env.OWN_SNAPSHOT_MATERIALIZE_IMPL
  ?? join(ROOT, 'packages', 'retrieval', 'dist', 'src', 'own-snapshot.js');
const OWN_ROOT = '.opencode/skills/own/';

function fail(message) {
  console.error(`materialize-own-snapshot: ${message}`);
  process.exit(1);
}

function hasPath(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function containsAtlasDirectory(path) {
  return resolve(path).split(sep).includes('.atlas');
}

function git(args, options = {}) {
  return execFileSync('git', ['-C', ROOT, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function revisionBlob(revision, path) {
  try {
    return git(['rev-parse', `${revision}:./${path}`]);
  } catch {
    return undefined;
  }
}

function currentBlob(path) {
  try {
    return git(['hash-object', '--', path]);
  } catch {
    return undefined;
  }
}

if (process.argv.length !== 3) {
  fail('usage: node scripts/materialize-own-snapshot.mjs <reviewed-snapshot.json>');
}

const inputArg = process.argv[2];
const lexicalInput = isAbsolute(inputArg) ? resolve(inputArg) : resolve(ROOT, inputArg);
if (containsAtlasDirectory(lexicalInput)) fail('refusing snapshot input inside .atlas');

let input;
try {
  input = realpathSync(lexicalInput);
} catch (error) {
  fail(`cannot read snapshot input: ${error instanceof Error ? error.message : String(error)}`);
}
if (containsAtlasDirectory(input)) fail('refusing snapshot input inside .atlas');

let contract;
try {
  contract = await import(pathToFileURL(IMPLEMENTATION).href);
} catch (error) {
  fail(`cannot load compiled Own snapshot contract: ${error instanceof Error ? error.message : String(error)}`);
}
if (typeof contract.parseOwnSnapshot !== 'function' || typeof contract.materializeStaticOwnSnapshot !== 'function') {
  fail('compiled Own snapshot contract lacks required exports');
}

let inputBytes;
try {
  inputBytes = readFileSync(input, 'utf8');
} catch (error) {
  fail(`cannot read snapshot input: ${error instanceof Error ? error.message : String(error)}`);
}
const snapshot = contract.parseOwnSnapshot(inputBytes);
if (snapshot === undefined) fail('reviewed snapshot is malformed, empty, or has invalid units/source blobs');

try {
  git(['cat-file', '-e', `${snapshot.sourceRevision}^{commit}`]);
  git(['merge-base', '--is-ancestor', snapshot.sourceRevision, 'HEAD']);
} catch {
  fail(`sourceRevision is not a Git commit ancestor of HEAD: ${snapshot.sourceRevision}`);
}

const anchorIssues = [];
for (const entry of snapshot.units) {
  for (const [path, blob] of Object.entries(entry.sourceBlobs)) {
    if (path.split('/').includes('.atlas')) {
      anchorIssues.push(`refusing .atlas source anchor: ${entry.unit.id} -> ${path}`);
      continue;
    }
    if (revisionBlob(snapshot.sourceRevision, path) !== blob) {
      anchorIssues.push(`snapshot revision blob mismatch: ${entry.unit.id} -> ${path}`);
    }
    if (currentBlob(path) !== blob) {
      anchorIssues.push(`current source blob mismatch: ${entry.unit.id} -> ${path}`);
    }
  }
}
if (anchorIssues.length > 0) fail(anchorIssues.sort().join('\n'));

let output;
try {
  output = contract.materializeStaticOwnSnapshot(snapshot);
} catch (error) {
  fail(`compiled Own snapshot contract refused materialization: ${error instanceof Error ? error.message : String(error)}`);
}

const files = [...output.skills, output.coverage];
const seen = new Set();
for (const file of files) {
  if (typeof file?.path !== 'string' || typeof file?.content !== 'string' || !file.path.startsWith(OWN_ROOT)) {
    fail('compiled Own snapshot contract produced invalid output path or content');
  }
  const suffix = file.path.slice(OWN_ROOT.length);
  if (suffix.length === 0 || suffix.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    fail(`compiled Own snapshot contract produced unsafe output path: ${file.path}`);
  }
  if (seen.has(file.path)) fail(`compiled Own snapshot contract produced duplicate output path: ${file.path}`);
  seen.add(file.path);
}

const nonce = `${process.pid}-${randomUUID()}`;
const snapshotTemp = join(dirname(SNAPSHOT_TARGET), `.OWN-SNAPSHOT.json.tmp-${nonce}`);
const snapshotBackup = join(dirname(SNAPSHOT_TARGET), `.OWN-SNAPSHOT.json.bak-${nonce}`);
const skillsParent = dirname(SKILLS_TARGET);
const skillsTemp = join(skillsParent, `.own.tmp-${nonce}`);
const skillsBackup = join(skillsParent, `.own.bak-${nonce}`);

let snapshotBackedUp = false;
let skillsBackedUp = false;
let snapshotInstalled = false;
let skillsInstalled = false;
let transactionError;

try {
  mkdirSync(skillsParent, { recursive: true });
  writeFileSync(snapshotTemp, inputBytes, { flag: 'wx' });
  mkdirSync(skillsTemp);
  for (const file of files) {
    const destination = join(skillsTemp, ...file.path.slice(OWN_ROOT.length).split('/'));
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, file.content, { flag: 'wx' });
  }

  try {
    if (hasPath(SNAPSHOT_TARGET)) {
      renameSync(SNAPSHOT_TARGET, snapshotBackup);
      snapshotBackedUp = true;
    }
    if (hasPath(SKILLS_TARGET)) {
      renameSync(SKILLS_TARGET, skillsBackup);
      skillsBackedUp = true;
    }
    renameSync(snapshotTemp, SNAPSHOT_TARGET);
    snapshotInstalled = true;
    renameSync(skillsTemp, SKILLS_TARGET);
    skillsInstalled = true;
  } catch (replacementError) {
    const rollbackIssues = [];
    try {
      if (snapshotInstalled) rmSync(SNAPSHOT_TARGET, { recursive: true, force: true });
      if (snapshotBackedUp) renameSync(snapshotBackup, SNAPSHOT_TARGET);
    } catch (error) {
      rollbackIssues.push(`snapshot rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      if (skillsInstalled) rmSync(SKILLS_TARGET, { recursive: true, force: true });
      if (skillsBackedUp) renameSync(skillsBackup, SKILLS_TARGET);
    } catch (error) {
      rollbackIssues.push(`skills rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const detail = replacementError instanceof Error ? replacementError.message : String(replacementError);
    throw new Error(`replacement failed: ${detail}${rollbackIssues.length === 0 ? '' : `; ${rollbackIssues.join('; ')}`}`);
  }

  if (snapshotBackedUp) rmSync(snapshotBackup, { recursive: true, force: true });
  if (skillsBackedUp) rmSync(skillsBackup, { recursive: true, force: true });
} catch (error) {
  transactionError = error instanceof Error ? error.message : String(error);
} finally {
  rmSync(snapshotTemp, { recursive: true, force: true });
  rmSync(skillsTemp, { recursive: true, force: true });
}

if (transactionError !== undefined) fail(transactionError);

console.log(`materialize-own-snapshot: wrote ${relative(ROOT, SNAPSHOT_TARGET)} and ${files.length} file(s) under ${relative(ROOT, SKILLS_TARGET)}`);
