import assert from 'node:assert/strict';
import {writeFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=realpathSync(process.argv[2]),output=process.argv[3];
const {makeFixtureRepo,mcpSession}=await import(pathToFileURL(join(root,'packages/e2e-blackbox/dist/src/harness.js')).href);
process.env.ATLAS_ACTOR='orch';delete process.env.ATLAS_RATIFY_TOKEN;
const repo=makeFixtureRepo({files:{'src/value.ts':'export const value=1;\n'}});
const sessions=[];const rounds=[];let error;
async function call(s,name,args){const r=await s.client.callTool({name,arguments:args});return {isError:r.isError===true,body:JSON.parse(r.content.find(x=>x.type==='text').text)};}
try {
 sessions.push(await mcpSession(repo.repoPath));sessions.push(await mcpSession(repo.repoPath));
 for(let round=0;round<3;round++) {
  const prId=`concurrent-pr-${round}`;
  const base={prId,at:'2026-09-17',territories:['src'],shipped:'A verified change.',decisions:'A decision.',tradeoffs:'A tradeoff.',risks:'A risk.',openThreads:'None.',links:[]};
  const writes=await Promise.all(sessions.map((s,i)=>call(s,'atlas-memory-emit',{entry:{...base,decisions:`Independent writer ${i} recorded its decision.`}})));
  const read=await call(sessions[0],'atlas-memory-recall',{kind:'logbook',prId});
  const sequential=await call(sessions[0],'atlas-memory-emit',{entry:{...base,decisions:'Later sequential write.'}});
  assert.equal(sequential.isError,true);
  rounds.push({round,writes,recordCount:read.body.data.length,sequentialControl:sequential,uniquenessViolated:read.body.data.length>1});
 }
} catch(e) {error=e.stack;} finally {for(const s of sessions)await s.close();repo.cleanup();}
const result={commit:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',runtime:process.version,transport:'two original MCP stdio server processes, actual gitleaks; no synchronization seam substituted',rounds,...(error?{error}:{})};
writeFileSync(join(output,'memory-concurrency.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({observed:rounds.map(r=>({round:r.round,successes:r.writes.filter(w=>!w.isError).length,recordCount:r.recordCount,uniquenessViolated:r.uniquenessViolated})),error}));
if(error)process.exitCode=1;
