import { describe, expect, test } from 'vitest';
import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { MappingGraph } from '@/lib/api/mapping_service/types';
import { buildProposeFixMessages } from './proposeFixPrompt';
import { LocatedTarget } from './repairTypes';

const SH = 'http://www.w3.org/ns/shacl#';

const mapping: MappingGraph = {
  uuid: 'm1',
  name: 'm1',
  description: '',
  source_id: 'source',
  nodes: [
    {
      id: 'entity1',
      type: 'entity',
      position: { x: 0, y: 0 },
      label: 'entity',
      uri_pattern: 'http://example.org/{id}',
      rdf_type: ['http://example.org/Patient'],
      properties: [],
    },
  ],
  edges: [],
};

const located: LocatedTarget = { target_type: 'entity', target_id: 'entity1' };

function violation(constraintComponent: string): ShaclViolation {
  return {
    focus_node: 'http://example.org/alice',
    result_path: 'http://example.org/age',
    source_constraint_component: constraintComponent,
    value: '',
    message: '',
    severity: '',
  };
}

describe('buildProposeFixMessages', () => {
  test('restricts a MinCountConstraintComponent violation to add_missing_property only', () => {
    const messages = buildProposeFixMessages(
      violation(`${SH}MinCountConstraintComponent`),
      mapping,
      located,
      {},
      [],
    );
    const userMessage = messages.find(m => m.role === 'user')?.content as string;

    expect(userMessage).toContain('add_missing_property');
    expect(userMessage).not.toContain('change_rdf_type');
  });

  test('restricts a ClosedConstraintComponent violation to change_predicate only, never change_rdf_type', () => {
    const messages = buildProposeFixMessages(
      violation(`${SH}ClosedConstraintComponent`),
      mapping,
      located,
      {},
      [],
    );
    const userMessage = messages.find(m => m.role === 'user')?.content as string;

    expect(userMessage).toContain('change_predicate');
    expect(userMessage).not.toContain('change_rdf_type');
  });
});
