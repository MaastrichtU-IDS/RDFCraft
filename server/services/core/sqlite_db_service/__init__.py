from pathlib import Path

from kink import inject
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session

from server.service_protocols.db_service_protocol import (
    DBServiceProtocol,
)
from server.services.core.sqlite_db_service.base import Base
from server.services.core.sqlite_db_service.tables import *  # noqa: F403


@inject(alias=DBServiceProtocol)
class DBService(DBServiceProtocol):
    def __init__(
        self,
        APP_DIR: Path,
    ):
        self._db_path = f"sqlite:///{(APP_DIR / 'db.sqlite').absolute()}"
        if not APP_DIR.exists():
            APP_DIR.mkdir()
        self._engine = create_engine(
            f"{self._db_path}",
        )
        Base.metadata.create_all(self._engine)

    @classmethod
    def from_connection_string(cls, connection_string: str):
        db_service = cls.__new__(cls)
        db_service._db_path = connection_string
        db_service._engine = create_engine(
            connection_string,
        )
        Base.metadata.create_all(db_service._engine)
        return db_service

    def get_engine(self) -> Engine:
        return self._engine

    def get_session(self) -> Session:
        return sessionmaker(bind=self._engine)()

    def dispose(self):
        self._engine.dispose()


__all__ = ["DBService"]
