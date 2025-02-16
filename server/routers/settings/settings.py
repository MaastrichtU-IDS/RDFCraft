import re
import shutil
import subprocess
from pathlib import Path
from typing import Annotated

from fastapi.exceptions import HTTPException
from fastapi.params import Depends
from fastapi.routing import APIRouter
from kink.container import di
from starlette.responses import FileResponse

from server.services.core.config_service import ConfigServiceProtocol

router = APIRouter()

ConfigServiceDep = Annotated[
    ConfigServiceProtocol, Depends(lambda: di[ConfigServiceProtocol])
]


@router.get("/openai-url")
async def get_openai_url(config_service: ConfigServiceDep):
    return config_service.get("openai_url") or ""


@router.put("/openai-url")
async def set_openai_url(openai_url: str, config_service: ConfigServiceDep):
    config_service.set("openai_url", openai_url)
    return {"message": "OpenAI URL updated"}


@router.get("/openai-key")
async def get_openai_key(config_service: ConfigServiceDep):
    return config_service.get("openai_key") or ""


@router.put("/openai-key")
async def set_openai_key(openai_key: str, config_service: ConfigServiceDep):
    config_service.set("openai_key", openai_key)
    return {"message": "OpenAI key updated"}


@router.get("/openai-model")
async def get_openai_model(config_service: ConfigServiceDep):
    return config_service.get("openai_model") or ""


@router.put("/openai-model")
async def set_openai_model(openai_model: str, config_service: ConfigServiceDep):
    config_service.set("openai_model", openai_model)
    return {"message": "OpenAI model updated"}


@router.get("/java-memory")
async def get_java_memory(config_service: ConfigServiceDep):
    return config_service.get("java_memory")


@router.put("/java-memory")
async def set_java_memory(java_memory: str, config_service: ConfigServiceDep):
    mem_checker = r"^\d+[kKmMgG]$"  # 1k, 1K, 1m, 1M, 1g, 1G
    if not java_memory or not java_memory.lower().strip() or not java_memory.strip():
        return {"message": "Java memory cannot be empty"}
    if not re.match(mem_checker, java_memory):
        return {"message": "Java memory must be in the format of 1k, 1m, 1g"}
    config_service.set("java_memory", java_memory)
    return {"message": "Java memory updated"}


@router.get("/java-path")
async def get_java_path(config_service: ConfigServiceDep):
    return config_service.get("java_path")


@router.put("/java-path")
async def set_java_path(java_path: str, config_service: ConfigServiceDep):
    path = Path(java_path).absolute()
    if not path.exists():
        return {"message": "Java path does not exist"}
    # Check if it's a valid java path
    try:
        subprocess.run(
            [java_path, "-version"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError:
        raise HTTPException(
            status_code=400, detail="Java path is not a valid Java executable"
        )
    except OSError:
        raise HTTPException(
            status_code=400, detail="Java path is not a valid Java executable"
        )

    config_service.set("java_path", java_path)
    return {"message": "Java path updated"}


@router.delete("/clear-temp")
async def clear_temp():
    shutil.rmtree(di["TEMP_DIR"])
    di["TEMP_DIR"].mkdir()
    return {"message": "Temporary directory cleared"}


@router.get("/logs", response_class=FileResponse)
async def get_logs():
    path: Path = di["APP_DIR"] / "rdfcraft.log"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Logs not found")
    new_path = di["TEMP_DIR"] / "rdfcraft.log"
    if new_path.exists():
        new_path.unlink()
    new_path.write_text(path.read_text())
    return FileResponse(new_path, filename="rdfcraft.log")


@router.delete("/logs")
async def clear_logs():
    path = di["APP_DIR"] / "rdfcraft.log"
    if path.exists():
        open(path, "w").close()
    return {"message": "Logs cleared"}


@router.get("/system")
async def get_system():
    return di["SYSTEM"]


@router.get("/arch")
async def get_arch():
    return di["ARCH"]


@router.get("/app-dir")
async def get_app_dir():
    return di["APP_DIR"]
