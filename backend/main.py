import asyncio
import json
import logging
import logging.config
from contextlib import asynccontextmanager

import coloredlogs
from fastapi import FastAPI

from bootstrap import bootstrap


@asynccontextmanager
async def setup(app: FastAPI):
    await bootstrap()
    yield
    await asyncio.sleep(1)


app = FastAPI(lifespan=setup)

from routers.authentication import router as auth_router
from routers.authorization import router as authz_router
from routers.files import router as file_router
from routers.mapping import router as mapping_router
from routers.ontology import router as ontology_router
from routers.prefix import router as prefix_router
from routers.rml import router as rml_router
from routers.source import router as source_router
from routers.users import router as user_router
from routers.workspace import router as workspace_router

app.include_router(
    user_router, prefix="/users", tags=["users"]
)

app.include_router(
    auth_router, prefix="/auth", tags=["auth"]
)
app.include_router(
    authz_router, prefix="/authz", tags=["authz"]
)
app.include_router(
    file_router, prefix="/files", tags=["files"]
)
app.include_router(
    prefix_router, prefix="/prefixes", tags=["prefixes"]
)
app.include_router(
    ontology_router,
    prefix="/ontologies",
    tags=["ontologies"],
)
app.include_router(
    source_router, prefix="/sources", tags=["sources"]
)
app.include_router(
    mapping_router, prefix="/mappings", tags=["mappings"]
)
app.include_router(
    workspace_router,
    prefix="/workspaces",
    tags=["workspaces"],
)
app.include_router(
    rml_router,
    prefix="/complete-mapping",
    tags=["complete-mapping"],
)


if __name__ == "__main__":
    import uvicorn

    with open("logging_config.json", "r") as f:
        log_config = json.load(f)

    logging.config.dictConfig(log_config)
    coloredlogs.install()

    uvicorn.run(
        app=app,
        host="0.0.0.0",
        port=8000,
    )
