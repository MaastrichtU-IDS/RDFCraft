from abc import ABC, abstractmethod

from server.models.shacl_report import ShaclValidationReport


class ShaclServiceProtocol(ABC):
    """
    SHACL validation service protocol
    """

    @abstractmethod
    def validate(self, data_ttl: str, shapes_ttl: str) -> ShaclValidationReport:
        """
        Validate a Turtle data graph against a Turtle SHACL shapes graph

        Args:
            data_ttl (str): The data graph, as Turtle
            shapes_ttl (str): The SHACL shapes graph, as Turtle

        Returns:
            ShaclValidationReport: The validation report
        """
        ...
