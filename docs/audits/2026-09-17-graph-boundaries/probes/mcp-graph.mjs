import assert from 'node:assert/strict';
import {writeFileSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=realpathSync(resolve(process.argv[2]));
const out=resolve(process.argv[3]);
const load=(pkg,file='index')=>import(pathToFileURL(join(root,'packages',pkg,'dist/src',file+'.js')).href);
const {makeFixtureRepo,mcpSession,runAtlas}=await load('e2e-blackbox','harness');
const {initAst,composeRuntime}=await load('adapter-io');
const {build,nodeHashOfPath}=await load('index','build');
const {createDepgraph}=await load('index','depgraph');
const {walkFileTree}=await load('adapter-io','fs');
const {readScip}=await load('adapter-io','scip');
const {deriveGroundingAxes}=await load('adapter-io','grounding-computer');
const results=[];
process.env.ATLAS_ACTOR='graph-audit';process.env.ATLAS_RATIFY_TOKEN='billy';
const policy=JSON.stringify({t0Heuristic:{keywords:[]},authz:{scopes:{src:['graph-audit']}}});
const key=p=>p.split('/').map(x=>x.replaceAll('%','%25').replaceAll(':','%3A')).join('/');
function fixture(provider='src/provider.ts',consumer='src/consumer.ts',unknown=false){
 const symbol='scip-typescript npm audit 1 value.';
 const files={[provider]:'export const value = 1;\n',[consumer]:`import { value } from './${provider.split('/').at(-1).replace('.ts','')}';\nexport const readValue = () => value;\n`};
 const repo=makeFixtureRepo({files,policy,index:[{path:provider,defines:[symbol]},{path:consumer,references:[symbol,...(unknown?['unknown/target.']:[])]}]});
 return {...repo,provider,consumer};
}
async function call(s,name,args){
 const res=await s.client.callTool({name,arguments:args});
 const text=res.content.find(x=>x.type==='text')?.text;assert.ok(text);
 return {isError:res.isError===true,body:JSON.parse(text)};
}
async function emit(s,r,anchor,claim){
 const d=await call(s,'atlas-draft',{anchor,slot:'invariant',claim});assert.equal(d.isError,false,JSON.stringify(d));
 const e=await call(s,'atlas-emit',{node:d.body.data.fact,at:r.sha()});assert.equal(e.isError,false,JSON.stringify(e));return e.body.data.nodeKey;
}
async function query(s,scope,by='dependency'){const q=await call(s,'atlas-query',{scope,by});assert.equal(q.isError,false,JSON.stringify(q));return q;}
function ids(q){const p=q.body.data.pack;return [...p.invariants,...p.advisory??[]].map(x=>x.nodeId);}
function find(n,key){if(n.key===key)return n;for(const c of n.children){const m=find(c,key);if(m)return m;}}
async function probe(id,fn){try{const data=await fn();results.push({id,status:'observation-confirmed',...data});}catch(e){results.push({id,status:'probe-error',error:e.stack});}console.log(JSON.stringify(results.at(-1)));}
await initAst();
await probe('MCP-GRAPH-01-root-without-own-fact',async()=>{
 const r=fixture();let s;
 try{
  s=await mcpSession(r.repoPath);const dependent=await emit(s,r,r.consumer,'Consumer imports provider.');
  const scoped=await query(s,'src','scope');assert.ok(ids(scoped).includes(dependent));
  const before=await query(s,r.provider);assert.deepEqual(ids(before),[]);
  await s.close();s=await mcpSession(r.repoPath);
  const restarted=await query(s,r.provider);assert.deepEqual(ids(restarted),[]);
  await emit(s,r,r.provider,'Provider exports value.');const after=await query(s,r.provider);assert.ok(ids(after).includes(dependent));
  return {dependent,scoped,before,restarted,after,defect:true};
 }finally{await s?.close();r.cleanup();}
});
await probe('MCP-GRAPH-02-canonical-file-identities',async()=>{
 const observations=[];
 for(const [provider,consumer] of [['src/provider.ts','src/consumer.ts'],['src/provider%value.ts','src/consumer.ts'],['src/provider:value.ts','src/consumer.ts'],['src/provider.ts','src/consumer%value.ts']]){
  const r=fixture(provider,consumer);let s;
  try{
   s=await mcpSession(r.repoPath);await emit(s,r,key(provider),'Provider exports value.');const dependent=await emit(s,r,key(consumer),'Consumer imports provider.');
   const scoped=await query(s,'src','scope');assert.ok(ids(scoped).includes(dependent));
   const canonical=await query(s,key(provider));const raw=await query(s,provider);
   observations.push({provider,consumer,canonicalTarget:key(provider),dependent,scopedIDs:ids(scoped),canonical,raw});
  }finally{await s?.close();r.cleanup();}
 }
 assert.ok(ids(observations[0].canonical).includes(observations[0].dependent));
 for(const x of observations.slice(1))assert.ok(!ids(x.canonical).includes(x.dependent));
 return {observations,defect:true};
});
await probe('MCP-GRAPH-03-subfile-fact',async()=>{
 const r=fixture();let s;
 try{
  const a=deriveGroundingAxes(walkFileTree(r.repoPath),readScip(join(r.repoPath,'.atlas/index.scip'))).axes;
  const anchor=find(a.spatial,r.consumer).children[0].key;
  s=await mcpSession(r.repoPath);await emit(s,r,r.provider,'Provider exports value.');
  const symbol=await emit(s,r,anchor,'Consumer symbol uses imported value.');const file=await emit(s,r,r.consumer,'Consumer file imports provider.');
  const scope=await query(s,'src','scope');assert.ok(ids(scope).includes(symbol));assert.ok(ids(scope).includes(file));
  const dep=await query(s,r.provider);assert.ok(ids(dep).includes(file));assert.ok(!ids(dep).includes(symbol));
  await s.close();s=await mcpSession(r.repoPath);const reopened=await query(s,r.provider);assert.ok(!ids(reopened).includes(symbol));
  return {anchor,symbol,file,scope,dep,reopened,defect:true};
 }finally{await s?.close();r.cleanup();}
});
await probe('MCP-GRAPH-06-coverage-erased',async()=>{
 const observations=[];
 for(const unknown of [false,true]){
  const r=fixture('src/provider.ts','src/consumer.ts',unknown);let s;
  try{
   const a=build(walkFileTree(r.repoPath),readScip(join(r.repoPath,'.atlas/index.scip')));
   const closure=createDepgraph(a.edges).reverseClosure(nodeHashOfPath(r.provider));assert.equal(closure.underApprox,unknown);
   s=await mcpSession(r.repoPath);await emit(s,r,r.provider,'Provider exports value.');const dependent=await emit(s,r,r.consumer,'Consumer imports provider.');
   const response=await query(s,r.provider);assert.ok(ids(response).includes(dependent));
   const own=composeRuntime(r.repoPath).own('src');
   observations.push({unknown,closure,response,own,serializedCoverageFieldPresent:/"(?:underApprox|coverage|incomplete|coChanged)"\s*:/.test(JSON.stringify(response))});
  }finally{await s?.close();r.cleanup();}
 }
 assert.equal(observations[1].serializedCoverageFieldPresent,false);
 return {observations,classification:'Read completeness metadata lost; success for known facts need not be forbidden, but partial coverage must stay observable.'};
});
writeFileSync(out,JSON.stringify({sha:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,transport:'original MCP stdio server and original SDK via repository harness',indexInput:'controlled minimal SCIP protobuf, not actual scip-typescript output',results},null,2)+'\n');
if(results.some(x=>x.status==='probe-error'))process.exitCode=1;
