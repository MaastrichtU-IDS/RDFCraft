# Repair Pipeline

The Validate & Refine auto-repair loop (`runRepairLoop` in
`src/pages/validation_page/state.ts`) fixes SHACL violations with a 3-stage
pipeline ported from clustered-kg-refine, operating on real RML *text*
(the mapping's rules) rather than RDFCraft's own node/edge graph model:

1. **Stage 1** ([`stage1Signals.ts`](./stage1Signals.ts)) -- deterministic,
   no LLM call. Converts one `ShaclViolation` into a structured diagnosis:
   which constraint failed, whether the fault is on the focus node itself
   (`fix_target: "focus_node"`, e.g. a missing/extra property) or on the
   value (`"value"`, e.g. wrong datatype), boolean signals, how many sibling
   violations share the same focus node, and the actual violated SHACL
   shape's own declaration (via `sh:sourceShape`).
2. **Stage 2** ([`locateFixPrompt.ts`](./locateFixPrompt.ts)) -- an LLM call.
   Given Stage 1's output plus the full multi-file RML text, identifies the
   exact erroneous RML triple(s) and a `root_error_type`. Does not propose a
   fix.
3. **Stage 3** ([`proposeRepairPrompt.ts`](./proposeRepairPrompt.ts)) -- an
   LLM call. Given Stage 2's output, proposes the corrected replacement
   triple(s) and classifies the edit as one of ten `repair_type` values
   (`RepairType` in [`repairTypes.ts`](./repairTypes.ts)): `change_rdf_type`,
   `change_predicate`, `change_datatype`, `reformat_literal_value`,
   `add_missing_property`, `delete_property`, `change_termtype`,
   `change_subject_key`, `add_missing_type`, `unknown`. `reformat_literal_value`
   may use an RML-FN `grel:string_replace` function call instead of a plain
   template when the fix requires substituting a character inside the value
   (e.g. a space-separated datetime needing a `T`) -- something a
   `rr:template`/`rml:reference` alone cannot express.

[`applyRmlTextCorrection.ts`](./applyRmlTextCorrection.ts) applies Stage 3's
corrected triples by parsing the mapping's RML into a real RDF store and
replacing triples by **subject identity**, not text matching -- an LLM asked
to reproduce a triple will often normalize `rr:template` to its full
`<http://www.w3.org/ns/r2rml#template>` IRI, which broke naive substring
replacement entirely.

Regardless of repair_type, nothing is trusted on its own: a candidate fix is
only kept if re-executing the patched RML and re-validating shows the
violation count actually dropped; otherwise it's reverted.

## Guards: closing the "opt out of the shape" evasion path

Before any of this, [`repairGuards.ts`](./repairGuards.ts) restricts which
`repair_type` values are even offered, keyed by the violation's
`constraint_component` -- enforced as a hard check on Stage 3's response in
`state.ts` (and used to skip hopeless constraint components before spending
any LLM calls at all). This exists specifically to close an evasion path:
since acceptance is judged by violation *count*, reclassifying an entity
away from the class a shape targets can make a `MinCount`/`Closed` violation
vanish without fixing anything -- the entity just opts out of the shape.
`change_rdf_type` is therefore only ever offered for a genuine
`ClassConstraintComponent` violation (or `add_missing_type`, which types a
*referenced* resource rather than reclassifying the focus node -- not the
same evasion), never for `MinCount`/`Closed` ones, even though it would
"resolve" those too.

The guard table only covers constraint components Stage 2/3's own prompts
explicitly reason about (`Class`, `MinCount`, `Closed`, `Datatype`,
`MaxCount`); anything else resolves to no allowed operations and is skipped
-- a deliberately conservative, fail-safe default rather than guessing.

## Applying an accepted repair to the canvas

Accepted fixes only ever exist as patched RML text during a run. To reflect
them on the mapping's visual canvas, [`rmlToMappingGraph.ts`](./rmlToMappingGraph.ts)
parses that RML back into RDFCraft's own `MappingGraph` model (the inverse
of the YARRRML→RML generation pipeline), which `applyRepairedMapping`/
`applyAllRepairedMappings` in `state.ts` then persist via
`MappingService.updateMapping`. An RML-FN function call it can't fully
represent as a `$(Column)` template is preserved as a clearly-marked,
non-editable literal (`⚠ ... (function value, not editable here)`) rather
than silently dropped -- but re-saving that mapping from the canvas would
flatten it into a literal constant, losing the function call, so this is a
one-way rendering, not a full round trip.
