import { MappingGraph } from '@/lib/api/mapping_service/types';
import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { DataFactory, Parser, Store } from 'n3';

const { namedNode } = DataFactory;
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/**
 * Best-effort: finds which mapping's entity node declares the focus node's
 * asserted rdf:type as one of its own `rdf_type` values. Works well when
 * each RDF class is only ever produced by one mapping/table (true for the
 * bundled MIMIC example), falls back to null otherwise -- callers should
 * skip violations they can't attribute to a single mapping.
 */
export function buildGraphStore(mergedTtl: string): Store {
  const store = new Store();
  const parser = new Parser({ format: 'text/turtle' });
  store.addQuads(parser.parse(mergedTtl));
  return store;
}

export function resolveOwningMapping(
  violation: ShaclViolation,
  store: Store,
  mappings: MappingGraph[],
): MappingGraph | null {
  if (!violation.focus_node) return null;

  const types = store
    .getObjects(namedNode(violation.focus_node), namedNode(RDF_TYPE), null)
    .map(t => t.value);

  if (types.length === 0) return null;

  const candidates = mappings.filter(mapping =>
    mapping.nodes.some(
      node => node.type === 'entity' && node.rdf_type.some(t => types.includes(t)),
    ),
  );

  return candidates.length === 1 ? candidates[0] : null;
}
