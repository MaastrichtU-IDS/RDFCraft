import {
  XYEdgeType,
  XYNodeTypes,
} from '@/pages/mapping_page/components/MainPanel/types';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import MappingService from '../../lib/api/mapping_service';
import { MappingGraph } from '../../lib/api/mapping_service/types';
import OntologyApi from '../../lib/api/ontology_api';
import { Ontology } from '../../lib/api/ontology_api/types';
import PrefixApi from '../../lib/api/prefix_api';
import { Prefix } from '../../lib/api/prefix_api/types';
import SourceApi from '../../lib/api/source_api';
import { Source } from '../../lib/api/source_api/types';
import { ZustandActions } from '../../utils/zustand';

interface MappingPageState {
  mapping: MappingGraph | null;
  source: Source | null;
  ontologies: Ontology[] | null;
  prefixes: Prefix[] | null;
  isLoading: string | null;
  error: string | null;
}

interface MappingPageStateActions {
  loadMapping: (workspaceUuid: string, mappingUuid: string) => Promise<void>;
  saveMapping: (
    workspaceUuid: string,
    mappingUuid: string,
    mappingGraph: MappingGraph,
    nodes: XYNodeTypes[],
    edges: XYEdgeType[],
  ) => Promise<void>;
}

const defaultState: MappingPageState = {
  mapping: null,
  source: null,
  ontologies: null,
  prefixes: null,
  isLoading: null,
  error: null,
};

const functions: ZustandActions<MappingPageStateActions, MappingPageState> = (
  set,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get,
) => ({
  async loadMapping(workspaceUuid: string, mappingUuid: string) {
    set({ isLoading: 'Loading mapping...' });
    try {
      const mapping_promise = MappingService.getMappingInWorkspace(
        workspaceUuid,
        mappingUuid,
      );
      const ontologies_promise =
        OntologyApi.getOntologiesInWorkspace(workspaceUuid);
      const prefixes_promise = PrefixApi.getPrefixesInWorkspace(workspaceUuid);

      const [mapping, ontologies, prefixes] = await Promise.all([
        mapping_promise,
        ontologies_promise,
        prefixes_promise,
      ]);

      const source = await SourceApi.getSource(mapping.source_id);

      set({ mapping, source, ontologies, prefixes, error: null });
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      set({ isLoading: null });
    }
  },
  async saveMapping(
    workspaceUuid: string,
    mappingUuid: string,
    mappingGraph: MappingGraph,
    nodes: XYNodeTypes[],
    edges: XYEdgeType[],
  ) {
    set({ isLoading: 'Saving mapping...' });
    // Convert nodes and edges to MappingGraph, sync nodes position and id with node.data
    // and edges source, sourceHandle, target, targetHandle and id with edge.data
    const mapping = {
      ...mappingGraph,
      nodes: nodes.map(node => ({
        ...node.data,
        position: node.position,
        id: node.id,
      })),
      edges: edges.map(edge => ({
        ...edge.data,
        source: edge.source,
        target: edge.target,
        source_handle: edge.sourceHandle,
        target_handle: edge.targetHandle,
        id: edge.id,
      })),
    } as MappingGraph;
    try {
      await MappingService.updateMapping(workspaceUuid, mappingUuid, mapping);
      set({ error: null });
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      set({ isLoading: null });
    }
  },
});

export const useMappingPage = create<
  MappingPageState & MappingPageStateActions
>()(
  devtools((set, get) => ({
    ...defaultState,
    ...functions(set, get),
  })),
);

export default useMappingPage;
