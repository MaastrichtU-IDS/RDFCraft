import { ShaclViolation } from '@/lib/api/shacl_api/types';

export type RepairTargetType = 'entity' | 'edge' | 'literal';

export interface LocatedTarget {
  target_type: RepairTargetType;
  target_id: string;
  reasoning?: string;
}

export type RepairOperation =
  | 'change_rdf_type'
  | 'change_predicate'
  | 'change_datatype'
  | 'add_missing_property'
  | 'reformat_literal_value';

export type NewNodeKind = 'literal' | 'uri_ref';

export interface ProposedFix {
  operation: RepairOperation;
  old_value: string;
  new_value: string;
  reasoning?: string;
  /**
   * add_missing_property only: the new node to create and attach to the
   * entity via a new edge using new_value as the predicate.
   */
  new_node_kind?: NewNodeKind;
  /** literal: a value template, e.g. "$(DOB)"; uri_ref: a URI template. */
  new_node_value?: string;
  /** literal only: the XSD datatype URI for the new literal node. */
  new_node_datatype?: string;
}

export interface IterationLogEntry {
  iteration: number;
  violation: ShaclViolation | null;
  mappingName: string | null;
  located: LocatedTarget | null;
  fix: ProposedFix | null;
  violationsBefore: number;
  violationsAfter: number | null;
  accepted: boolean;
  note?: string;
}
