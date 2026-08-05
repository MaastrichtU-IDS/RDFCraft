import MappingService from '@/lib/api/mapping_service';
import { MappingGraph } from '@/lib/api/mapping_service/types';
import { Prefix } from '@/lib/api/prefix_api/types';
import PrefixApi from '@/lib/api/prefix_api';
import ShaclApi from '@/lib/api/shacl_api';
import { ShaclValidationReport, ShaclViolation } from '@/lib/api/shacl_api/types';
import ShapesApi from '@/lib/api/shapes_api';
import { ShapeSet } from '@/lib/api/shapes_api/types';
import SettingsApi from '@/lib/api/settings_api';
import SourceApi from '@/lib/api/source_api';
import WorkspacesApi from '@/lib/api/workspaces_api';
import { Workspace } from '@/lib/api/workspaces_api/types';
import YARRRMLService from '@/lib/api/yarrrml_service';
import { applyFixToMappingGraph, UnresolvedFixError } from '@/lib/llm/applyFixToMappingGraph';
import { buildLocateFixMessages } from '@/lib/llm/locateFixPrompt';
import { parseShapeClassRequirements } from '@/lib/llm/parseShapeClassRequirements';
import { buildProposeFixMessages } from '@/lib/llm/proposeFixPrompt';
import { IterationLogEntry, LocatedTarget, ProposedFix } from '@/lib/llm/repairTypes';
import { buildGraphStore, resolveOwningMapping } from '@/lib/llm/resolveOwningMapping';
import { ZustandActions } from '@/utils/zustand';
import OpenAI from 'openai';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface PerMappingState {
  isLoading: string | null;
  isRepairing: boolean;
  report: ShaclValidationReport | null;
  iterationLog: IterationLogEntry[];
}

const defaultPerMappingState: PerMappingState = {
  isLoading: null,
  isRepairing: false,
  report: null,
  iterationLog: [],
};

interface ValidationPageState {
  workspace: Workspace | null;
  shapeSets: ShapeSet[];
  selectedShapeSetId: string | null;
  mappings: MappingGraph[];
  prefixes: Prefix[];
  sourceReferencesByMapping: Record<string, string[]>;
  report: ShaclValidationReport | null;
  ttlCache: Record<string, string>;
  isLoading: string | null;
  isRepairing: boolean;
  error: string | null;
  iterationLog: IterationLogEntry[];
  perMapping: Record<string, PerMappingState>;
}

interface ValidationPageStateActions {
  loadWorkspace: (workspaceUuid: string) => Promise<void>;
  setSelectedShapeSetId: (shapeSetId: string) => void;
  runValidation: () => Promise<void>;
  runAutoRepair: (maxIterations: number) => Promise<void>;
  runValidationForMapping: (mappingUuid: string) => Promise<void>;
  runAutoRepairForMapping: (
    mappingUuid: string,
    maxIterations: number,
  ) => Promise<void>;
}

const defaultState: ValidationPageState = {
  workspace: null,
  shapeSets: [],
  selectedShapeSetId: null,
  mappings: [],
  prefixes: [],
  sourceReferencesByMapping: {},
  report: null,
  ttlCache: {},
  isLoading: null,
  isRepairing: false,
  error: null,
  iterationLog: [],
  perMapping: {},
};

function familyKey(violation: ShaclViolation): string {
  return `${violation.source_constraint_component}|${violation.result_path}`;
}

async function materializeMapping(
  workspaceUuid: string,
  mapping: MappingGraph,
  prefixes: Prefix[],
): Promise<string> {
  // Uses the preview endpoint (not getYARRRMLMapping) so this always
  // reflects the in-memory `mapping` object passed in -- critical for the
  // repair loop, which needs to test a candidate fix before deciding
  // whether to persist it.
  const yarrrml = await YARRRMLService.getYARRRMLMappingPreview(
    workspaceUuid,
    mapping,
  );
  const rml = await YARRRMLService.yarrrmlToRML(yarrrml, prefixes);
  return YARRRMLService.rmlToTTL(rml);
}

async function materializeAll(
  workspaceUuid: string,
  mappings: MappingGraph[],
  prefixes: Prefix[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    mappings.map(async mapping => {
      const ttl = await materializeMapping(workspaceUuid, mapping, prefixes);
      return [mapping.uuid, ttl] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function combineTtls(ttlCache: Record<string, string>): string {
  return Object.values(ttlCache).join('\n');
}

async function getOpenAIClient(): Promise<{ openai: OpenAI; model: string }> {
  const openai_url = await SettingsApi.getOpenAIURL();
  const openai_key = await SettingsApi.getOpenAIKey();
  const openai_model = await SettingsApi.getOpenAIModel();

  if (!openai_url || !openai_key || !openai_model) {
    throw new Error(
      'OpenAI URL, Key or Model not set, please set it in the settings page',
    );
  }

  return {
    openai: new OpenAI({
      apiKey: openai_key,
      baseURL: openai_url,
      dangerouslyAllowBrowser: true,
    }),
    model: openai_model,
  };
}

async function askForJson<T>(
  openai: OpenAI,
  model: string,
  messages: Parameters<OpenAI['chat']['completions']['create']>[0]['messages'],
): Promise<T> {
  const completion = await openai.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' },
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as T;
}

function pickViolation(
  violations: ShaclViolation[],
  familyAttempts: Record<string, number>,
): ShaclViolation | null {
  if (violations.length === 0) return null;

  let bestFamily: string | null = null;
  let bestCount = Infinity;
  for (const violation of violations) {
    const key = familyKey(violation);
    const count = familyAttempts[key] ?? 0;
    if (count < bestCount) {
      bestCount = count;
      bestFamily = key;
    }
  }

  const picked =
    violations.find(v => familyKey(v) === bestFamily) ?? violations[0];
  return picked;
}

const functions: ZustandActions<
  ValidationPageStateActions,
  ValidationPageState
> = (set, get) => ({
  async loadWorkspace(workspaceUuid: string) {
    set({ isLoading: 'Loading workspace...' });
    try {
      const [workspace, shapeSets, mappings, prefixes] = await Promise.all([
        WorkspacesApi.getWorkspace(workspaceUuid),
        ShapesApi.getShapesInWorkspace(workspaceUuid),
        MappingService.getMappingsInWorkspace(workspaceUuid),
        PrefixApi.getPrefixesInWorkspace(workspaceUuid),
      ]);

      const sourceReferencesEntries = await Promise.all(
        mappings.map(async mapping => {
          const source = await SourceApi.getSource(mapping.source_id);
          return [mapping.uuid, source.references] as const;
        }),
      );

      set({
        workspace,
        shapeSets,
        mappings,
        prefixes,
        sourceReferencesByMapping: Object.fromEntries(sourceReferencesEntries),
        selectedShapeSetId: shapeSets[0]?.uuid ?? null,
        error: null,
      });
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      set({ isLoading: null });
    }
  },

  setSelectedShapeSetId(shapeSetId: string) {
    set({ selectedShapeSetId: shapeSetId });
  },

  async runValidation() {
    const { workspace, mappings, prefixes, shapeSets, selectedShapeSetId } =
      get();
    if (!workspace) return;
    const shapeSet = shapeSets.find(s => s.uuid === selectedShapeSetId);
    if (!shapeSet) {
      set({ error: 'Select a shape set to validate against' });
      return;
    }

    set({ isLoading: 'Validating...', error: null });
    try {
      const ttlCache = await materializeAll(workspace.uuid, mappings, prefixes);
      const report = await ShaclApi.validate(
        combineTtls(ttlCache),
        shapeSet.content,
      );
      set({ report, ttlCache });
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      set({ isLoading: null });
    }
  },

  async runAutoRepair(maxIterations: number) {
    const { workspace, shapeSets, selectedShapeSetId, prefixes } = get();
    if (!workspace) return;
    const shapeSet = shapeSets.find(s => s.uuid === selectedShapeSetId);
    if (!shapeSet) {
      set({ error: 'Select a shape set to validate against' });
      return;
    }

    set({ isRepairing: true, error: null, iterationLog: [] });

    try {
      const { openai, model } = await getOpenAIClient();
      const classRequirements = parseShapeClassRequirements(shapeSet.content);

      let mappings = get().mappings;
      let ttlCache = await materializeAll(workspace.uuid, mappings, prefixes);
      let report = await ShaclApi.validate(
        combineTtls(ttlCache),
        shapeSet.content,
      );
      set({ report, ttlCache, mappings });

      const familyAttempts: Record<string, number> = {};
      const log: IterationLogEntry[] = [];

      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        if (report.conforms) break;

        const violation = pickViolation(report.violations, familyAttempts);
        if (!violation) break;
        familyAttempts[familyKey(violation)] =
          (familyAttempts[familyKey(violation)] ?? 0) + 1;

        const violationsBefore = report.violations.length;
        const entry: IterationLogEntry = {
          iteration,
          violation,
          mappingName: null,
          located: null,
          fix: null,
          violationsBefore,
          violationsAfter: null,
          accepted: false,
        };

        try {
          const store = buildGraphStore(combineTtls(ttlCache));
          const owningMapping = resolveOwningMapping(violation, store, mappings);

          if (!owningMapping) {
            entry.note = 'Could not resolve which mapping owns this violation';
            log.push(entry);
            set({ iterationLog: [...log] });
            continue;
          }
          entry.mappingName = owningMapping.name;

          const located = await askForJson<LocatedTarget>(
            openai,
            model,
            buildLocateFixMessages(violation, owningMapping),
          );
          entry.located = located;

          const targetExists =
            (located.target_type === 'edge' &&
              owningMapping.edges.some(e => e.id === located.target_id)) ||
            (located.target_type !== 'edge' &&
              owningMapping.nodes.some(n => n.id === located.target_id));

          if (!targetExists) {
            entry.note = `Located target ${located.target_id} does not exist in mapping`;
            log.push(entry);
            set({ iterationLog: [...log] });
            continue;
          }

          const fix = await askForJson<ProposedFix>(
            openai,
            model,
            buildProposeFixMessages(
              violation,
              owningMapping,
              located,
              classRequirements,
              get().sourceReferencesByMapping[owningMapping.uuid] ?? [],
            ),
          );
          entry.fix = fix;

          const fixedMapping = applyFixToMappingGraph(
            owningMapping,
            located,
            fix,
          );

          const newTtlForMapping = await materializeMapping(
            workspace.uuid,
            fixedMapping,
            prefixes,
          );
          const candidateTtlCache = {
            ...ttlCache,
            [fixedMapping.uuid]: newTtlForMapping,
          };
          const candidateReport = await ShaclApi.validate(
            combineTtls(candidateTtlCache),
            shapeSet.content,
          );

          entry.violationsAfter = candidateReport.violations.length;

          if (candidateReport.violations.length < violationsBefore) {
            await MappingService.updateMapping(
              workspace.uuid,
              fixedMapping.uuid,
              fixedMapping,
            );
            mappings = mappings.map(m =>
              m.uuid === fixedMapping.uuid ? fixedMapping : m,
            );
            ttlCache = candidateTtlCache;
            report = candidateReport;
            entry.accepted = true;
            set({ mappings, ttlCache, report });
          } else {
            entry.accepted = false;
            entry.note = 'Violation count did not decrease, reverted';
          }
        } catch (error) {
          entry.note =
            error instanceof UnresolvedFixError
              ? `Fix could not be applied: ${error.message}`
              : error instanceof Error
                ? error.message
                : String(error);
        }

        log.push(entry);
        set({ iterationLog: [...log] });
      }
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      set({ isRepairing: false });
    }
  },

  async runValidationForMapping(mappingUuid: string) {
    const { workspace, mappings, prefixes, shapeSets, selectedShapeSetId } =
      get();
    if (!workspace) return;
    const shapeSet = shapeSets.find(s => s.uuid === selectedShapeSetId);
    if (!shapeSet) {
      set({ error: 'Select a shape set to validate against' });
      return;
    }
    const mapping = mappings.find(m => m.uuid === mappingUuid);
    if (!mapping) return;

    const patchPerMapping = (patch: Partial<PerMappingState>) =>
      set(state => ({
        perMapping: {
          ...state.perMapping,
          [mappingUuid]: {
            ...defaultPerMappingState,
            ...state.perMapping[mappingUuid],
            ...patch,
          },
        },
      }));

    patchPerMapping({ isLoading: 'Validating...' });
    try {
      const ttl = await materializeMapping(workspace.uuid, mapping, prefixes);
      const report = await ShaclApi.validate(ttl, shapeSet.content);
      patchPerMapping({ report });
      set({ error: null });
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      patchPerMapping({ isLoading: null });
    }
  },

  async runAutoRepairForMapping(mappingUuid: string, maxIterations: number) {
    const { workspace, mappings, prefixes, shapeSets, selectedShapeSetId } =
      get();
    if (!workspace) return;
    const shapeSet = shapeSets.find(s => s.uuid === selectedShapeSetId);
    if (!shapeSet) {
      set({ error: 'Select a shape set to validate against' });
      return;
    }
    const initialMapping = mappings.find(m => m.uuid === mappingUuid);
    if (!initialMapping) return;

    const patchPerMapping = (patch: Partial<PerMappingState>) =>
      set(state => ({
        perMapping: {
          ...state.perMapping,
          [mappingUuid]: {
            ...defaultPerMappingState,
            ...state.perMapping[mappingUuid],
            ...patch,
          },
        },
      }));

    patchPerMapping({ isRepairing: true, iterationLog: [] });

    try {
      const { openai, model } = await getOpenAIClient();
      const classRequirements = parseShapeClassRequirements(shapeSet.content);

      let mapping = initialMapping;
      let report = await ShaclApi.validate(
        await materializeMapping(workspace.uuid, mapping, prefixes),
        shapeSet.content,
      );
      patchPerMapping({ report });
      set({ error: null });

      const familyAttempts: Record<string, number> = {};
      const log: IterationLogEntry[] = [];

      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        if (report.conforms) break;

        const violation = pickViolation(report.violations, familyAttempts);
        if (!violation) break;
        familyAttempts[familyKey(violation)] =
          (familyAttempts[familyKey(violation)] ?? 0) + 1;

        const violationsBefore = report.violations.length;
        const entry: IterationLogEntry = {
          iteration,
          violation,
          mappingName: mapping.name,
          located: null,
          fix: null,
          violationsBefore,
          violationsAfter: null,
          accepted: false,
        };

        try {
          const located = await askForJson<LocatedTarget>(
            openai,
            model,
            buildLocateFixMessages(violation, mapping),
          );
          entry.located = located;

          const targetExists =
            (located.target_type === 'edge' &&
              mapping.edges.some(e => e.id === located.target_id)) ||
            (located.target_type !== 'edge' &&
              mapping.nodes.some(n => n.id === located.target_id));

          if (!targetExists) {
            entry.note = `Located target ${located.target_id} does not exist in mapping`;
            log.push(entry);
            patchPerMapping({ iterationLog: [...log] });
            continue;
          }

          const fix = await askForJson<ProposedFix>(
            openai,
            model,
            buildProposeFixMessages(
              violation,
              mapping,
              located,
              classRequirements,
              get().sourceReferencesByMapping[mapping.uuid] ?? [],
            ),
          );
          entry.fix = fix;

          const fixedMapping = applyFixToMappingGraph(mapping, located, fix);

          const newTtl = await materializeMapping(
            workspace.uuid,
            fixedMapping,
            prefixes,
          );
          const candidateReport = await ShaclApi.validate(newTtl, shapeSet.content);

          entry.violationsAfter = candidateReport.violations.length;

          if (candidateReport.violations.length < violationsBefore) {
            await MappingService.updateMapping(
              workspace.uuid,
              fixedMapping.uuid,
              fixedMapping,
            );
            mapping = fixedMapping;
            report = candidateReport;
            entry.accepted = true;
            set(state => ({
              mappings: state.mappings.map(m =>
                m.uuid === fixedMapping.uuid ? fixedMapping : m,
              ),
            }));
            patchPerMapping({ report });
          } else {
            entry.accepted = false;
            entry.note = 'Violation count did not decrease, reverted';
          }
        } catch (error) {
          entry.note =
            error instanceof UnresolvedFixError
              ? `Fix could not be applied: ${error.message}`
              : error instanceof Error
                ? error.message
                : String(error);
        }

        log.push(entry);
        patchPerMapping({ iterationLog: [...log] });
      }
    } catch (error) {
      if (error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      patchPerMapping({ isRepairing: false });
    }
  },
});

const useValidationPageState = create<
  ValidationPageState & ValidationPageStateActions
>()(
  devtools((set, get) => ({
    ...defaultState,
    ...functions(set, get),
  })),
);

export default useValidationPageState;
