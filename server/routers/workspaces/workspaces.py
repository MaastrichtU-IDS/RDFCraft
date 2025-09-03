from pathlib import Path
from typing import Annotated, cast

from fastapi.exceptions import HTTPException
from fastapi.params import Depends, File
from fastapi.routing import APIRouter
from kink.container import di
from starlette.responses import (
    FileResponse,
    PlainTextResponse,
)

from server.facades import FacadeResponse
from server.facades.workspace.create_workspace_facade import (
    CreateWorkspaceFacade,
)
from server.facades.workspace.delete_workspace_facade import (
    DeleteWorkspaceFacade,
)
from server.facades.workspace.export_workspace_facade import (
    ExportWorkspaceFacade,
)
from server.facades.workspace.get_workspaces_facade import (
    GetWorkspacesFacade,
)
from server.facades.workspace.import_workspace_facade import ImportWorkspaceFacade
from server.facades.workspace.mapping.create_mapping_in_workspace_facade import (
    CreateMappingInWorkspaceFacade,
)
from server.facades.workspace.mapping.delete_mapping_from_workspace_facade import (
    DeleteMappingFromWorkspaceFacade,
)
from server.facades.workspace.mapping.export_mapping_in_workspace_facade import (
    ExportMappingInWorkspaceFacade,
)
from server.facades.workspace.mapping.get_mappings_in_workspace_facade import (
    GetMappingsInWorkspaceFacade,
)
from server.facades.workspace.mapping.import_mapping_in_workspace_facade import (
    ImportMappingInWorkspaceFacade,
)
from server.facades.workspace.mapping.mapping_to_yarrrml_facade import (
    MappingToYARRRMLFacade,
)
from server.facades.workspace.mapping.update_mapping_facade import (
    UpdateMappingFacade,
)
from server.facades.workspace.ontology.create_ontology_in_workspace_facade import (
    CreateOntologyInWorkspaceFacade,
)
from server.facades.workspace.ontology.delete_ontology_from_workspace_facade import (
    DeleteOntologyFromWorkspaceFacade,
)
from server.facades.workspace.ontology.get_ontologies_in_workspace_facade import (
    GetOntologyInWorkspaceFacade,
)
from server.facades.workspace.prefix.create_prefix_in_workspace_facade import (
    CreatePrefixInWorkspaceFacade,
)
from server.facades.workspace.prefix.delete_prefix_from_workspace_facade import (
    DeletePrefixFromWorkspaceFacade,
)
from server.facades.workspace.prefix.get_prefixes_in_workspace_facade import (
    GetPrefixInWorkspaceFacade,
)
from server.models.mapping import MappingGraph
from server.models.ontology import Ontology
from server.models.workspace import WorkspaceModel
from server.routers.models import BasicResponse
from server.routers.workspaces.models import (
    CreateMappingInput,
    CreateOntologyInput,
    CreatePrefixInput,
    CreateWorkspaceInput,
)

router = APIRouter()


CreateWorkspaceFacadeDep = Annotated[
    CreateWorkspaceFacade,
    Depends(lambda: di[CreateWorkspaceFacade]),
]

DeleteWorkspaceFacadeDep = Annotated[
    DeleteWorkspaceFacade,
    Depends(lambda: di[DeleteWorkspaceFacade]),
]

GetWorkspacesFacadeDep = Annotated[
    GetWorkspacesFacade,
    Depends(lambda: di[GetWorkspacesFacade]),
]

ExportWorkspaceFacadeDep = Annotated[
    ExportWorkspaceFacade,
    Depends(lambda: di[ExportWorkspaceFacade]),
]

ImportWorkspaceFacadeDep = Annotated[
    ImportWorkspaceFacade,
    Depends(lambda: di[ImportWorkspaceFacade]),
]

GetPrefixInWorkspaceFacadeDep = Annotated[
    GetPrefixInWorkspaceFacade,
    Depends(lambda: di[GetPrefixInWorkspaceFacade]),
]

CreatePrefixInWorkspaceDep = Annotated[
    CreatePrefixInWorkspaceFacade,
    Depends(lambda: di[CreatePrefixInWorkspaceFacade]),
]

DeletePrefixFromWorkspaceDep = Annotated[
    DeletePrefixFromWorkspaceFacade,
    Depends(lambda: di[DeletePrefixFromWorkspaceFacade]),
]

GetOntologyInWorkspaceFacadeDep = Annotated[
    GetOntologyInWorkspaceFacade,
    Depends(lambda: di[GetOntologyInWorkspaceFacade]),
]

CreateOntologyInWorkspaceDep = Annotated[
    CreateOntologyInWorkspaceFacade,
    Depends(lambda: di[CreateOntologyInWorkspaceFacade]),
]

DeleteOntologyFromWorkspaceDep = Annotated[
    DeleteOntologyFromWorkspaceFacade,
    Depends(lambda: di[DeleteOntologyFromWorkspaceFacade]),
]

CreateMappingInWorkspaceDep = Annotated[
    CreateMappingInWorkspaceFacade,
    Depends(lambda: di[CreateMappingInWorkspaceFacade]),
]

DeleteMappingFromWorkspaceDep = Annotated[
    DeleteMappingFromWorkspaceFacade,
    Depends(lambda: di[DeleteMappingFromWorkspaceFacade]),
]

GetMappingsInWorkspaceDep = Annotated[
    GetMappingsInWorkspaceFacade,
    Depends(lambda: di[GetMappingsInWorkspaceFacade]),
]

UpdateMappingDep = Annotated[
    UpdateMappingFacade,
    Depends(lambda: di[UpdateMappingFacade]),
]

ExportMappingInWorkspaceDep = Annotated[
    ExportMappingInWorkspaceFacade,
    Depends(lambda: di[ExportMappingInWorkspaceFacade]),
]

ImportMappingInWorkspaceDep = Annotated[
    ImportMappingInWorkspaceFacade,
    Depends(lambda: di[ImportMappingInWorkspaceFacade]),
]

MappingToYARRRMLDep = Annotated[
    MappingToYARRRMLFacade,
    Depends(lambda: di[MappingToYARRRMLFacade]),
]


@router.get("/")
async def get_workspaces(
    get_workspaces_facade: GetWorkspacesFacadeDep,
) -> list[WorkspaceModel]:
    facade_response: FacadeResponse = get_workspaces_facade.execute()

    if facade_response.status // 100 == 2:
        return facade_response.data or []

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    get_workspaces_facade: GetWorkspacesFacadeDep,
) -> WorkspaceModel:
    facade_response: FacadeResponse = get_workspaces_facade.execute(
        uuid=workspace_id,
    )

    if (
        facade_response.status // 100 == 2
        and facade_response.data
        and len(facade_response.data) == 1
    ):
        return facade_response.data[0]

    if facade_response.data is None or len(facade_response.data) == 0:
        raise HTTPException(
            status_code=404,
            detail={
                "status": 404,
                "message": "Workspace not found",
            },
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.post("/", status_code=201)
async def create_workspace(
    input: CreateWorkspaceInput,
    create_workspace_facade: CreateWorkspaceFacadeDep,
) -> BasicResponse:
    facade_response = create_workspace_facade.execute(
        name=input.name,
        description=input.description,
        type=input.type,
        location=input.location,
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    delete_workspace_facade: DeleteWorkspaceFacadeDep,
) -> BasicResponse:
    facade_response = delete_workspace_facade.execute(
        uuid=workspace_id,
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get("/{workspace_id}/export", response_class=FileResponse)
async def export_workspace(
    workspace_id: str,
    export_workspace_facade: ExportWorkspaceFacadeDep,
) -> FileResponse:
    facade_response: FacadeResponse = export_workspace_facade.execute(
        workspace_id=workspace_id,
    )

    if facade_response.status // 100 == 2 and facade_response.data:
        _data = cast(Path, facade_response.data)
        return FileResponse(
            path=facade_response.data,
            filename=_data.name,
            media_type="application/gzip",
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.post("/import", response_class=PlainTextResponse)
async def import_workspace(
    tar: Annotated[bytes, File()],
    import_workspace_facade: ImportWorkspaceFacadeDep,
) -> str:
    facade_response = import_workspace_facade.execute(
        data=tar,
    )

    if facade_response.status // 100 == 2 and facade_response.data:
        return facade_response.data

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get("/{workspace_id}/prefix")
async def get_prefixes(
    workspace_id: str,
    get_prefix_in_workspace_facade: GetPrefixInWorkspaceFacadeDep,
) -> dict[str, str]:
    facade_response = get_prefix_in_workspace_facade.execute(
        workspace_id=workspace_id,
    )

    if facade_response.status // 100 == 2:
        return facade_response.data or {}

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.post("/{workspace_id}/prefix", status_code=201)
async def create_prefix(
    workspace_id: str,
    data: CreatePrefixInput,
    create_prefix_in_workspace_facade: CreatePrefixInWorkspaceDep,
) -> BasicResponse:
    facade_response = create_prefix_in_workspace_facade.execute(
        workspace_id=workspace_id,
        prefix=data.prefix,
        uri=str(data.uri),
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.delete("/{workspace_id}/prefix/{prefix}")
async def delete_prefix(
    workspace_id: str,
    prefix: str,
    delete_prefix_from_workspace_facade: DeletePrefixFromWorkspaceDep,
) -> BasicResponse:
    facade_response = delete_prefix_from_workspace_facade.execute(
        workspace_id=workspace_id,
        prefix=prefix,
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get("/{workspace_id}/ontology")
async def get_ontologies(
    workspace_id: str,
    get_ontology_in_workspace_facade: GetOntologyInWorkspaceFacadeDep,
) -> list[Ontology]:
    facade_response = get_ontology_in_workspace_facade.execute(
        workspace_id=workspace_id,
    )

    if facade_response.status // 100 == 2:
        return facade_response.data or []

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.post("/{workspace_id}/ontology", status_code=201)
async def create_ontology(
    workspace_id: str,
    data: CreateOntologyInput,
    create_ontology_in_workspace_facade: CreateOntologyInWorkspaceDep,
) -> BasicResponse:
    facade_response = create_ontology_in_workspace_facade.execute(
        workspace_id=workspace_id,
        name=data.name,
        description=data.description,
        base_uri=str(data.base_uri),
        content=data.content.encode(),
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.delete("/{workspace_id}/ontology/{ontology_id}")
async def delete_ontology(
    workspace_id: str,
    ontology_id: str,
    delete_ontology_from_workspace_facade: DeleteOntologyFromWorkspaceDep,
) -> BasicResponse:
    facade_response = delete_ontology_from_workspace_facade.execute(
        workspace_id=workspace_id,
        ontology_id=ontology_id,
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get("/{workspace_id}/mapping")
async def get_mappings(
    workspace_id: str,
    get_mappings_in_workspace_facade: GetMappingsInWorkspaceDep,
) -> list[MappingGraph]:
    facade_response = get_mappings_in_workspace_facade.execute(
        workspace_id=workspace_id,
    )

    if facade_response.status // 100 == 2:
        return facade_response.data or []

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get("/{workspace_id}/mapping/{mapping_id}")
async def get_mapping(
    workspace_id: str,
    mapping_id: str,
    get_mappings_in_workspace_facade: GetMappingsInWorkspaceDep,
) -> MappingGraph:
    facade_response = get_mappings_in_workspace_facade.execute(
        workspace_id=workspace_id,
        mapping_id=mapping_id,
    )

    if facade_response.status // 100 == 2 and facade_response.data:
        return facade_response.data

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.post("/{workspace_id}/mapping", status_code=201)
async def create_mapping(
    workspace_id: str,
    data: CreateMappingInput,
    create_mapping_in_workspace_facade: CreateMappingInWorkspaceDep,
) -> BasicResponse:
    facade_response = create_mapping_in_workspace_facade.execute(
        workspace_id=workspace_id,
        name=data.name,
        description=data.description,
        source_content=data.content.encode(),
        source_type=data.source_type,
        extra=data.extra,
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.delete("/{workspace_id}/mapping/{mapping_id}")
async def delete_mapping(
    workspace_id: str,
    mapping_id: str,
    delete_mapping_from_workspace_facade: DeleteMappingFromWorkspaceDep,
) -> BasicResponse:
    facade_response = delete_mapping_from_workspace_facade.execute(
        workspace_id=workspace_id,
        mapping_id=mapping_id,
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.put("/{workspace_id}/mapping/{mapping_id}")
async def update_mapping(
    mapping_id: str,
    workspace_id: str,
    data: MappingGraph,
    update_mapping_facade: UpdateMappingDep,
) -> BasicResponse:
    facade_response = update_mapping_facade.execute(
        mapping_id=mapping_id,
        workspace_id=workspace_id,
        mapping_graph=data,
    )

    if facade_response.status // 100 == 2:
        return BasicResponse(
            message=facade_response.message,
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get(
    "/{workspace_id}/mapping/{mapping_id}/export",
    response_class=FileResponse,
)
async def export_mapping(
    workspace_id: str,
    mapping_id: str,
    export_mapping_in_workspace_facade: ExportMappingInWorkspaceDep,
) -> FileResponse:
    facade_response: FacadeResponse = export_mapping_in_workspace_facade.execute(
        mapping_id=mapping_id,
    )

    if facade_response.status // 100 == 2 and facade_response.data:
        _data = cast(Path, facade_response.data)
        return FileResponse(
            path=facade_response.data,
            filename=_data.name,
            media_type="application/gzip",
        )

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.post(
    "/{workspace_id}/mapping/import",
    response_class=PlainTextResponse,
)
async def import_mapping(
    workspace_id: str,
    tar: Annotated[bytes, File()],
    import_mapping_in_workspace_facade: ImportMappingInWorkspaceDep,
) -> str:
    facade_response = import_mapping_in_workspace_facade.execute(
        workspace_id=workspace_id,
        tar=tar,
    )

    if facade_response.status // 100 == 2:
        return facade_response.message

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get(
    "/{workspace_id}/mapping/{mapping_id}/yarrrml",
    response_class=PlainTextResponse,
)
async def mapping_to_yarrrml(
    workspace_id: str,
    mapping_id: str,
    mapping_to_yarrrml_facade: MappingToYARRRMLDep,
) -> str:
    facade_response = mapping_to_yarrrml_facade.execute(
        workspace_id=workspace_id,
        mapping_id=mapping_id,
    )

    if facade_response.status // 100 == 2 and facade_response.data:
        return facade_response.data

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )
