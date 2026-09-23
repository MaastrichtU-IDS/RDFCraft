import {
  MappingEdge,
  MappingGraph,
  MappingLiteral,
  MappingNode,
  MappingURIRef,
} from '@/lib/api/mapping_service/types';
import { DataFactory, Parser, Quad_Subject, Store, Term } from 'n3';
import { v4 as uuidv4 } from 'uuid';

const { namedNode } = DataFactory;

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RR_TRIPLES_MAP = 'http://www.w3.org/ns/r2rml#TriplesMap';
const RR_SUBJECT_MAP = 'http://www.w3.org/ns/r2rml#subjectMap';
const RR_SUBJECT = 'http://www.w3.org/ns/r2rml#subject';
const RR_PREDICATE_OBJECT_MAP = 'http://www.w3.org/ns/r2rml#predicateObjectMap';
const RR_PREDICATE_MAP = 'http://www.w3.org/ns/r2rml#predicateMap';
const RR_PREDICATE = 'http://www.w3.org/ns/r2rml#predicate';
const RR_OBJECT_MAP = 'http://www.w3.org/ns/r2rml#objectMap';
const RR_OBJECT = 'http://www.w3.org/ns/r2rml#object';
const RR_CONSTANT = 'http://www.w3.org/ns/r2rml#constant';
const RR_TEMPLATE = 'http://www.w3.org/ns/r2rml#template';
const RML_REFERENCE = 'http://semweb.mmlab.be/ns/rml#reference';
const RR_DATATYPE = 'http://www.w3.org/ns/r2rml#datatype';
const RR_TERM_TYPE = 'http://www.w3.org/ns/r2rml#termType';
const RR_IRI = 'http://www.w3.org/ns/r2rml#IRI';
const RR_LITERAL = 'http://www.w3.org/ns/r2rml#Literal';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';

const FNML_FUNCTION_VALUE = 'http://semweb.mmlab.be/ns/fnml#functionValue';
const FNO_EXECUTES = 'https://w3id.org/function/ontology#executes';
const GREL_STRING_REPLACE = 'http://users.ugent.be/~bjdmeest/function/grel.ttl#string_replace';
const GREL_VALUE_PARAMETER = 'http://users.ugent.be/~bjdmeest/function/grel.ttl#valueParameter';
const GREL_FIND_PARAM = 'http://users.ugent.be/~bjdmeest/function/grel.ttl#p_string_find';
const GREL_REPLACE_PARAM = 'http://users.ugent.be/~bjdmeest/function/grel.ttl#p_string_replace';

const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

const GRID_COLUMNS = 4;
const X_SPACING = 320;
const Y_SPACING = 160;

export class RmlParseError extends Error {}

/** RML's `{Column}` -> RDFCraft's own `$(Column)` template placeholder syntax. */
function rmlTemplateToPlaceholder(template: string): string {
  return template.replace(/\{([^}]+)\}/g, '$($1)');
}

function localName(value: string): string {
  const hashIndex = value.lastIndexOf('#');
  const slashIndex = value.lastIndexOf('/');
  const cut = Math.max(hashIndex, slashIndex);
  return cut >= 0 ? value.slice(cut + 1) : value;
}

interface ResolvedObject {
  kind: 'literal' | 'uri_ref';
  value: string;
  literalType?: string;
}

interface BuiltEdge {
  predicate: string;
  object: ResolvedObject;
}

interface BuiltEntity {
  id: string;
  label: string;
  uriPattern: string;
  rdfType: string[];
  edges: BuiltEdge[];
}

function resolveSubjectMapTemplate(store: Store, tm: Quad_Subject): string | null {
  const subjectMap = store.getObjects(tm, namedNode(RR_SUBJECT_MAP), null)[0];
  if (subjectMap) {
    const template = store.getObjects(subjectMap, namedNode(RR_TEMPLATE), null)[0];
    if (template) return rmlTemplateToPlaceholder(template.value);

    const constant = store.getObjects(subjectMap, namedNode(RR_CONSTANT), null)[0];
    if (constant) return constant.value;

    const reference = store.getObjects(subjectMap, namedNode(RML_REFERENCE), null)[0];
    if (reference) return `$(${reference.value})`;

    return null;
  }

  const shortcut = store.getObjects(tm, namedNode(RR_SUBJECT), null)[0];
  return shortcut ? shortcut.value : null;
}

function resolvePredicateIri(store: Store, pom: Term): string | null {
  const predicateMap = store.getObjects(pom, namedNode(RR_PREDICATE_MAP), null)[0];
  if (predicateMap) {
    const constant = store.getObjects(predicateMap, namedNode(RR_CONSTANT), null)[0];
    if (constant) return constant.value;
  }

  const shortcut = store.getObjects(pom, namedNode(RR_PREDICATE), null)[0];
  return shortcut ? shortcut.value : null;
}

/**
 * Summarizes an fnml:functionValue's function call as a short, readable
 * string -- e.g. `FN:grel:string_replace($(ADMITTIME), find=" ", replace="T")`
 * -- rather than silently dropping the property, which is what happened
 * before: resolveObject() found none of rr:constant/rr:template/rml:reference
 * on an FNML-based ObjectMap and returned null, so the whole edge vanished
 * from the graph. This is intentionally NOT a `$(Column)` template: it can't
 * be edited meaningfully from the node panel, and re-saving this mapping
 * from the canvas would flatten it into a literal constant, losing the
 * function call -- surfacing it beats silently deleting the property, but
 * it is not a full round trip.
 */
function summarizeFunctionValue(store: Store, functionValueNode: Term): string {
  let functionUri: string | null = null;
  const args: Record<string, string> = {};

  for (const pom of store.getObjects(functionValueNode, namedNode(RR_PREDICATE_OBJECT_MAP), null)) {
    const predicate = resolvePredicateIri(store, pom);
    if (!predicate) continue;

    if (predicate === FNO_EXECUTES) {
      const object = resolveObject(store, pom);
      if (object) functionUri = object.value;
      continue;
    }

    const object = resolveObject(store, pom);
    if (object) args[predicate] = object.value;
  }

  if (functionUri === GREL_STRING_REPLACE) {
    const value = args[GREL_VALUE_PARAMETER] ?? '?';
    const find = args[GREL_FIND_PARAM] ?? '?';
    const replace = args[GREL_REPLACE_PARAM] ?? '?';
    return `FN:grel:string_replace(${value}, find=${JSON.stringify(find)}, replace=${JSON.stringify(replace)})`;
  }

  if (functionUri) {
    const argsText = Object.entries(args)
      .map(([predicate, value]) => `${localName(predicate)}=${value}`)
      .join(', ');
    return `FN:${localName(functionUri)}(${argsText})`;
  }

  return 'FN:(unrecognized function)';
}

function resolveObject(store: Store, pom: Term): ResolvedObject | null {
  const objectMap = store.getObjects(pom, namedNode(RR_OBJECT_MAP), null)[0];
  if (objectMap) {
    const constant = store.getObjects(objectMap, namedNode(RR_CONSTANT), null)[0];
    const template = store.getObjects(objectMap, namedNode(RR_TEMPLATE), null)[0];
    const reference = store.getObjects(objectMap, namedNode(RML_REFERENCE), null)[0];
    const functionValue = store.getObjects(objectMap, namedNode(FNML_FUNCTION_VALUE), null)[0];
    const termType = store.getObjects(objectMap, namedNode(RR_TERM_TYPE), null)[0];
    const datatype = store.getObjects(objectMap, namedNode(RR_DATATYPE), null)[0];
    const isIriTermType = termType?.value === RR_IRI;
    const isLiteralTermType = termType?.value === RR_LITERAL;

    if (constant) {
      if (constant.termType === 'NamedNode' || (isIriTermType && constant.termType !== 'Literal')) {
        return { kind: 'uri_ref', value: constant.value };
      }
      if (constant.termType === 'Literal') {
        return { kind: 'literal', value: constant.value, literalType: datatype?.value ?? XSD_STRING };
      }
      return null;
    }

    if (template) {
      const pattern = rmlTemplateToPlaceholder(template.value);
      if (isLiteralTermType) {
        return { kind: 'literal', value: pattern, literalType: datatype?.value ?? XSD_STRING };
      }
      // rr:template defaults to termType rr:IRI per the R2RML spec.
      return { kind: 'uri_ref', value: pattern };
    }

    if (reference) {
      const pattern = `$(${reference.value})`;
      if (isIriTermType) {
        return { kind: 'uri_ref', value: pattern };
      }
      return { kind: 'literal', value: pattern, literalType: datatype?.value ?? XSD_STRING };
    }

    if (functionValue) {
      return {
        kind: 'literal',
        value: summarizeFunctionValue(store, functionValue),
        literalType: datatype?.value ?? XSD_STRING,
      };
    }

    return null;
  }

  const shortcut = store.getObjects(pom, namedNode(RR_OBJECT), null)[0];
  if (shortcut) {
    if (shortcut.termType === 'NamedNode') {
      return { kind: 'uri_ref', value: shortcut.value };
    }
    return { kind: 'literal', value: shortcut.value, literalType: XSD_STRING };
  }

  return null;
}

/**
 * Parses real RML/Turtle text back into RDFCraft's own MappingGraph model --
 * the inverse of the YARRRML->RML generation pipeline (see
 * yarrrml_service/index.ts), so an Auto-Repair run's accepted fixes (which
 * only ever exist as patched RML text -- see applyRmlTextCorrection.ts) can
 * be reflected on the mapping's visual canvas instead of only being
 * downloadable.
 *
 * Handles both the full Map-node form RMLGenerator always produces (and
 * that the Stage 3 repair prompt requires for any node it adds) and the
 * rr:predicate/rr:object shortcut forms the same prompt allows as an
 * alternative.
 *
 * Every TriplesMap becomes an entity node. When one TriplesMap's subject
 * template exactly matches another edge's uri_ref target elsewhere in the
 * mapping -- the shape an "add_missing_type" repair produces, a brand new
 * TriplesMap that only asserts rdf:type on a resource an existing property
 * already mints -- the two are merged: the edge is redirected to the real
 * entity node (now carrying that rdf:type) instead of a separate floating
 * uri_ref/entity pair, mirroring the original AI-generated graph's shape.
 */
export function parseRmlToMappingGraph(
  rmlText: string,
  existing: Pick<MappingGraph, 'uuid' | 'name' | 'description' | 'source_id'>,
): MappingGraph {
  let store: Store;
  try {
    store = new Store(new Parser({ format: 'text/turtle' }).parse(rmlText));
  } catch (error) {
    throw new RmlParseError(
      `Repaired RML did not parse as valid Turtle: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // An fnml:functionValue's own nested TriplesMap (see summarizeFunctionValue
  // above) is internal RML-FN plumbing, not a row-generating table entity --
  // it's already folded into the literal node that holds its FN: summary,
  // so exclude it here or it would also surface as a spurious top-level
  // entity (its own "executes"/"valueParameter"/... predicateObjectMaps).
  const functionValueNodeIds = new Set(
    store.getObjects(null, namedNode(FNML_FUNCTION_VALUE), null).map(term => term.value),
  );

  const triplesMaps = store
    .getSubjects(namedNode(RDF_TYPE), namedNode(RR_TRIPLES_MAP), null)
    .filter(tm => !functionValueNodeIds.has(tm.value));
  if (triplesMaps.length === 0) {
    throw new RmlParseError('No rr:TriplesMap found in the repaired RML');
  }

  const built: BuiltEntity[] = [];

  for (const tm of triplesMaps) {
    const uriPattern = resolveSubjectMapTemplate(store, tm);
    if (!uriPattern) continue;

    const label = store.getObjects(tm, namedNode(RDFS_LABEL), null)[0]?.value ?? localName(tm.value);
    const rdfType: string[] = [];
    const edges: BuiltEdge[] = [];

    for (const pom of store.getObjects(tm, namedNode(RR_PREDICATE_OBJECT_MAP), null)) {
      const predicate = resolvePredicateIri(store, pom);
      if (!predicate) continue;

      const object = resolveObject(store, pom);
      if (!object) continue;

      if (predicate === RDF_TYPE && object.kind === 'uri_ref') {
        rdfType.push(object.value);
        continue;
      }

      edges.push({ predicate, object });
    }

    built.push({ id: tm.value, label, uriPattern, rdfType, edges });
  }

  if (built.length === 0) {
    throw new RmlParseError('No parseable TriplesMap (with a resolvable subject template) found');
  }

  const entityByPattern = new Map<string, BuiltEntity>();
  for (const entity of built) entityByPattern.set(entity.uriPattern, entity);

  const nodes: (MappingNode | MappingLiteral | MappingURIRef)[] = [];
  const edges: MappingEdge[] = [];
  const createdEntityNodes = new Map<string, MappingNode>();
  let gridIndex = 0;

  const nextPosition = () => {
    const position = {
      x: (gridIndex % GRID_COLUMNS) * X_SPACING,
      y: Math.floor(gridIndex / GRID_COLUMNS) * Y_SPACING,
    };
    gridIndex++;
    return position;
  };

  const materializeEntity = (entity: BuiltEntity): MappingNode => {
    const existingNode = createdEntityNodes.get(entity.id);
    if (existingNode) return existingNode;

    const node: MappingNode = {
      id: entity.id,
      type: 'entity',
      label: entity.label,
      uri_pattern: entity.uriPattern,
      rdf_type: entity.rdfType,
      properties: [],
      position: nextPosition(),
    };
    createdEntityNodes.set(entity.id, node);
    nodes.push(node);
    return node;
  };

  for (const entity of built) materializeEntity(entity);

  for (const entity of built) {
    const sourceNode = createdEntityNodes.get(entity.id)!;
    const properties = new Set<string>();

    for (const edge of entity.edges) {
      let targetNode: MappingNode | MappingLiteral | MappingURIRef;

      const mergedEntity =
        edge.object.kind === 'uri_ref' ? entityByPattern.get(edge.object.value) : undefined;

      if (mergedEntity) {
        targetNode = materializeEntity(mergedEntity);
      } else if (edge.object.kind === 'uri_ref') {
        targetNode = {
          id: uuidv4(),
          type: 'uri_ref',
          uri_pattern: edge.object.value,
          position: nextPosition(),
        };
        nodes.push(targetNode);
      } else {
        const isFunctionValue = edge.object.value.startsWith('FN:');
        targetNode = {
          id: uuidv4(),
          type: 'literal',
          label: isFunctionValue
            ? `⚠ ${localName(edge.predicate)} (function value, not editable here)`
            : localName(edge.predicate),
          value: edge.object.value,
          literal_type: edge.object.literalType ?? XSD_STRING,
          position: nextPosition(),
        };
        nodes.push(targetNode);
      }

      properties.add(edge.predicate);
      edges.push({
        id: uuidv4(),
        source: sourceNode.id,
        target: targetNode.id,
        source_handle: edge.predicate,
        target_handle: targetNode.id,
      });
    }

    sourceNode.properties = Array.from(properties);
  }

  return {
    uuid: existing.uuid,
    name: existing.name,
    description: existing.description,
    source_id: existing.source_id,
    nodes,
    edges,
  };
}
