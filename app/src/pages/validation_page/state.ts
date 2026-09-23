import MappingService from '@/lib/api/mapping_service';
import { MappingGraph } from '@/lib/api/mapping_service/types';
import OntologyApi from '@/lib/api/ontology_api';
import { Ontology } from '@/lib/api/ontology_api/types';
import { Prefix } from '@/lib/api/prefix_api/types';
import PrefixApi from '@/lib/api/prefix_api';
import ShaclApi from '@/lib/api/shacl_api';
import { ShaclValidationReport, ShaclViolation } from '@/lib/api/shacl_api/types';
import ShapesApi from '@/lib/api/shapes_api';
import { ShapeSet } from '@/lib/api/shapes_api/types';
import SettingsApi from '@/lib/api/settings_api';
import WorkspacesApi from '@/lib/api/workspaces_api';
import { Workspace } from '@/lib/api/workspaces_api/types';
import YARRRMLService from '@/lib/api/yarrrml_service';
import { applyRmlTextCorrection, RmlPatchError } from '@/lib/llm/applyRmlTextCorrection';
import { buildLocateFixMessages } from '@/lib/llm/locateFixPrompt';
import { buildClassRequirementsSummary } from '@/lib/llm/parseShapeClassRequirements';
import { buildProposeRepairMessages } from '@/lib/llm/proposeRepairPrompt';
import {
  IterationLogEntry,
  PriorAttempt,
  SchemaContext,
  Stage2LocateOutput,
  Stage3RepairOutput,
} from '@/lib/llm/repairTypes';
import { buildGraphStore, resolveOwningMapping } from '@/lib/llm/resolveOwningMapping';
import { parseRmlToMappingGraph, RmlParseError } from '@/lib/llm/rmlToMappingGraph';
import {
  buildAllowedEntityTypes,
  buildRmlMappingContext,
  concatenateRmlMapping,
  RmlMappingContext,
} from '@/lib/llm/rmlMappingContext';
import { computeStage1Output } from '@/lib/llm/stage1Signals';
import downloadTextFile from '@/utils/downloadTextFile';
import { ZustandActions } from '@/utils/zustand';
import OpenAI, { RateLimitError } from 'openai';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface PerMappingState {
  isLoading: string | null;
  isRepairing: boolean;
  report: ShaclValidationReport | null;
  iterationLog: IterationLogEntry[];
  /** Final repaired RML text, when a repair run made changes -- there is no
   * way to fold RML-text-level fixes back into RDFCraft's own node/edge
   * graph, so this is offered for the user to inspect/export directly
   * instead of appearing on the mapping canvas. */
  correctedRml: string | null;
  /** Set while a repair run is in flight; cancelAutoRepairForMapping aborts it. */
  abortController: AbortController | null;
}

const defaultPerMappingState: PerMappingState = {
  isLoading: null,
  isRepairing: false,
  report: null,
  iterationLog: [],
  correctedRml: null,
  abortController: null,
};

interface ValidationPageState {
  workspace: Workspace | null;
  shapeSets: ShapeSet[];
  selectedShapeSetId: string | null;
  mappings: MappingGraph[];
  ontologies: Ontology[];
  prefixes: Prefix[];
  report: ShaclValidationReport | null;
  ttlCache: Record<string, string>;
  isLoading: string | null;
  isRepairing: boolean;
  error: string | null;
  iterationLog: IterationLogEntry[];
  correctedRmlByMapping: Record<string, string> | null;
  perMapping: Record<string, PerMappingState>;
  /** Set while a whole-workspace repair run is in flight; cancelAutoRepair aborts it. */
  repairAbortController: AbortController | null;
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
  /** Aborts an in-flight whole-workspace Auto-Repair run. */
  cancelAutoRepair: () => void;
  /** Aborts an in-flight per-mapping Auto-Repair run. */
  cancelAutoRepairForMapping: (mappingUuid: string) => void;
  /** Parses the mapping's repaired RML back into a MappingGraph and persists
   * it, so the fix appears on the mapping's visual canvas. Falls back to
   * downloading the RML text if it can't be parsed, so the fix isn't lost. */
  applyRepairedMapping: (mappingUuid: string) => Promise<void>;
  /** Same as applyRepairedMapping, for every mapping with an accepted
   * repair from the last whole-workspace Auto-Repair run. */
  applyAllRepairedMappings: () => Promise<void>;
}

const defaultState: ValidationPageState = {
  workspace: null,
  shapeSets: [],
  selectedShapeSetId: null,
  mappings: [],
  ontologies: [],
  prefixes: [],
  report: null,
  ttlCache: {},
  isLoading: null,
  isRepairing: false,
  error: null,
  iterationLog: [],
  correctedRmlByMapping: null,
  perMapping: {},
  repairAbortController: null,
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
  // reflects the in-memory `mapping` object passed in.
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

const RATE_LIMIT_MAX_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 2000;

function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 429
  );
}

/** Thrown when a repair run is cancelled via its AbortSignal -- distinct from
 * a real failure so the loop stops cleanly instead of logging a bogus error. */
export class RepairCancelledError extends Error {}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new RepairCancelledError('Cancelled'));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new RepairCancelledError('Cancelled'));
      },
      { once: true },
    );
  });
}

/**
 * Each repair iteration makes 2 LLM calls (Stage 2 + Stage 3); a rate-limited
 * provider (observed with OpenRouter) was silently burning most of a run's
 * iteration budget on 429s that immediately failed the whole iteration.
 * Retries the SAME call with exponential backoff + jitter before giving up,
 * so a throttled call costs wall-clock time instead of a wasted iteration.
 * `signal` cancels both an in-flight request and any pending backoff wait.
 */
async function askForJson<T>(
  openai: OpenAI,
  model: string,
  messages: Parameters<OpenAI['chat']['completions']['create']>[0]['messages'],
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw new RepairCancelledError('Cancelled');
    try {
      const completion = await openai.chat.completions.create(
        {
          model,
          messages,
          response_format: { type: 'json_object' },
        },
        { signal },
      );
      const raw = completion.choices[0]?.message?.content ?? '{}';
      return JSON.parse(raw) as T;
    } catch (error) {
      if (signal.aborted) throw new RepairCancelledError('Cancelled');
      if (!isRateLimitError(error) || attempt >= RATE_LIMIT_MAX_RETRIES) {
        throw error;
      }
      const delay = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      console.warn(
        `Rate limited (attempt ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES}), retrying in ${Math.round((delay + jitter) / 1000)}s`,
      );
      await sleep(delay + jitter, signal);
    }
  }
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

interface RepairLoopParams {
  workspaceUuid: string;
  allMappings: MappingGraph[];
  prefixes: Prefix[];
  ontologies: Ontology[];
  shapeSetContent: string;
  maxIterations: number;
  initialTtlCache: Record<string, string>;
  initialReport: ShaclValidationReport;
  openai: OpenAI;
  model: string;
  signal: AbortSignal;
  onIteration: (
    log: IterationLogEntry[],
    report: ShaclValidationReport,
    ttlCache: Record<string, string>,
  ) => void;
}

interface RepairLoopResult {
  finalReport: ShaclValidationReport;
  finalTtlCache: Record<string, string>;
  correctedRmlByMapping: Record<string, string>;
  log: IterationLogEntry[];
}

/**
 * The Stage 1 (deterministic signals) -> Stage 2 (LLM locate) -> Stage 3
 * (LLM repair) loop, ported from clustered-kg-refine. Unlike RDFCraft's
 * previous 2-stage repair loop, this operates entirely on RML *text* (the
 * mapping's rules, patched via exact substring replacement) rather than on
 * RDFCraft's node/edge graph model -- there is no reverse RML->graph parser,
 * so accepted fixes live only in `correctedRmlByMapping` for this run; they
 * are not written back to the mapping's canvas.
 */
async function runRepairLoop(params: RepairLoopParams): Promise<RepairLoopResult> {
  const {
    workspaceUuid,
    allMappings,
    prefixes,
    ontologies,
    shapeSetContent,
    maxIterations,
    openai,
    model,
    signal,
    onIteration,
  } = params;

  let ttlCache = { ...params.initialTtlCache };
  let report = params.initialReport;

  const rmlContext: RmlMappingContext = await buildRmlMappingContext(
    workspaceUuid,
    allMappings,
    prefixes,
  );
  const schemaContext: SchemaContext = {
    allowed_entity_types: buildAllowedEntityTypes(ontologies),
    class_requirements: buildClassRequirementsSummary(shapeSetContent),
  };

  const familyAttempts: Record<string, number> = {};
  // Only this trial's own reverted/rejected iterations -- observational, not
  // authoritative, and capped to the last 3 like clustered-kg-refine's own
  // `reverted_attempts[-3:]`.
  const revertedAttempts: PriorAttempt[] = [];
  const log: IterationLogEntry[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    if (report.conforms || signal.aborted) break;

    const violation = pickViolation(report.violations, familyAttempts);
    if (!violation) break;
    familyAttempts[familyKey(violation)] = (familyAttempts[familyKey(violation)] ?? 0) + 1;

    const violationsBefore = report.violations.length;
    const entry: IterationLogEntry = {
      iteration,
      violation,
      mappingName: null,
      stage1: null,
      stage2: null,
      stage3: null,
      violationsBefore,
      violationsAfter: null,
      accepted: false,
    };

    try {
      const store = buildGraphStore(combineTtls(ttlCache));
      const owningMapping = resolveOwningMapping(violation, store, allMappings);
      entry.mappingName = owningMapping?.name ?? null;

      const stage1 = computeStage1Output(violation, report.violations, shapeSetContent);
      entry.stage1 = stage1;

      const stage2 = await askForJson<Stage2LocateOutput>(
        openai,
        model,
        buildLocateFixMessages(
          stage1,
          rmlContext.rml_mapping,
          schemaContext,
          revertedAttempts.slice(-3),
        ),
        signal,
      );
      entry.stage2 = stage2;

      const mappingUuid =
        rmlContext.fileNameToMappingUuid[stage2.responsible_mapping_file] ??
        owningMapping?.uuid;

      if (!mappingUuid || !rmlContext.rmlByMapping[mappingUuid]) {
        entry.note = `Could not resolve responsible mapping file "${stage2.responsible_mapping_file}"`;
        log.push(entry);
        onIteration([...log], report, ttlCache);
        continue;
      }

      const stage3 = await askForJson<Stage3RepairOutput>(
        openai,
        model,
        buildProposeRepairMessages(stage2, rmlContext.rml_mapping, schemaContext),
        signal,
      );
      entry.stage3 = stage3;

      // Same guard clustered-kg-refine applies: a required-predicate-missing
      // violation has no wrong value to correct, so the fix must add the
      // property -- anything else is a mismatch worth remembering.
      if (
        stage1.signals.required_predicate_missing &&
        stage3.repair_type !== 'add_missing_property'
      ) {
        entry.note = `required_predicate_missing signal but repair_type=${stage3.repair_type} (expected add_missing_property)`;
        revertedAttempts.push({
          constraint_component: stage1.constraint_component,
          forbidden_predicate: stage1.forbidden_predicate,
          repair_type_tried: stage3.repair_type,
        });
        log.push(entry);
        onIteration([...log], report, ttlCache);
        continue;
      }

      const patchedRml = applyRmlTextCorrection(
        rmlContext.rmlByMapping[mappingUuid],
        stage2.erroneous_root_triples,
        stage3.corrected_triples,
      );

      const newTtl = await YARRRMLService.rmlToTTL(patchedRml);
      const candidateTtlCache = { ...ttlCache, [mappingUuid]: newTtl };
      const candidateReport = await ShaclApi.validate(
        combineTtls(candidateTtlCache),
        shapeSetContent,
      );
      entry.violationsAfter = candidateReport.violations.length;

      if (candidateReport.violations.length < violationsBefore) {
        rmlContext.rmlByMapping[mappingUuid] = patchedRml;
        rmlContext.rml_mapping = concatenateRmlMapping(
          rmlContext.rmlByMapping,
          rmlContext.mappingUuidToFileName,
        );
        ttlCache = candidateTtlCache;
        report = candidateReport;
        entry.accepted = true;
      } else {
        entry.accepted = false;
        entry.note = 'Violation count did not decrease, reverted';
        revertedAttempts.push({
          constraint_component: stage1.constraint_component,
          forbidden_predicate: stage1.forbidden_predicate,
          repair_type_tried: stage3.repair_type,
        });
      }
    } catch (error) {
      if (error instanceof RepairCancelledError) {
        // Stop the whole run without logging a partial/misleading entry for
        // whichever stage was in flight when cancel fired.
        break;
      }
      entry.note =
        error instanceof RmlPatchError
          ? `Fix could not be applied: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
    }

    log.push(entry);
    onIteration([...log], report, ttlCache);
  }

  return {
    finalReport: report,
    finalTtlCache: ttlCache,
    correctedRmlByMapping: rmlContext.rmlByMapping,
    log,
  };
}

const functions: ZustandActions<
  ValidationPageStateActions,
  ValidationPageState
> = (set, get) => ({
  async loadWorkspace(workspaceUuid: string) {
    set({ isLoading: 'Loading workspace...' });
    try {
      const [workspace, shapeSets, mappings, prefixes, ontologies] = await Promise.all([
        WorkspacesApi.getWorkspace(workspaceUuid),
        ShapesApi.getShapesInWorkspace(workspaceUuid),
        MappingService.getMappingsInWorkspace(workspaceUuid),
        PrefixApi.getPrefixesInWorkspace(workspaceUuid),
        OntologyApi.getOntologiesInWorkspace(workspaceUuid),
      ]);

      set({
        workspace,
        shapeSets,
        mappings,
        prefixes,
        ontologies,
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
    const { workspace, shapeSets, selectedShapeSetId, prefixes, ontologies } = get();
    if (!workspace) return;
    const shapeSet = shapeSets.find(s => s.uuid === selectedShapeSetId);
    if (!shapeSet) {
      set({ error: 'Select a shape set to validate against' });
      return;
    }

    const controller = new AbortController();
    set({
      isRepairing: true,
      error: null,
      iterationLog: [],
      correctedRmlByMapping: null,
      repairAbortController: controller,
    });

    try {
      const { openai, model } = await getOpenAIClient();
      const mappings = get().mappings;
      const ttlCache = await materializeAll(workspace.uuid, mappings, prefixes);
      const report = await ShaclApi.validate(combineTtls(ttlCache), shapeSet.content);
      set({ report, ttlCache, mappings });

      const result = await runRepairLoop({
        workspaceUuid: workspace.uuid,
        allMappings: mappings,
        prefixes,
        ontologies,
        shapeSetContent: shapeSet.content,
        maxIterations,
        initialTtlCache: ttlCache,
        initialReport: report,
        openai,
        model,
        signal: controller.signal,
        onIteration: (log, rep, ttl) =>
          set({ iterationLog: log, report: rep, ttlCache: ttl }),
      });

      set({
        report: result.finalReport,
        ttlCache: result.finalTtlCache,
        iterationLog: result.log,
        correctedRmlByMapping: result.correctedRmlByMapping,
      });
    } catch (error) {
      if (!(error instanceof RepairCancelledError) && error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      set({ isRepairing: false, repairAbortController: null });
    }
  },

  cancelAutoRepair() {
    get().repairAbortController?.abort();
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
    const { workspace, mappings, prefixes, shapeSets, selectedShapeSetId, ontologies } =
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

    const controller = new AbortController();
    patchPerMapping({
      isRepairing: true,
      iterationLog: [],
      correctedRml: null,
      abortController: controller,
    });

    try {
      const { openai, model } = await getOpenAIClient();
      const ttl = await materializeMapping(workspace.uuid, mapping, prefixes);
      const report = await ShaclApi.validate(ttl, shapeSet.content);
      patchPerMapping({ report });
      set({ error: null });

      const result = await runRepairLoop({
        workspaceUuid: workspace.uuid,
        allMappings: [mapping],
        prefixes,
        ontologies,
        shapeSetContent: shapeSet.content,
        maxIterations,
        initialTtlCache: { [mapping.uuid]: ttl },
        initialReport: report,
        openai,
        model,
        signal: controller.signal,
        onIteration: (log, rep) => patchPerMapping({ iterationLog: log, report: rep }),
      });

      patchPerMapping({
        report: result.finalReport,
        iterationLog: result.log,
        correctedRml: result.correctedRmlByMapping[mapping.uuid] ?? null,
      });
    } catch (error) {
      if (!(error instanceof RepairCancelledError) && error instanceof Error) {
        set({ error: error.message });
      }
    } finally {
      patchPerMapping({ isRepairing: false, abortController: null });
    }
  },

  cancelAutoRepairForMapping(mappingUuid: string) {
    get().perMapping[mappingUuid]?.abortController?.abort();
  },

  async applyRepairedMapping(mappingUuid: string) {
    const { workspace, mappings, perMapping } = get();
    const mapping = mappings.find(m => m.uuid === mappingUuid);
    const correctedRml = perMapping[mappingUuid]?.correctedRml;
    if (!workspace || !mapping || !correctedRml) return;

    try {
      const newGraph = parseRmlToMappingGraph(correctedRml, mapping);
      await MappingService.updateMapping(workspace.uuid, mappingUuid, newGraph);
      set(state => ({
        mappings: state.mappings.map(m => (m.uuid === mappingUuid ? newGraph : m)),
        perMapping: {
          ...state.perMapping,
          [mappingUuid]: { ...state.perMapping[mappingUuid], correctedRml: null },
        },
        error: null,
      }));
    } catch (error) {
      set({
        error:
          error instanceof RmlParseError
            ? `Could not apply to the canvas (${error.message}) -- downloaded the repaired RML instead`
            : error instanceof Error
              ? error.message
              : String(error),
      });
      downloadTextFile(`${mapping.name}.repaired.rml.ttl`, correctedRml);
    }
  },

  async applyAllRepairedMappings() {
    const { workspace, mappings, correctedRmlByMapping } = get();
    if (!workspace || !correctedRmlByMapping) return;

    const updatedGraphs: MappingGraph[] = [];

    for (const mapping of mappings) {
      const correctedRml = correctedRmlByMapping[mapping.uuid];
      if (!correctedRml) continue;

      try {
        const newGraph = parseRmlToMappingGraph(correctedRml, mapping);
        await MappingService.updateMapping(workspace.uuid, mapping.uuid, newGraph);
        updatedGraphs.push(newGraph);
      } catch (error) {
        set({
          error:
            error instanceof RmlParseError
              ? `Could not apply "${mapping.name}" to the canvas (${error.message}) -- downloaded the repaired RML instead`
              : error instanceof Error
                ? error.message
                : String(error),
        });
        downloadTextFile(`${mapping.name}.repaired.rml.ttl`, correctedRml);
      }
    }

    if (updatedGraphs.length > 0) {
      set(state => ({
        mappings: state.mappings.map(
          m => updatedGraphs.find(u => u.uuid === m.uuid) ?? m,
        ),
        correctedRmlByMapping: null,
      }));
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
