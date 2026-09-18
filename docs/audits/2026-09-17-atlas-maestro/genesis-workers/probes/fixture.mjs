import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { create } from '@bufbuild/protobuf';
import { serializeSCIP, IndexSchema, MetadataSchema, ToolInfoSchema, DocumentSchema, OccurrenceSchema, SymbolRole } from '@c4312/scip';
export function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'atlas-genesis-probe-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, '.gitignore'), '.atlas/\n');
  writeFileSync(join(root, 'src/util.ts'), 'export function greet(n: string): string { return `hi ${n}`; }\n');
  writeFileSync(join(root, 'src/app.ts'), "import { greet } from './util';\nexport function main(): string { return greet('world'); }\n");
  const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe']}).trim();
  git('init','-q'); git('config','user.name','Audit Fixture'); git('config','user.email','audit@example.invalid');
  git('add','.'); git('-c','commit.gpgsign=false','commit','-qm','Controlled two-file fixture');
  const symbol = 'scip-typescript npm audit-fixture 1.0.0 src/util.ts/greet().';
  const main = 'scip-typescript npm audit-fixture 1.0.0 src/app.ts/main().';
  const occurrence = (s, role, range) => create(OccurrenceSchema, {symbol:s, symbolRoles:role, range});
  const docs = [create(DocumentSchema, {relativePath:'src/util.ts', occurrences:[occurrence(symbol,SymbolRole.Definition,[0,16,21])]}),
    create(DocumentSchema, {relativePath:'src/app.ts', occurrences:[occurrence(main,SymbolRole.Definition,[1,16,20]),occurrence(symbol,0,[1,39,44])]})];
  mkdirSync(join(root,'.atlas'));
  writeFileSync(join(root,'.atlas/index.scip'), serializeSCIP(create(IndexSchema,{metadata:create(MetadataSchema,{projectRoot:`file://${root}`,toolInfo:create(ToolInfoSchema,{name:'controlled-audit-fixture',version:'1'})}),documents:docs})));
  return {root, rev:git('rev-parse','HEAD')};
}
