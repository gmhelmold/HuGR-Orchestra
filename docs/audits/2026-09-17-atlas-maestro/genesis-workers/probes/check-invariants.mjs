import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=dirname(dirname(fileURLToPath(import.meta.url)));const round=process.argv[2]??'first';
const read=(name)=>JSON.parse(readFileSync(join(base,'evidence',`${name}-${round}.json`),'utf8'));
const arms=read('worker-arms'), live=read('worker-liveness'), partial=read('partial-publication');
const checks=[];
const check=(id,pass,observed)=>checks.push({id,pass,observed});
for(const arm of ['advisory','dependency','count']){
 const c=arms.cases.find(c=>c.arm===arm);
 check(`control-single-${arm}`,c.exit===0&&c.prompts.length===2&&c.prompts.every(p=>arm==='advisory'?p.block&&!p.dependency&&!p.count:arm==='dependency'?p.dependency:p.count),{exit:c.exit,count:c.prompts.length});
}
const all=arms.cases.find(c=>c.arm==='default');
check('GW01-default-worker-arms-preserved',all.prompts.some(p=>p.dependency)&&all.prompts.some(p=>p.count),{dependency:all.prompts.filter(p=>p.dependency).length,count:all.prompts.filter(p=>p.count).length,total:all.prompts.length});
for(const mode of ['healthy','closed']){const c=live.results.find(c=>c.mode===mode);check(`control-pool-${mode}`,c.status===0&&c.stdout.includes('"returned":true'),{status:c.status});}
const lost=live.results.find(c=>c.mode==='worker-exit');
check('GW02-worker-loss-returns-within-test-bound',lost.status===0&&lost.stdout.includes('"returned":true')&&!lost.errorCode,{status:lost.status,errorCode:lost.errorCode,signal:lost.signal});
for(const mode of ['healthy','refuse-second','throw-second']){
 const c=partial.results.find(c=>c.mode===mode);
 check(mode==='healthy'?'control-staging-report':'GW03-progress-retained-'+mode,c.report.seeded===c.durableRows.length&&c.report.modelCalls===c.proposed&&c.report.coverage.frontier==='planned',{reportedSeeded:c.report.seeded,durableRows:c.durableRows.length,reportedCalls:c.report.modelCalls,proposed:c.proposed,frontier:c.report.coverage.frontier});
}
const result={round,kind:'Desired invariants asserted against independently captured original-runtime observations; not a production fix',passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks};
writeFileSync(join(base,'evidence',`desired-invariants-${round}.json`),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({round,passed:result.passed,failed:result.failed}));process.exitCode=result.failed?1:0;
