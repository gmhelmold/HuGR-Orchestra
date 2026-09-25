import {writeFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=realpathSync(process.argv[2]);const evidence=process.argv[3];
const {makeFixtureRepo,mcpSession}=await import(pathToFileURL(join(root,'packages/e2e-blackbox/dist/src/harness.js')).href);
process.env.ATLAS_ACTOR='audit@example.invalid';delete process.env.ATLAS_RATIFY_TOKEN;
const policy=JSON.stringify({t0Heuristic:{keywords:[]},authz:{scopes:{src:['audit@example.invalid']}}});
const results=[];
async function call(session,name,args){
 const result=await session.client.callTool({name,arguments:args});
 const text=result.content.find(x=>x.type==='text')?.text;
 assert.ok(text,`No text from ${name}`);
 return {isError:result.isError===true,body:JSON.parse(text)};
}
async function run(id,fn){try{const result=await fn();results.push({id,outcome:'observed',...result});console.log(JSON.stringify(results.at(-1)));}catch(e){results.push({id,outcome:'experiment-error',error:e.stack});console.error(e.stack);}}
await run('MCP-frozen-axes-current-watermark',async()=>{
 const repo=makeFixtureRepo({files:{'src/f0.ts':'export const value0 = 0;\n'},policy});let session;
 try{
  const oldRev=repo.sha();session=await mcpSession(repo.repoPath);
  const draft=await call(session,'atlas-draft',{anchor:'src/f0.ts',slot:'invariant',claim:'The value0 is zero.'});
  assert.equal(draft.isError,false,JSON.stringify(draft));
  const fact=draft.body.data.fact;
  const control=await call(session,'atlas-check',{fact,at:oldRev});assert.equal(control.body.data.wouldEmit,true,JSON.stringify(control));
  const newRev=repo.commit({'src/f0.ts':'export const value0 = 987;\n'});
  const emit=await call(session,'atlas-emit',{node:fact,at:newRev});
  const oldQuery=await call(session,'atlas-query',{scope:'src'});
  await session.close();session=await mcpSession(repo.repoPath);
  const freshQuery=await call(session,'atlas-query',{scope:'src'});
  const freshCheck=await call(session,'atlas-check',{fact,at:newRev});
  assert.equal(emit.isError,false,JSON.stringify(emit));
  assert.equal(oldQuery.body.data.pack.stale,false);
  assert.equal(oldQuery.body.data.pack.advisory[0].freshness,'FRESH');
  assert.equal(freshQuery.body.data.pack.advisory[0].freshness,'STALE');
  assert.equal(freshCheck.body.data.wouldEmit,false);
  return {oldRev,newRev,control,emit,oldQuery,freshQuery,freshCheck,defectReproduced:true};
 }finally{await session?.close();repo.cleanup();}
});
await run('MCP-invisible-hit-promotion',async()=>{
 const files=Object.fromEntries(Array.from({length:6},(_,i)=>[`src/f${i}.ts`,`export const value${i} = ${i};\n`]));
 const repo=makeFixtureRepo({files,policy});let session;
 try{
  session=await mcpSession(repo.repoPath);const keys=[];
  for(let i=0;i<6;i++){
   const draft=await call(session,'atlas-draft',{anchor:`src/f${i}.ts`,slot:'invariant',claim:`Fixture claim ${i}. `.padEnd(450,'x')});
   const emit=await call(session,'atlas-emit',{node:draft.body.data.fact,at:repo.sha()});assert.equal(emit.isError,false,JSON.stringify(emit));keys.push(String(emit.body.data.nodeKey));
  }
  const sequence=[];
  for(let i=1;i<=9;i++){const query=await call(session,'atlas-query',{scope:'src'});assert.equal(query.isError,false);const p=query.body.data.pack;sequence.push({query:i,governing:p.invariants.map(x=>x.nodeId),advisory:p.advisory.map(x=>x.nodeId),dropped:p.advisoryDropped});}
  const undelivered=keys.filter(k=>sequence.slice(0,8).every(x=>!x.governing.includes(k)&&!x.advisory.includes(k)));
  assert.equal(undelivered.length,2);assert.ok(undelivered.every(k=>sequence[8].governing.includes(k)));
  return {sequence,undelivered,defectReproduced:true};
 }finally{await session?.close();repo.cleanup();}
});
await run('MCP-abstention-unrelated-emit-loss',async()=>{
 const repo=makeFixtureRepo({files:{'src/f0.ts':'export const value0 = 0;\n'},policy});let session;
 try{
  session=await mcpSession(repo.repoPath);
  const node={kind:'negation',id:'ignored',tier:'T2',relationKind:'calls',target:'local 4',scope:'src',grounding:{entries:[]},edgeModel:'ignored',freshness:'FRESH',claims:[],authoring:'NEGATED'};
  const abstain=await call(session,'atlas-emit',{node,at:repo.sha()});assert.equal(abstain.isError,true);
  const before=await call(session,'atlas-negations',{scope:'src'});
  const draft=await call(session,'atlas-draft',{anchor:'src/f0.ts',slot:'invariant',claim:'value0 exists.'});
  const emit=await call(session,'atlas-emit',{node:draft.body.data.fact,at:repo.sha()});assert.equal(emit.isError,false);
  await session.close();session=await mcpSession(repo.repoPath);
  const after=await call(session,'atlas-negations',{scope:'src'});
  return {abstain,before,emit,after};
 }finally{await session?.close();repo.cleanup();}
});
writeFileSync(join(evidence,'mcp-probes.json'),JSON.stringify({commit:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,transport:'original MCP stdio subprocess + original SDK client',results},null,2)+'\n');
if(results.some(x=>x.outcome==='experiment-error'))process.exitCode=1;
