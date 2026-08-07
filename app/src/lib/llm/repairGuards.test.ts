import { describe, expect, test } from 'vitest';
import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { getAllowedOperationsForViolation } from './repairGuards';

const SH = 'http://www.w3.org/ns/shacl#';

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

describe('getAllowedOperationsForViolation', () => {
  test('MinCountConstraintComponent only allows add_missing_property, never change_rdf_type', () => {
    const ops = getAllowedOperationsForViolation(violation(`${SH}MinCountConstraintComponent`));
    expect(ops).toEqual(['add_missing_property']);
  });

  test('ClosedConstraintComponent only allows change_predicate, never change_rdf_type', () => {
    const ops = getAllowedOperationsForViolation(violation(`${SH}ClosedConstraintComponent`));
    expect(ops).toEqual(['change_predicate']);
  });

  test('ClassConstraintComponent allows change_rdf_type', () => {
    const ops = getAllowedOperationsForViolation(violation(`${SH}ClassConstraintComponent`));
    expect(ops).toEqual(['change_rdf_type']);
  });

  test('DatatypeConstraintComponent allows change_datatype or reformat_literal_value', () => {
    const ops = getAllowedOperationsForViolation(violation(`${SH}DatatypeConstraintComponent`));
    expect(ops).toEqual(['change_datatype', 'reformat_literal_value']);
  });

  test('unknown constraint component allows no operation (fail safe)', () => {
    const ops = getAllowedOperationsForViolation(violation(`${SH}PatternConstraintComponent`));
    expect(ops).toEqual([]);
  });
});
