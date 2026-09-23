import logging
import subprocess
from pathlib import Path
from uuid import uuid4

import rdflib
from kink import inject
from rdflib.namespace import RDF, Namespace

from server.exceptions import ErrCodes, ServerException
from server.models.shacl_report import ShaclValidationReport, ShaclViolation
from server.service_protocols.shacl_service_protocol import (
    ShaclServiceProtocol,
)

# Preserve original literal spelling instead of normalizing valid values, and
# suppress rdflib warnings for intentionally-invalid typed literals (e.g. a
# DatatypeConstraintComponent violation reporting "HOME"^^xsd:long as its
# sh:value) -- both are expected inputs when reading a validation report.
rdflib.NORMALIZE_LITERALS = False
logging.getLogger("rdflib.term").setLevel(logging.ERROR)

SH = Namespace("http://www.w3.org/ns/shacl#")


@inject(alias=ShaclServiceProtocol)
class ShaclService(ShaclServiceProtocol):
    def __init__(
        self,
        TEMP_DIR: Path,
    ):
        self.logger = logging.getLogger(__name__)
        self.TEMP_DIR = TEMP_DIR
        self.logger.info("Instantiating ShaclService")

        self.validator_bin = (
            Path(__file__).parent.parent.parent.parent / "bin" / "shacl-validator"
        )

        if not self.validator_bin.exists():
            self.logger.error(
                "shacl-validator binary not found, SHACL validation will not be executed"
            )

        self.logger.info("ShaclService instantiated")

    def validate(self, data_ttl: str, shapes_ttl: str) -> ShaclValidationReport:
        self.logger.info("Validating data graph against SHACL shapes")

        if not self.validator_bin.exists():
            raise ServerException(
                "shacl-validator binary not found",
                ErrCodes.SHACL_VALIDATOR_NOT_FOUND,
            )

        process_uuid = uuid4().hex

        data_file: Path = self.TEMP_DIR / f"shacl_data_{process_uuid}.ttl"
        shapes_file: Path = self.TEMP_DIR / f"shacl_shapes_{process_uuid}.ttl"
        report_file: Path = self.TEMP_DIR / f"shacl_report_{process_uuid}.ttl"

        data_file.touch()
        data_file.write_text(data_ttl)

        shapes_file.touch()
        shapes_file.write_text(shapes_ttl)

        cmd = [
            str(self.validator_bin),
            "validate",
            str(shapes_file),
            str(data_file),
            "--output-format",
            "ttl",
            "--output",
            str(report_file),
            "--quiet",
        ]

        self.logger.info(f"Executing command: {cmd}")

        try:
            # shacl-validator exits non-zero when the data does not conform,
            # which is expected -- only a missing report file is a real error.
            subprocess.run(
                cmd,
                shell=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )

            if not report_file.exists():
                raise ServerException(
                    "shacl-validator did not produce a validation report",
                    ErrCodes.SHACL_VALIDATION_EXECUTION_ERROR,
                )

            return self._parse_report(report_file)
        except ServerException:
            raise
        except Exception as e:
            self.logger.error(f"Error executing SHACL validation: {e}")
            raise ServerException(
                f"Error executing SHACL validation: {e}",
                ErrCodes.SHACL_VALIDATION_EXECUTION_ERROR,
            )

    def _parse_report(self, report_file: Path) -> ShaclValidationReport:
        results_graph = rdflib.Graph()
        results_graph.parse(str(report_file), format="turtle")

        violation_nodes = list(results_graph.subjects(RDF.type, SH.ValidationResult))

        violations = []
        for node in violation_nodes:
            focus_node = results_graph.value(node, SH.focusNode)
            result_path = results_graph.value(node, SH.resultPath)
            constraint_component = results_graph.value(
                node, SH.sourceConstraintComponent
            )
            value = results_graph.value(node, SH.value)
            message = results_graph.value(node, SH.resultMessage)
            severity = results_graph.value(node, SH.resultSeverity)
            source_shape = results_graph.value(node, SH.sourceShape)

            if value is None:
                observed_value, value_type = "", "unknown"
            elif isinstance(value, rdflib.URIRef):
                observed_value, value_type = str(value), "iri"
            elif isinstance(value, rdflib.Literal):
                observed_value = str(value)
                is_string_typed = value.datatype is None or str(
                    value.datatype
                ) == "http://www.w3.org/2001/XMLSchema#string"
                value_type = "string" if is_string_typed else "literal"
            else:
                observed_value, value_type = str(value), "unknown"

            violations.append(
                ShaclViolation(
                    focus_node=str(focus_node) if focus_node is not None else "",
                    result_path=str(result_path) if result_path is not None else "",
                    source_constraint_component=str(constraint_component)
                    if constraint_component is not None
                    else "",
                    value=observed_value,
                    value_type=value_type,
                    message=str(message) if message is not None else "",
                    severity=str(severity) if severity is not None else "",
                    source_shape=str(source_shape) if source_shape is not None else "",
                )
            )

        return ShaclValidationReport(
            conforms=len(violations) == 0,
            violations=violations,
        )
