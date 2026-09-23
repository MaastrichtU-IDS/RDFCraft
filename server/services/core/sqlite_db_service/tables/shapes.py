from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from server.services.core.sqlite_db_service.base import (
    Base,
)


class ShapesTable(Base):
    __tablename__ = "shapes"

    uuid: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    file_uuid: Mapped[str] = mapped_column(String)

    def to_dict(self):
        return {
            "uuid": self.uuid,
            "name": self.name,
            "description": self.description,
            "file_uuid": self.file_uuid,
        }

    @classmethod
    def from_dict(cls, data: dict):
        return cls(
            uuid=data["uuid"],
            name=data["name"],
            description=data["description"],
            file_uuid=data["file_uuid"],
        )
