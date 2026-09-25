import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = resolve(process.argv[2]);
const {resolveCeiling} = await import(pathToFileURL(repo + '/foundation/atlas/packages/retrieval/dist/src/drop.js').href);
const row = (kind,tokenEstimate) => ({kind,tokenEstimate,hitRate:0,hits:0});
const inputs = {
 uniqueKinds: [row('awareness',400),row('protocols.safetyCritical',300),row('pack',2000),row('own',1500),row('projectMem',500),row('poke',500)],
 repeatedKind: [row('awareness',400), ...Array.from({length:6},()=>row('pack',1000))],
 repeatedSameObject: (()=> {const p=row('pack',1000);return [row('awareness',400),p,p,p,p,p,p];})(),
 pinsOnly: [row('awareness',3000),row('protocols.safetyCritical',3000)],
};
const cases=Object.fromEntries(Object.entries(inputs).map(([name,input])=>{
 const result=resolveCeiling(input);
 const actual=result.survivors.reduce((sum,item)=>sum+item.tokenEstimate,0);
 return [name,{input,result,actual,accountingAgrees:actual===result.sum,
 ceilingOrPinsOnly:actual<=5000 || result.survivors.every(x=>['awareness','protocols.safetyCritical'].includes(x.kind))}];
}));
console.log(JSON.stringify({productRevision:'b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7',boundary:'Original budget function; no production caller found. Numeric supplied estimates, not measured tokenizer output.',cases},null,2));
process.exitCode=Object.values(cases).every(c=>c.accountingAgrees&&c.ceilingOrPinsOnly)?0:1;
