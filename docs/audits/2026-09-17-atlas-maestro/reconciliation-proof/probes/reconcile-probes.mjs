import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const load = (pkg, file = 'index') => import(pathToFileURL(join(root, 'packages', pkg, 'dist/src', `${file}.js`)).href);
const { composeRuntime, initAst } = await load('adapter-io');
const { createDiskStore } = await load('adapter-io', 'store');
const { makeFixtureRepo, runAtlas, mcpSession } = await load('e2e-blackbox', 'harness');
for (const key of Object.keys(process.env)) if (key.startsWith('ATLAS_')) delete process.env[key];
process.env.ATLAS_ACTOR = 'reconcile-audit';
process.env.ATLAS_RATIFY_TOKEN = 'billy';
process.env.GIT_CONFIG_COUNT = '2';
process.env.GIT_CONFIG_KEY_0 = 'core.hooksPath'; process.env.GIT_CONFIG_VALUE_0 = '/dev/null';
process.env.GIT_CONFIG_KEY_1 = 'commit.gpgsign'; process.env.GIT_CONFIG_VALUE_1 = 'false';
const policy = JSON.stringify({t0Heuristic:{keywords:[]},authz:{scopes:{src:['reconcile-audit']}}});
const symbol = 'scip-typescript npm audit 1 src/provider.ts/value.';
const content = 'export const value = "unique original value";\n';
function fixture(indexed = false) {
 return makeFixtureRepo({policy, files:{'src/provider.ts':content,'src/consumer.ts':"import { value } from './provider';\nexport const readValue = () => value;\n"},
  ...(indexed ? {index:[{path:'src/provider.ts',defines:[symbol]},{path:'src/consumer.ts',references:[symbol]}]} : {})});
}
function git(repo, ...args) { return execFileSync('git', ['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(); }
function commit(repo) { git(repo,'add','-A'); git(repo,'commit','-qm','controlled source change'); }
function store(repo) { return createDiskStore(join(repo,'.atlas','cas')); }
function emit(runtime, repo, anchor='src/provider.ts') {
 const draft = runtime.draft({anchor,slot:'invariant',claim:'The provider declares the original value.'});
 assert.ok(draft.fact,JSON.stringify(draft));
 const result = runtime.handler.handle('atlas-emit',{node:draft.fact,at:repo.sha()});
 assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(result.data.emitted,true,JSON.stringify(result));
 return {fact:draft.fact,result:result.data};
}
function projection(repo) { return store(repo).loadProjection(); }
function digestFiles(path) {
 const rows=[];
 function walk(dir, prefix='') {
  for (const ent of readdirSync(dir,{withFileTypes:true})) {
   const rel=join(prefix,ent.name), absolute=join(dir,ent.name);
   if(ent.isDirectory()) walk(absolute,rel);
   else if(ent.isFile()) rows.push([rel,createHash('sha256').update(readFileSync(absolute)).digest('hex')]);
  }
 }
 walk(path); return rows.sort(([a],[b])=>a.localeCompare(b));
}
async function mcall(s,name,args) {
 const raw=await s.client.callTool({name,arguments:args});
 const text=raw.content.find(x=>x.type==='text')?.text; assert.ok(text);
 return {isError:raw.isError===true,body:JSON.parse(text)};
}
const results=[];
async function probe(id,fn){
 try { results.push({id,status:'confirmed-observation',...await fn()}); }
 catch(error) { results.push({id,status:'probe-error',error:error.stack}); }
 writeFileSync(output,JSON.stringify({sha:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',root,node:process.version,results},null,2)+'\n');
 const item=results.at(-1); console.log(JSON.stringify({id,status:item.status,summary:item.summary,error:item.error}));
}
await initAst();
await probe('REC-01-deleted-citation-versus-rename-and-rewrite',async()=>{
 const cases=[];
 for(const change of ['unchanged','rename','rewrite','delete']){
  const repo=fixture(); let session;
  try {
   const base=repo.sha(); const written=emit(composeRuntime(repo.repoPath),repo);
   if(change==='rename') renameSync(join(repo.repoPath,'src/provider.ts'),join(repo.repoPath,'src/moved.ts'));
   if(change==='rewrite') writeFileSync(join(repo.repoPath,'src/provider.ts'),'export const value = "different body";\n');
   if(change==='delete') unlinkSync(join(repo.repoPath,'src/provider.ts'));
   if(change!=='unchanged')commit(repo.repoPath);
   const fresh=composeRuntime(repo.repoPath);
   const drift=fresh.doctorSource.drift(written.result.nodeKey);
   const reconcile=fresh.handler.handle('atlas-reconcile',{mergeBase:base});
   const cli=runAtlas(repo.repoPath,['reconcile',base]);
   session=await mcpSession(repo.repoPath); const mcp=await mcall(session,'atlas-reconcile',{mergeBase:base});
   cases.push({change,base,head:repo.sha(),nodeKey:written.result.nodeKey,drift,reconcile,cli,mcp});
   assert.equal(reconcile.ok,true,JSON.stringify(reconcile));
   assert.equal(cli.exitCode, change==='rewrite'?2:0);
   assert.equal(mcp.body.data.exitCode,change==='rewrite'?2:0);
   if(change==='delete'){assert.equal(drift.class,'semantic');assert.deepEqual(reconcile.data.semantic,[]);}
   if(change==='rename'){assert.equal(drift.class,'mechanical');assert.equal(reconcile.data.mechanical.length,1);}
  } finally {await session?.close();repo.cleanup();}
 }
 return {cases,summary:'Fresh CLI and fresh MCP both return a clean reconcile for a deleted sole citation; rewrite blocks, rename is mechanical, unchanged stays clean.'};
});
await probe('REC-02-accept-reground-reports-without-publication',async()=>{
 const repo=fixture();let session;
 try {
  const base=repo.sha();const written=emit(composeRuntime(repo.repoPath),repo);
  renameSync(join(repo.repoPath,'src/provider.ts'),join(repo.repoPath,'src/moved.ts'));commit(repo.repoPath);
  const before=digestFiles(join(repo.repoPath,'.atlas'));
  const reportOnly=runAtlas(repo.repoPath,['reconcile',base]);
  const accepted=runAtlas(repo.repoPath,['reconcile',base,'--accept-reground']);
  const afterCLI=digestFiles(join(repo.repoPath,'.atlas'));
  session=await mcpSession(repo.repoPath);
  const mcp=await mcall(session,'atlas-reconcile',{mergeBase:base,options:{acceptReground:true}});
  const afterMCP=digestFiles(join(repo.repoPath,'.atlas'));
  const reopened=composeRuntime(repo.repoPath); const stillDrifted=reopened.doctorSource.drift(written.result.nodeKey);
  const recorded=store(repo.repoPath).get(written.result.id);
  assert.equal(accepted.exitCode,0);assert.match(accepted.stdout,/regroundedCount:\s*1/);
  assert.equal(mcp.body.data.regroundedCount,1);assert.deepEqual(afterCLI,before);assert.deepEqual(afterMCP,before);
  assert.equal(stillDrifted.class,'mechanical');assert.equal(recorded.grounding.entries[0].anchor.qualifiedPath,'src/provider.ts');
  return {reportOnly,accepted,mcp,before,afterCLI,afterMCP,stillDrifted,recordedAnchors:recorded.grounding.entries,
   summary:'Both public transports report regroundedCount=1; every .atlas file is byte-identical and the original citation remains drifted after reopening.'};
 }finally{await session?.close();repo.cleanup();}
});
await probe('DOC-01-semantic-retire-plan-fails-own-write-door',async()=>{
 const repo=fixture();let session;
 try {
  const written=emit(composeRuntime(repo.repoPath),repo);
  writeFileSync(join(repo.repoPath,'src/provider.ts'),'export const value = "different body";\n');commit(repo.repoPath);
  const runtime=composeRuntime(repo.repoPath);const plan=runtime.doctorSource.plan(written.result.nodeKey);
  assert.equal(plan.action,'retire');assert.equal(plan.emit.authoring,'SUPERSEDED');
  const before=digestFiles(join(repo.repoPath,'.atlas'));
  const check=runtime.check(plan.emit,repo.sha());
  const emitResult=runtime.handler.handle('atlas-emit',{node:plan.emit,at:repo.sha()});
  session=await mcpSession(repo.repoPath);const mcp=await mcall(session,'atlas-emit',{node:plan.emit,at:repo.sha()});
  assert.equal(emitResult.ok,false,JSON.stringify(emitResult));assert.equal(mcp.isError,true);
  assert.match(JSON.stringify(emitResult),/ungrounded/);assert.deepEqual(digestFiles(join(repo.repoPath,'.atlas')),before);
  const stillPresent=projection(repo.repoPath).current.has(written.result.nodeKey);
  assert.equal(stillPresent,true);
  const positiveControl=emit(runtime,repo,'src/consumer.ts');
  return {plan,check,emitResult,mcp,stillPresent,positiveControl:positiveControl.result,
   summary:'Doctor recommends retiring semantic drift, but its exact payload is rejected as ungrounded by the governed door; authorized fresh writing still succeeds.'};
 }finally{await session?.close();repo.cleanup();}
});
await probe('VER-01-new-proof-is-invisible-to-composed-reverify',()=>{
 const repo=fixture(true);
 try {
  const runtime=composeRuntime(repo.repoPath);const before=runtime.reverify();
  const derived=runtime.deriveRelations(); const current=projection(repo.repoPath);
  const count=[...current.current.values()].filter(n=>n.seal==='proven').length;
  assert.ok(count>0,JSON.stringify(derived));
  const same=runtime.reverify();const fresh=composeRuntime(repo.repoPath).reverify();
  assert.equal(before.sealedProven,0);assert.equal(same.sealedProven,0);assert.equal(fresh.sealedProven,count);assert.equal(fresh.reProven,count);
  return {head:repo.sha(),indexSHA256:createHash('sha256').update(readFileSync(join(repo.repoPath,'.atlas/index.scip'))).digest('hex'),before,derived,count,same,fresh,
   summary:'With unchanged source and SCIP, original deriveRelations publishes proven facts invisible to the same runtime reverify; fresh runtime sees and proves them.'};
 }finally{repo.cleanup();}
});
await probe('VER-02-mixed-snapshot-double-counts-pruned-proof',()=>{
 const repo=fixture(true);
 try {
  const derived=composeRuntime(repo.repoPath).deriveRelations();
  const runtime=composeRuntime(repo.repoPath);const before=runtime.reverify();
  assert.ok(before.reProven>0,JSON.stringify(derived));
  const rows=[...projection(repo.repoPath).current.values()].filter(n=>n.seal==='proven');assert.equal(rows.length,1);
  const row=rows[0];unlinkSync(join(repo.repoPath,'.atlas/cas',row.contentHash.slice(0,2),row.contentHash));
  const same=runtime.reverify();const fresh=composeRuntime(repo.repoPath).reverify();
  assert.equal(same.sealedProven,2);assert.equal(same.reProven,1);assert.equal(same.dangling,1);
  assert.equal(fresh.sealedProven,1);assert.equal(fresh.reProven,0);assert.equal(fresh.dangling,1);
  return {before,row,same,fresh,summary:'One pruned proven row is counted both re-proven and dangling by the reused runtime; fresh runtime correctly counts it once as dangling.'};
 }finally{repo.cleanup();}
});
await probe('DOC-02-wrong-shard-cas-object-reports-sound',async()=>{
 const repo=fixture();let session;
 try {
  const runtime=composeRuntime(repo.repoPath);const written=emit(runtime,repo);
  const before=runtime.doctorSource.casAudit();assert.equal(before.sound,true);
  const hash=written.result.id;const cas=join(repo.repoPath,'.atlas/cas');const wrong=hash.startsWith('00')?'01':'00';
  const bytes=readFileSync(join(cas,hash.slice(0,2),hash));mkdirSync(join(cas,wrong),{recursive:true});
  renameSync(join(cas,hash.slice(0,2),hash),join(cas,wrong,hash));
  assert.equal(store(repo.repoPath).get(hash),undefined);
  const after=composeRuntime(repo.repoPath).doctorSource.casAudit();
  const cli=runAtlas(repo.repoPath,['doctor','cas']);
  session=await mcpSession(repo.repoPath);const mcp=await mcall(session,'atlas-doctor',{sub:'cas'});
  assert.equal(after.sound,true);assert.deepEqual(after.missing,[]);
  assert.equal(cli.exitCode,0);assert.match(cli.stdout,/sound[^\n]*true/);
  assert.equal(mcp.isError,false,JSON.stringify(mcp));
  const unchanged=bytes.equals(readFileSync(join(cas,wrong,hash)));assert.equal(unchanged,true);
  return {hash,expectedShard:hash.slice(0,2),actualShard:wrong,before,after,cli,mcp,unchanged,
   summary:'An intact blob at the wrong shard is unreachable by the actual store but doctor cas reports sound=true, no missing objects, through CLI and MCP.'};
 }finally{await session?.close();repo.cleanup();}
});
if(results.some(r=>r.status==='probe-error'))process.exitCode=1;
