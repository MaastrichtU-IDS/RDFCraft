import { describe, expect, test } from 'vitest';
import { normalizeGeneratedMapping } from './normalizeGeneratedMapping';

const FOAF = 'http://xmlns.com/foaf/0.1/';
const props = ['firstName', 'lastName', 'nick', 'mbox', 'homepage', 'age', 'knows'];

const generated = {
  nodes: [
    {
      id: 'person',
      kind: 'entity' as const,
      label: 'Person',
      uri_pattern: 'http://example.org/person/$(id)',
      rdf_type: [`${FOAF}Person`],
    },
    {
      id: 'org',
      kind: 'entity' as const,
      label: 'Organization',
      uri_pattern: 'http://example.org/org/$(organization)',
      rdf_type: [`${FOAF}Organization`],
    },
    ...props.map(p => ({ id: p, kind: 'literal' as const, label: p, value: `$(${p})` })),
  ],
  edges: [
    ...props.map(p => ({ source: 'person', predicate: `${FOAF}${p}`, target: p })),
    { source: 'org', predicate: `${FOAF}member`, target: 'person' },
  ],
};

const existing = { uuid: 'm', name: 'm', description: '', source_id: 's' };

describe('layoutMappingGraph via normalizeGeneratedMapping', () => {
  const graph = normalizeGeneratedMapping(generated, existing);
  const pos = Object.fromEntries(graph.nodes.map(n => [n.id, n.position]));

  test('places objects to the right of their subjects', () => {
    expect(pos.org.x).toBeLessThan(pos.person.x);
    for (const p of props) expect(pos.person.x).toBeLessThan(pos[p].x);
  });

  test('stacks sibling literals without vertical overlap', () => {
    const ys = props.map(p => pos[p].y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(120);
  });
});
