import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=realpathSync(resolve(process.argv[2]));
const load=(pkg,file)=>import(pathToFileURL(join(root,'packages',pkg,'dist/src',file+'.js')).href);
const {composeRuntime}=await load('adapter-io','compose');
const {initAst}=await load('adapter-io','ast');
const {loadPolicy,anchorOwner,actorInScope}=await load('adapter-io','policy');
const results=[];
const git=(dir,...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture(policy){
 const dir=realpathSync(mkdtempSync('/private/tmp/atlas-own-metadata-'));
 mkdirSync(join(dir,'src/payments'),{recursive:true});mkdirSync(join(dir,'.atlas'));
 writeFileSync(join(dir,'.gitignore'),'.atlas/\n');writeFileSync(join(dir,'src/payments/a.ts'),'export const value = 1;\n');
 writeFileSync(join(dir,'.atlas/policy.json'),JSON.stringify({t0Heuristic:{keywords:[]},authz:policy}));
 git(dir,'init');git(dir,'config','user.name','Audit fixture');git(dir,'config','user.email','audit@example.invalid');git(dir,'add','.');git(dir,'commit','-m','initial');return dir;
}
function runtime(dir,actor='alice'){process.env.ATLAS_ACTOR=actor;process.env.ATLAS_RATIFY_TOKEN=actor;return composeRuntime(dir);}
function put(r,dir,anchor,slot,claim,scope){
 const d=r.draft({anchor,slot,claim});if(scope)d.fact.scope=scope;
 const v=r.handler.handle('atlas-emit',{node:d.fact,at:git(dir,'rev-parse','HEAD')});
 assert.equal(v.ok,true,JSON.stringify(v));assert.equal(v.data.emitted,true,JSON.stringify(v));return v;
}
await initAst();
for(const mode of ['path-control','logical-owner','misleading-path-fallback']){
 const policy=mode==='path-control'?{scopes:{src:['alice']}}:{scopes:{core:['alice'],payments:['bob'],...(mode==='misleading-path-fallback'?{src:['alice']}:{})},anchors:{src:'core','src/payments':'payments'}};
 const dir=fixture(policy);const r=runtime(dir,mode==='path-control'?'alice':'bob');const scope=mode==='path-control'?'src':'payments';
 const emitted=put(r,dir,'src/payments/a.ts','invariant','The fixture exports value.',scope);
 const parsed=loadPolicy(dir);const owner=anchorOwner(parsed,'src/payments/a.ts');const reported=r.own('src/payments').pack.shape.owner;
 results.push({id:mode,reportedOwner:reported,policyScope:owner??'unbound',policyMembers:parsed.authz.scopes[owner??'src'],authorizedActor:actorInScope(parsed,mode==='path-control'?'alice':'bob',scope),emitted:emitted.data.emitted});
}
const dir=fixture({scopes:{src:['alice']}});let r=runtime(dir);
put(r,dir,'src/payments/a.ts','definition','The fixture value is one.');
const before=r.own('src/payments').pack;
writeFileSync(join(dir,'src/payments/a.ts'),'export const value = 2;\n');git(dir,'add','src');git(dir,'commit','-m','value changed');r=runtime(dir);
const after=r.own('src/payments').pack;
results.push({id:'role-currentness',beforeRole:before.unit,afterRole:after.unit,afterBands:{invariants:after.invariants,advisory:after.advisory},classification:'unannotated role read differs from stale band verdict; no assertion static exporter accepts this pack'});
assert.equal(results[0].reportedOwner,'alice');assert.equal(results[1].reportedOwner,'');assert.equal(results[2].reportedOwner,'alice');assert.deepEqual(results[2].policyMembers,['bob']);assert.equal(after.unit,before.unit);assert.ok(after.advisory.every(x=>x.freshness!=='FRESH'));
writeFileSync(resolve(process.argv[3]),JSON.stringify({sha:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',root,node:process.version,results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
