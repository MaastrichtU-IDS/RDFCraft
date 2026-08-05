from kink import inject

from server.const.err_enums import ErrCodes
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
class DeleteShapesFromWorkspaceFacade(BaseFacade):
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
        shapes_id: str,
    ):
        self.logger.info("Retrieving workspace metadata")
        workspace_metadata = self.workspace_metadata_service.get_workspace_metadata(
            workspace_id,
        )

        self.logger.info("Retrieving workspace")
        workspace = self.workspace_service.get_workspace(
            workspace_metadata.location,
        )

        if shapes_id not in workspace.shapes:
            return FacadeResponse(
                status=404,
                message=f"Shape set {shapes_id} not found in workspace {workspace_id}",
                err_code=ErrCodes.SHAPES_NOT_FOUND,
            )

        self.logger.info("Deleting shape set")
        self.shapes_service.delete_shapes(shapes_id)

        self.logger.info("Updating workspace")
        new_model = workspace.copy_with(
            shapes=[shapes for shapes in workspace.shapes if shapes != shapes_id]
        )

        self.workspace_service.update_workspace(new_model)

        return FacadeResponse(
            status=200,
            message="Shape set deleted from workspace",
        )
