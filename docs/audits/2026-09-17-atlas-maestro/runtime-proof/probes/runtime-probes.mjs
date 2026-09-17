import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=realpathSync(resolve(process.argv[2]));
const evidence=resolve(process.argv[3]);
const load=(pkg,file='index')=>import(pathToFileURL(join(root,'packages',pkg,'dist/src',file+'.js')).href);
const {composeRuntime,initAst}=await load('adapter-io');
const {createDiskStore,rehydrateProjection}=await load('adapter-io','store');
const {upsert,emptyStore,negationKey}=await load('knowledge');
const {parseOwnSnapshot,exportOwnSnapshot,materializeStaticOwnSnapshot,verifyStaticOwnSnapshot}=await load('retrieval','own-snapshot');
const {materializeStaticOwn}=await load('retrieval','own-artifact');
const fixtures=[];
const results=[];
const git=(dir,...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture(n=2){
 const dir=mkdtempSync(join(tmpdir(),'hugr-proof-'));fixtures.push(dir);
 mkdirSync(join(dir,'src'));mkdirSync(join(dir,'.atlas'));
 writeFileSync(join(dir,'.gitignore'),'.atlas/\n');
 for(let i=0;i<n;i++)writeFileSync(join(dir,`src/f${i}.ts`),`export const value${i} = ${i};\n`);
 writeFileSync(join(dir,'.atlas/policy.json'),JSON.stringify({t0Heuristic:{keywords:[]},authz:{scopes:{src:['audit@example.invalid']}}}));
 git(dir,'init');git(dir,'config','user.name','Atlas audit');git(dir,'config','user.email','audit@example.invalid');
 git(dir,'add','.');git(dir,'commit','-m','audit fixture');return dir;
}
function runtime(dir,token){
 process.env.ATLAS_ACTOR='audit@example.invalid';
 if(token===undefined)delete process.env.ATLAS_RATIFY_TOKEN;else process.env.ATLAS_RATIFY_TOKEN=token;
 return composeRuntime(dir);
}
function emit(rt,dir,fact){return rt.handler.handle('atlas-emit',{node:fact,at:git(dir,'rev-parse','HEAD')});}
function pack(rt){const out=rt.handler.handle('atlas-query',{scope:'src'});assert.equal(out.ok,true,JSON.stringify(out));return out.data.pack;}
function rows(dir){return rehydrateProjection(createDiskStore(join(dir,'.atlas/cas')));}
async function probe(id,fn){try{const result=await fn();results.push({id,outcome:'observed',...result});console.log(JSON.stringify(results.at(-1)));}catch(e){results.push({id,outcome:'experiment-error',error:e.stack});console.error(id,e.stack);}}
await initAst();
await probe('ATL-001-upsert-all-routes',()=>{
 const rec={kind:'abstained',id:'abstention-a',relationKind:'calls',target:'scip:X#',scope:'src',reason:'scope-open',witness:{underApproxSources:['src/f0.ts']}};
 const seed={current:new Map([['old',{nodeKey:'old',family:'advisory',contentHash:'h-old',claims:['old']}]]),cas:new Set(['h-old']),abstained:new Map([[rec.id,rec]]),builtAt:'revision'};
 const requests=[{nodeKey:'new',contentHash:'h-new',family:'advisory',claimNorm:'new'},{nodeKey:'old',contentHash:'h-next',family:'advisory',claimNorm:'next'},{nodeKey:'old',contentHash:'h-pred',family:'predicate',claimNorm:'predicate'},{nodeKey:'old',contentHash:'h-old',family:'advisory',claimNorm:'old'}];
 const outcomes=requests.map(req=>{const out=upsert(seed,req);return {route:out.decision,retained:out.store.abstained?.size??0,builtAt:out.store.builtAt??null};});
 assert.deepEqual(outcomes.map(x=>x.route),['CREATE','UPDATE','SUPERSEDE','DEDUP']);assert.equal(seed.abstained.size,1);
 return {outcomes,inputUnmodified:true,defectReproduced:outcomes.every(x=>x.retained===0)};
});
await probe('ATL-001-real-handler-durable-loss',()=>{
 const dir=fixture();const rt=runtime(dir,'billy');
 const neg={kind:'negation',id:'ignored',tier:'T2',relationKind:'calls',target:'local 4',scope:'src',grounding:{entries:[]},edgeModel:'ignored',freshness:'FRESH',claims:[],authoring:'NEGATED'};
 const abstain=emit(rt,dir,neg);assert.equal(abstain.ok,false);assert.equal(rows(dir).abstained?.size,1,JSON.stringify(abstain));
 const fact=rt.draft({anchor:'src/f0.ts',slot:'invariant',claim:'Fixture value0 is exported.'}).fact;
 const emitted=emit(rt,dir,fact);assert.equal(emitted.ok,true,JSON.stringify(emitted));
 const after=rows(dir);return {abstainReason:abstain.rejected,before:1,emit:emitted.data,afterReopen:after.abstained?.size??0,defectReproduced:(after.abstained?.size??0)===0};
});
await probe('ATL-002-real-handler-invisible-hit-promotion',()=>{
 const dir=fixture(6);const rt=runtime(dir);
 const keys=[];
 for(let i=0;i<6;i++){
  const draft=rt.draft({anchor:`src/f${i}.ts`,slot:'invariant',claim:(`Fixture claim ${i}. `).padEnd(450,'x')});
  const out=emit(rt,dir,draft.fact);assert.equal(out.ok,true,JSON.stringify(out));keys.push(String(out.data.nodeKey));
 }
 const sequence=[];
 for(let i=1;i<=9;i++){const p=pack(rt);sequence.push({query:i,governing:p.invariants.map(x=>String(x.nodeId)),advisory:p.advisory.map(x=>String(x.nodeId)),advisoryDropped:p.advisoryDropped});}
 const absent=keys.filter(k=>!sequence[0].advisory.includes(k));
 const neverDeliveredBeforeNine=absent.filter(k=>sequence.slice(0,8).every(s=>!s.advisory.includes(k)&&!s.governing.includes(k)));
 const promotedWithoutDelivery=neverDeliveredBeforeNine.filter(k=>sequence[8].governing.includes(k));
 return {sequence,neverDeliveredBeforeNine,promotedWithoutDelivery,storedTiers:[...rows(dir).current.values()].map(x=>x.tier),defectReproduced:promotedWithoutDelivery.length>0};
});
await probe('OWN-003-real-gotcha-freshness',()=>{
 const dir=fixture();const rt=runtime(dir,'billy');
 for(const slot of ['invariant','gotcha']){
  const fact={...rt.draft({anchor:'src/f0.ts',slot,claim:`Original value for ${slot}.`}).fact,tier:'T1'};
  const out=emit(rt,dir,fact);assert.equal(out.ok,true,JSON.stringify(out));
 }
 const before=rt.own('src').pack;
 writeFileSync(join(dir,'src/f0.ts'),'export const value0 = 999;\n');git(dir,'add','src/f0.ts');git(dir,'commit','-m','change grounded source');
 const fresh=runtime(dir,'billy');const after=fresh.own('src').pack;const queried=pack(fresh);
 return {before:{invariants:before.invariants.map(x=>x.freshness),gotchas:before.gotchas.map(x=>x.freshness)},after:{invariants:after.invariants.map(x=>x.freshness),gotchas:after.gotchas.map(x=>x.freshness)},query:queried.invariants.map(x=>({claim:x.claim,freshness:x.freshness})),defectReproduced:after.invariants.some(x=>x.freshness==='DRIFTED')&&after.gotchas.some(x=>x.freshness==='FRESH')};
});
await probe('NEW-runtime-stale-axes-current-watermark',()=>{
 const dir=fixture();const rt=runtime(dir);
 const old=rt.draft({anchor:'src/f0.ts',slot:'invariant',claim:'The original value0 is zero.'});
 const oldRev=git(dir,'rev-parse','HEAD');
 writeFileSync(join(dir,'src/f0.ts'),'export const value0 = 987;\n');git(dir,'add','src/f0.ts');git(dir,'commit','-m','advance HEAD after runtime build');
 const newRev=git(dir,'rev-parse','HEAD');const out=emit(rt,dir,old.fact);const sameProcess=pack(rt);
 const rebuilt=runtime(dir);const freshProcess=pack(rebuilt);const freshCheck=rebuilt.check(old.fact,newRev);
 return {oldRev,newRev,oldDraftRev:old.rev,emit:out,sameProcess,freshProcess,freshCheck,defectReproduced:out.ok===true&&sameProcess.stale===false&&sameProcess.advisory.some(x=>x.freshness==='FRESH')&&freshProcess.advisory.some(x=>x.freshness!=='FRESH')};
});
await probe('NEW-draft-provenance-route-parity',()=>{
 const dir=fixture();const rt=runtime(dir);
 const draft=rt.draft({anchor:'src/f0.ts',slot:'invariant',claim:'Fixture value0 is exported.'});
 const check=rt.check(draft.fact,draft.rev);const out=emit(rt,dir,draft.fact);
 return {draftRoute:draft.route,requires:draft.requires,returnedFactProvenance:draft.fact.provenance??null,check,emit:out,ratifyTokenPresent:false,defectReproduced:draft.route==='full-ratify'&&out.ok===true};
});
function snapshotFor(dir){const s=JSON.parse(readFileSync(join(root,'OWN-SNAPSHOT.json'),'utf8'));s.snapshot='audit-real-kernel';s.sourceRevision=git(dir,'rev-parse','HEAD');const entry=s.units[0];entry.unit={level:'module',id:'src',grounding:null};entry.sourceBlobs={'src/f0.ts':git(dir,'hash-object','src/f0.ts')};entry.pack.unit='Fixture src owns exported constants.';entry.pack.shape.contents=['src/f0.ts'];return s;}
for(const mode of ['control','dangling','malformed-predicate','stale-source'])await probe('OWN-scripts-'+mode,()=>{
 const dir=fixture();const s=snapshotFor(dir);
 if(mode==='dangling')s.units[0].pack.drill.finer=[{level:'module',id:'missing/unit',grounding:null}];
 if(mode==='malformed-predicate')s.units[0].pack.gotchas=[{id:'bad-check',kind:'predicate',tier:'T1',freshness:'FRESH',check:{expr:'valid expression without required discriminant'}}];
 const input=join(dir,'reviewed.json');writeFileSync(input,JSON.stringify(s));
 const parsed=parseOwnSnapshot(JSON.stringify(s));assert.ok(parsed);
 const projected=materializeStaticOwnSnapshot(exportOwnSnapshot({snapshot:s.snapshot,sourceRevision:s.sourceRevision,units:s.units}));
 const pure=verifyStaticOwnSnapshot(s,[...projected.skills,projected.coverage],p=>git(dir,'hash-object',p));
 const env={...process.env,OWN_SNAPSHOT_MATERIALIZE_IMPL:join(root,'packages/retrieval/dist/src/own-snapshot.js'),OWN_SNAPSHOT_GUARD_IMPL:join(root,'packages/retrieval/dist/src/own-snapshot.js'),OWN_SNAPSHOT_GUARD_ROOT:dir};
 const materialize=spawnSync(process.execPath,[join(root,'scripts/materialize-own-snapshot.mjs'),input],{cwd:dir,env,encoding:'utf8'});
 assert.equal(materialize.status,0,materialize.stderr);assert.ok(existsSync(join(dir,'OWN-SNAPSHOT.json')),'materializer actually executed');
 if(mode==='stale-source')writeFileSync(join(dir,'src/f0.ts'),'export const value0 = 555;\n');
 const guard=spawnSync(process.execPath,[join(root,'harness/gates/own-snapshot-guard.mjs')],{cwd:dir,env,encoding:'utf8'});
 return {pure,materialize:{status:materialize.status,stdout:materialize.stdout,stderr:materialize.stderr},guard:{status:guard.status,stdout:guard.stdout,stderr:guard.stderr},rendersUndefined:projected.skills[0].content.includes(': undefined'),drill:s.units[0].pack.drill.finer.map(x=>x.id),realKernel:true,defectReproduced:(mode==='dangling'||mode==='malformed-predicate')&&guard.status===0};
});
await probe('OWN-005-final-payload-budget',()=>{
 const dir=fixture(350);const rt=runtime(dir);const p=rt.own('src').pack;
 return {files:350,estimate:p.tokenEstimate,packUtf8Bytes:Buffer.byteLength(JSON.stringify(p)),terrainEntries:p.shape.contents.length,explicitFiner:p.drill.finer.length,manifest:p.manifest,claim:'Serialized size is measured in bytes; no exact model token count is claimed.'};
});

await probe('NEW-draft-provenance-negative-control',()=>{
 const dir=fixture();const rt=runtime(dir);const d=rt.draft({anchor:'src/f0.ts',slot:'invariant',claim:'Fixture value0 is exported.'});
 const explicit={...d.fact,provenance:{source:'atlas-draft',trusted:false}};
 const denied=emit(rt,dir,explicit);const accepted=emit(rt,dir,d.fact);
 assert.equal(denied.ok,false);assert.ok(denied.rejected.includes('unratified'));assert.equal(accepted.ok,true);
 return {declaredProvenanceRefused:denied,omittedProvenanceAccepted:accepted,defectReproduced:true};
});
await probe('NEW-check-closed-slot-parity',()=>{
 const dir=fixture();const rt=runtime(dir);const d=rt.draft({anchor:'src/f0.ts',slot:'invariant',claim:'Fixture value0 is exported.'});
 const invalid={...d.fact,predicateSlot:'unknown-audit-slot'};
 const validCheck=rt.check(d.fact,d.rev);const check=rt.check(invalid,d.rev);const out=emit(rt,dir,invalid);
 return {validControl:validCheck,check,emit:out,rowsAfter:rows(dir).current.size,defectReproduced:check.wouldEmit===true&&out.ok===false};
});
await probe('ATL-003-contested-wiring',async()=>{
 const {route}=await load('knowledge');const dir=fixture();const rt=runtime(dir);
 const a=rt.draft({anchor:'src/f0.ts',slot:'invariant',claim:'Claim A at this anchor.'}).fact;
 const b=rt.draft({anchor:'src/f0.ts',slot:'invariant',claim:'Different claim B at this anchor.'}).fact;
 assert.equal(emit(rt,dir,a).ok,true);const prior=[...rows(dir).current.values()][0];
 const view={...b,slot:b.predicateSlot};const explicitContested=route(view,{lowRisk:true,contested:true,derivedTier:'T2'});
 const check=rt.check(b,git(dir,'rev-parse','HEAD'));const emitted=emit(rt,dir,b);const after=[...rows(dir).current.values()][0];
 return {explicitContested,check,emit:emitted,contentChanged:prior.contentHash!==after.contentHash,claimUnion:after.claims,classification:'Wiring/contract conflict, not proof all different claims are semantically contradictory.'};
});
await probe('NEW-materializer-symlink-entrypoint',()=>{
 const dir=fixture();const s=snapshotFor(dir);const input=join(dir,'reviewed.json');writeFileSync(input,JSON.stringify(s));
 const alias=join(dir,'atlas-alias');symlinkSync(root,alias,'dir');
 const env={...process.env,OWN_SNAPSHOT_MATERIALIZE_IMPL:join(root,'packages/retrieval/dist/src/own-snapshot.js')};
 const aliased=spawnSync(process.execPath,[join(alias,'scripts/materialize-own-snapshot.mjs'),input],{cwd:dir,env,encoding:'utf8'});
 const aliasInstalled=existsSync(join(dir,'OWN-SNAPSHOT.json'));
 const canonical=spawnSync(process.execPath,[join(root,'scripts/materialize-own-snapshot.mjs'),input],{cwd:dir,env,encoding:'utf8'});
 const canonicalInstalled=existsSync(join(dir,'OWN-SNAPSHOT.json'));
 return {aliased:{status:aliased.status,stdout:aliased.stdout,stderr:aliased.stderr,installed:aliasInstalled},canonical:{status:canonical.status,stdout:canonical.stdout,stderr:canonical.stderr,installed:canonicalInstalled},defectReproduced:aliased.status===0&&!aliasInstalled&&canonical.status===0&&canonicalInstalled};
});

const report={commit:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,platform:process.platform,arch:process.arch,realKernel:true,originalCompiledProduct:true,results};
writeFileSync(join(evidence,'runtime-probes.json'),JSON.stringify(report,null,2)+'\n');
for(const dir of fixtures)rmSync(dir,{recursive:true,force:true});
if(results.some(x=>x.outcome==='experiment-error'))process.exitCode=1;
