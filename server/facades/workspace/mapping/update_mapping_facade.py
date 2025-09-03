from kink import inject

from server.facades import (
    BaseFacade,
    FacadeResponse,
)
from server.models.mapping import MappingGraph, MappingLiteral, MappingNode
from server.service_protocols.mapping_service_protocol import (
    MappingServiceProtocol,
)
from server.service_protocols.workspace_service_protocol import WorkspaceServiceProtocol


@inject
class UpdateMappingFacade(BaseFacade):
    def __init__(
        self,
        mapping_service: MappingServiceProtocol,
        workspace_service: WorkspaceServiceProtocol,
    ):
        super().__init__()
        self.mapping_service: MappingServiceProtocol = mapping_service
        self.workspace_service: WorkspaceServiceProtocol = workspace_service

    @BaseFacade.error_wrapper
    def execute(
        self,
        mapping_id: str,
        workspace_id: str,
        mapping_graph: MappingGraph,
    ) -> FacadeResponse:
        self.logger.info(f"Updating mapping {mapping_id}")
        workspace = self.workspace_service.get_workspace(workspace_id)
        # Update used URI patterns
        nodes = mapping_graph.nodes

        uris = [
            node.uri_pattern for node in nodes if not isinstance(node, MappingLiteral)
        ]

        workspace.used_uri_patterns_by_workspace[mapping_id] = uris
        workspace.used_uri_patterns = list(
            {
                uri
                for uris in workspace.used_uri_patterns_by_workspace.values()
                for uri in uris
            }
        )
        # Remove duplicates
        workspace.used_uri_patterns = list(set(workspace.used_uri_patterns))

        self.workspace_service.update_workspace(workspace)

        self.mapping_service.update_mapping(
            mapping_id,
            mapping_graph,
        )
        return FacadeResponse(
            status=200,
            message=f"Mapping {mapping_id} updated",
        )
