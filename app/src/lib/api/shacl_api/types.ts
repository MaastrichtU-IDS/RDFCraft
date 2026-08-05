export interface ShaclViolation {
  focus_node: string;
  result_path: string;
  source_constraint_component: string;
  value: string;
  message: string;
  severity: string;
}

export interface ShaclValidationReport {
  conforms: boolean;
  violations: ShaclViolation[];
}
