import { DataFactory, Parser, Store } from 'n3';

const { namedNode } = DataFactory;

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SH_NODE_SHAPE = 'http://www.w3.org/ns/shacl#NodeShape';
const SH_TARGET_CLASS = 'http://www.w3.org/ns/shacl#targetClass';
const SH_CLOSED = 'http://www.w3.org/ns/shacl#closed';
const SH_PROPERTY = 'http://www.w3.org/ns/shacl#property';
const SH_PATH = 'http://www.w3.org/ns/shacl#path';
const SH_MIN_COUNT = 'http://www.w3.org/ns/shacl#minCount';
const SH_DATATYPE = 'http://www.w3.org/ns/shacl#datatype';

export interface PropertyRequirement {
  min_count?: number;
  datatype?: string;
}

export interface ClassRequirement {
  closed: boolean;
  properties: Record<string, PropertyRequirement>;
}

export type ClassRequirements = Record<string, ClassRequirement>;

/**
 * Parses a SHACL shapes graph into a compact per-class summary: which
 * properties each class is allowed/required to have, with their expected
 * datatype, and whether the shape is closed (extra properties are
 * violations). Multiple NodeShapes targeting the same class (e.g. a
 * completeness shape + a datatype shape, as in clustered-kg-refine's
 * generated_shacl.ttl) are merged together.
 *
 * This replaces handing the fix-proposal LLM the raw shapes Turtle to parse
 * itself -- cheaper and more reliable for any model, mirrors
 * clustered-kg-refine's build_schema_context_for_stage3().
 */
export function parseShapeClassRequirements(shapesTtl: string): ClassRequirements {
  const store = new Store();
  try {
    const parser = new Parser({ format: 'text/turtle' });
    store.addQuads(parser.parse(shapesTtl));
  } catch {
    return {};
  }

  const requirements: ClassRequirements = {};

  const nodeShapeSubjects = store.getSubjects(
    namedNode(RDF_TYPE),
    namedNode(SH_NODE_SHAPE),
    null,
  );

  for (const shape of nodeShapeSubjects) {
    const targetClasses = store.getObjects(shape, namedNode(SH_TARGET_CLASS), null);
    if (targetClasses.length === 0) continue;

    const isClosed = store
      .getObjects(shape, namedNode(SH_CLOSED), null)
      .some(v => v.value === 'true');

    const propertyShapes = store.getObjects(shape, namedNode(SH_PROPERTY), null);

    for (const targetClass of targetClasses) {
      const classUri = targetClass.value;
      if (!requirements[classUri]) {
        requirements[classUri] = { closed: false, properties: {} };
      }
      if (isClosed) {
        requirements[classUri].closed = true;
      }

      for (const propShape of propertyShapes) {
        const paths = store.getObjects(propShape, namedNode(SH_PATH), null);
        if (paths.length === 0) continue;
        const path = paths[0].value;

        if (!requirements[classUri].properties[path]) {
          requirements[classUri].properties[path] = {};
        }
        const entry = requirements[classUri].properties[path];

        const minCounts = store.getObjects(propShape, namedNode(SH_MIN_COUNT), null);
        if (minCounts.length > 0) {
          const parsed = parseInt(minCounts[0].value, 10);
          if (!Number.isNaN(parsed)) {
            entry.min_count = parsed;
          }
        }

        const datatypes = store.getObjects(propShape, namedNode(SH_DATATYPE), null);
        if (datatypes.length > 0) {
          entry.datatype = datatypes[0].value;
        }
      }
    }
  }

  return requirements;
}
