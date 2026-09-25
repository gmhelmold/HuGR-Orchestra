import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { fixture } from './fixture.mjs';
const base = dirname(dirname(fileURLToPath(import.meta.url)));
const atlas = process.env.ATLAS_AUDIT_ROOT ?? join(base,'repo/foundation/atlas');
const round = process.argv[2] ?? 'first';
const cases=[];
for (const arm of ['advisory','dependency','count','default']) {
  const f=fixture(); const operator=mkdtempSync(join(base,'operator-')); const log=join(operator,'prompts.jsonl');
  const config=join(operator,'model.json');
  writeFileSync(config,JSON.stringify({roles:{propose:{cmd:process.execPath,args:[join(base,'probes/model-standin.mjs'),log]}},timeoutMs:3000}));
  const env={PATH:process.env.PATH,HOME:operator,ATLAS_MODEL_CONFIG:config,ATLAS_MINE_BUDGET:'2'};
  if(arm!=='default') env.ATLAS_MINE_SLOT=arm;
  const run=spawnSync(process.execPath,[join(atlas,'packages/cli/dist/src/bin.js'),'mine','.'],{cwd:f.root,env,encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024});
  const prompts=existsSync(log)?readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x).prompt):[];
  const result={arm,exit:run.status,signal:run.signal,error:run.error?.message,stdout:run.stdout,stderr:run.stderr,prompts:prompts.map(prompt=>({sha256:createHash('sha256').update(prompt).digest('hex'),dependency:prompt.includes('DEPENDS-ON:'),count:prompt.includes('COUNT:'),block:prompt.includes('atlas-fact'),prompt}))};
  cases.push(result);
  console.log(JSON.stringify({arm,exit:result.exit,n:prompts.length,markers:result.prompts.map(p=>[p.dependency,p.count,p.block])}));
}
const normal=cases.find(c=>c.arm==='advisory'), multi=cases.find(c=>c.arm==='default');
const result={product:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,transport:'original compiled CLI with original worker threads',model:'offline abstaining command',index:'controlled SCIP, not external indexer output',cases,defaultAllAdvisory:multi.prompts.length===6&&multi.prompts.every(p=>p.block&&!p.dependency&&!p.count),controls:cases.slice(0,3).map(c=>({arm:c.arm,n:c.prompts.length,exit:c.exit}))};
writeFileSync(join(base,'evidence',`worker-arms-${round}.json`),JSON.stringify(result,null,2)+'\n');
