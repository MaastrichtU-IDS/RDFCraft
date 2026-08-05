from kink import inject

from server.facades import (
    BaseFacade,
    FacadeResponse,
)
from server.models.mapping import MappingGraph
from server.service_protocols.mapping_to_yarrrml_service_protocol import (
    FSServiceProtocol,
    MappingToYARRRMLServiceProtocol,
)
from server.services.core.workspace_metadata_service import (
    WorkspaceMetadataServiceProtocol,
)
from server.services.local.local_source_service import (
    SourceServiceProtocol,
)
from server.services.local.local_workspace_service import (
    WorkspaceServiceProtocol,
)


@inject
class MappingToYARRRMLPreviewFacade(BaseFacade):
    """
    Converts a client-supplied MappingGraph to YARRRML without requiring it
    to already be persisted -- used to materialize/validate a candidate fix
    before deciding whether to save it (see the Validate & Refine repair
    loop), so the test actually reflects the candidate, not whatever is
    currently saved for that mapping id.
    """

    def __init__(
        self,
        workspace_metadata_service: WorkspaceMetadataServiceProtocol,
        workspace_service: WorkspaceServiceProtocol,
        source_service: SourceServiceProtocol,
        yarrrml_service: MappingToYARRRMLServiceProtocol,
        fs_service: FSServiceProtocol,
    ):
        super().__init__()
        self.workspace_metadata_service: WorkspaceMetadataServiceProtocol = (
            workspace_metadata_service
        )
        self.workspace_service: WorkspaceServiceProtocol = workspace_service
        self.source_service: SourceServiceProtocol = source_service
        self.yarrrml_service: MappingToYARRRMLServiceProtocol = yarrrml_service
        self.fs_service: FSServiceProtocol = fs_service

    @BaseFacade.error_wrapper
    def execute(
        self,
        workspace_id: str,
        mapping: MappingGraph,
    ) -> FacadeResponse:
        self.logger.info(
            f"Creating YARRRML preview for workspace {workspace_id}"
        )

        workspace_metadata = self.workspace_metadata_service.get_workspace_metadata(
            workspace_id,
        )

        workspace = self.workspace_service.get_workspace(
            workspace_metadata.location,
        )

        source = self.source_service.get_source(
            mapping.source_id,
        )

        yarrrml = self.yarrrml_service.convert_mapping_to_yarrrml(
            workspace.prefixes,
            source,
            mapping,
            self.fs_service,
        )

        return self._success_response(
            data=yarrrml,
            message="YARRRML preview created",
        )
