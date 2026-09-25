import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const repo = resolve(process.argv[2]);
const mod = (p) => import(pathToFileURL(join(repo, 'foundation/atlas/packages', p, 'dist/src/index.js')).href);
const { id } = await mod('kernel');
const { upsert, emptyStore } = await mod('knowledge');
const { createDiskStore } = await import(pathToFileURL(join(repo, 'foundation/atlas/packages/adapter-io/dist/src/store.js')).href);
const { createAwarenessStore, realAtlasRoot } = await import(pathToFileURL(join(repo, 'foundation/atlas/packages/adapter-io/dist/src/awareness-store.js')).href);
const { makeAwarenessMemo } = await mod('memory');
const dir = mkdtempSync(join(tmpdir(), 'atlas-aware-boundary-'));
try {
  execFileSync('git', ['init','-q',dir]);
  writeFileSync(join(dir,'.gitignore'), '.atlas/\n');
  writeFileSync(join(dir,'CONVENTIONS.md'), '# Fixture conventions\n');
  execFileSync('git',['-C',dir,'add','.']);
  execFileSync('git',['-C',dir,'-c','user.name=Audit Fixture','-c','user.email=audit@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-qm','fixture']);
  const store = createDiskStore(join(dir,'.atlas','cas'));
  const seed = (key, claim) => {
    const req = { nodeKey:key, contentHash:id({key,claim}), family:'advisory', claimNorm:claim, tier:'T0' };
    store.persistProjection(upsert(store.loadProjection() ?? emptyStore(), req).store);
  };
  seed('claim:aaa','First fixture invariant');
  const service = createAwarenessStore(dir);
  const first = service.assembleForWave(['fixture-seat']);
  const unchanged = service.assembleForWave(['fixture-seat']);
  seed('claim:zzz','Second fixture invariant');
  const afterAdd = service.assembleForWave(['fixture-seat']);
  const coldAfterAdd = service.read();
  seed('claim:zzz','Second fixture invariant revised');
  const afterSecondaryChange = service.assembleForWave(['fixture-seat']);
  const coldAfterSecondaryChange = service.read();
  seed('claim:aaa','First fixture invariant revised');
  const afterPrimaryChange = service.assembleForWave(['fixture-seat']);
  const coldAfterPrimaryChange = service.read();
  const memo = makeAwarenessMemo();
  memo.assemble(realAtlasRoot(dir));
  const unrelated = memo.assemble(realAtlasRoot(dir,{bump:'unrelated'}));
  const sameSources = (a,b) => JSON.stringify(a.grounding) === JSON.stringify(b.grounding) && a.content === b.content;
  const checks = {
    unchangedCacheHit: unchanged.receipt.reRolls === 0,
    unrelatedRootCacheHit: unrelated.receipt.reRolls === 0,
    secondaryAdditionInvalidates: sameSources(afterAdd.awareness.constitution,coldAfterAdd.constitution),
    secondaryRevisionInvalidates: sameSources(afterSecondaryChange.awareness.constitution,coldAfterSecondaryChange.constitution),
    primaryRevisionInvalidates: sameSources(afterPrimaryChange.awareness.constitution,coldAfterPrimaryChange.constitution),
  };
  console.log(JSON.stringify({ productRevision:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',
    boundary:'Original durable adapter/reducer/kernel; T0 rows fixture-seeded using original upsert, NOT a live governance or automatic wave test',
    first,unchanged,afterAdd,coldAfterAdd,afterSecondaryChange,coldAfterSecondaryChange,afterPrimaryChange,coldAfterPrimaryChange,checks },null,2));
  process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
} finally { rmSync(dir,{recursive:true,force:true}); }
