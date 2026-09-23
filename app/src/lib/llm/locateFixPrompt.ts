import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { PriorAttempt, SchemaContext, Stage1Output } from './repairTypes';

const STAGE2_SYSTEM_PROMPT = `
You are an RML mapping analyst.

Task:

Identify the most likely root-cause error in the RML mapping and return the exact noisy RML triple(s). Do not propose repairs.

Inputs:

* stage1_output: the JSON object produced by Stage 1.
* rml_mapping: the complete set of noisy RML mappings.
* schema_context: the closed vocabulary of entity-type (class) IRIs used by this mapping, under schema_context.allowed_entity_types.
* prior_attempts_this_trial (optional): a list of {constraint_component, forbidden_predicate, repair_type_tried} for earlier violations in this same trial whose proposed fix was reverted (did not reduce the violation count) or rejected. This is observational, not authoritative -- it only tells you what already failed to help in this trial, not what the correct answer is. If the current violation's constraint_component and forbidden_predicate closely match an entry here, avoid repeating the same repair_type_tried; consider whether a structural fix (add/remove a property, retarget a key) fits better than another value-level edit.

Rules:

* Use only the provided inputs.
* Use Stage 1 signals only as evidence.
* Determine the root cause from the RML mappings.
* The rml_mapping input may contain multiple RML files separated by file headers.
* Identify which mapping file contains the responsible triple when possible.
* Return the smallest set of atomic RML triples whose modification would eliminate the violation pattern.
* Return exact complete triples from the RML mapping, including subject, predicate, object, and final ".".
* Do not return partial triples such as "rr:constant schema:author .".
* If a map node's declaration spans several predicates chained with ";", return the ENTIRE chain from its subject through the final "." as ONE array entry -- never just the opening line (e.g. never return only ":x a rr:TriplesMap ;" by itself; that is a fragment, not a statement, and will fail to parse on its own).
* When your analysis names an entity-type (class), name only a class that appears in schema_context.allowed_entity_types. Never invent a class IRI that is absent from that list.
* If the error is a wrong entity type, the correct class is almost always one already used by an analogous triples map in rml_mapping (e.g. a sibling object map for the same subject/domain). Prefer that class over any guess.
* stage1_output.fix_target tells you, GENERICALLY (derived from the SHACL specification itself, not from any specific error type), which node the constraint actually failed on: "focus_node" means the focus node's own use of the property (its presence, absence, or count) is what's wrong; "value" means the focus node's use of the property is fine and stage1_output.observed_value itself is what fails the check. This distinction holds for constraint components beyond the ones with a named signal below -- always trust fix_target over guessing from constraint_component alone.
* stage1_output.violated_shape_nt, when present, is the violated SHACL shape's own complete declaration (its actual sh:class/sh:datatype/sh:pattern/sh:minCount/etc.) -- prefer reading the real required value from there over inferring one.
* Decide in this order -- check sibling count BEFORE branching on fix_target, not after:
  1. stage1_output.sibling_violations_on_same_focus_node counts how many OTHER violations affect the same focus node as this one. If that count is high (several unrelated-looking predicate violations sharing one focus node), check the siblings' fix_target/constraint_component first -- clustering means something different depending on which:
     - If the siblings are focus_node-scoped and represent forbidden_predicate_present/required_predicate_missing-style defects (ClosedConstraintComponent/MinCountConstraintComponent) across DIFFERENT properties: a wrong entity type on that node typically makes many of its real properties simultaneously disallowed and many of the wrong class's own required properties simultaneously absent -- one bad class produces a whole cluster of these. Diagnose a shared wrong-entity-type root cause, REGARDLESS of what this single violation's own signal says. The erroneous_root_triple is the ONE specific ObjectMap that carries the focus node's rdf:type class value (reached through a PredicateObjectMap whose PredicateMap has rr:constant rdf:type) -- return only that one small ObjectMap triple. Never the enclosing TriplesMap's own multi-predicate declaration for this case.
     - If the siblings are focus_node-scoped and represent unexpected_cardinality-style defects (MaxCountConstraintComponent) across MULTIPLE DIFFERENT properties: this focus node's subject IRI was most likely built by merging two or more distinct source rows under the same key, because every property those rows both had now shows up twice. Diagnose a wrong subject key, set root_error_type to "wrong_subject_key", and return the TriplesMap's SubjectMap node's OWN complete declaration as erroneous_root_triple (its \`a rr:SubjectMap ; rr:template "..." .\` statement -- a small, specific node, not the whole TriplesMap).
     - If the siblings are value-scoped (fix_target == "value", e.g. ClassConstraintComponent, DatatypeConstraintComponent, PatternConstraintComponent, ...) across multiple different properties: this is NOT one shared root cause on the focus node -- a value-scoped failure means the focus node's own property usage is fine; only each property's individual value or reference fails its own check, independently of the others. Do not touch the focus node's own entity type or subject key here. Handle THIS violation exactly as branch 2's fix_target == "value" case below describes; a high sibling count just means several such violations to fix independently, not a bigger, shared fix.
  2. Otherwise (isolated on its focus node, or value-scoped per the bullet above regardless of sibling count), branch on stage1_output.fix_target:
     - fix_target == "focus_node":
       - If signals.required_predicate_missing is true: there is no wrong value anywhere to correct -- a required PredicateObjectMap is absent entirely from the focus node's TriplesMap. Set root_error_type to "missing_property", identify the TriplesMap the focus node is an instance of, and return that TriplesMap's own subject-defining triple (its \`a rr:TriplesMap\` or \`rr:subjectMap\` triple) as the erroneous_root_triple -- that is where the missing PredicateObjectMap needs to be attached in Stage 3.
       - If signals.forbidden_predicate_present is true (and required_predicate_missing is false): a predicate exists on the focus node that a closed shape disallows, in isolation. Point erroneous_root_triples at that specific PredicateMap/PredicateObjectMap, not at the focus node's entity type.
       - If signals.unexpected_cardinality is true (and the other two are false), in isolation: an existing PredicateMap's value was most likely changed to accidentally duplicate what a different, already-correct map node produces for this same property on this node -- not a row-merge (that needs the clustered case above), just one value now collides with another. Set root_error_type to "duplicate_value", and point erroneous_root_triples at the PredicateMap/ObjectMap pair whose value looks unrelated to its own source column/template (rather than the one that matches its source cleanly) -- that is the one that was altered.
     - fix_target == "value": the focus node's use of this property is correct; stage1_output.observed_value itself fails the violated shape (stage1_output.violated_shape_nt, when present, names the actual requirement). Two different root causes are possible, and you must pick between them:
       - "missing_object_type" applies ONLY when constraint_component is ClassConstraintComponent (a real, existing resource is missing an rdf:type) -- NEVER for DatatypeConstraintComponent, NodeKindConstraintComponent, PatternConstraintComponent, or any other value-scoped component. sh:datatype only ever constrains a LITERAL's own form; it has no "missing type elsewhere" reading, no matter how IRI-shaped or template-built observed_value looks. An observed_value that is an IRI (value_type == "iri") under a DatatypeConstraintComponent violation is not evidence of a real external resource -- it is direct evidence of a termType flip (a literal-valued property is instead constructing an IRI). Treat that case under the branch below, not this one.
       - If constraint_component is ClassConstraintComponent AND observed_value is an IRI that this property correctly, consistently references -- the SAME rr:template construct produces it as the SAME PredicateObjectMap/ObjectMap already reached from the focus node for this property, and nothing about that construction looks altered -- then the property mapping itself is not the defect. What is missing is a separate assertion ON THAT REFERENCED RESOURCE (e.g. its own rdf:type), declared nowhere else in the mapping. Set root_error_type to "missing_object_type", and point erroneous_root_triples at that SAME PredicateMap/PredicateObjectMap/ObjectMap (the one whose rr:template mints observed_value) -- Stage 3 will attach a new, separate assertion to that minted resource; it will not modify this map node's own triples.
       - Otherwise (including every DatatypeConstraintComponent case), the value's own construction is what changed: an existing ObjectMap's rml:reference, rr:template, rr:datatype, or rr:termType was most likely altered so it no longer satisfies the violated shape. A DatatypeConstraintComponent violation whose observed_value is IRI-shaped specifically indicates rr:termType was flipped from rr:Literal to rr:IRI (or an rr:template was substituted for what should be a plain rml:reference) -- root_error_type "wrong_termtype" or "wrong_value", your choice of label, but point erroneous_root_triples at that specific ObjectMap itself, not at the focus node's own type or subject key, and not through add_missing_type.
  Returning the enclosing TriplesMap's own multi-predicate declaration (its \`a rr:TriplesMap ; rml:logicalSource ... ; rr:predicateObjectMap ... ; rr:subjectMap ... .\` block) as erroneous_root_triple is correct ONLY for the required_predicate_missing branch above (2, first bullet) -- never for any other branch. All other branches always point at one small, specific map node (an ObjectMap, a SubjectMap, or a PredicateMap/PredicateObjectMap), not the TriplesMap itself.

Output rules:

* Do not use markdown code fences.
* Do not add any explanation before or after the JSON.
* Return only valid JSON.
* The first character of your response must be "{".
* The last character of your response must be "}".

Your entire response must be the following single JSON object:
{
  "violation_id": "<string>",
  "root_error_type": "<text>",
  "responsible_mapping_file": "<filename or unknown>",
  "erroneous_root_triples": ["<exact complete RML triple>", "..."],
  "evidence": "<brief justification>"
}
`.trim();

export function buildLocateFixMessages(
  stage1Output: Stage1Output,
  rmlMapping: string,
  schemaContext: SchemaContext,
  priorAttemptsThisTrial?: PriorAttempt[] | null,
): ChatCompletionMessageParam[] {
  const userPayload = {
    stage1_output: stage1Output,
    rml_mapping: rmlMapping,
    schema_context: schemaContext,
    ...(priorAttemptsThisTrial && priorAttemptsThisTrial.length > 0
      ? { prior_attempts_this_trial: priorAttemptsThisTrial }
      : {}),
  };

  return [
    { role: 'system', content: STAGE2_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload, null, 2) },
  ];
}
