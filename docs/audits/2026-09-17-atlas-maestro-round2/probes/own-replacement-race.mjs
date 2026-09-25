import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.ATLAS_ROOT;
if(!root)throw Error('Set ATLAS_ROOT to foundation/atlas.');
const audit=process.env.AUDIT_ROOT;
if(!audit)throw Error('Set AUDIT_ROOT to an isolated output directory.');
mkdirSync(join(audit,'fixtures'),{recursive:true});mkdirSync(join(audit,'evidence'),{recursive:true});
const {replaceOwnTargets}=await import(pathToFileURL(join(root,'scripts/materialize-own-snapshot.mjs')).href);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function paths(dir,id){return {snapshotTarget:join(dir,'OWN-SNAPSHOT.json'),skillsTarget:join(dir,'own'),
  snapshotTemp:join(dir,id+'.snapshot.tmp'),snapshotBackup:join(dir,id+'.snapshot.bak'),
  skillsTemp:join(dir,id+'.skills.tmp'),skillsBackup:join(dir,id+'.skills.bak')};}
function installFixture(){
  const dir=mkdtempSync(join(audit,'fixtures','own-race-'));
  writeFileSync(join(dir,'OWN-SNAPSHOT.json'),JSON.stringify({generation:'old'}));
  mkdirSync(join(dir,'own'));writeFileSync(join(dir,'own','SKILL.md'),'old');
  for(const id of ['A','B']){const p=paths(dir,id);writeFileSync(p.snapshotTemp,JSON.stringify({generation:id}));
    mkdirSync(p.skillsTemp);writeFileSync(join(p.skillsTemp,'SKILL.md'),id);}
  return dir;
}
function snapshot(dir){return {snapshot:JSON.parse(readFileSync(join(dir,'OWN-SNAPSHOT.json'),'utf8')).generation,
  skill:readFileSync(join(dir,'own','SKILL.md'),'utf8')};}
if(process.argv[2]==='worker'){
  const [id,dir]=process.argv.slice(3);const p=paths(dir,id);let result;
  try{
    const warnings=replaceOwnTargets(p,{renameSync:(from,to)=>{
      renameSync(from,to);
      if(id==='A' && from===p.snapshotTemp){
        writeFileSync(join(dir,'A-installed-snapshot'),'ready');const deadline=Date.now()+15000;
        while(!existsSync(join(dir,'resume-A'))){if(Date.now()>deadline)throw Error('Fixture scheduler timed out');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}
      }
    }});
    result={ok:true,warnings};
  }catch(error){result={ok:false,error:String(error)};}
  writeFileSync(join(dir,id+'.result.json'),JSON.stringify(result));process.exitCode=result.ok?0:1;
}else{
  const results=[];
  const control=installFixture();replaceOwnTargets(paths(control,'A'));replaceOwnTargets(paths(control,'B'));
  results.push({id:'sequential-control',after:snapshot(control),desiredInvariant:snapshot(control).snapshot==='B' && snapshot(control).skill==='B'});
  for(let trial=0;trial<3;trial++){
    const dir=installFixture();
    const start=id=>{const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'worker',id,dir],{stdio:['ignore','pipe','pipe']});
      return new Promise((resolve,reject)=>{let stderr='';child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('exit',code=>resolve({code,stderr}));});};
    const a=start('A');let n=0;while(!existsSync(join(dir,'A-installed-snapshot'))){if(++n>1500)throw Error('A barrier timed out');await sleep(10);}
    const b=await start('B');const afterB=snapshot(dir);
    writeFileSync(join(dir,'resume-A'),'resume');const aexit=await a;const afterA=snapshot(dir);
    results.push({id:'interleaving-'+trial,writerB:b,B:JSON.parse(readFileSync(join(dir,'B.result.json'),'utf8')),
      writerA:aexit,A:JSON.parse(readFileSync(join(dir,'A.result.json'),'utf8')),afterB,afterA,
      desiredInvariant:afterA.snapshot===afterA.skill && afterA.snapshot==='B'});
  }
  writeFileSync(join(audit,'evidence','own-replacement-race.json'),JSON.stringify(results,null,2)+'\n');
  for(const r of results)console.log(JSON.stringify(r));
  if(process.argv.includes('--assert-invariants') && results.some(r=>!r.desiredInvariant))process.exitCode=1;
}
