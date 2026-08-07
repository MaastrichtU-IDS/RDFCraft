import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { RepairOperation } from './repairTypes';

const SH = 'http://www.w3.org/ns/shacl#';

/**
 * Which repair operations are actually safe for a given SHACL violation,
 * keyed by its sourceConstraintComponent. change_rdf_type is deliberately
 * restricted to ClassConstraintComponent only -- it must never be offered as
 * a fix for MinCount/Closed violations, where reclassifying the entity away
 * from the shape "resolves" the violation by opting out of it rather than
 * fixing the mapping (the entity stops being validated against that shape
 * at all).
 */
const ALLOWED_OPERATIONS_BY_CONSTRAINT_COMPONENT: Record<string, RepairOperation[]> = {
  [`${SH}ClassConstraintComponent`]: ['change_rdf_type'],
  [`${SH}MinCountConstraintComponent`]: ['add_missing_property'],
  [`${SH}ClosedConstraintComponent`]: ['change_predicate'],
  [`${SH}DatatypeConstraintComponent`]: ['change_datatype', 'reformat_literal_value'],
};

export function getAllowedOperationsForViolation(
  violation: ShaclViolation,
): RepairOperation[] {
  return ALLOWED_OPERATIONS_BY_CONSTRAINT_COMPONENT[violation.source_constraint_component] ?? [];
}
