import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { MappingGraph } from '@/lib/api/mapping_service/types';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

/** Strips XYFlow positions -- irrelevant to locating the erroneous element, saves tokens. */
function summarizeMapping(mapping: MappingGraph) {
  return {
    name: mapping.name,
    nodes: mapping.nodes.map(node => {
      if (node.type === 'entity') {
        return {
          id: node.id,
          type: 'entity',
          label: node.label,
          rdf_type: node.rdf_type,
          properties: node.properties,
        };
      }
      if (node.type === 'literal') {
        return {
          id: node.id,
          type: 'literal',
          label: node.label,
          value: node.value,
          literal_type: node.literal_type,
        };
      }
      return { id: node.id, type: 'uri_ref', uri_pattern: node.uri_pattern };
    }),
    edges: mapping.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      predicate: edge.source_handle,
    })),
  };
}

export function buildLocateFixMessages(
  violation: ShaclViolation,
  mapping: MappingGraph,
): ChatCompletionMessageParam[] {
  const systemPrompt = `
You are a SHACL validation analyst. You are given one SHACL validation violation from a knowledge graph produced by an RML-style mapping, plus the JSON representation of the mapping that produced it.

Your job: identify which single element of the mapping is responsible for the violation.

The mapping has three kinds of elements:
- "entity" nodes: have an "id", a "label", a list "rdf_type" of RDF class URIs it is asserted to be an instance of, and a list "properties" of predicate URIs it can emit.
- "edge" objects: connect a source entity to a target node via a "predicate" URI -- this is what produces a single RDF triple's predicate.
- "literal" nodes: have an "id" and a "literal_type" (the XSD datatype URI of the value).

Common root causes:
- Wrong entity type (fix target: an "entity" node's rdf_type)
- Wrong predicate used for a relation (fix target: an "edge")
- Wrong literal datatype (fix target: a "literal" node)
- Wrong/malformed literal value, e.g. a date missing its time component (fix target: a "literal" node)
- A required property is entirely missing (e.g. sh:MinCountConstraintComponent with 0 values) -- the entity itself is missing an outgoing edge for that property. Fix target: the "entity" node that should have emitted it (there is no existing edge/literal to point at yet).

Respond with ONLY a JSON object of this exact shape, no markdown, no commentary:
{ "target_type": "entity" | "edge" | "literal", "target_id": "<the id of the entity/literal node, or the id of the edge>", "reasoning": "<one short sentence>" }

The target_id MUST be an id that literally appears in the given mapping JSON.
`.trim();

  const userPrompt = `
Violation:
${JSON.stringify(violation, null, 2)}

Mapping JSON:
${JSON.stringify(summarizeMapping(mapping), null, 2)}
`.trim();

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
