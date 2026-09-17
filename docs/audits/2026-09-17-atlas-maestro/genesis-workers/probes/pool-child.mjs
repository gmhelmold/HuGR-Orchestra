import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const base=dirname(dirname(fileURLToPath(import.meta.url)));
const atlas=process.env.ATLAS_AUDIT_ROOT??join(base,'repo/foundation/atlas');
const {createProposerPool}=await import(pathToFileURL(join(atlas,'packages/cli/dist/src/mine-pool.js')));
const pool=createProposerPool(process.cwd(),{HOME:base,XDG_CONFIG_HOME:join(base,'no-config-home')},1);
if(process.argv[2]==='closed')pool.close();
const cand={site:{kind:'file',qualifiedPath:'src/a.ts',subtreeHash:'fixture'},ppr:1,rank:1,signals:{hotspot:0,szzBugCommits:0,coChanged:[],owners:[],messages:[]}};
console.log('AUDIT_BEFORE_PROPOSE');
try { const out=pool.proposeAll([cand]); console.log(JSON.stringify({returned:true,results:out.map(r=>({ok:r.ok,seed:r.ok?r.seed:undefined,error:r.ok?undefined:r.error.message}))})); }
finally {pool.close();}
