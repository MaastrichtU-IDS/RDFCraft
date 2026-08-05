from dataclasses import dataclass


@dataclass(kw_only=True)
class ShapeSet:
    """
    A set of SHACL shapes attached to a workspace.

    Attributes:
        uuid (str): The UUID of the shape set
        file_uuid (str): The UUID of the underlying Turtle file
        name (str): The name of the shape set
        description (str): The description of the shape set
        content (str): The raw Turtle content of the SHACL shapes
    """

    uuid: str
    file_uuid: str
    name: str
    description: str
    content: str

    def to_dict(self):
        return {
            "uuid": self.uuid,
            "file_uuid": self.file_uuid,
            "name": self.name,
            "description": self.description,
            "content": self.content,
        }

    @classmethod
    def from_dict(cls, data):
        if "uuid" not in data:
            raise ValueError("uuid is required")
        if "file_uuid" not in data:
            raise ValueError("file_uuid is required")
        if "name" not in data:
            raise ValueError("name is required")
        if "description" not in data:
            data["description"] = ""
        if "content" not in data:
            raise ValueError("content is required")
        return cls(
            uuid=data["uuid"],
            file_uuid=data["file_uuid"],
            name=data["name"],
            description=data["description"],
            content=data["content"],
        )
