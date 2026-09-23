import { describe, expect, test } from 'vitest';
import { MappingGraph } from '@/lib/api/mapping_service/types';
import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { buildGraphStore, resolveOwningMapping } from './resolveOwningMapping';

const PERSON = 'http://example.org/Person';
const ANIMAL = 'http://example.org/Animal';

function entityMapping(uuid: string, rdfType: string): MappingGraph {
  return {
    uuid,
    name: uuid,
    description: '',
    source_id: 'source',
    nodes: [
      {
        id: `${uuid}-entity`,
        type: 'entity',
        position: { x: 0, y: 0 },
        label: 'entity',
        uri_pattern: 'http://example.org/{id}',
        rdf_type: [rdfType],
        properties: [],
      },
    ],
    edges: [],
  };
}

function violationFor(focusNode: string): ShaclViolation {
  return {
    focus_node: focusNode,
    result_path: '',
    source_constraint_component: '',
    value: '',
    value_type: 'unknown',
    message: '',
    severity: '',
    source_shape: '',
  };
}

describe('resolveOwningMapping', () => {
  test('returns the single mapping whose rdf_type matches the focus node type', () => {
    const store = buildGraphStore(`
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      <http://example.org/alice> rdf:type <${PERSON}> .
    `);
    const mappings = [entityMapping('patients', PERSON), entityMapping('pets', ANIMAL)];

    const owner = resolveOwningMapping(violationFor('http://example.org/alice'), store, mappings);

    expect(owner?.uuid).toBe('patients');
  });

  test('returns null when two mappings both declare the focus node type (ambiguous)', () => {
    const store = buildGraphStore(`
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      <http://example.org/alice> rdf:type <${PERSON}> .
    `);
    const mappings = [entityMapping('patients', PERSON), entityMapping('customers', PERSON)];

    const owner = resolveOwningMapping(violationFor('http://example.org/alice'), store, mappings);

    expect(owner).toBeNull();
  });
});
