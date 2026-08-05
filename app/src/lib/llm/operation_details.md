# Repair Operations

The Validate & Refine auto-repair loop (`src/pages/validation_page/state.ts`) fixes SHACL
violations by proposing one of five typed operations per iteration. Each operation is
defined in [`repairTypes.ts`](./repairTypes.ts) and applied by
[`applyFixToMappingGraph.ts`](./applyFixToMappingGraph.ts), which works on a **copy** of the
mapping graph and never mutates the original.

Regardless of operation, nothing is trusted on its own: a candidate fix is only persisted if
re-materializing and re-validating the resulting graph shows the violation count actually
dropped. A syntactically valid but semantically wrong fix is discarded even if
`applyFixToMappingGraph` raised no error.

## 1. `change_rdf_type`

**Fixes:** wrong entity class (`sh:ClassConstraintComponent`, or a closed-shape violation
where the entity's actual type doesn't match any shape that allows the property it's
emitting).

**Target:** `entity`

**Fields:** `old_value` / `new_value` = class URIs.

**Mechanics:** finds `old_value` inside the entity's `rdf_type` array (an entity can have
multiple asserted types) and replaces just that element with `new_value`.

**Guard:** throws `UnresolvedFixError` if `old_value` isn't actually present in `rdf_type`.

## 2. `change_predicate`

**Fixes:** wrong predicate on a relation, usually a closed-shape violation
(`sh:ClosedConstraintComponent`) where the entity emits a property the shape doesn't allow.

**Target:** `edge`

**Fields:** `old_value` / `new_value` = predicate URIs.

**Mechanics:** finds the edge by id, verifies `edge.source_handle === old_value`, sets it to
`new_value`. Also updates the **source entity's** `properties` array (removes the old
predicate, adds the new one) -- `EntityNode` derives its connectable source handles from that
list, so skipping this would silently break the canvas even though the underlying triple
would still materialize correctly.

**Real example (MIMIC demo):** DIAGNOSES_ICD's `label` (`rdf-schema#label`, disallowed) →
`hasCode`. 38 → 19 violations, accepted.

## 3. `change_datatype`

**Fixes:** wrong datatype *declaration* (`sh:DatatypeConstraintComponent` where the shape
wants a different XSD type than what's declared, e.g. entity declares `xsd:string` where
`xsd:dateTime` is required).

**Target:** `literal`

**Fields:** `old_value` / `new_value` = XSD datatype URIs.

**Mechanics:** verifies `node.literal_type === old_value`, sets `node.literal_type =
new_value`. Changes the *type tag* only -- the underlying value template is untouched.

## 4. `reformat_literal_value`

**Fixes:** a *malformed* literal value for its declared datatype -- the datatype declaration
is already correct, but the actual value string doesn't parse as that type (e.g.
`"1965-05-30"` isn't a valid `xsd:dateTime` lexical form, it's missing the time component).

**Target:** `literal`

**Fields:** `old_value` / `new_value` = value **templates**, not literal constants -- e.g.
`$(DOB)` → `$(DOB)T00:00:00`.

**Mechanics:** verifies `node.value === old_value`, sets `node.value = new_value`. Distinct
from `change_datatype` -- this edits the RML template string, which supports mixing
`$(ColumnName)` references with literal text exactly like URI templates do (confirmed by
hand-testing `rr:template "{DOB}T00:00:00"` through the real RMLMapper -- it correctly
appended the time suffix per row).

**Real example (MIMIC demo):** PATIENTS' `dob_literal` node, `$(DOB)` → `$(DOB)T00:00:00`,
dropped violations 17 → 2 in one shot -- fixed every malformed birthdate across all 15
patients at once, since one node's template governs every row.

## 5. `add_missing_property`

**Fixes:** `sh:MinCountConstraintComponent` -- a required property is entirely absent, so
there's no existing edge or literal to point a fix at.

**Target:** `entity` (the entity that should have emitted the property)

**Fields:**
- `new_value` = the missing predicate URI
- `new_node_kind` = `'literal' | 'uri_ref'`
- `new_node_value` = a value template (literal) or URI template (uri_ref)
- `new_node_datatype` = XSD type (literal only, optional)

**Mechanics:** the only operation that *creates* graph elements rather than editing one. It
builds a brand-new node (id via `uuidv4()`, positioned at `entity.x + 320, entity.y +
properties.length*100` so it doesn't overlap existing children), pushes it into
`next.nodes`, creates a new edge from the entity to that node with `source_handle =
new_value` and `target_handle` = the new node's own id (matching how `EntityNode` /
`LiteralNode` / `URIRefNode` render their target handle as their own id), and adds the
predicate to the entity's `properties` list.

**Real example (MIMIC demo):** ADMISSIONS was missing `hasAdministrativeGender` entirely -- a
new literal node templated `$(ADMISSION_TYPE)` was added, dropping 60 → 30 violations.

## Cross-cutting guard logic

Every operation validates that `fix.operation` actually matches `located.target_type` before
touching anything (e.g. `add_missing_property` requires `target_type: 'entity'` -- when the
LLM located an `edge` instead, `applyFixToMappingGraph` threw before any mutation, logged as
"Fix could not be applied," and the iteration moved on cleanly).
