from kink import inject

from server.facades import (
    BaseFacade,
    FacadeResponse,
)
from server.service_protocols.shapes_service_protocol import (
    ShapesServiceProtocol,
)
from server.services.core.workspace_metadata_service import (
    WorkspaceMetadataServiceProtocol,
)
from server.services.local.local_workspace_service import (
    WorkspaceServiceProtocol,
)


@inject
class CreateShapesInWorkspaceFacade(BaseFacade):
    def __init__(
        self,
        workspace_metadata_service: WorkspaceMetadataServiceProtocol,
        workspace_service: WorkspaceServiceProtocol,
        shapes_service: ShapesServiceProtocol,
    ):
        super().__init__()
        self.workspace_metadata_service = workspace_metadata_service
        self.workspace_service = workspace_service
        self.shapes_service = shapes_service

    @BaseFacade.error_wrapper
    def execute(
        self,
        workspace_id: str,
        name: str,
        description: str,
        content: bytes,
    ) -> FacadeResponse:
        self.logger.info("Retrieving workspace metadata")
        workspace_metadata = self.workspace_metadata_service.get_workspace_metadata(
            workspace_id,
        )

        self.logger.info("Retrieving workspace")
        workspace = self.workspace_service.get_workspace(
            workspace_metadata.location,
        )

        self.logger.info("Creating shape set")
        shapes = self.shapes_service.create_shapes(
            name,
            description,
            content,
        )

        self.logger.info("Adding shape set to workspace")

        new_model = workspace.copy_with(
            shapes=workspace.shapes + [shapes.uuid],
        )

        self.workspace_service.update_workspace(
            new_model,
        )

        return FacadeResponse(
            status=200,
            message="Shape set created",
            data=shapes,
        )
