import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { DataFactory, Parser, Store, Writer } from 'n3';
import { Stage1Output } from './repairTypes';

const { namedNode } = DataFactory;

/**
 * Ported verbatim (in behavior) from clustered-kg-refine's
 * `extract_stage1_signals` in codes/prepare-prompts-rs-mimic.py -- every
 * field there is a mechanical lookup or boolean function over the fixed
 * SHACL vocabulary already present in the violation, so it runs as plain
 * code, no LLM call.
 */

function localName(term: string): string {
  let text = term;
  for (const sep of ['#', '/']) {
    const index = text.lastIndexOf(sep);
    if (index >= 0) {
      text = text.slice(index + 1);
    }
  }
  return text;
}

// Generic constraint-component scoping, derived from the W3C SHACL Core
// specification itself (a fixed, closed vocabulary). For every core
// constraint component, SHACL defines whether a violation's value is the
// node that's actually wrong ("value"-scoped: the focus node's use of the
// property is fine, the VALUE fails some check) or whether the focus node's
// own property usage is what's wrong ("focus_node"-scoped: presence,
// absence, or count of a property at the focus node, independent of any one
// value). Unlisted components default to "focus_node", matching every
// existing signal's prior (implicit) assumption.
const SHACL_CONSTRAINT_SCOPE: Record<string, 'focus_node' | 'value'> = {
  MinCountConstraintComponent: 'focus_node',
  MaxCountConstraintComponent: 'focus_node',
  ClosedConstraintComponent: 'focus_node',
  QualifiedMinCountConstraintComponent: 'focus_node',
  QualifiedMaxCountConstraintComponent: 'focus_node',

  ClassConstraintComponent: 'value',
  DatatypeConstraintComponent: 'value',
  NodeKindConstraintComponent: 'value',
  MinExclusiveConstraintComponent: 'value',
  MinInclusiveConstraintComponent: 'value',
  MaxExclusiveConstraintComponent: 'value',
  MaxInclusiveConstraintComponent: 'value',
  MinLengthConstraintComponent: 'value',
  MaxLengthConstraintComponent: 'value',
  PatternConstraintComponent: 'value',
  LanguageInConstraintComponent: 'value',
  InConstraintComponent: 'value',

  // Approximate: rare in RML/SHACL mapping validation, not a spec-certain
  // claim like the entries above -- classified value-scoped as the closer
  // default.
  EqualsConstraintComponent: 'value',
  DisjointConstraintComponent: 'value',
  LessThanConstraintComponent: 'value',
  LessThanOrEqualsConstraintComponent: 'value',
  HasValueConstraintComponent: 'value',
  QualifiedValueShapeConstraintComponent: 'value',
};

/** Deterministic id for a violation, stable across re-validations of the
 * same underlying defect (order in the violations array can shift). */
export function computeViolationId(violation: ShaclViolation): string {
  const basis = `${violation.focus_node}|${violation.result_path}|${violation.source_constraint_component}|${violation.value}`;
  let hash = 0;
  for (let i = 0; i < basis.length; i++) {
    hash = (Math.imul(31, hash) + basis.charCodeAt(i)) | 0;
  }
  return `v${(hash >>> 0).toString(36)}`;
}

/**
 * The violated shape's own complete declaration (whatever constraint
 * parameters it actually has), resolved from the shapes graph via the
 * violation's sh:sourceShape -- not a hand-picked field per constraint type.
 * null if source_shape is absent or can't be resolved in the given shapes.
 */
function resolveViolatedShapeNt(sourceShape: string, shapesTtl: string): string | null {
  if (!sourceShape) return null;

  let store: Store;
  try {
    const parser = new Parser({ format: 'text/turtle' });
    store = new Store(parser.parse(shapesTtl));
  } catch {
    return null;
  }

  const quads = store.getQuads(namedNode(sourceShape), null, null, null);
  if (quads.length === 0) return null;

  const writer = new Writer({ format: 'N-Triples' });
  writer.addQuads(quads);
  let result = '';
  writer.end((_err, res) => {
    result = res;
  });
  return result.trim() || null;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>]+/;

export function extractStage1Signals(
  violation: ShaclViolation,
  shapesTtl: string,
): Omit<Stage1Output, 'sibling_violations_on_same_focus_node'> {
  const constraintComponentLocal = violation.source_constraint_component
    ? localName(violation.source_constraint_component)
    : 'unknown';

  let forbiddenPredicate: string;
  if (violation.result_path) {
    forbiddenPredicate = violation.result_path;
  } else {
    const match = violation.message?.match(URL_IN_TEXT);
    forbiddenPredicate = match ? match[0] : 'unknown';
  }

  const closedShape = constraintComponentLocal === 'ClosedConstraintComponent';
  const requiredPredicateMissing =
    constraintComponentLocal === 'MinCountConstraintComponent';
  const unexpectedCardinality =
    constraintComponentLocal === 'MaxCountConstraintComponent';
  const predicateMismatch = closedShape || requiredPredicateMissing;
  const valueSuspicious = constraintComponentLocal === 'DatatypeConstraintComponent';

  const fixTarget = SHACL_CONSTRAINT_SCOPE[constraintComponentLocal] ?? 'focus_node';

  return {
    violation_id: computeViolationId(violation),
    constraint_component: constraintComponentLocal,
    forbidden_predicate: forbiddenPredicate,
    observed_value: violation.value,
    value_type: violation.value_type,
    focus_node: violation.focus_node || 'unknown',
    fix_target: fixTarget,
    violated_shape_nt: resolveViolatedShapeNt(violation.source_shape, shapesTtl),
    signals: {
      closed_shape: closedShape,
      predicate_mismatch: predicateMismatch,
      forbidden_predicate_present: closedShape,
      required_predicate_missing: requiredPredicateMissing,
      unexpected_cardinality: unexpectedCardinality,
      value_suspicious: valueSuspicious,
    },
  };
}

/**
 * Stage 1: derives the rich signal object the Stage 2 (locate) prompt needs,
 * purely from data RDFCraft already has -- no LLM call. `sibling_violation_count`
 * is computed by the caller in clustered-kg-refine (see sample_violation() in
 * codes/all-error-types-experiment.py) and merged into stage1_parsed
 * afterwards; folded in here directly since we already have allViolations.
 */
export function computeStage1Output(
  violation: ShaclViolation,
  allViolations: ShaclViolation[],
  shapesTtl: string,
): Stage1Output {
  const siblingCount = violation.focus_node
    ? allViolations.filter(v => v !== violation && v.focus_node === violation.focus_node)
        .length
    : 0;

  return {
    ...extractStage1Signals(violation, shapesTtl),
    sibling_violations_on_same_focus_node: siblingCount,
  };
}
