import { describe, expect, it } from 'vitest';
import { exportOwnSnapshot, materializeStaticOwnSnapshot, parseOwnSnapshot, verifyStaticOwnSnapshot } from '../src/own-snapshot.js';

const snapshotText = JSON.stringify({
  schemaVersion: 1,
  snapshot: 'genesis-v1',
  sourceRevision: 'revision-1',
  units: [{
    unit: { level: 'module', id: 'packages/genesis', grounding: null },
    sourceBlobs: { 'packages/genesis/src/index.ts': '0123456789abcdef0123456789abcdef01234567' },
    pack: {
      unit: 'Genesis owns bootstrap.',
      invariants: [{ nodeId: 'genesis:bootstrap', tier: 'T1', claim: 'Genesis bootstrap is deterministic.', freshness: 'FRESH' }],
      shape: { contents: ['packages/genesis/src/index.ts'], owner: 'atlas-foundation', tier: 'T1' },
      edges: { dependents: [], dependencies: [] }, gotchas: [], memory: null,
      drill: { finer: [], refresh: { pull: 'poke:own_packages_genesis' }, complement: { pull: 'relate:packages/genesis' } },
      grounding: { source: 'tree' }, tokenEstimate: 12, manifest: { pointers: [], truncated: false }, pullReachable: [], advisory: [], advisoryDropped: 0,
    },
  }],
});

describe('static Own snapshot', () => {
  it('recomposes skills, coverage, and source freshness from Genesis snapshot', () => {
    const snapshot = parseOwnSnapshot(snapshotText);
    expect(snapshot).toBeDefined();
    const output = materializeStaticOwnSnapshot(snapshot!);
    expect(output.skills).toHaveLength(1);
    expect(output.coverage.path).toBe('.opencode/skills/own/OWN-COVERAGE.json');
    expect(verifyStaticOwnSnapshot(snapshot!, [...output.skills, output.coverage], (path) => snapshot!.units[0]!.sourceBlobs[path])).toEqual({ status: 'READY' });
  });

  it('fails closed on empty or duplicate Genesis unit coverage', () => {
    expect(parseOwnSnapshot('{"schemaVersion":1,"snapshot":"x","sourceRevision":"y","units":[]}')).toBeUndefined();
    const duplicate = JSON.parse(snapshotText);
    duplicate.units.push({ ...duplicate.units[0], sourceBlobs: { 'packages/genesis/src/other.ts': '0123456789abcdef0123456789abcdef01234567' } });
    expect(parseOwnSnapshot(JSON.stringify(duplicate))).toBeUndefined();
  });

  it('exports only fresh reviewed packs, never an empty oracle', () => {
    const value = JSON.parse(snapshotText);
    expect(exportOwnSnapshot({ snapshot: value.snapshot, sourceRevision: value.sourceRevision, units: value.units })).toMatchObject({ schemaVersion: 1 });
    value.units[0].pack.invariants[0].freshness = 'DRIFTED';
    expect(() => exportOwnSnapshot({ snapshot: value.snapshot, sourceRevision: value.sourceRevision, units: value.units })).toThrow('Own snapshot export requires fresh reviewed packs');
  });

  it('names prose and source-blob drift', () => {
    const snapshot = parseOwnSnapshot(snapshotText)!;
    const output = materializeStaticOwnSnapshot(snapshot);
    const altered = { ...output.skills[0]!, content: output.skills[0]!.content.replace('Genesis bootstrap is deterministic.', 'altered') };
    expect(verifyStaticOwnSnapshot(snapshot, [altered, output.coverage], () => 'abcdefabcdefabcdefabcdefabcdefabcdefabcd')).toEqual({
      status: 'HOLD',
      issues: [
        'source blob drift: packages/genesis -> packages/genesis/src/index.ts',
        `static Own drift: ${output.skills[0]!.path}`,
      ],
    });
  });
});
