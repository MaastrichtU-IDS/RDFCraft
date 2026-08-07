import logging

import shacl_rust
from kink import inject

from server.exceptions import ErrCodes, ServerException
from server.models.shacl_report import ShaclValidationReport, ShaclViolation
from server.service_protocols.shacl_service_protocol import (
    ShaclServiceProtocol,
)


def _strip_iri(value: str | None) -> str:
    if value and value.startswith("<") and value.endswith(">"):
        return value[1:-1]
    return value or ""


def _strip_literal(value: str | None) -> str:
    # shacl_rust serializes sh:value as its Turtle literal form, e.g.
    # '"notanumber"' or '"30"^^<http://www.w3.org/2001/XMLSchema#integer>'.
    if not value:
        return ""
    if not value.startswith('"'):
        return value
    end = value.rfind('"')
    return value[1:end] if end > 0 else value


@inject(alias=ShaclServiceProtocol)
class ShaclService(ShaclServiceProtocol):
    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.logger.info("ShaclService instantiated")

    def validate(self, data_ttl: str, shapes_ttl: str) -> ShaclValidationReport:
        self.logger.info("Validating data graph against SHACL shapes")

        try:
            report = shacl_rust.validate(data_ttl, shapes_ttl)
        except Exception as e:
            self.logger.error(f"Error executing SHACL validation: {e}")
            raise ServerException(
                f"Error executing SHACL validation: {e}",
                ErrCodes.SHACL_VALIDATION_EXECUTION_ERROR,
            )

        violations = [
            ShaclViolation(
                focus_node=_strip_iri(result.get("focusNode")),
                result_path=_strip_iri(result.get("resultPath")),
                source_constraint_component=_strip_iri(
                    result.get("sourceConstraintComponent")
                ),
                value=_strip_literal(result.get("value")),
                message="; ".join(result.get("messages", [])),
                severity=_strip_iri(result.get("severity")),
            )
            for result in report.get("results", [])
        ]

        return ShaclValidationReport(
            conforms=report.get("conforms", len(violations) == 0),
            violations=violations,
        )
