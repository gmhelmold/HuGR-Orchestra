import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const j=JSON.parse(readFileSync(process.argv[2],'utf8'));
const cases=j.results.filter(x=>x.id==='logical-owner'||x.id==='misleading-path-fallback');
assert.equal(cases.length,2,'both executed controls must exist');
for (const c of cases) {
 assert.equal(c.emitted,true,'the original authorized write must have succeeded');
 assert.equal(c.authorizedActor,true,'this is not an authorization-bypass experiment');
 assert.equal(c.reportedOwner,[...c.policyMembers].sort().join(', '),c.id+': Own must honor explicit anchor owner');
}
