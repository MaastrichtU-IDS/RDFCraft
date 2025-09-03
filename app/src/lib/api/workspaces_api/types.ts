interface Workspace {
  uuid: string;
  name: string;
  description: string;
  type: 'local' | 'remote';
  location: string;
  sources: string[];
  mappings: string[];
  prefixes: Record<string, string>[];
  ontologies: string[];
  used_uri_patterns: string[];
  used_uri_patterns_by_workspace: Record<string, string[]>;
  enabled_features: string[];
}

interface CreateWorkspaceMetadata {
  name: string;
  description: string;
  type: 'local' | 'remote';
  location: string;
}

export type { CreateWorkspaceMetadata, Workspace };
