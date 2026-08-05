import tempfile
import unittest
from pathlib import Path

from server.services.core.shacl_service import ShaclService

SHAPES_TTL = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:PersonShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path ex:age ;
        sh:datatype xsd:integer ;
        sh:minCount 1 ;
    ] .
"""

CONFORMING_DATA_TTL = """
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:alice a ex:Person ;
    ex:age "30"^^xsd:integer .
"""

VIOLATING_DATA_TTL = """
@prefix ex: <http://example.org/> .

ex:alice a ex:Person .
"""


class ShaclServiceTestCases(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.service = ShaclService(TEMP_DIR=Path(self.temp_dir.name))

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_validator_binary_found(self):
        self.assertTrue(self.service.validator_bin.exists())

    def test_conforming_data(self):
        report = self.service.validate(CONFORMING_DATA_TTL, SHAPES_TTL)
        self.assertTrue(report.conforms)
        self.assertEqual(report.violations, [])

    def test_violating_data(self):
        report = self.service.validate(VIOLATING_DATA_TTL, SHAPES_TTL)
        self.assertFalse(report.conforms)
        self.assertEqual(len(report.violations), 1)

        violation = report.violations[0]
        self.assertEqual(violation.focus_node, "http://example.org/alice")
        self.assertEqual(violation.result_path, "http://example.org/age")
        self.assertEqual(
            violation.source_constraint_component,
            "http://www.w3.org/ns/shacl#MinCountConstraintComponent",
        )


if __name__ == "__main__":
    unittest.main()
