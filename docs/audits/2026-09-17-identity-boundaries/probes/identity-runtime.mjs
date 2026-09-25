import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2]);
const repository = resolve(process.env.HUGR_AUDIT_REPO ?? join(out, 'repo'));
const atlas = join(repository, 'foundation/atlas');
mkdirSync(join(out, 'fixtures'), { recursive: true });
mkdirSync(join(out, 'evidence'), { recursive: true });
const mod = (name) => import(pathToFileURL(join(atlas, 'packages', name, 'dist/src/index.js')).href);
const { composeRuntime, initAst } = await mod('adapter-io');
const { createRevIndex } = await import(pathToFileURL(join(atlas, 'packages/adapter-io/dist/src/rev-index.js')).href);
const { parseTsDoc } = await import(pathToFileURL(join(atlas, 'packages/adapter-io/dist/src/ast.js')).href);
const { scanTestVacuity } = await import(pathToFileURL(join(atlas, 'packages/adapter-io/dist/src/test-vacuity.js')).href);
const { createDiskStore } = await import(pathToFileURL(join(atlas, 'packages/adapter-io/dist/src/store.js')).href);
await initAst();
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
function makeRepo(label, files) {
  const dir = mkdtempSync(join(out, 'fixtures', label + '-'));
  git(dir, 'init', '-q'); git(dir, 'config', 'user.name', 'Atlas audit fixture');
  git(dir, 'config', 'user.email', 'audit@example.invalid'); git(dir, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, '.gitignore'), '.atlas/\n');
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(resolve(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), bytes);
  }
  git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'fixture initial');
  mkdirSync(join(dir, '.atlas'));
  writeFileSync(join(dir, '.atlas/policy.json'), JSON.stringify({ t0Heuristic: { keywords: [] }, authz: { scopes: { src: ['seat:owner'] } } }));
  return dir;
}
function commit(dir, path, bytes, label) {
  writeFileSync(join(dir, path), bytes); git(dir, 'add', path); git(dir, 'commit', '-qm', label);
  return git(dir, 'rev-parse', 'HEAD');
}
function cli(dir, args) {
  const result = spawnSync(process.execPath, [join(atlas, 'packages/cli/dist/src/bin.js'), ...args], { cwd: dir, env: process.env, encoding: 'utf8', timeout: 60000 });
  if (result.error) throw result.error;
  return { args, status: result.status, stdout: result.stdout, stderr: result.stderr };
}
function transitionCase(label, values) {
  const unit = 'src/pay.ts';
  const dir = makeRepo(label, { [unit]: `export const rate = ${values[0]};\n` });
  const revs = [git(dir, 'rev-parse', 'HEAD')];
  for (let i = 1; i < values.length; i++) revs.push(commit(dir, unit, `export const rate = ${values[i]};\n`, `state-${i}`));
  const steps = [];
  for (let i = 1; i < revs.length; i++) {
    const production = cli(dir, ['transition', unit, revs[i-1], revs[i]]);
    assert.equal(production.status, 0, production.stdout + production.stderr);
    const read = composeRuntime(dir).transitions(unit);
    steps.push({ before: revs[i-1], after: revs[i], production, read, current: read.filter(r => r.authoring === 'TRANSITIONED').length });
  }
  const readCLI = cli(dir, ['transitions', unit]); assert.equal(readCLI.status, 0);
  return { dir, unit, values, revs, steps, readCLI, worktrees: git(dir, 'worktree', 'list', '--porcelain') };
}
const result = { scope: 'Original built Atlas code; real Git/filesystem/WASM/governed persistence; controlled fixtures; no LLM calls.', transitions: {}, testVacuity: {}, movingRev: {} };
for (const [label, values] of [['linear',[1,2,3]],['revert',[1,2,1]],['reapply',[1,2,1,2]]]) {
  result.transitions[label] = transitionCase(label, values);
}
assert.equal(result.transitions.linear.steps.at(-1).current, 1);
assert.equal(result.transitions.revert.steps.at(-1).current, 0);
assert.equal(result.transitions.reapply.steps.at(-1).current, 0);
assert.equal(result.transitions.reapply.steps.at(-1).read.length, 2);

const catchTest = (name) => `test('${name}', () => { try { work(); } catch (e) { expect(e).toBeDefined(); } });`;
const noAssertion = (name) => `test('${name}', () => { work(); });`;
for (const [label, names, reversed] of [['unique',['left','right'],false], ['same',['same','same'],false], ['same-reversed',['same','same'],true]]) {
  const pieces = [`describe('left-suite', () => { ${catchTest(names[0])} });`, `describe('right-suite', () => { ${noAssertion(names[1])} });`];
  if (reversed) pieces.reverse();
  const bytes = `import { describe, test, expect } from 'vitest';\n${pieces.join('\n')}\n`;
  const unit = 'src/example.test.ts'; const dir = makeRepo('tv-'+label, { [unit]: bytes });
  const parsed = parseTsDoc(unit, bytes); assert.ok(parsed);
  let scanned; try { scanned = scanTestVacuity(parsed.root); } finally { parsed.dispose(); }
  assert.equal(scanned.length, 2);
  const production = cli(dir, ['test-vacuity', '.']); assert.equal(production.status, 0, production.stdout + production.stderr);
  const runtime = composeRuntime(dir); const read = runtime.testVacuities(unit);
  const store = createDiskStore(join(dir, '.atlas/cas'));
  const projection = store.loadProjection();
  const rows = [...projection.current.values()].filter(r => r.family === 'test-vacuity');
  const readCLI = cli(dir, ['test-vacuities', unit]); assert.equal(readCLI.status, 0);
  result.testVacuity[label] = { dir, unit, bytes, scanned, production, read, rows, stored: rows.map(r => store.get(r.contentHash)), readCLI };
}
assert.equal(result.testVacuity.unique.read.length, 2);
assert.equal(result.testVacuity.same.read.length, 1);
assert.equal(result.testVacuity['same-reversed'].read.length, 1);
assert.notEqual(result.testVacuity.same.read[0].shape, result.testVacuity['same-reversed'].read[0].shape);

const movingDir = makeRepo('moving-rev', { 'src/pay.ts': 'export const rate = 1;\n' });
const rev1 = git(movingDir, 'rev-parse', 'HEAD');
const index = createRevIndex(movingDir);
const before = index.resolveAnchorAt('HEAD', 'src/pay.ts');
const rev2 = commit(movingDir, 'src/pay.ts', 'export const rate = 2;\n', 'advance head');
const retained = index.resolveAnchorAt('HEAD', 'src/pay.ts');
const fresh = createRevIndex(movingDir).resolveAnchorAt('HEAD', 'src/pay.ts');
const pinned = index.resolveAnchorAt(rev2, 'src/pay.ts');
assert.equal(before.subtreeHash, retained.subtreeHash);
assert.notEqual(before.subtreeHash, fresh.subtreeHash);
assert.equal(fresh.subtreeHash, pinned.subtreeHash);
result.movingRev = { dir:movingDir, rev1, rev2, before, retained, fresh, pinned };
writeFileSync(join(out, 'evidence/identity-runtime.json'), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify({
  transitions: Object.fromEntries(Object.entries(result.transitions).map(([k,v]) => [k, { admitted:v.steps.length, rows:v.steps.at(-1).read.length, current:v.steps.at(-1).current }])),
  testVacuity: Object.fromEntries(Object.entries(result.testVacuity).map(([k,v]) => [k, { scanned:v.scanned.length, delivered:v.read.length, shapes:v.read.map(r=>r.shape) }])),
  movingRefReturnsPriorState: before.subtreeHash === retained.subtreeHash && retained.subtreeHash !== fresh.subtreeHash
}, null, 2));
