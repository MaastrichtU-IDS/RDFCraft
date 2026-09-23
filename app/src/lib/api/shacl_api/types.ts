export interface ShaclViolation {
  focus_node: string;
  result_path: string;
  source_constraint_component: string;
  value: string;
  value_type: 'iri' | 'string' | 'literal' | 'unknown';
  message: string;
  severity: string;
  source_shape: string;
}

export interface ShaclValidationReport {
  conforms: boolean;
  violations: ShaclViolation[];
}
