import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { MappingGraph } from '@/lib/api/mapping_service/types';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { ClassRequirements } from './parseShapeClassRequirements';
import { LocatedTarget } from './repairTypes';

export function buildProposeFixMessages(
  violation: ShaclViolation,
  mapping: MappingGraph,
  located: LocatedTarget,
  classRequirements: ClassRequirements,
  sourceReferences: string[],
): ChatCompletionMessageParam[] {
  const target = mapping.nodes.find(n => n.id === located.target_id);
  const edge = mapping.edges.find(e => e.id === located.target_id);

  const systemPrompt = `
You are an RML mapping repair engineer. You are given a SHACL violation, the mapping element responsible for it (already located), a compact summary of every RDF class the shapes define -- for each class: whether it is closed (declaring any other property is a violation), and which properties it allows, each with its required minimum count and expected datatype (if any) -- and the source's column names ("references").

Propose exactly one fix. Respond with ONLY a JSON object, no markdown, no commentary, of one of these five shapes depending on the operation:

1) Wrong entity type:
{ "operation": "change_rdf_type", "old_value": "<current class URI, must be one of the entity's current rdf_type values>", "new_value": "<corrected class URI>", "reasoning": "..." }

2) Wrong predicate on a relation:
{ "operation": "change_predicate", "old_value": "<current predicate URI, must be the edge's current predicate>", "new_value": "<corrected predicate URI>", "reasoning": "..." }

3) Wrong literal datatype declaration:
{ "operation": "change_datatype", "old_value": "<current datatype URI, must be the literal's current literal_type>", "new_value": "<corrected datatype URI>", "reasoning": "..." }

4) Malformed/wrong literal value template (e.g. a date string missing its time component for a dateTime-typed property) -- fixes the VALUE TEMPLATE, not the datatype declaration:
{ "operation": "reformat_literal_value", "old_value": "<the literal's current value template, must match exactly>", "new_value": "<corrected value template, e.g. wrap the same $(Column) reference with a fixed literal suffix/prefix like \\"$(DOB)T00:00:00\\">", "reasoning": "..." }

5) Required property entirely missing (sh:MinCountConstraintComponent, 0 values) -- creates a brand new node + edge on the located entity:
{
  "operation": "add_missing_property",
  "old_value": "",
  "new_value": "<the missing predicate URI, must appear in classRequirements for this entity's class>",
  "new_node_kind": "literal" | "uri_ref",
  "new_node_value": "<for literal: a value template using $(ColumnName); for uri_ref: a URI template using $(ColumnName)>",
  "new_node_datatype": "<for literal only: the XSD datatype URI classRequirements declares for this property>",
  "reasoning": "..."
}

Rules:
- Only use "$(ColumnName)" placeholders where ColumnName is exactly one of the given source references. Never invent column names.
- Only propose class/predicate/datatype URIs that appear in classRequirements -- never invent one.
- Match the operation to target_type: "entity" -> change_rdf_type or add_missing_property; "edge" -> change_predicate; "literal" -> change_datatype or reformat_literal_value.
`.trim();

  const userPrompt = `
Violation:
${JSON.stringify(violation, null, 2)}

Located target:
${JSON.stringify(located, null, 2)}

Target element:
${JSON.stringify(target ?? edge ?? null, null, 2)}

classRequirements (per-class allowed properties, derived from the SHACL shapes):
${JSON.stringify(classRequirements, null, 2)}

Source column references:
${sourceReferences.map(r => `- ${r}`).join('\n')}
`.trim();

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
