import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdtempSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=dirname(dirname(fileURLToPath(import.meta.url)));const round=process.argv[2]??'first';
const results=[];
for(const mode of ['healthy','closed','worker-exit']){
 const args=mode==='worker-exit'?['--import',join(base,'probes/worker-exit-preload.mjs')]:[];
 args.push(join(base,'probes/pool-child.mjs'),mode);
 const t=Date.now();const r=spawnSync(process.execPath,args,{cwd:mkdtempSync(join(base,'liveness-')),env:{PATH:process.env.PATH,HOME:base},timeout:6000,encoding:'utf8',maxBuffer:1024*1024});
 results.push({mode,durationMs:Date.now()-t,status:r.status,signal:r.signal,errorCode:r.error?.code,stdout:r.stdout,stderr:r.stderr});
 console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(join(base,'evidence',`worker-liveness-${round}.json`),JSON.stringify({product:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,originalPool:true,fault:'worker-only exit(23) via inherited Node preload',watchdogMs:6000,results},null,2)+'\n');
