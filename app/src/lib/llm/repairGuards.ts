import { RepairType, Stage1Output } from './repairTypes';

/**
 * Which Stage 3 repair_type values are actually safe for a given Stage 1
 * signal, keyed by constraint_component (Stage1Output's local name form).
 *
 * Ported from a sibling review's repairGuards.ts (originally written against
 * RDFCraft's older 2-stage graph-mutation repair loop, 5 operations) and
 * adapted to this pipeline's 9 repair_type values. The core safety concern
 * carries over unchanged: an iteration is accepted purely by whether
 * violation COUNT dropped, so change_rdf_type can "fix" a MinCount/Closed
 * violation by reclassifying the entity out of the shape entirely -- the
 * entity just stops being validated against that shape, nothing in the
 * mapping was actually corrected. change_rdf_type must never be offered for
 * those two constraint components, only for a genuine
 * ClassConstraintComponent violation (or missing_object_type's
 * add_missing_type, which types a REFERENCED resource rather than
 * reclassifying the focus node itself -- not the same evasion).
 *
 * Deliberately conservative: only constraint components Stage 2/3's own
 * prompts explicitly reason about are listed. Anything else resolves to no
 * allowed operations (skipped) rather than guessing -- same fail-safe
 * default as the original table.
 */
const ALLOWED_REPAIR_TYPES_BY_CONSTRAINT_COMPONENT: Record<string, RepairType[]> = {
  ClassConstraintComponent: ['change_rdf_type', 'add_missing_type'],
  MinCountConstraintComponent: ['add_missing_property'],
  ClosedConstraintComponent: ['change_predicate', 'delete_property'],
  DatatypeConstraintComponent: ['change_datatype', 'reformat_literal_value', 'change_termtype'],
  MaxCountConstraintComponent: ['reformat_literal_value', 'change_subject_key'],
};

export function getAllowedRepairTypes(stage1: Stage1Output): RepairType[] {
  return ALLOWED_REPAIR_TYPES_BY_CONSTRAINT_COMPONENT[stage1.constraint_component] ?? [];
}
