import dagre from '@dagrejs/dagre';
import { MappingGraph } from '@/lib/api/mapping_service/types';

// Rendered node sizes are only known after XYFlow mounts the nodes, so these
// are conservative estimates of EntityNode/LiteralNode/URIRefNode at zoom 1.
// Entity height grows with its property handle rows.
const NODE_WIDTH = 240;
const ENTITY_HEADER_HEIGHT = 90;
const ENTITY_ROW_HEIGHT = 60;
const LEAF_HEIGHT = 120;

const nodeHeight = (node: MappingGraph['nodes'][number]): number =>
  node.type === 'entity'
    ? ENTITY_HEADER_HEIGHT + ENTITY_ROW_HEIGHT * node.properties.length
    : LEAF_HEIGHT;

/**
 * Returns a copy of `graph` with node positions assigned by a left-to-right
 * layered (dagre) layout, so subjects sit to the left of their objects and
 * tall entity nodes don't overlap their neighbours.
 */
export function layoutMappingGraph<T extends Pick<MappingGraph, 'nodes' | 'edges'>>(
  graph: T,
): T {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 140, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: nodeHeight(node) });
  }
  for (const edge of graph.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      const { x, y, width, height } = g.node(node.id);
      // dagre reports centers; XYFlow positions are top-left corners.
      return { ...node, position: { x: x - width / 2, y: y - height / 2 } };
    }),
  };
}
