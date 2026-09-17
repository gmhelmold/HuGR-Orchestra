import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = realpathSync(resolve(process.argv[2]));
const out = realpathSync(resolve(process.argv[3]));
const load = (pkg, file='index') => import(pathToFileURL(join(root, 'packages',pkg,'dist/src',file+'.js')).href);
const { createDurableMemory } = await load('adapter-io','memory-store');
const { createMemoryEmit } = await load('adapter-io','memory-emit');
const { createMemoryRead } = await load('adapter-io','memory-read');
const { createDurableOrientation } = await load('adapter-io','orientation-store');
const { memoryRecallVerdict, memoryOrientationVerdict } = await load('adapter-io','memory-verdicts');
const { orientEvent, validateLogbookEntry, capGate } = await load('memory');
const scanner = { name:'audit-synthetic-clean', scan:()=>false };
const results = [];
const fixture = (name) => mkdtempSync(join(out, name+'-'));
const task = (id,lesson) => ({taskId:id, attempted:['checked source'],failedWith:[],stoppedAt:'checkpoint',lesson});
const writer = (store,actor='audit')=>createMemoryEmit({store,actor,scanner});
async function probe(id, fn) {
 try { const details=await fn(); results.push({id,status:'observation-verified',...details}); }
 catch(e) { results.push({id,status:'experiment-error',error:String(e.stack)}); }
 console.log(JSON.stringify(results.at(-1)));
}
await probe('MEM-R3-01-torn-tail-next-append',()=>{
 const dir=fixture('torn'); const store=createDurableMemory(dir); const door=writer(store);
 assert.equal(door.emit(task('before','before tear')).ok,true);
 appendFileSync(store.path,'{"id":"unfinished');
 const accepted=door.emit(task('after','accepted after tear')); assert.equal(accepted.ok,true);
 const reread=createDurableMemory(dir).read();
 assert.equal(reread.rejected,1); assert.deepEqual(reread.store.map(x=>x.entry.taskId),['before']);
 const acceptedNext=door.emit(task('next','subsequent record')); assert.equal(acceptedNext.ok,true);
 const recovered=createDurableMemory(dir).read(); assert.deepEqual(recovered.store.map(x=>x.entry.taskId),['before','next']);
 const controlDir=fixture('terminated-corrupt'); const control=createDurableMemory(controlDir); const c=writer(control);
 assert.equal(c.emit(task('before','control')).ok,true); appendFileSync(control.path,'{"id":"unfinished\n');
 assert.equal(c.emit(task('after','control')).ok,true);
 const controlRead=createDurableMemory(controlDir).read(); assert.deepEqual(controlRead.store.map(x=>x.entry.taskId),['before','after']);
 return {accepted:accepted.ok,afterReopen:reread.store.map(x=>x.entry.taskId),rejected:reread.rejected,recoveryNext:recovered.store.map(x=>x.entry.taskId),control:controlRead.store.map(x=>x.entry.taskId),defectReproduced:true};
});
await probe('MEM-R3-02-read-hides-rejections',()=>{
 const dir=fixture('hidden-corruption'); const store=createDurableMemory(dir); const door=writer(store);
 assert.equal(door.emit(task('present','readable')).ok,true); appendFileSync(store.path,'{broken-line}\n');
 const raw=store.read(); assert.equal(raw.rejected,1);
 const read=createMemoryRead({store,actor:'audit'});
 const present=memoryRecallVerdict(read.recall,{taskId:'present'});
 const absent=memoryRecallVerdict(read.recall,{taskId:'unreadable'});
 assert.equal(present.ok,true); assert.equal(absent.ok,true); assert.equal(absent.data.length,0);
 assert.equal('rejected' in absent,false);
 const orientation=createDurableOrientation(dir); mkdirSync(join(dir,'.atlas'),{recursive:true}); writeFileSync(orientation.path,'{broken-line}\n');
 assert.equal(orientation.read().rejected,1);
 const orientationVerdict=memoryOrientationVerdict(()=>orientation.orientation()); assert.equal(orientationVerdict.ok,true);
 return {rawRejections:raw.rejected,present,absent,orientationVerdict,defectReproduced:true};
});
await probe('MEM-R3-03-historical-rules-exhaust-cap',()=>{
 const dir=fixture('historical-cap'); const store=createDurableMemory(dir); const door=writer(store);
 const rule=Array(80).fill('check').join(' '); const sequence=[];
 for(let i=1;i<=8;i++) { const entry={rule,scope:'src',frecency:i}; const result=door.emit(entry); sequence.push({version:i,ok:result.ok,refusal:result.refusal,tokens:result.tokens,cap:result.cap}); }
 const slab=createMemoryRead({store,actor:'audit'}).projectSlab();
 const hypothetical=capGate([{rule,scope:'src',frecency:8}],500);
 assert.equal(hypothetical.accepted,true); assert.equal(slab.injected.length,1);
 assert(sequence.some(x=>x.ok===false&&x.refusal==='over-cap'));
 return {sequence,storedVersions:store.read().store.length,injectedRules:slab.injected.length,latestAcceptedFrecency:slab.injected[0].frecency,hypotheticalCurrentSet:hypothetical,defectReproduced:true};
});
await probe('MEM-R3-04-orientation-recurrent-state',()=>{
 const dir=fixture('orient-recurrent'); const store=createDurableOrientation(dir);
 const a=orientEvent('state','running'); const b=orientEvent('state','blocked',[a.id]); const a2=orientEvent('state','running',[b.id]);
 store.append('state','running'); store.append('state','blocked',[a.id]); store.append('state','running',[b.id]);
 const raw=createDurableOrientation(dir).read(); const state=createDurableOrientation(dir).orientation();
 assert.equal(a.id,a2.id); assert.equal(raw.log.size,2); assert.equal(raw.rejected,0); assert.equal(state.state,'blocked');
 const physicalBeforeControl=readFileSync(store.path,'utf8').trim().split('\n').length; store.append('state','completed',[b.id]); const control=createDurableOrientation(dir).orientation(); assert.equal(control.state,'completed');
 return {eventIDs:[a.id,b.id,a2.id],physicalLines:physicalBeforeControl,foldedBeforeControl:raw.log.size,reportedRejections:raw.rejected,stateAfterReturn:state.state,uniqueLabelControl:control.state,defectReproduced:true,exposure:'durable builder; no production state-event producer established'};
});
await probe('MEM-R3-05-spawn-selects-oldest-task-fold',()=>{
 const dir=fixture('old-fold'); const store=createDurableMemory(dir); const door=writer(store);
 for(const lesson of ['old checkpoint','new checkpoint']) assert.equal(door.emit(task('same-task',lesson)).ok,true);
 const read=createMemoryRead({store:createDurableMemory(dir),actor:'audit'}); const found=read.spawnFold({kind:'task',id:'same-task'});
 assert.equal(found.ok,true); assert.equal(found.fold.lesson,'old checkpoint');
 const foreign=createMemoryRead({store,actor:'other'}).spawnFold({kind:'task',id:'same-task'}); assert.equal(foreign.ok,false);
 return {appendOrder:store.read().store.map(x=>x.entry.lesson),returned:found,foreignControl:foreign,defectReproduced:true,exposure:'spawnFold not wired into public runtime; prospective correctness gap'};
});
await probe('MEM-R3-06-logbook-section-policy-parity',()=>{
 const dir=fixture('logbook'); const store=createDurableMemory(dir); const door=writer(store,'orch');
 const base={prId:'pr-a',at:'2026-09-17',territories:['src'],shipped:'shipped',decisions:'chosen',tradeoffs:'cost',risks:'risk',openThreads:'none',links:[]};
 const oversized={...base,shipped:'x'.repeat(281)}; const empty={...base,prId:'pr-b',shipped:''};
 const reference=[oversized,empty].map(e=>validateLogbookEntry(e)); const outcomes=[oversized,empty].map(e=>door.emit(e));
 assert(reference.every(x=>!x.valid)); assert(outcomes.every(x=>x.ok));
 const duplicate=door.emit(base); assert.equal(duplicate.ok,false); assert.equal(duplicate.refusal,'logbook-duplicate');
 return {reference,outcomes:outcomes.map(x=>({ok:x.ok})),durableCount:createDurableMemory(dir).read().store.length,duplicateControl:duplicate,defectReproduced:true};
});
writeFileSync(join(out,'memory-lifecycle.json'),JSON.stringify({base:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',runtime:process.version,platform:process.platform,originalCompiledModules:true,substitutions:['named scanner always clean for synthetic non-secret fixtures; not a scanner evaluation'],results},null,2));
if(results.some(x=>x.status==='experiment-error'))process.exitCode=1;
