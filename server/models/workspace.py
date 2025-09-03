from dataclasses import dataclass

from server.services.core.sqlite_db_service.tables.workspace_metadata import (
    WorkspaceType,
)


@dataclass
class WorkspaceModel:
    """
    Model for workspace

    Attributes:
        uuid (str): UUID of the workspace
        name (str): name of the workspace
        description (str): description of the workspace
        type (WorkspaceType): type of the workspace
        location (str): location of the workspace
        enabled_features (list[str]): list of enabled features
        mappings (list[str]): ids of mappings
        ontologies (list[str]): ids of ontologies
        prefixes (dict[str, str]): prefixes
        used_uri_patterns (list[str]): list of used URI patterns
        used_uri_patterns_by_workspace (dict[str, list[str]]): mapping of workspace IDs to their used URI patterns
    """

    uuid: str
    name: str
    description: str
    type: WorkspaceType
    location: str
    enabled_features: list[str]
    mappings: list[str]
    prefixes: dict[str, str]
    ontologies: list[str]
    used_uri_patterns: list[str]
    used_uri_patterns_by_workspace: dict[str, list[str]]

    @classmethod
    def create_with_defaults(
        cls,
        uuid: str,
        name: str,
        description: str,
        type: WorkspaceType,
        location: str,
    ) -> "WorkspaceModel":
        """
        Create a workspace with default values

        Args:
            uuid (str): UUID of the workspace
            name (str): name of the workspace
            description (str): description of the workspace
            type (WorkspaceType): type of the workspace
            location (str): location of the workspace

        Returns:
            WorkspaceModel: workspace
        """
        return WorkspaceModel(
            uuid=uuid,
            name=name,
            description=description,
            type=type,
            location=location,
            enabled_features=[],
            mappings=[],
            prefixes={},
            ontologies=[],
            used_uri_patterns=[],
            used_uri_patterns_by_workspace={},
        )

    def to_dict(self) -> dict:
        """
        Convert the workspace to a dictionary

        Returns:
            dict: dictionary with workspace data
        """
        return {
            "uuid": self.uuid,
            "name": self.name,
            "description": self.description,
            "type": self.type.value,
            "location": self.location,
            "enabled_features": self.enabled_features,
            "mappings": self.mappings,
            "prefixes": self.prefixes,
            "ontologies": self.ontologies,
            "used_uri_patterns": self.used_uri_patterns,
            "used_uri_patterns_by_workspace": self.used_uri_patterns_by_workspace,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WorkspaceModel":
        """
        Create a workspace from a dictionary

        Args:
            data (dict): dictionary with workspace data

        Returns:
            WorkspaceModel: workspace
        """
        return WorkspaceModel(
            uuid=data["uuid"],
            name=data["name"],
            description=data["description"],
            type=WorkspaceType(data["type"]),
            location=data["location"],
            enabled_features=data["enabled_features"],
            mappings=data["mappings"],
            prefixes=data["prefixes"],
            ontologies=data["ontologies"],
            used_uri_patterns=data["used_uri_patterns"],
            used_uri_patterns_by_workspace=data.get(
                "used_uri_patterns_by_workspace", {}
            ),
        )

    def copy_with(
        self,
        name: str | None = None,
        description: str | None = None,
        type: WorkspaceType | None = None,
        location: str | None = None,
        enabled_features: list[str] | None = None,
        mappings: list[str] | None = None,
        prefixes: dict[str, str] | None = None,
        ontologies: list[str] | None = None,
        used_uri_patterns: list[str] | None = None,
        used_uri_patterns_by_workspace: dict[str, list[str]] | None = None,
    ) -> "WorkspaceModel":
        """
        Create a copy of the workspace with updated attributes

        Args:
            name (str): name of the workspace
            description (str): description of the workspace
            type (WorkspaceType): type of the workspace
            location (str): location of the workspace
            enabled_features (list[str]): list of enabled features
            mappings (list[str]): ids of mappings
            prefixes (dict[str, str]): prefixes
            ontologies (list[str]): ids of ontologies
            used_uri_patterns (list[str]): list of used URI patterns

        Returns:
            WorkspaceModel: updated workspace
        """

        return WorkspaceModel(
            uuid=self.uuid,
            name=name if name is not None else self.name,
            description=description if description is not None else self.description,
            type=type if type is not None else self.type,
            location=location if location is not None else self.location,
            enabled_features=enabled_features
            if enabled_features is not None
            else self.enabled_features,
            mappings=mappings if mappings is not None else self.mappings,
            prefixes=prefixes if prefixes is not None else self.prefixes,
            ontologies=ontologies if ontologies is not None else self.ontologies,
            used_uri_patterns=used_uri_patterns
            if used_uri_patterns is not None
            else self.used_uri_patterns,
            used_uri_patterns_by_workspace=used_uri_patterns_by_workspace
            if used_uri_patterns_by_workspace is not None
            else self.used_uri_patterns_by_workspace,
        )
