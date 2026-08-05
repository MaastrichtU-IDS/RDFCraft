import { Ontology } from '@/lib/api/ontology_api/types';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

export interface GenerateMappingContext {
  mappingName: string;
  mappingDescription: string;
  references: string[];
  ontologies: Ontology[];
  shapesContent: string[];
  prefixes: Record<string, string>;
}

/**
 * Wire format the LLM is asked to produce. Deliberately smaller than the
 * real MappingGraph shape (no XYFlow positions/handles) -- those are
 * derived deterministically after parsing, see normalizeGeneratedMapping.ts.
 */
export interface GeneratedMappingNode {
  id: string;
  kind: 'entity' | 'literal' | 'uri_ref';
  label?: string;
  uri_pattern?: string;
  rdf_type?: string[];
  value?: string;
  literal_type?: string;
}

export interface GeneratedMappingEdge {
  source: string;
  predicate: string;
  target: string;
}

export interface GeneratedMapping {
  nodes: GeneratedMappingNode[];
  edges: GeneratedMappingEdge[];
}

export function buildGenerateMappingMessages(
  ctx: GenerateMappingContext,
): ChatCompletionMessageParam[] {
  const ontologySummary = ctx.ontologies
    .map(ontology => {
      const classes = ontology.classes
        .map(c => `  - ${c.full_uri}`)
        .join('\n');
      const properties = ontology.properties
        .map(
          p =>
            `  - ${p.full_uri} (${p.property_type}, domain: ${p.domain.join(', ') || 'any'}, range: ${p.range.join(', ') || 'any'})`,
        )
        .join('\n');
      return `Ontology "${ontology.name}" (${ontology.base_uri}):\nClasses:\n${classes}\nProperties:\n${properties}`;
    })
    .join('\n\n');

  const shapesSummary = ctx.shapesContent
    .map((content, i) => `Shape set #${i + 1} (Turtle):\n${content}`)
    .join('\n\n');

  const systemPrompt = `
You are an RML mapping engineer. You design a mapping from a tabular data source (CSV/JSON) to RDF, for the RDFCraft tool.

You will be given: the source's column names ("references"), any ontology classes/properties available, and optionally SHACL shapes that the resulting RDF graph should conform to.

You must produce a JSON object with this exact shape:
{
  "nodes": [
    {
      "id": "<short unique slug, e.g. patient>",
      "kind": "entity",
      "label": "<human readable label>",
      "uri_pattern": "<URI template using $(ColumnName) placeholders for column references, e.g. http://example.org/patient/$(ROW_ID)>",
      "rdf_type": ["<one or more class URIs>"]
    },
    {
      "id": "<short unique slug>",
      "kind": "literal",
      "label": "<human readable label>",
      "value": "<template using $(ColumnName), e.g. $(GENDER)>",
      "literal_type": "<XSD datatype URI, e.g. http://www.w3.org/2001/XMLSchema#string>"
    },
    {
      "id": "<short unique slug>",
      "kind": "uri_ref",
      "uri_pattern": "<URI template using $(ColumnName) placeholders, used to reference another resource by URI without declaring its type here>"
    }
  ],
  "edges": [
    { "source": "<id of an entity node>", "predicate": "<property URI>", "target": "<id of any node>" }
  ]
}

Rules:
- Only use "$(ColumnName)" placeholders where ColumnName is exactly one of the given references. Never invent column names.
- Every entity node must have at least one outgoing edge to a literal or uri_ref node for each property that has useful column data.
- Prefer to reuse existing ontology classes/properties when given. Only invent new URIs (using the given prefixes as a base) if nothing suitable exists.
- If SHACL shapes are given, make sure the generated graph is likely to conform to them: include every property whose shape has "sh:minCount 1" or higher, and use exactly the datatypes/classes the shapes declare.
- Respond with ONLY the JSON object. No markdown, no commentary, no code fences.
`.trim();

  const userPrompt = `
Mapping name: ${ctx.mappingName}
Mapping description: ${ctx.mappingDescription}

Source column references:
${ctx.references.map(r => `- ${r}`).join('\n')}

Available prefixes:
${Object.entries(ctx.prefixes)
  .map(([prefix, uri]) => `- ${prefix}: ${uri}`)
  .join('\n')}

${ontologySummary ? `Ontology context:\n${ontologySummary}\n` : ''}
${shapesSummary ? `SHACL shapes to conform to:\n${shapesSummary}\n` : ''}

Generate the mapping JSON now.
`.trim();

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
