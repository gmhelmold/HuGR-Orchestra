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
const results = { scope: 'Original CLI/composition; real fixtures; no substituted gates or parser; no model.', parse: {}, movingProducer: {} };
const good = `import { test, expect } from 'vitest';\ntest('checks', () => { expect(1).toBe(1); });\n`;
const bad = `test('syntax error' => {{{ this is not TypeScript\n`;
const vacuous = `import { test } from 'vitest';\ntest('no assertion', () => { work(); });\n`;
for (const [label,files] of [['valid-no-findings',{'src/good.test.ts':good}], ['unparseable-only',{'src/bad.test.ts':bad}], ['mixed',{'src/bad.test.ts':bad,'src/vacuous.test.ts':vacuous}]]) {
  const dir=makeRepo(label,files); const runtime=composeRuntime(dir); const runs=runtime.testVacuity();
  const output=cli(dir,['test-vacuity','.']); results.parse[label]={dir,files,runs,output};
}
assert.equal(results.parse['valid-no-findings'].output.status,2);
assert.equal(results.parse['unparseable-only'].runs[0].admitted,false);
assert.match(results.parse['unparseable-only'].runs[0].reason,/could not be parsed/);
assert.equal(results.parse['unparseable-only'].output.stdout,results.parse['valid-no-findings'].output.stdout);
assert.equal(results.parse.mixed.runs.some(r=>r.admitted===false),true);
assert.equal(results.parse.mixed.output.status,0);
assert.equal(results.parse.mixed.output.stdout.includes('could not be parsed'),false);
const unit='src/pay.ts'; const dir=makeRepo('moving-producer',{[unit]:'export const rate = 1;\n'});
const a=git(dir,'rev-parse','HEAD'); const b=commit(dir,unit,'export const rate = 2;\n','B');
const retained=composeRuntime(dir); const first=retained.transition(unit,a,'HEAD'); assert.equal(first.persisted,true);
const c=commit(dir,unit,'export const rate = 3;\n','C');
const wrong=retained.transition(unit,b,'HEAD');
const fresh=composeRuntime(dir).transition(unit,b,'HEAD');
assert.equal(wrong.admitted,false); assert.equal(fresh.persisted,true);
const pinned=retained.transition(unit,b,c); assert.equal(pinned.persisted,true);
results.movingProducer={dir,unit,a,b,c,first,wrong,fresh,pinned};
writeFileSync(join(out,'evidence/failure-boundaries.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({parse:Object.fromEntries(Object.entries(results.parse).map(([k,v])=>[k,{runs:v.runs.map(r=>({admitted:r.admitted,persisted:r.persisted,reason:r.reason})),exit:v.output.status}])),movingProducer:{retainedAdmitted:wrong.admitted,freshPersisted:fresh.persisted,immutableSHAPersisted:pinned.persisted}},null,2));
