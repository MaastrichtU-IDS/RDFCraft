from dataclasses import dataclass, field


@dataclass(kw_only=True)
class ShaclViolation:
    """
    A single sh:ValidationResult from a SHACL validation report.

    Attributes:
        focus_node (str): The node that violated the shape
        result_path (str): The predicate/path the violation occurred on, if any
        source_constraint_component (str): The SHACL constraint component that was violated
        value (str): The offending value, if any
        message (str): The human-readable violation message
        severity (str): The SHACL severity (sh:Violation, sh:Warning, sh:Info)
    """

    focus_node: str = ""
    result_path: str = ""
    source_constraint_component: str = ""
    value: str = ""
    message: str = ""
    severity: str = ""

    def to_dict(self):
        return {
            "focus_node": self.focus_node,
            "result_path": self.result_path,
            "source_constraint_component": self.source_constraint_component,
            "value": self.value,
            "message": self.message,
            "severity": self.severity,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            focus_node=data.get("focus_node", ""),
            result_path=data.get("result_path", ""),
            source_constraint_component=data.get("source_constraint_component", ""),
            value=data.get("value", ""),
            message=data.get("message", ""),
            severity=data.get("severity", ""),
        )


@dataclass(kw_only=True)
class ShaclValidationReport:
    """
    A SHACL validation report.

    Attributes:
        conforms (bool): Whether the data graph conforms to the shapes
        violations (list[ShaclViolation]): The violations found, if any
    """

    conforms: bool
    violations: list[ShaclViolation] = field(default_factory=list)

    def to_dict(self):
        return {
            "conforms": self.conforms,
            "violations": [violation.to_dict() for violation in self.violations],
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            conforms=data["conforms"],
            violations=[
                ShaclViolation.from_dict(violation)
                for violation in data.get("violations", [])
            ],
        )
