import { describe, expect, test } from 'vitest';
import { getAllowedRepairTypes, losesSubjects } from './repairGuards';
import { Stage1Output } from './repairTypes';

function stage1(constraintComponent: string): Stage1Output {
  return {
    violation_id: 'v1',
    constraint_component: constraintComponent,
    forbidden_predicate: 'http://example.org/age',
    observed_value: '',
    value_type: 'unknown',
    focus_node: 'http://example.org/alice',
    fix_target: 'value',
    violated_shape_nt: null,
    signals: {
      closed_shape: false,
      predicate_mismatch: false,
      forbidden_predicate_present: false,
      required_predicate_missing: false,
      unexpected_cardinality: false,
      value_suspicious: false,
    },
    sibling_violations_on_same_focus_node: 0,
  };
}

describe('getAllowedRepairTypes', () => {
  test('MinCountConstraintComponent only allows add_missing_property, never change_rdf_type', () => {
    expect(getAllowedRepairTypes(stage1('MinCountConstraintComponent'))).toEqual([
      'add_missing_property',
    ]);
  });

  test('ClosedConstraintComponent allows change_predicate or delete_property, never change_rdf_type', () => {
    expect(getAllowedRepairTypes(stage1('ClosedConstraintComponent'))).toEqual([
      'change_predicate',
      'delete_property',
    ]);
  });

  test('ClassConstraintComponent allows change_rdf_type and add_missing_type', () => {
    expect(getAllowedRepairTypes(stage1('ClassConstraintComponent'))).toEqual([
      'change_rdf_type',
      'add_missing_type',
    ]);
  });

  test('DatatypeConstraintComponent allows change_datatype, reformat_literal_value, or change_termtype', () => {
    expect(getAllowedRepairTypes(stage1('DatatypeConstraintComponent'))).toEqual([
      'change_datatype',
      'reformat_literal_value',
      'change_termtype',
    ]);
  });

  test('MaxCountConstraintComponent allows reformat_literal_value or change_subject_key', () => {
    expect(getAllowedRepairTypes(stage1('MaxCountConstraintComponent'))).toEqual([
      'reformat_literal_value',
      'change_subject_key',
    ]);
  });

  test('unlisted constraint component allows no operation (fail safe)', () => {
    expect(getAllowedRepairTypes(stage1('PatternConstraintComponent'))).toEqual([]);
  });
});

describe('losesSubjects', () => {
  const before = `
<http://example.org/person/1> a <http://xmlns.com/foaf/0.1/Person> .
<http://example.org/person/2> a <http://xmlns.com/foaf/0.1/Person> .
`;

  test('flags a candidate graph that drops subjects (e.g. a patch that broke the subject map)', () => {
    expect(losesSubjects(before, '')).toBe(true);
    expect(losesSubjects(before, '<http://example.org/person/1> a <http://xmlns.com/foaf/0.1/Person> .')).toBe(true);
  });

  test('allows adding triples or renaming subjects (change_subject_key)', () => {
    expect(
      losesSubjects(before, `${before}<http://example.org/person/1> <http://xmlns.com/foaf/0.1/name> "A" .`),
    ).toBe(false);
    expect(
      losesSubjects(
        before,
        `<http://example.org/p/a> a <http://xmlns.com/foaf/0.1/Person> .
<http://example.org/p/b> a <http://xmlns.com/foaf/0.1/Person> .`,
      ),
    ).toBe(false);
  });
});
