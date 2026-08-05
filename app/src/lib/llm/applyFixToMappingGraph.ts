import { MappingGraph } from '@/lib/api/mapping_service/types';
import { v4 as uuidv4 } from 'uuid';
import { LocatedTarget, ProposedFix } from './repairTypes';

export class UnresolvedFixError extends Error {}

const DEFAULT_LITERAL_DATATYPE = 'http://www.w3.org/2001/XMLSchema#string';

function localName(uri: string): string {
  const hashIndex = uri.lastIndexOf('#');
  const slashIndex = uri.lastIndexOf('/');
  const cut = Math.max(hashIndex, slashIndex);
  return cut >= 0 ? uri.slice(cut + 1) : uri;
}

/**
 * Applies a proposed fix to a COPY of the given mapping graph. Never mutates
 * the input. Throws UnresolvedFixError if the located target/fix don't
 * actually match the mapping (mirrors clustered-kg-refine's guard against
 * the LLM referencing an element that doesn't exist).
 */
export function applyFixToMappingGraph(
  mapping: MappingGraph,
  located: LocatedTarget,
  fix: ProposedFix,
): MappingGraph {
  const next: MappingGraph = structuredClone(mapping);

  if (located.target_type === 'entity') {
    if (fix.operation === 'add_missing_property') {
      const entity = next.nodes.find(n => n.id === located.target_id);
      if (!entity || entity.type !== 'entity') {
        throw new UnresolvedFixError(
          `Entity node ${located.target_id} not found in mapping`,
        );
      }
      if (!fix.new_value) {
        throw new UnresolvedFixError(
          'add_missing_property requires new_value (the missing predicate URI)',
        );
      }
      if (fix.new_node_kind !== 'literal' && fix.new_node_kind !== 'uri_ref') {
        throw new UnresolvedFixError(
          `add_missing_property requires new_node_kind of "literal" or "uri_ref", got ${fix.new_node_kind}`,
        );
      }
      if (!fix.new_node_value) {
        throw new UnresolvedFixError(
          'add_missing_property requires new_node_value (a value/URI template)',
        );
      }

      const newNodeId = uuidv4();
      const position = {
        x: entity.position.x + 320,
        y: entity.position.y + entity.properties.length * 100,
      };

      if (fix.new_node_kind === 'literal') {
        next.nodes.push({
          id: newNodeId,
          type: 'literal',
          label: localName(fix.new_value),
          value: fix.new_node_value,
          literal_type: fix.new_node_datatype ?? DEFAULT_LITERAL_DATATYPE,
          position,
        });
      } else {
        next.nodes.push({
          id: newNodeId,
          type: 'uri_ref',
          uri_pattern: fix.new_node_value,
          position,
        });
      }

      next.edges.push({
        id: uuidv4(),
        source: entity.id,
        target: newNodeId,
        source_handle: fix.new_value,
        target_handle: newNodeId,
      });

      if (!entity.properties.includes(fix.new_value)) {
        entity.properties.push(fix.new_value);
      }

      return next;
    }

    if (fix.operation !== 'change_rdf_type') {
      throw new UnresolvedFixError(
        `Fix operation ${fix.operation} does not match target_type entity`,
      );
    }
    const node = next.nodes.find(n => n.id === located.target_id);
    if (!node || node.type !== 'entity') {
      throw new UnresolvedFixError(
        `Entity node ${located.target_id} not found in mapping`,
      );
    }
    const index = node.rdf_type.indexOf(fix.old_value);
    if (index === -1) {
      throw new UnresolvedFixError(
        `rdf_type ${fix.old_value} not found on entity ${located.target_id}`,
      );
    }
    node.rdf_type[index] = fix.new_value;
    return next;
  }

  if (located.target_type === 'edge') {
    if (fix.operation !== 'change_predicate') {
      throw new UnresolvedFixError(
        `Fix operation ${fix.operation} does not match target_type edge`,
      );
    }
    const edge = next.edges.find(e => e.id === located.target_id);
    if (!edge) {
      throw new UnresolvedFixError(`Edge ${located.target_id} not found in mapping`);
    }
    if (edge.source_handle !== fix.old_value) {
      throw new UnresolvedFixError(
        `Edge ${located.target_id} predicate is ${edge.source_handle}, not ${fix.old_value}`,
      );
    }
    edge.source_handle = fix.new_value;

    // Keep the owning entity's `properties` handle list in sync -- it drives
    // which source handles render on the canvas (see EntityNode).
    const sourceEntity = next.nodes.find(n => n.id === edge.source);
    if (sourceEntity && sourceEntity.type === 'entity') {
      sourceEntity.properties = sourceEntity.properties.map(p =>
        p === fix.old_value ? fix.new_value : p,
      );
      if (!sourceEntity.properties.includes(fix.new_value)) {
        sourceEntity.properties.push(fix.new_value);
      }
    }
    return next;
  }

  if (located.target_type === 'literal') {
    const node = next.nodes.find(n => n.id === located.target_id);
    if (!node || node.type !== 'literal') {
      throw new UnresolvedFixError(
        `Literal node ${located.target_id} not found in mapping`,
      );
    }

    if (fix.operation === 'reformat_literal_value') {
      if (node.value !== fix.old_value) {
        throw new UnresolvedFixError(
          `Literal ${located.target_id} value is ${node.value}, not ${fix.old_value}`,
        );
      }
      node.value = fix.new_value;
      return next;
    }

    if (fix.operation !== 'change_datatype') {
      throw new UnresolvedFixError(
        `Fix operation ${fix.operation} does not match target_type literal`,
      );
    }
    if (node.literal_type !== fix.old_value) {
      throw new UnresolvedFixError(
        `Literal ${located.target_id} datatype is ${node.literal_type}, not ${fix.old_value}`,
      );
    }
    node.literal_type = fix.new_value;
    return next;
  }

  throw new UnresolvedFixError(`Unknown target_type: ${located.target_type}`);
}
