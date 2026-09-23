import logging
from uuid import uuid4

from kink import inject
from sqlalchemy import select

from server.exceptions import ErrCodes, ServerException
from server.models.shapes import ShapeSet
from server.service_protocols.fs_service_protocol import (
    FSServiceProtocol,
)
from server.service_protocols.shapes_service_protocol import (
    ShapesServiceProtocol,
)
from server.services.core.sqlite_db_service import (
    DBService,
    ShapesTable,
)
from server.services.local.local_fs_service import (
    LocalFSService,
)


@inject(alias=ShapesServiceProtocol)
class LocalShapesService(ShapesServiceProtocol):
    def __init__(
        self,
        fs_service: LocalFSService,
        db_service: DBService,
    ):
        self.logger = logging.getLogger(__name__)
        self.fs_service: FSServiceProtocol = fs_service
        self.db_service: DBService = db_service

        self.logger.info("LocalShapesService initialized")

    def _get_from_shapes_table(self, shapes_id: str) -> ShapesTable | None:
        try:
            query = select(ShapesTable).where(ShapesTable.uuid == shapes_id).limit(1)

            with self.db_service.get_session() as session:
                result = session.execute(query).first()
                if not result:
                    return None

                return result[0]
        except Exception as e:
            self.logger.error(
                f"Error fetching shape set from table: {e}",
                exc_info=e,
            )
            raise ServerException(
                "Error fetching shape set from table",
                ErrCodes.DB_ERROR,
            )

    def get_shapes(self, shapes_id: str) -> ShapeSet:
        self.logger.info(f"Getting shape set with id: {shapes_id}")
        shapes_table = self._get_from_shapes_table(shapes_id)

        if not shapes_table:
            self.logger.error(f"Shape set with id: {shapes_id} not found")
            raise ServerException(
                "Shape set not found",
                ErrCodes.SHAPES_NOT_FOUND,
            )

        try:
            content_bytes = self.fs_service.download_file_with_uuid(
                shapes_table.file_uuid
            )

            return ShapeSet(
                uuid=shapes_table.uuid,
                file_uuid=shapes_table.file_uuid,
                name=shapes_table.name,
                description=shapes_table.description,
                content=content_bytes.decode("utf-8"),
            )
        except ServerException as e:
            if e.code == ErrCodes.FILE_NOT_FOUND:
                self.logger.error(
                    f"Shape set file not found for id: {shapes_id}",
                    exc_info=e,
                )
                raise ServerException(
                    "Shape set file not found",
                    ErrCodes.SHAPES_NOT_FOUND,
                )
            self.logger.error(
                f"Failed to get shape set with id: {shapes_id}",
                exc_info=e,
            )
            raise e
        except Exception as e:
            self.logger.error(
                f"Unexpected error while getting shape set with id: {shapes_id}",
                exc_info=e,
            )
            raise ServerException(
                "Unexpected error",
                ErrCodes.UNKNOWN_ERROR,
            )

    def get_shapes_list(self, ids: list[str]) -> list[ShapeSet]:
        self.logger.info(f"Getting shape sets with ids: {ids}")
        query = select(ShapesTable).where(ShapesTable.uuid.in_(ids))

        shape_sets = []

        try:
            with self.db_service.get_session() as session:
                result = session.execute(query).all()

                for row in result:
                    shapes_table = row[0]
                    content_bytes = self.fs_service.download_file_with_uuid(
                        shapes_table.file_uuid
                    )

                    shape_sets.append(
                        ShapeSet(
                            uuid=shapes_table.uuid,
                            file_uuid=shapes_table.file_uuid,
                            name=shapes_table.name,
                            description=shapes_table.description,
                            content=content_bytes.decode("utf-8"),
                        )
                    )

            return shape_sets
        except Exception as e:
            self.logger.error(
                f"Error fetching shape sets: {e}",
                exc_info=e,
            )
            raise ServerException(
                "Error fetching shape sets",
                ErrCodes.DB_ERROR,
            )

    def create_shapes(
        self,
        name: str,
        description: str,
        content: bytes,
    ) -> ShapeSet:
        self.logger.info(f"Creating shape set: {name}")
        try:
            self.logger.info("Uploading shapes file")
            file_metadata = self.fs_service.upload_file(f"{name}.ttl", content)
            self.logger.info("File uploaded")

            shapes = ShapeSet(
                uuid=uuid4().hex,
                file_uuid=file_metadata.uuid,
                name=name,
                description=description,
                content=content.decode("utf-8"),
            )

            with self.db_service.get_session() as session:
                session.add(
                    ShapesTable(
                        uuid=shapes.uuid,
                        name=shapes.name,
                        description=shapes.description,
                        file_uuid=file_metadata.uuid,
                    )
                )
                session.commit()

            return shapes
        except Exception as e:
            self.logger.error(
                f"Error creating shape set: {e}",
                exc_info=e,
            )
            raise ServerException(
                "Error creating shape set",
                ErrCodes.UNKNOWN_ERROR,
            )

    def delete_shapes(self, shapes_id: str) -> None:
        self.logger.info(f"Deleting shape set with id: {shapes_id}")

        shapes_table = self._get_from_shapes_table(shapes_id)

        if not shapes_table:
            self.logger.error(f"Shape set with id: {shapes_id} not found")
            raise ServerException(
                "Shape set not found",
                ErrCodes.SHAPES_NOT_FOUND,
            )

        try:
            self.fs_service.delete_file_with_uuid(shapes_table.file_uuid)

            with self.db_service.get_session() as session:
                session.delete(shapes_table)
                session.commit()

            self.logger.info(f"Shape set with id: {shapes_id} deleted")

            return None
        except Exception as e:
            self.logger.error(
                f"Error deleting shape set with id: {shapes_id}",
                exc_info=e,
            )
            raise ServerException(
                "Error deleting shape set",
                ErrCodes.UNKNOWN_ERROR,
            )
