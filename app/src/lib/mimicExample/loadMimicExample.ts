import MappingService from '@/lib/api/mapping_service';
import ShapesApi from '@/lib/api/shapes_api';
import WorkspacesApi from '@/lib/api/workspaces_api';

const TABLES = ['PATIENTS', 'ADMISSIONS', 'DIAGNOSES_ICD', 'CPTEVENTS'] as const;

async function fetchAsFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch bundled example asset: ${url}`);
  }
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

/**
 * Bootstraps a demo workspace from the bundled synthetic MIMIC-shaped example
 * (app/public/examples/mimic-demo/ -- invented data, not real PhysioNet/MIMIC-III
 * data). Creates the workspace, one empty mapping per table (ready for
 * "Generate Mapping with AI"), and the SHACL shape set used to validate them.
 *
 * Returns the new workspace's uuid.
 */
export async function loadMimicExample(): Promise<string> {
  const workspacesBefore = await WorkspacesApi.getWorkspaces();
  const knownUuids = new Set(workspacesBefore.map(w => w.uuid));

  const suffix = Math.random().toString(36).slice(2, 8);
  await WorkspacesApi.createWorkspace({
    name: `MIMIC Demo (${suffix})`,
    description:
      'Synthetic MIMIC-III-shaped example for AI mapping generation + SHACL validate/refine.',
    type: 'local',
    location: '',
  });

  const workspacesAfter = await WorkspacesApi.getWorkspaces();
  const created = workspacesAfter.find(w => !knownUuids.has(w.uuid));
  if (!created) {
    throw new Error('Could not find newly created workspace');
  }

  await Promise.all(
    TABLES.map(async table => {
      const file = await fetchAsFile(
        `/examples/mimic-demo/source/${table}.csv`,
        `${table}.csv`,
      );
      await MappingService.createMappingInWorkspace(
        created.uuid,
        table,
        `MIMIC ${table} table (synthetic example data)`,
        file,
        'csv',
        {},
      );
    }),
  );

  const shapesFile = await fetchAsFile(
    '/examples/mimic-demo/shapes/mimic_shapes.ttl',
    'mimic_shapes.ttl',
  );
  await ShapesApi.createShapesInWorkspace(
    created.uuid,
    'MIMIC SHACL Shapes',
    'SHACL shapes for the MIMIC-shaped example (adapted from clustered-kg-refine)',
    shapesFile,
  );

  return created.uuid;
}
