from pydantic import (
    Base64UrlStr,
    BaseModel,
    HttpUrl,
)

from server.models.source import SourceType
from server.services.core.sqlite_db_service.tables.workspace_metadata import (
    WorkspaceType,
)


class CreateWorkspaceInput(BaseModel):
    name: str
    description: str
    type: WorkspaceType
    location: str = ""


class UpdateWorkspaceInput(BaseModel):
    name: str | None
    description: str | None


class CreatePrefixInput(BaseModel):
    prefix: str
    uri: HttpUrl


class CreateOntologyInput(BaseModel):
    name: str
    description: str
    base_uri: HttpUrl
    content: Base64UrlStr


class CreateShapesInput(BaseModel):
    name: str
    description: str
    content: Base64UrlStr


class CreateMappingInput(BaseModel):
    name: str
    description: str
    content: Base64UrlStr
    source_type: SourceType
    extra: dict = {}
