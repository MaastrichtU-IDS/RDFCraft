import { ShaclViolation } from '@/lib/api/shacl_api/types';

/**
 * Stage 1 output: signals mechanically derived from one ShaclViolation plus
 * the full violation list and the SHACL shapes text -- no LLM call needed,
 * every field here is computable from data RDFCraft already has. Feeds the
 * Stage 2 (locate) prompt. Field shape ported verbatim from
 * clustered-kg-refine's `extract_stage1_signals` (codes/prepare-prompts-rs-mimic.py),
 * with `sibling_violations_on_same_focus_node` folded in directly (that
 * project injects it as a separate step after calling the function).
 */
export interface Stage1Output {
  violation_id: string;
  constraint_component: string;
  forbidden_predicate: string;
  observed_value: string;
  value_type: 'iri' | 'string' | 'literal' | 'unknown';
  focus_node: string;
  fix_target: 'focus_node' | 'value';
  violated_shape_nt: string | null;
  signals: {
    closed_shape: boolean;
    predicate_mismatch: boolean;
    forbidden_predicate_present: boolean;
    required_predicate_missing: boolean;
    unexpected_cardinality: boolean;
    value_suspicious: boolean;
  };
  sibling_violations_on_same_focus_node: number;
}

/** One earlier-trial attempt whose fix was reverted or rejected. */
export interface PriorAttempt {
  constraint_component: string;
  forbidden_predicate: string | null;
  repair_type_tried: string;
}

/** Stage 2 (locate) output: the root-cause analyst's verdict. */
export interface Stage2LocateOutput {
  violation_id: string;
  root_error_type: string;
  responsible_mapping_file: string;
  erroneous_root_triples: string[];
  evidence: string;
}

/** Per-class SHACL-shape-derived requirements, as consumed by the Stage 3 repair prompt. */
export interface ClassRequirementSummary {
  required_properties: string[];
  /** null when the shape is not closed (no restriction on extra properties). */
  allowed_properties: string[] | null;
  datatype_constraints: Record<string, string>;
}

export type ClassRequirementsSummary = Record<string, ClassRequirementSummary>;

export interface SchemaContext {
  allowed_entity_types: string[];
  class_requirements?: ClassRequirementsSummary;
}

export type RepairType =
  | 'change_rdf_type'
  | 'change_predicate'
  | 'change_datatype'
  | 'reformat_literal_value'
  | 'add_missing_property'
  | 'delete_property'
  | 'change_termtype'
  | 'change_subject_key'
  | 'add_missing_type'
  | 'unknown';

/** Stage 3 (repair) output: the corrected replacement for each Stage 2 erroneous triple. */
export interface Stage3RepairOutput {
  violation_id: string;
  responsible_mapping_file: string;
  repair_type: RepairType;
  /** Positionally aligned with the Stage 2 erroneous_root_triples; "" means delete. */
  corrected_triples: string[];
  justification: string;
}

export interface IterationLogEntry {
  iteration: number;
  violation: ShaclViolation | null;
  mappingName: string | null;
  stage1: Stage1Output | null;
  stage2: Stage2LocateOutput | null;
  stage3: Stage3RepairOutput | null;
  violationsBefore: number;
  violationsAfter: number | null;
  accepted: boolean;
  note?: string;
}
