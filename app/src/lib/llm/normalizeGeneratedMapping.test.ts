import { describe, expect, test } from 'vitest';
import { normalizeGeneratedMapping } from './normalizeGeneratedMapping';

const FOAF = 'http://xmlns.com/foaf/0.1/';
const existing = { uuid: 'm', name: 'm', description: '', source_id: 's' };

describe('normalizeGeneratedMapping', () => {
  test('drops literal/uri_ref nodes no edge points to (they would map nothing)', () => {
    // Real LLM output for the FOAF demo: FOAF has no Person -> Organization
    // property, so the model minted an organization uri_ref with no edge.
    const graph = normalizeGeneratedMapping(
      {
        nodes: [
          {
            id: 'person',
            kind: 'entity',
            uri_pattern: 'http://example.org/person/$(id)',
            rdf_type: [`${FOAF}Person`],
          },
          { id: 'nick', kind: 'literal', value: '$(nickname)' },
          { id: 'org_ref', kind: 'uri_ref', uri_pattern: 'http://example.org/org/$(organization)' },
          { id: 'stray', kind: 'literal', value: '$(age)' },
        ],
        edges: [{ source: 'person', predicate: `${FOAF}nick`, target: 'nick' }],
      },
      existing,
    );

    expect(graph.nodes.map(n => n.id).sort()).toEqual(['nick', 'person']);
  });

  test('keeps entity nodes even without edges (they still emit rdf:type)', () => {
    const graph = normalizeGeneratedMapping(
      {
        nodes: [
          {
            id: 'person',
            kind: 'entity',
            uri_pattern: 'http://example.org/person/$(id)',
            rdf_type: [`${FOAF}Person`],
          },
        ],
        edges: [],
      },
      existing,
    );

    expect(graph.nodes.map(n => n.id)).toEqual(['person']);
  });
});
