import { MappingGraph } from '@/lib/api/mapping_service/types';
import { Ontology } from '@/lib/api/ontology_api/types';
import { Prefix } from '@/lib/api/prefix_api/types';
import SourceApi from '@/lib/api/source_api';
import YARRRMLService from '@/lib/api/yarrrml_service';
import { groupRmlBySubject } from './applyRmlTextCorrection';

export interface RmlMappingContext {
  /** Every mapping's RML text concatenated, each preceded by a file-header comment. */
  rml_mapping: string;
  /** Per-mapping RML text, keyed by mapping uuid -- the repair loop's mutable "current RML" cache. */
  rmlByMapping: Record<string, string>;
  /** `responsible_mapping_file` string -> owning mapping uuid. */
  fileNameToMappingUuid: Record<string, string>;
  /** mapping uuid -> `responsible_mapping_file` string, the inverse of fileNameToMappingUuid. */
  mappingUuidToFileName: Record<string, string>;
}

function fileNameFor(mapping: MappingGraph): string {
  return `${mapping.name}.rml.ttl`;
}

/**
 * Builds the `rml_mapping` (multi-file RML text) input for the Stage 2/3
 * prompts, by converting every mapping in the workspace to real RML via the
 * same YARRRML->RML pipeline already used to materialize output data (see
 * materializeMapping in validation_page/state.ts), but stopping before
 * execution.
 */
export async function buildRmlMappingContext(
  workspaceUuid: string,
  mappings: MappingGraph[],
  prefixes: Prefix[],
): Promise<RmlMappingContext> {
  const entries = await Promise.all(
    mappings.map(async mapping => {
      const yarrrml = await YARRRMLService.getYARRRMLMappingPreview(
        workspaceUuid,
        mapping,
      );
      const rml = groupRmlBySubject(await YARRRMLService.yarrrmlToRML(yarrrml, prefixes));
      return { mapping, rml };
    }),
  );

  const rmlByMapping: Record<string, string> = {};
  const fileNameToMappingUuid: Record<string, string> = {};
  const mappingUuidToFileName: Record<string, string> = {};

  for (const { mapping, rml } of entries) {
    const fileName = fileNameFor(mapping);
    rmlByMapping[mapping.uuid] = rml;
    fileNameToMappingUuid[fileName] = mapping.uuid;
    mappingUuidToFileName[mapping.uuid] = fileName;
  }

  return {
    rml_mapping: concatenateRmlMapping(rmlByMapping, mappingUuidToFileName),
    rmlByMapping,
    fileNameToMappingUuid,
    mappingUuidToFileName,
  };
}

/** Rebuilds the concatenated multi-file `rml_mapping` text after rmlByMapping has been patched in place. */
export function concatenateRmlMapping(
  rmlByMapping: Record<string, string>,
  mappingUuidToFileName: Record<string, string>,
): string {
  return Object.entries(rmlByMapping)
    .map(
      ([uuid, rml]) => `# File: ${mappingUuidToFileName[uuid] ?? uuid}\n${rml}`,
    )
    .join('\n\n');
}

/** `schema_context.allowed_entity_types`: every class URI known to the workspace's ontologies. */
export function buildAllowedEntityTypes(ontologies: Ontology[]): string[] {
  const classes = new Set<string>();
  for (const ontology of ontologies) {
    for (const cls of ontology.classes) {
      classes.add(cls.full_uri);
    }
  }
  return Array.from(classes);
}

/**
 * `schema_context.source_columns`: each mapping file's source column names.
 * Without these, a repair that adds a property has to guess column names from
 * the references already in the RML (e.g. inventing `family_name` when the
 * column is `last_name`), producing a fix that maps nothing.
 */
export async function buildSourceColumns(
  mappings: MappingGraph[],
  mappingUuidToFileName: Record<string, string>,
): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    mappings.map(async mapping => {
      const source = await SourceApi.getSource(mapping.source_id);
      return [mappingUuidToFileName[mapping.uuid] ?? mapping.uuid, source.references] as const;
    }),
  );
  return Object.fromEntries(entries);
}
