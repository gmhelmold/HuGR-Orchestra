import assert from 'node:assert/strict';
import {writeFileSync,unlinkSync,renameSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(process.argv[2]),out=resolve(process.argv[3]);
const load=(pkg,file='index')=>import(pathToFileURL(join(root,'packages',pkg,'dist/src',file+'.js')).href);
const {composeRuntime,initAst}=await load('adapter-io');
const {makeFixtureRepo,runAtlas}=await load('e2e-blackbox','harness');
const {createDiskStore}=await load('adapter-io','store');
for(const k of Object.keys(process.env))if(k.startsWith('ATLAS_'))delete process.env[k];
process.env.ATLAS_ACTOR='audit-controls';process.env.ATLAS_RATIFY_TOKEN='billy';
const policy=JSON.stringify({t0Heuristic:{keywords:[]},authz:{scopes:{src:['audit-controls']}}});
const results=[];await initAst();
function commit(r){execFileSync('git',['-c','commit.gpgsign=false','add','-A'],{cwd:r.repoPath});execFileSync('git',['-c','commit.gpgsign=false','commit','-qm','fixture change'],{cwd:r.repoPath});}
for(const removed of ['src/a.ts','src/b.ts']){
 const r=makeFixtureRepo({policy,files:{'src/a.ts':'export const a = "first unique body";\n','src/b.ts':'export const b = "second unique body";\n'}});
 try{
  const base=r.sha(),rt=composeRuntime(r.repoPath);
  const a=rt.draft({anchor:'src/a.ts',slot:'invariant',claim:'The fixture has two declarations.'});
  const b=rt.draft({anchor:'src/b.ts',slot:'invariant',claim:'The fixture has two declarations.'});
  assert.ok(a.fact&&b.fact);
  const fact={...a.fact,grounding:{entries:[...a.fact.grounding.entries,...b.fact.grounding.entries]}};
  const emit=rt.handler.handle('atlas-emit',{node:fact,at:r.sha()});assert.equal(emit.ok,true);assert.equal(emit.data.emitted,true);
  unlinkSync(join(r.repoPath,removed));commit(r);
  const fresh=composeRuntime(r.repoPath);const doctor=fresh.doctorSource.drift(emit.data.nodeKey);
  const cli=runAtlas(r.repoPath,['reconcile',base]);
  const invalidBase=runAtlas(r.repoPath,['reconcile','no-such-audit-base']);
  assert.equal(doctor.class,'semantic');assert.equal(cli.exitCode,0);assert.equal(invalidBase.exitCode,1);
  results.push({case:'two-anchors-delete',removed,doctor,cli,invalidBase});
 }finally{r.cleanup();}
}
const symbol='scip-typescript npm fixture 1 src/a.ts/a.';
const r=makeFixtureRepo({policy,files:{'src/a.ts':'export const a = 1;\n','src/b.ts':"import { a } from './a';\nexport const b = a;\n"},index:[{path:'src/a.ts',defines:[symbol]},{path:'src/b.ts',references:[symbol]}]});
try{
 const retained=composeRuntime(r.repoPath);const created=retained.deriveRelations();
 const cliAfterPublication=runAtlas(r.repoPath,['verify-store']);assert.equal(cliAfterPublication.exitCode,0);assert.match(cliAfterPublication.stdout,/1 sealed-proven fact/);
 const refreshed=composeRuntime(r.repoPath);const disk=createDiskStore(join(r.repoPath,'.atlas/cas'));
 const rows=[...disk.loadProjection().current.values()].filter(x=>x.seal==='proven');assert.equal(rows.length,1);
 const row=rows[0];unlinkSync(join(r.repoPath,'.atlas/cas',row.contentHash.slice(0,2),row.contentHash));
 const cliAfterLoss=runAtlas(r.repoPath,['verify-store']);assert.equal(cliAfterLoss.exitCode,2);assert.match(cliAfterLoss.stdout,/1 dangling/);
 const old=refreshed.reverify();assert.equal(old.sealedProven,2);
 results.push({case:'fresh-cli-verification-controls',created,cliAfterPublication,cliAfterLoss,reused:old});
}finally{r.cleanup();}
writeFileSync(out,JSON.stringify({productSHA:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',results},null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({case:x.case,removed:x.removed,cliExit:x.cli?.exitCode,invalidBaseExit:x.invalidBase?.exitCode,publicationExit:x.cliAfterPublication?.exitCode,lossExit:x.cliAfterLoss?.exitCode}))));
