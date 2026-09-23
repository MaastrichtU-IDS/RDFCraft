import { Ontology } from '@/lib/api/ontology_api/types';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

export interface GenerateMappingContext {
  mappingName: string;
  mappingDescription: string;
  references: string[];
  ontologies: Ontology[];
  prefixes: Record<string, string>;
  /** A few sample rows from the source, for table_preview.example_rows. */
  exampleRows: Record<string, unknown>[];
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

/** Keeps a single example-row cell from blowing up the prompt (some source
 * columns, e.g. free-text descriptions, can run to thousands of characters). */
const MAX_EXAMPLE_CELL_LENGTH = 150;

function truncateCell(value: unknown): unknown {
  if (typeof value !== 'string' || value.length <= MAX_EXAMPLE_CELL_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_EXAMPLE_CELL_LENGTH)}...`;
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
        .map(p => {
          // RDFCraft's ontology indexer doesn't currently detect OWL
          // cardinality restrictions (owl:minCardinality/someValuesFrom),
          // so every property is reported "optional" until that's added --
          // this matches how a property with no declared restriction reads
          // in practice (e.g. the SEPSES CWE ontology declares none).
          const requirement = 'optional';
          const kind =
            p.property_type === 'object'
              ? 'reference to another resource (object property)'
              : `literal, datatype ${p.range[0] ?? 'unspecified'}`;
          return `  - ${p.full_uri} (${kind}, ${requirement}, domain: ${p.domain.join(', ') || 'any'})`;
        })
        .join('\n');
      return `Ontology "${ontology.name}" (${ontology.base_uri}):\nClasses:\n${classes}\nProperties:\n${properties}`;
    })
    .join('\n\n');

  const exampleRowsSummary = ctx.exampleRows
    .map(row => {
      const truncated = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, truncateCell(value)]),
      );
      return JSON.stringify(truncated);
    })
    .join('\n');

  const systemPrompt = `
You are an RML mapping engineer.

Task:

Given a tabular data source's schema (column names) and an ontology reference (classes and their properties), design a mapping that lifts this source into RDF using the ontology's classes and properties, for the RDFCraft tool.

Inputs:

* table_preview: the mapping name, the exact column names of the source ("references"), and a few example_rows.
* ontology reference: the classes available and, for each, its properties (required/optional, and whether each property takes a literal of a given datatype or a reference to another resource).

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
- Choose a uri_pattern for the entity node using one or more of the given column references, whichever forms a stable identifier for a row of this source.
- Map each relevant column to a property from the ontology reference by adding an edge from the entity node to a literal or uri_ref node, choosing the rdf_type for the entity that best represents what a row of this source conceptually is.
- For properties that are a reference to another resource (object properties), create a "uri_ref" node with a URI template that mints an IRI for the referenced resource; you do not need to give that resource its own rdf_type or outgoing edges.
- For properties that take a literal, create a "literal" node and set literal_type to exactly the datatype URI declared for that property in the ontology reference.
- Do not invent classes or properties outside the given ontology reference.
- Only create edges for column references that correspond to a property of the class you chose; you do not need to map every column.
- Only use "$(ColumnName)" placeholders where ColumnName is exactly one of the given references. Never invent column names.
- Prefer to reuse existing ontology classes/properties when given. Only invent new URIs (using the given prefixes as a base) if nothing suitable exists in the ontology reference.
- Use example_rows only to judge each column's actual content and format (e.g. to pick a sensible XSD datatype, or to see whether a column looks empty/unstable and so unsuitable as part of the uri_pattern) -- never copy an example value itself into a template.

Output rules:

- Do not use markdown code fences.
- Do not add any explanation before or after the mapping.
- Respond with ONLY the JSON object described above.
`.trim();

  const userPrompt = `
Mapping name: ${ctx.mappingName}
Mapping description: ${ctx.mappingDescription}

Source column references:
${ctx.references.map(r => `- ${r}`).join('\n')}

${exampleRowsSummary ? `Example rows:\n${exampleRowsSummary}\n` : ''}

Available prefixes:
${Object.entries(ctx.prefixes)
  .map(([prefix, uri]) => `- ${prefix}: ${uri}`)
  .join('\n')}

${ontologySummary ? `Ontology context:\n${ontologySummary}\n` : ''}

Generate the mapping JSON now.
`.trim();

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
