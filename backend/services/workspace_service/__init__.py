import logging
from typing import List

from beanie import DeleteRules
from beanie.odm.fields import Link
from fastapi import HTTPException
from kink import inject

from models.ontology_document import OntologyDocument
from models.prefix_document import PrefixDocument
from models.workspace_document import WorkspaceDocument
from services.mapping_service import MappingService
from services.ontology_service import OntologyService
from services.prefix_service import PrefixService


@inject
class WorkspaceService:
    def __init__(
        self,
        mapping_service: MappingService,
        prefix_service: PrefixService,
        ontology_service: OntologyService,
    ):
        self.logger = logging.getLogger(__name__)
        self.mapping_service = mapping_service
        self.prefix_service = prefix_service
        self.ontology_service = ontology_service

    async def create_workspace(
        self, name: str, description: str
    ) -> WorkspaceDocument:
        self.logger.info(
            f"Creating workspace with name {name}"
        )

        document = WorkspaceDocument(
            name=name,
            description=description,
        )

        document = await WorkspaceDocument.insert(document)  # type: ignore

        return document

    async def get_workspace(
        self, workspace_id: str
    ) -> WorkspaceDocument:
        document = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if document is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )
        return document

    async def get_workspaces(
        self,
    ) -> List[WorkspaceDocument]:
        documents = await WorkspaceDocument.find(
            {}
        ).to_list()
        return documents

    async def delete_workspace(self, workspace_id: str):
        document = await WorkspaceDocument.get(workspace_id)
        if document is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )
        await document.delete(
            link_rule=DeleteRules.DELETE_LINKS  # type: ignore
        )
        return document

    async def update_workspace(
        self, workspace_id: str, name: str, description: str
    ) -> WorkspaceDocument:
        document = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if document is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        if document.name != name:
            document.name = name
        if document.description != description:
            document.description = description

        document = await WorkspaceDocument.update(document)
        return document

    async def add_mapping_to_workspace(
        self,
        workspace_id: str,
        name: str,
        description: str,
        file_name: str,
        file_extension: str,
        json_path: str,
        bytes: bytes,
    ) -> WorkspaceDocument:
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        mapping = await self.mapping_service.create_mapping(
            name,
            description,
            file_name,
            file_extension,
            json_path,
            bytes,
        )

        workspace.sources.append(mapping.source)
        workspace.mappings.append(mapping)  # type: ignore

        workspace = await WorkspaceDocument.replace(
            workspace
        )

        return workspace

    async def delete_mapping_from_workspace(
        self, workspace_id: str, mapping_id: str
    ) -> WorkspaceDocument:
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        mapping = await self.mapping_service.get_mapping(
            mapping_id
        )

        workspace.sources = [
            source
            for source in workspace.sources
            if source.id != mapping.source.id  # type: ignore
        ]

        workspace.mappings = [
            m
            for m in workspace.mappings
            if m.id != mapping.id  # type: ignore
        ]

        await self.mapping_service.delete_mapping(
            mapping_id
        )

        workspace = await WorkspaceDocument.replace(
            workspace
        )

        return workspace

    async def add_prefix_to_workspace(
        self,
        workspace_id: str,
        prefix: str,
        uri: str,
    ) -> WorkspaceDocument:
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        duplicate_prefix = next(
            (
                p
                for p in workspace.prefixes
                if p.prefix == prefix  # type: ignore
            ),
            None,
        )
        if duplicate_prefix is not None:
            raise HTTPException(
                detail="Prefix already exists in workspace",
                status_code=400,
            )

        duplicate_uri = next(
            (
                p
                for p in workspace.prefixes
                if p.uri == uri  # type: ignore
            ),
            None,
        )

        if duplicate_uri is not None:
            raise HTTPException(
                detail="URI already exists in workspace",
                status_code=400,
            )

        prefix_document = (
            await self.prefix_service.create_prefix(
                prefix,
                uri,
            )
        )

        workspace.prefixes.append(prefix_document)  # type: ignore

        workspace = await WorkspaceDocument.replace(
            workspace
        )

        return workspace

    async def delete_prefix_from_workspace(
        self, workspace_id: str, prefix_id: str
    ) -> WorkspaceDocument:
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        prefix = await self.prefix_service.get_prefix_by_id(
            prefix_id
        )

        ontology_uses_prefix = next(
            (
                o
                for o in workspace.ontologies
                if str(o.prefix.id) == prefix_id  # type: ignore
            ),
            None,
        )

        if ontology_uses_prefix is not None:
            raise HTTPException(
                detail=f"Ontology {ontology_uses_prefix.name} uses prefix {prefix.prefix}, reassign its prefix before removing",  # type: ignore
                status_code=400,
            )

        workspace.prefixes.remove(prefix)  # type: ignore

        await self.prefix_service.delete_prefix(prefix_id)

        workspace = await WorkspaceDocument.replace(
            workspace
        )

        return workspace

    async def get_unassigned_prefixes(
        self, workspace_id: str
    ) -> list[PrefixDocument]:
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        prefixes: List[PrefixDocument] = workspace.prefixes  # type: ignore

        ontologies: List[OntologyDocument] = workspace.ontologies  # type: ignore

        assigned_prefixes = [o.prefix for o in ontologies]  # type: ignore

        unassigned_prefixes = [
            p
            for p in prefixes
            if p not in assigned_prefixes
        ]

        return unassigned_prefixes

    async def add_ontology_to_workspace(
        self,
        workspace_id: str,
        name: str,
        description: str,
        prefix_id: str,
        file_name: str,
        file_extension: str,
        bytes: bytes,
    ) -> WorkspaceDocument:
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        prefix = await self.prefix_service.get_prefix_by_id(
            prefix_id
        )

        ontology_uses_prefix = next(
            (
                o
                for o in workspace.ontologies
                if str(o.prefix.id) == prefix_id  # type: ignore
            ),
            None,
        )

        if ontology_uses_prefix is not None:
            raise HTTPException(
                detail=f"Ontology {ontology_uses_prefix.name} already uses prefix {prefix.prefix}",  # type: ignore
                status_code=400,
            )

        ontology = (
            await self.ontology_service.upload_ontology(
                file_name,
                file_extension,
                bytes,
                name,
                description,
                prefix_id,
            )
        )

        workspace.ontologies.append(ontology)  # type: ignore

        workspace = await WorkspaceDocument.replace(
            workspace
        )

        return workspace

    async def delete_ontology_from_workspace(
        self, workspace_id: str, ontology_id: str
    ):
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        ontology = (
            await self.ontology_service.get_ontology_by_id(
                ontology_id
            )
        )

        workspace.ontologies.remove(ontology)  # type: ignore

        await self.ontology_service.delete_ontology(
            ontology_id
        )

        workspace = await WorkspaceDocument.replace(
            workspace
        )

        return workspace

    async def assign_prefix_to_ontology(
        self,
        workspace_id: str,
        ontology_id: str,
        prefix_id: str,
    ) -> WorkspaceDocument:
        workspace = await WorkspaceDocument.get(
            workspace_id, fetch_links=True
        )
        if workspace is None:
            raise HTTPException(
                detail="Workspace not found",
                status_code=404,
            )

        ontology = (
            await self.ontology_service.get_ontology_by_id(
                ontology_id
            )
        )

        prefix = await self.prefix_service.get_prefix_by_id(
            prefix_id
        )

        ontology_uses_prefix = next(
            (
                o
                for o in workspace.ontologies
                if str(o.prefix.id) == prefix_id  # type: ignore
            ),
            None,
        )

        if ontology_uses_prefix is not None:
            raise HTTPException(
                detail=f"Ontology {ontology_uses_prefix.name} already uses prefix {prefix.prefix}",  # type: ignore
                status_code=400,
            )

        ontology = (
            await self.ontology_service.update_prefix(
                ontology_id, prefix_id
            )
        )

        workspace = await WorkspaceDocument.replace(
            workspace
        )

        return workspace
