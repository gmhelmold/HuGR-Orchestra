import {mkdtempSync,mkdirSync,writeFileSync,appendFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=process.env.ATLAS_ROOT;
if(!root)throw Error('Set ATLAS_ROOT to the built foundation/atlas directory.');
const out=process.env.AUDIT_ROOT;
if(!out)throw Error('Set AUDIT_ROOT to an isolated output directory.');
mkdirSync(join(out,'fixtures'),{recursive:true});mkdirSync(join(out,'evidence'),{recursive:true});
const load=(path)=>import(pathToFileURL(join(root,path)).href);
const {composeRuntime}=await load('packages/adapter-io/dist/src/compose.js');
const {initAst}=await load('packages/adapter-io/dist/src/ast.js');
const {createDurableMemory,memoryLogPath}=await load('packages/adapter-io/dist/src/memory-store.js');
const {createDurableOrientation}=await load('packages/adapter-io/dist/src/orientation-store.js');
const {orientEvent,tok,validateLogbookEntry}=await load('packages/memory/dist/src/index.js');
await initAst();
const results={sha:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,
  scanner:execFileSync('gitleaks',['version'],{encoding:'utf8'}).trim(),cases:[]};
function fixture(name,actor='alice') {
  const dir=mkdtempSync(join(out,'fixtures',name+'-'));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('config','user.email','audit@example.invalid');git('config','user.name','Audit fixture');
  mkdirSync(join(dir,'src'));mkdirSync(join(dir,'.atlas'));
  writeFileSync(join(dir,'src/a.ts'),'export const value = 1;\n');
  writeFileSync(join(dir,'.gitignore'),'.atlas/\n');
  writeFileSync(join(dir,'.atlas/policy.json'),JSON.stringify({t0Heuristic:{keywords:[]},authz:{scopes:{src:[actor]}}}));
  git('add','.');git('commit','-m','Audit fixture');
  process.env.ATLAS_ACTOR=actor;delete process.env.ATLAS_RATIFY_TOKEN;
  return {dir,runtime:composeRuntime(dir)};
}
const rule=(text)=>({rule:text,scope:'src',frecency:1});
const emit=(r,entry)=>r.handler.handle('atlas-memory-emit',{entry});
function saved(dir){const d=createDurableMemory(dir).read();return {count:d.store.length,rejected:d.rejected,rules:d.store.map(r=>r.entry.rule ?? r.entry.prId)};}
for (const mode of ['clean','damaged-terminated','damaged-unterminated']) {
  const {dir,runtime}=fixture('tail-'+mode);
  const first=emit(runtime,rule('Keep the initial fixture rule.'));
  assert.equal(first.ok,true,'valid initial fixture must be admitted');assert.equal(saved(dir).count,1);
  if(mode!=='clean')appendFileSync(memoryLogPath(dir),'{"id":"unfinished'+(mode==='damaged-terminated'?'\n':''));
  const before=saved(dir);
  const second=emit(runtime,rule('Keep the next fixture rule.'));
  const reopened=composeRuntime(dir),after=saved(dir);
  results.cases.push({id:'tail-'+mode,first,second,before,after,
    recall:reopened.memoryRecall({owner:'alice'}).map(r=>r.entry.rule),
    desiredInvariant:second.ok!==true || after.rules.includes('Keep the next fixture rule.'),
    hasFinalNewline:readFileSync(memoryLogPath(dir),'utf8').endsWith('\n')});
}
for(const size of [250,300]) {
  const {dir,runtime}=fixture('retry-'+size),entry=rule(Array(size).fill('word').join(' '));
  const first=emit(runtime,entry),retry=emit(runtime,entry);
  assert.equal(first.ok,true);
  results.cases.push({id:'retry-'+size,firstOK:first.ok,retry,readback:saved(dir),
    activeTokens:runtime.memoryHeader().rules.reduce((n,e)=>n+tok(e),0),
    desiredInvariant:retry.ok===true && saved(dir).count===1});
}
{
  const {dir,runtime}=fixture('archive-cap');
  const entry=rule(Array(100).fill('guidance').join(' '));
  const writes=[];
  for(let frecency=1;frecency<=6;frecency++)writes.push(emit(runtime,{...entry,frecency}));
  const header=runtime.memoryHeader();
  results.cases.push({id:'archive-cap',writes:writes.map(r=>({ok:r.ok,data:r.data,reason:r.reason})),
    durable:saved(dir),activeRules:header.rules.length,activeTokens:header.rules.reduce((n,e)=>n+tok(e),0),
    desiredInvariant:writes.every(r=>r.ok===true) && header.rules.length===1});
}
{
  const {dir,runtime}=fixture('logbook-sections','orch');
  for(const [label,text] of [['valid','s'.repeat(280)],['over','s'.repeat(281)],['empty',''],['blank','   ']]){
    const entry={prId:'fixture-'+label,at:'1',territories:['src'],shipped:text,decisions:'Decision recorded.',
      tradeoffs:'No material tradeoffs.',risks:'No new risks.',openThreads:'None.',links:[]};
    const pure=validateLogbookEntry(entry),actual=emit(runtime,entry);
    const present=createDurableMemory(dir).read().store.some(r=>r.entry.prId===entry.prId);
    results.cases.push({id:'logbook-'+label,pure,actual,present,desiredInvariant:pure.valid || !present});
  }
}
for(const last of ['complete','running']) {
  const {dir}=fixture('orientation-'+last);
  const log=createDurableOrientation(dir);
  const a=orientEvent('state','running');
  log.append('state','running');
  const b=orientEvent('state','blocked',[a.id]);
  log.append('state','blocked',[a.id]);
  const before=log.orientation();
  log.append('state',last,[b.id]);
  const reopened=createDurableOrientation(dir),after=reopened.orientation();
  results.cases.push({id:'orientation-'+last,before,after,expectedState:last,
    physicalLines:readFileSync(reopened.path,'utf8').trim().split('\n').length,
    logicalEvents:reopened.read().log.size,rejected:reopened.read().rejected,desiredInvariant:after.state===last});
}
writeFileSync(join(out,'evidence','memory-round2.json'),JSON.stringify(results,null,2)+'\n');
for(const c of results.cases)console.log(JSON.stringify({id:c.id,desiredInvariant:c.desiredInvariant,
  after:c.after,retryOK:c.retry?.ok,activeRules:c.activeRules,activeTokens:c.activeTokens,present:c.present,pure:c.pure}));
if(process.argv.includes('--assert-invariants') && results.cases.some(c=>c.desiredInvariant===false))process.exitCode=1;
