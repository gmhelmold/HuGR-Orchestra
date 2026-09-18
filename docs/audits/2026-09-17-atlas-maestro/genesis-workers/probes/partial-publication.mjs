import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import {fixture} from './fixture.mjs';
const base=dirname(dirname(fileURLToPath(import.meta.url)));const atlas=process.env.ATLAS_AUDIT_ROOT??join(base,'repo/foundation/atlas');
const {initAst,createDiskStore,headSha}=await import(pathToFileURL(join(atlas,'packages/adapter-io/dist/src/index.js')));
const {driveMinePass}=await import(pathToFileURL(join(atlas,'packages/cli/dist/src/mine.js')));
const {foldVerdict}=await import(pathToFileURL(join(atlas,'packages/cli/dist/src/mine-render.js')));
await initAst();const results=[];
for(const mode of ['healthy','refuse-second','throw-second']){
 const f=fixture();const store=createDiskStore(join(f.root,'.atlas/cas'),()=>headSha(f.root));let commits=0,proposed=0;
 const observedStore={...store,commitStaging:(decide)=>{
   commits++;
   if(commits===2&&mode==='refuse-second')return {settled:false,refusal:'contended'};
   if(commits===2&&mode==='throw-second')throw new Error('AUDIT_INJECTED_STORAGE_FAILURE');
   return store.commitStaging(decide);
 }};
 const proposer={propose:(cand)=>{proposed++;return {cand,claim:`The source ${cand.site.qualifiedPath} declares an exported function.`};}};
 const pass=driveMinePass(f.root,{proposer,store:observedStore,env:{HOME:base,XDG_CONFIG_HOME:join(base,'no-config-home')}});
 const reopened=createDiskStore(join(f.root,'.atlas/cas'),()=>headSha(f.root));const read=reopened.commitStaging(p=>({out:p}));
 const rows=read.settled?[...read.out.current.values()].map(r=>({nodeKey:r.nodeKey,claims:r.claims,contentHash:r.contentHash,readable:reopened.get(r.contentHash)!==undefined})):[];
 const r={mode,proposed,commitAttempts:commits,refusal:pass.refusal,report:{seeded:pass.report.seeded.length,llmCalls:pass.report.llmCalls,modelCalls:pass.report.modelCalls,budgetSpent:pass.report.budgetSpent,coverage:pass.report.coverage,resumeToken:pass.report.resumeToken},durableRows:rows,cliVerdict:foldVerdict(pass)};
 results.push(r);console.log(JSON.stringify(r));
}
writeFileSync(join(base,'evidence',`partial-publication-${process.argv[2]??'first'}.json`),JSON.stringify({product:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',node:process.version,index:'controlled SCIP',proposer:'recorded synthetic seed; no model',gate:'original composed gate, not substituted',fault:'explicit second-commit refusal/throw at store port; first commit and reopened store original',results},null,2)+'\n');
