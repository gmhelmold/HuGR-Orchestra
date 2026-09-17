import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {create} from '@bufbuild/protobuf';
import {serializeSCIP,IndexSchema,MetadataSchema,ToolInfoSchema,DocumentSchema,OccurrenceSchema,SymbolRole} from '@c4312/scip';
const root=realpathSync(resolve(process.argv[2]));
const output=resolve(process.argv[3]);
const load=(pkg,file='index')=>import(pathToFileURL(join(root,'packages',pkg,'dist/src',file+'.js')).href);
const {build,nodeHashOfPath}=await load('index','build');
const {createDepgraph}=await load('index','depgraph');
const {ownImpact}=await load('index','own-impact');
const {createDriftFold}=await load('index','fold');
const {composeRuntime,initAst}=await load('adapter-io');
const {walkFileTree}=await load('adapter-io','fs');
const {readScip}=await load('adapter-io','scip');
const {deriveGroundingAxes}=await load('adapter-io','grounding-computer');
const {createDiskStore,rehydrateProjection}=await load('adapter-io','store');
const {buildRetrievalModel}=await load('adapter-io','retrieval-model');
const results=[];
const git=(dir,...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function scip(dir,provider,consumer,unresolved=false){
 const symbol='scip-typescript npm fixture 1 '+provider+'/value.';
 const documents=[
  create(DocumentSchema,{relativePath:provider,occurrences:[create(OccurrenceSchema,{symbol,symbolRoles:SymbolRole.Definition})]}),
  create(DocumentSchema,{relativePath:consumer,occurrences:[create(OccurrenceSchema,{symbol:unresolved?'unresolved/external/value.':symbol,symbolRoles:0})]})
 ];
 writeFileSync(join(dir,'.atlas/index.scip'),serializeSCIP(create(IndexSchema,{metadata:create(MetadataSchema,{projectRoot:pathToFileURL(dir).href,toolInfo:create(ToolInfoSchema,{name:'controlled-audit-fixture',version:'1'})}),documents})));
}
function fixture(provider='src/provider.ts',consumer='src/consumer.ts',unresolved=false){
 const dir=realpathSync(mkdtempSync('/private/tmp/atlas-graph-fixture-'));
 for(const p of ['src','.atlas'])mkdirSync(join(dir,p));
 writeFileSync(join(dir,'.gitignore'),'.atlas/\n');
 writeFileSync(join(dir,provider),'export const value = 1;\n');
 writeFileSync(join(dir,consumer),`import { value } from './${provider.split('/').at(-1).replace('.ts','')}';\nexport const readValue = () => value;\n`);
 writeFileSync(join(dir,'.atlas/policy.json'),JSON.stringify({t0Heuristic:{keywords:[]},authz:{scopes:{src:['graph-audit']}}}));
 git(dir,'init');git(dir,'config','user.name','Graph audit');git(dir,'config','user.email','graph-audit@example.invalid');git(dir,'add','.');git(dir,'commit','-m','fixture');
 scip(dir,provider,consumer,unresolved);return {dir,provider,consumer};
}
function axes(f){return build(walkFileTree(f.dir),readScip(join(f.dir,'.atlas/index.scip')));}
function rt(f){process.env.ATLAS_ACTOR='graph-audit';process.env.ATLAS_RATIFY_TOKEN='billy';return composeRuntime(f.dir);}
function emit(r,f,anchor,claim){const d=r.draft({anchor,slot:'invariant',claim});assert.ok(d.fact,JSON.stringify(d));const o=r.handler.handle('atlas-emit',{node:d.fact,at:git(f.dir,'rev-parse','HEAD')});assert.equal(o.ok,true,JSON.stringify(o));return o.data.nodeKey;}
function query(r,target,by='dependency'){const o=r.handler.handle('atlas-query',{scope:target,by});assert.equal(o.ok,true,JSON.stringify(o));return o.data.pack;}
function ids(p){return [...p.invariants,...(p.advisory??[])].map(x=>x.nodeId);}
function node(root,key){if(root.key===key)return root;for(const ch of root.children){const n=node(ch,key);if(n)return n;}}
async function probe(id,fn){try{const data=await fn();results.push({id,status:'observation-confirmed',...data});}catch(e){results.push({id,status:'probe-error',error:e.stack});}console.log(JSON.stringify(results.at(-1)));}
await initAst();
await probe('GRAPH-01-target-without-own-fact',()=>{
 const f=fixture();const a=axes(f);const graph=createDepgraph(a.edges).reverseClosure(nodeHashOfPath(f.provider));assert.ok(graph.closure.includes(nodeHashOfPath(f.consumer)));
 const r=rt(f);const dependent=emit(r,f,f.consumer,'Consumer reads the provider.');
 const scope=ids(query(r,'src','scope'));assert.ok(scope.includes(dependent));
 const before=ids(query(r,f.provider));assert.deepEqual(before,[]);
 emit(r,f,f.provider,'Provider exports value.');
 const after=ids(query(r,f.provider));assert.ok(after.includes(dependent));
 return {fixture:f,graph,dependent,scope,before,after,defect:before.length===0&&after.includes(dependent)};
});
await probe('GRAPH-02-escaped-provider-impact',()=>{
 const variants=[];
 for(const provider of ['src/provider.ts','src/provider%value.ts','src/provider:value.ts']){
  const f=fixture(provider);const before=axes(f);
  writeFileSync(join(f.dir,provider),'export const value = 2;\n');const after=axes(f);
  const receipt=ownImpact({before,after,baseSnapshot:'before',headSnapshot:'after',knowledgeChangedUnits:[]});
  const direct=createDepgraph(after.edges).reverseClosure(nodeHashOfPath(provider));assert.ok(direct.closure.includes(nodeHashOfPath(f.consumer)));
  const encoded=provider.replaceAll('%','%25').replaceAll(':','%3A');
  variants.push({provider,encoded,receipt,direct,consumerIncluded:receipt.impactedUnits.includes(f.consumer)});
 }
 assert.equal(variants[0].consumerIncluded,true);assert.equal(variants[1].consumerIncluded,false);assert.equal(variants[2].consumerIncluded,false);
 return {variants,defect:true};
});
await probe('GRAPH-03-symbol-anchored-dependent',()=>{
 const f=fixture();const a=deriveGroundingAxes(walkFileTree(f.dir),readScip(join(f.dir,'.atlas/index.scip'))).axes;
 const child=node(a.spatial,f.consumer).children[0];assert.ok(child, 'real AST child required');
 const r=rt(f);emit(r,f,f.provider,'Provider exports value.');const symbolFact=emit(r,f,child.key,'Consumer symbol uses imported value.');
 const scope=ids(query(r,'src','scope'));assert.ok(scope.includes(symbolFact));
 const before=ids(query(r,f.provider));assert.ok(!before.includes(symbolFact));
 const fileFact=emit(r,f,f.consumer,'Consumer file imports provider.');const after=ids(query(r,f.provider));assert.ok(after.includes(fileFact));assert.ok(!after.includes(symbolFact));
 return {fixture:f,symbolAnchor:child.key,symbolFact,fileFact,scope,before,after,defect:true};
});
await probe('GRAPH-04-unresolved-outside-reached-set',()=>{
 const f=fixture('src/provider.ts','src/consumer.ts',true);const before=axes(f);
 writeFileSync(join(f.dir,f.provider),'export const value = 2;\n');const after=axes(f);
 const result=ownImpact({before,after,baseSnapshot:'a',headSnapshot:'b',knowledgeChangedUnits:[]});
 const direct=createDepgraph(after.edges).reverseClosure(nodeHashOfPath(f.provider));
 const graphWithResolvedEdge=createDepgraph([...after.edges,{from:nodeHashOfPath(f.consumer),to:nodeHashOfPath(f.provider),kind:'resolved'}]).reverseClosure(nodeHashOfPath(f.provider));
 assert.equal(direct.underApprox,false);assert.equal(result.coverage,'COMPLETE');assert.ok(!result.impactedUnits.includes(f.consumer));assert.ok(graphWithResolvedEdge.closure.includes(nodeHashOfPath(f.consumer)));
 return {fixture:f,direct,result,graphWithResolvedEdge,classification:'coverage-contract gap: unknown target cannot be excluded from whole-graph reachability by already-reached-set filtering; controlled index, not actual indexer output'};
});
await probe('GRAPH-05-drift-fold-cache-invalidation',()=>{
 const f=fixture();const a=axes(f);const original=node(a.dependency,nodeHashOfPath(f.consumer));const origin=node(a.dependency,nodeHashOfPath(f.provider));assert.ok(original&&origin);
 const before={...original,objects:['old-state']};const after={...original,objects:['new-state']};
 const fold=createDriftFold(a.edges,[origin,before]);const initial=fold.queryState(before);fold.propagateDirty(origin);fold.rehashState(origin);const reused=fold.queryState(after);
 const independent=createDriftFold(a.edges,[origin,after]).queryState(after);
 assert.equal(initial,reused);assert.notEqual(independent,reused);
 return {initial,reused,independent,dirty:fold.isDirty(after),stateResolved:fold.rStateResolved(after),onReadResolves:fold.onReadResolves,classification:'unwired reference-model limitation, not live runtime stale-state incident'};
});
writeFileSync(output,JSON.stringify({sha:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',root,node:process.version,platform:process.platform,indexInput:'controlled minimal protobuf with installed original schema; no scip-typescript execution',results},null,2)+'\n');
if(results.some(x=>x.status==='probe-error'))process.exitCode=1;
