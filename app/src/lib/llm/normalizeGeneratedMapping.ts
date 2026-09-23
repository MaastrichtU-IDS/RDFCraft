import {
  MappingEdge,
  MappingGraph,
  MappingLiteral,
  MappingNode,
  MappingURIRef,
} from '@/lib/api/mapping_service/types';
import { v4 as uuidv4 } from 'uuid';
import { GeneratedMapping } from './generateMappingPrompt';

const GRID_COLUMNS = 4;
const X_SPACING = 320;
const Y_SPACING = 160;

/**
 * Converts the LLM's compact wire format (see GeneratedMapping) into a real
 * MappingGraph: assigns XYFlow-compatible positions, derives each entity's
 * `properties` handle list from its outgoing edges, and derives each edge's
 * source_handle (the predicate) / target_handle (the target node's own id) --
 * see EntityNode/LiteralNode/URIRefNode, whose target handle id is always
 * the node's own id, and whose source handles are one per entry in
 * `properties`.
 */
export function normalizeGeneratedMapping(
  generated: GeneratedMapping,
  existing: Pick<
    MappingGraph,
    'uuid' | 'name' | 'description' | 'source_id'
  >,
): MappingGraph {
  if (!Array.isArray(generated.nodes) || generated.nodes.length === 0) {
    throw new Error('Generated mapping has no nodes');
  }

  const seenIds = new Set<string>();
  const idMap = new Map<string, string>();

  const resolveId = (rawId: string): string => {
    if (idMap.has(rawId)) return idMap.get(rawId) as string;
    let candidate = String(rawId || uuidv4()).trim() || uuidv4();
    while (seenIds.has(candidate)) {
      candidate = `${candidate}-${uuidv4().slice(0, 4)}`;
    }
    seenIds.add(candidate);
    idMap.set(rawId, candidate);
    return candidate;
  };

  // Every entity's `properties` array drives which source handles are
  // rendered on the canvas -- must contain every predicate used by its
  // outgoing edges, or those edges have nowhere to visually attach.
  const propertiesByEntity = new Map<string, Set<string>>();
  for (const edge of generated.edges ?? []) {
    if (!edge?.source || !edge?.predicate || !edge?.target) continue;
    const sourceId = resolveId(edge.source);
    if (!propertiesByEntity.has(sourceId)) {
      propertiesByEntity.set(sourceId, new Set());
    }
    propertiesByEntity.get(sourceId)?.add(edge.predicate);
  }

  const nodes: (MappingNode | MappingLiteral | MappingURIRef)[] =
    generated.nodes.map((node, index) => {
      const id = resolveId(node.id);
      const position = {
        x: (index % GRID_COLUMNS) * X_SPACING,
        y: Math.floor(index / GRID_COLUMNS) * Y_SPACING,
      };

      switch (node.kind) {
        case 'entity':
          return {
            id,
            type: 'entity',
            label: node.label ?? id,
            uri_pattern: node.uri_pattern ?? '',
            rdf_type: node.rdf_type ?? [],
            properties: Array.from(propertiesByEntity.get(id) ?? []),
            position,
          } as MappingNode;
        case 'literal':
          return {
            id,
            type: 'literal',
            label: node.label ?? id,
            value: node.value ?? '',
            literal_type:
              node.literal_type ?? 'http://www.w3.org/2001/XMLSchema#string',
            position,
          } as MappingLiteral;
        case 'uri_ref':
          return {
            id,
            type: 'uri_ref',
            uri_pattern: node.uri_pattern ?? '',
            position,
          } as MappingURIRef;
        default:
          throw new Error(`Unknown generated node kind: ${node.kind}`);
      }
    });

  const nodeIds = new Set(nodes.map(n => n.id));

  const edges: MappingEdge[] = (generated.edges ?? [])
    .filter(edge => edge?.source && edge?.predicate && edge?.target)
    .map(edge => {
      const source = idMap.get(edge.source) ?? edge.source;
      const target = idMap.get(edge.target) ?? edge.target;
      return {
        id: uuidv4(),
        source,
        target,
        source_handle: edge.predicate,
        target_handle: target,
      };
    })
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return {
    uuid: existing.uuid,
    name: existing.name,
    description: existing.description,
    source_id: existing.source_id,
    nodes,
    edges,
  };
}
