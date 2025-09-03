import WorkspacesApi from '@/lib/api/workspaces_api';
import { Workspace } from '@/lib/api/workspaces_api/types';
import YARRRMLService from '@/lib/api/yarrrml_service';
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

type SelectedTab = 'properties' | 'ai' | 'references' | 'search' | 'problems';

interface MappingPageState {
  mapping: MappingGraph | null;
  workspace: Workspace | null;
  source: Source | null;
  ontologies: Ontology[] | null;
  prefixes: Prefix[] | null;
  isLoading: string | null;
  error: string | null;
  isSaved: boolean;
  selectedTab: SelectedTab;
  isSidePanelCollapsed: boolean;
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
  completeMapping: (
    workspaceUuid: string,
    mappingUuid: string,
  ) => Promise<{ yarrrml: string; rml: string; ttl: string }>;
  setIsSaved: (isSaved: boolean) => void;
  setSelectedTab: (
    selectedTab: 'properties' | 'ai' | 'references' | 'search',
  ) => void;
  setIsSidePanelCollapsed: (isSidePanelCollapsed: boolean) => void;
}

const defaultState: MappingPageState = {
  mapping: null,
  workspace: null,
  source: null,
  ontologies: null,
  prefixes: null,
  isLoading: null,
  error: null,
  isSaved: true,
  selectedTab: 'properties',
  isSidePanelCollapsed: false,
};

const functions: ZustandActions<MappingPageStateActions, MappingPageState> = (
  set,

  get,
) => ({
  async loadMapping(workspaceUuid: string, mappingUuid: string) {
    set({ isLoading: 'Loading mapping...' });
    try {
      const workspace_promise = WorkspacesApi.getWorkspace(workspaceUuid);
      const mapping_promise = MappingService.getMappingInWorkspace(
        workspaceUuid,
        mappingUuid,
      );
      const ontologies_promise =
        OntologyApi.getOntologiesInWorkspace(workspaceUuid);
      const prefixes_promise = PrefixApi.getPrefixesInWorkspace(workspaceUuid);

      const [mapping, ontologies, prefixes, workspace] = await Promise.all([
        mapping_promise,
        ontologies_promise,
        prefixes_promise,
        workspace_promise
      ]);

      const source = await SourceApi.getSource(mapping.source_id);

      set({ mapping, source, ontologies, prefixes, workspace, error: null });
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
      edges: edges
        .map(edge => ({
          ...edge.data,
          source: edge.source,
          target: edge.target,
          source_handle: edge.sourceHandle,
          target_handle: edge.targetHandle,
          id: edge.id,
        }))
        .filter(edge => {
          const sourceNode = nodes.find(node => node.id === edge.source);
          const targetNode = nodes.find(node => node.id === edge.target);
          return sourceNode && targetNode;
        }),
    } as MappingGraph;
    try {
      await MappingService.updateMapping(workspaceUuid, mappingUuid, mapping);
      set({ error: null, isSaved: true });
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      set({ isLoading: null });
    }
  },
  completeMapping: async (workspaceUuid: string, mappingUuid: string) => {
    set({ isLoading: 'Creating YARRRML' });
    try {
      const yarrrml = await YARRRMLService.getYARRRMLMapping(
        workspaceUuid,
        mappingUuid,
      );
      set({ isLoading: 'Creating RML' });
      const rml = await YARRRMLService.yarrrmlToRML(yarrrml, get().prefixes ?? []);
      set({ isLoading: 'Creating TTL' });
      const ttl = await YARRRMLService.rmlToTTL(rml);
      set({ error: null, isLoading: null });
      return { yarrrml, rml, ttl };
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
      throw error;
    } finally {
      set({ isLoading: null });
    }
  },
  setIsSaved(isSaved: boolean) {
    set({ isSaved });
  },
  setSelectedTab(selectedTab: SelectedTab) {
    set({ selectedTab, isSidePanelCollapsed: false });
  },
  setIsSidePanelCollapsed(isSidePanelCollapsed: boolean) {
    set({ isSidePanelCollapsed });
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

export type { SelectedTab };
