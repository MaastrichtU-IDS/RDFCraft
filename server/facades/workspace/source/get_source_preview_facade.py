import csv
import io
import json

import jsonpath_ng
from kink import inject

from server.facades import BaseFacade, FacadeResponse
from server.models.source import Source, SourceType
from server.services.local.local_source_service import (
    SourceServiceProtocol,
)


@inject
class GetSourcePreviewFacade(BaseFacade):
    def __init__(
        self,
        source_service: SourceServiceProtocol,
    ):
        super().__init__()
        self.source_service = source_service

    @BaseFacade.error_wrapper
    def execute(
        self,
        source_uuid: str,
        limit: int = 5,
    ) -> FacadeResponse:
        self.logger.info(f"Getting source preview for {source_uuid}")

        source: Source = self.source_service.get_source(source_id=source_uuid)
        content = self.source_service.download_source(source_id=source_uuid)

        if source.type == SourceType.CSV:
            rows = self._preview_csv(content, limit)
        else:
            rows = self._preview_json(content, source.extra, limit)

        return self._success_response(
            message="Source preview fetched successfully",
            data=rows,
        )

    def _preview_csv(self, content: bytes, limit: int) -> list[dict]:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        rows = []
        for index, row in enumerate(reader):
            if index >= limit:
                break
            rows.append(dict(row))
        return rows

    def _preview_json(self, content: bytes, extra: dict, limit: int) -> list[dict]:
        data = json.loads(content.decode("utf-8"))

        json_path = (extra or {}).get("json_path")
        if json_path:
            matches = jsonpath_ng.parse(json_path).find(data)
            data = matches[0].value if matches else []

        if isinstance(data, dict):
            data = [data]

        return data[:limit]
