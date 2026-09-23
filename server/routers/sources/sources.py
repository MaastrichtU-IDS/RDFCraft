from typing import Annotated

from fastapi.exceptions import HTTPException
from fastapi.params import Depends
from fastapi.routing import APIRouter
from kink.container import di

from server.facades.workspace.source.get_source_facade import (
    GetSourceFacade,
)
from server.facades.workspace.source.get_source_preview_facade import (
    GetSourcePreviewFacade,
)
from server.models.source import Source

router = APIRouter()


GetSourceFacadeDep = Annotated[GetSourceFacade, Depends(lambda: di[GetSourceFacade])]
GetSourcePreviewFacadeDep = Annotated[
    GetSourcePreviewFacade, Depends(lambda: di[GetSourcePreviewFacade])
]


@router.get("/{source_uuid}")
async def get_source(source_uuid: str, get_source_facade: GetSourceFacadeDep) -> Source:
    facade_response = get_source_facade.execute(
        source_uuid=source_uuid,
    )

    if facade_response.status // 100 == 2 and facade_response.data:
        return facade_response.data

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )


@router.get("/{source_uuid}/preview")
async def get_source_preview(
    source_uuid: str,
    get_source_preview_facade: GetSourcePreviewFacadeDep,
    limit: int = 5,
) -> list[dict]:
    facade_response = get_source_preview_facade.execute(
        source_uuid=source_uuid,
        limit=limit,
    )

    if facade_response.status // 100 == 2:
        return facade_response.data or []

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )
