import logging
import time
from contextlib import asynccontextmanager
from os import getenv
from pathlib import Path

import structlog
from asgi_correlation_id import CorrelationIdMiddleware
from asgi_correlation_id.context import correlation_id
from ddtrace.contrib.asgi.middleware import TraceMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.protocols.utils import (
    get_path_with_query_string,
)

from bootstrap import bootstrap, teardown
from server.routers.rml.rml import router as rml_router
from server.routers.settings.settings import router as settings_router
from server.routers.sources.sources import (
    router as sources_router,
)
from server.routers.workspaces.workspaces import (
    router as workspaces_router,
)

load_dotenv()

DEBUG = bool(getenv("DEBUG", False))

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await bootstrap()
    try:
        yield
    finally:
        await teardown()


app = FastAPI(lifespan=lifespan)


access_logger = structlog.get_logger("api.access")


@app.middleware("http")
async def logging_middleware(request: Request, call_next) -> Response:
    structlog.contextvars.clear_contextvars()
    # These context vars will be added to all log entries emitted during the request
    request_id = correlation_id.get()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    start_time = time.perf_counter_ns()
    # If the call_next raises an error, we still want to return our own 500 response,
    # so we can add headers to it (process time, request ID...)
    response = Response(status_code=500)
    try:
        response = await call_next(request)
    except Exception:
        structlog.stdlib.get_logger("api.error").exception("Uncaught exception")
        raise
    finally:
        process_time = time.perf_counter_ns() - start_time
        status_code = response.status_code
        url = get_path_with_query_string(request.scope)  # type: ignore
        client_host = request.client.host  # type: ignore
        client_port = request.client.port  # type: ignore
        http_method = request.method
        http_version = request.scope["http_version"]
        # Recreate the Uvicorn access log format, but add all parameters as structured information
        access_logger.info(
            f"""{client_host}:{client_port} - "{http_method}
                {url} HTTP/{http_version}" {status_code}""",
            http={
                "url": str(request.url),
                "status_code": status_code,
                "method": http_method,
                "request_id": request_id,
                "version": http_version,
            },
            network={
                "client": {
                    "ip": client_host,
                    "port": client_port,
                }
            },
            duration=process_time,
        )
        response.headers["X-Process-Time"] = str(process_time / 10**9)
    return response


app.add_middleware(CorrelationIdMiddleware)

tracing_middleware = next(
    (m for m in app.user_middleware if m.cls == TraceMiddleware),
    None,
)
if tracing_middleware is not None:
    app.user_middleware = [m for m in app.user_middleware if m.cls != TraceMiddleware]
    structlog.stdlib.get_logger("api.datadog_patch").info(
        "Patching Datadog tracing middleware to be the outermost middleware..."
    )
    app.user_middleware.insert(0, tracing_middleware)
    app.middleware_stack = app.build_middleware_stack()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS disabled")


app.include_router(
    workspaces_router,
    prefix="/api/workspaces",
    tags=["workspaces"],
)

app.include_router(
    sources_router,
    prefix="/api/sources",
    tags=["sources"],
)

app.include_router(
    rml_router,
    prefix="/api/rml",
    tags=["rml"],
)
app.include_router(
    settings_router,
    prefix="/api/settings",
    tags=["settings"],
)

current_dir = Path(__file__).parent.parent
build_dir = current_dir / "public"

if build_dir.exists():
    app.mount(
        "/",
        StaticFiles(directory=build_dir, html=True),
        name="static",
    )

else:
    logger.warning(f"Build directory {build_dir} does not exist")
