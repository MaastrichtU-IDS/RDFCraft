from typing import Annotated

from fastapi.exceptions import HTTPException
from fastapi.params import Depends
from fastapi.routing import APIRouter
from kink.container import di
from pydantic import BaseModel

from server.facades.shacl.validate_shacl_facade import ValidateShaclFacade
from server.models.shacl_report import ShaclValidationReport

router = APIRouter()


ValidateShaclFacadeDep = Annotated[
    ValidateShaclFacade,
    Depends(lambda: di[ValidateShaclFacade]),
]


class ValidateShaclInput(BaseModel):
    data_ttl: str
    shapes_ttl: str


@router.post("/validate")
async def validate(
    data: ValidateShaclInput,
    validate_shacl_facade: ValidateShaclFacadeDep,
) -> ShaclValidationReport:
    facade_response = validate_shacl_facade.execute(
        data_ttl=data.data_ttl,
        shapes_ttl=data.shapes_ttl,
    )

    if facade_response.status // 100 == 2:
        return facade_response.data

    raise HTTPException(
        status_code=facade_response.status,
        detail=facade_response.to_dict(),
    )
