from abc import ABC, abstractmethod

from server.models.shapes import ShapeSet


class ShapesServiceProtocol(ABC):
    """
    Shapes (SHACL shape set) service protocol
    """

    @abstractmethod
    def get_shapes(self, shapes_id: str) -> ShapeSet:
        """
        Get a shape set by id

        Parameters:
            shapes_id (str): Shape set id
        """
        ...

    @abstractmethod
    def get_shapes_list(self, ids: list[str]) -> list[ShapeSet]:
        """
        Get a list of shape sets by ids

        Parameters:
            ids (list[str]): List of shape set ids
        """
        ...

    @abstractmethod
    def create_shapes(
        self,
        name: str,
        description: str,
        content: bytes,
    ) -> ShapeSet:
        """
        Create a shape set

        Parameters:
            name (str): Shape set name
            description (str): Shape set description
            content (bytes): SHACL shapes Turtle content
        """
        ...

    @abstractmethod
    def delete_shapes(self, shapes_id: str) -> None:
        """
        Delete a shape set

        Parameters:
            shapes_id (str): Shape set id
        """
        ...
