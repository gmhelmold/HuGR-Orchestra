import assert from 'node:assert/strict';
import { appendFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=realpathSync(process.argv[2]); const output=process.argv[3];
const { makeFixtureRepo, mcpSession, runAtlas }=await import(pathToFileURL(join(root,'packages/e2e-blackbox/dist/src/harness.js')).href);
const {createDurableMemory}=await import(pathToFileURL(join(root,'packages/adapter-io/dist/src/memory-store.js')).href);
const results=[];
const task=(id)=>({taskId:id,attempted:['read source'],failedWith:[],stoppedAt:'checkpoint',lesson:'Use the checked source.'});
async function call(s,name,args={}) {const r=await s.client.callTool({name,arguments:args});const text=r.content.find(x=>x.type==='text')?.text;assert.ok(text);return {isError:r.isError===true,body:JSON.parse(text)};}
async function story(id,actor,fn) {process.env.ATLAS_ACTOR=actor;delete process.env.ATLAS_RATIFY_TOKEN;const repo=makeFixtureRepo({files:{'src/value.ts':'export const value=1;\n'}});const state={session:undefined};try {state.session=await mcpSession(repo.repoPath);const result=await fn(repo,state);results.push({id,status:'observation-verified',...result});}catch(e){results.push({id,status:'experiment-error',error:e.stack});}finally{await state.session?.close();repo.cleanup();}console.log(JSON.stringify(results.at(-1)));}
await story('MCP-MEM-R3-01-acknowledged-torn-tail-loss','audit',async(repo,state)=>{
 const s=state.session;const first=await call(s,'atlas-memory-emit',{entry:task('before')});assert.equal(first.isError,false,JSON.stringify(first));
 appendFileSync(join(repo.repoPath,'.atlas/memory.jsonl'),'{"id":"unfinished');
 const second=await call(s,'atlas-memory-emit',{entry:task('after')});assert.equal(second.isError,false,JSON.stringify(second));
 await s.close();state.session=await mcpSession(repo.repoPath);
 const recall=await call(state.session,'atlas-memory-recall',{kind:'task'});const low=createDurableMemory(repo.repoPath).read();
 assert.deepEqual(recall.body.data.map(x=>x.entry.taskId),['before']);assert.equal(low.rejected,1);
 const third=await call(state.session,'atlas-memory-emit',{entry:task('next')}); assert.equal(third.isError,false); const nextRead=await call(state.session,'atlas-memory-recall',{kind:'task'}); assert.deepEqual(nextRead.body.data.map(x=>x.entry.taskId),['before','next']); return {first,acknowledgedSecond:second,afterProcessRestart:recall,lowLevelRejected:low.rejected,third,nextRead,defectReproduced:true};
});
await story('MCP-MEM-R3-02-corruption-read-status','audit',async(repo,state)=>{
 const first=await call(state.session,'atlas-memory-emit',{entry:task('present')});assert.equal(first.isError,false);
 appendFileSync(join(repo.repoPath,'.atlas/memory.jsonl'),'{incomplete-line}\n');
 const mcp=await call(state.session,'atlas-memory-recall',{taskId:'missing'});assert.equal(mcp.isError,false);assert.deepEqual(mcp.body.data,[]);assert.equal('rejected' in mcp.body,false);
 const cli=runAtlas(repo.repoPath,['memory-recall','--task-id','missing']); assert.equal(cli.exitCode,0); assert(cli.stdout.includes('the durable log holds nothing that matches yet'));
 return {lowLevelRejected:createDurableMemory(repo.repoPath).read().rejected,mcp,cli,defectReproduced:true,cliQualification:'correct --task-id selector; successful empty verdict and misleading no-match guidance asserted'};
});
await story('MCP-MEM-R3-03-current-rule-vs-history-cap','audit',async(repo,state)=>{
 const rule=Array(80).fill('check').join(' ');const emitted=[];
 for(let frecency=1;frecency<=7;frecency++){const r=await call(state.session,'atlas-memory-emit',{entry:{rule,scope:'src',frecency}});emitted.push({version:frecency,...r});}
 assert(emitted.slice(0,6).every(x=>!x.isError));assert.equal(emitted[6].isError,true);
 const header=await call(state.session,'atlas-memory-header');assert.equal(header.isError,false);assert.equal(header.body.data.rules.length,1);
 return {emitted,header,defectReproduced:true};
});
await story('MCP-MEM-R3-06-logbook-section-parity','orch',async(repo,state)=>{
 const base={prId:'pr-a',at:'2026-09-17',territories:['src'],shipped:'x'.repeat(281),decisions:'chosen',tradeoffs:'cost',risks:'risk',openThreads:'none',links:[]};
 const oversize=await call(state.session,'atlas-memory-emit',{entry:base});assert.equal(oversize.isError,false,JSON.stringify(oversize));
 const empty=await call(state.session,'atlas-memory-emit',{entry:{...base,prId:'pr-b',shipped:''}});assert.equal(empty.isError,false,JSON.stringify(empty));
 await state.session.close();state.session=await mcpSession(repo.repoPath);
 const recall=await call(state.session,'atlas-memory-recall',{kind:'logbook'});assert.equal(recall.body.data.length,2);
 return {oversize,empty,afterRestart:recall,defectReproduced:true};
});
const scannerVersion=execFileSync('gitleaks',['version'],{encoding:'utf8'}).trim();
writeFileSync(join(output,'memory-mcp.json'),JSON.stringify({commit:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,platform:process.platform,transport:'original MCP binary, SDK client, real stdio child process',scanner:{name:'gitleaks',version:scannerVersion,substituted:false},results},null,2)+'\n');
if(results.some(x=>x.status==='experiment-error'))process.exitCode=1;
