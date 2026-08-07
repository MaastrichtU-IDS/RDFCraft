import unittest

from server.exceptions import ServerException
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

MALFORMED_DATATYPE_TTL = """
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:alice a ex:Person ;
    ex:age "not-a-number"^^xsd:integer .
"""


class ShaclServiceTestCases(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ShaclService()

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
        self.assertEqual(
            violation.severity, "http://www.w3.org/ns/shacl#Violation"
        )

    def test_violation_with_offending_value_strips_quoting_and_datatype(self):
        report = self.service.validate(MALFORMED_DATATYPE_TTL, SHAPES_TTL)
        self.assertFalse(report.conforms)

        violation = report.violations[0]
        self.assertEqual(violation.value, "not-a-number")

    def test_malformed_data_raises_server_exception(self):
        with self.assertRaises(ServerException):
            self.service.validate("not valid turtle {{{", SHAPES_TTL)


if __name__ == "__main__":
    unittest.main()
