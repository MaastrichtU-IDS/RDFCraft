import logging
import subprocess
from pathlib import Path
from uuid import uuid4

from kink import inject

from server.exceptions import ErrCodes, ServerException
from server.service_protocols.config_service_protocol import (
    ConfigServiceProtocol,
)
from server.service_protocols.rml_mapper_service_protocol import (
    RMLMapperServiceProtocol,
)


@inject(alias=RMLMapperServiceProtocol)
class RMLMapperService(RMLMapperServiceProtocol):
    def __init__(
        self,
        config_service: ConfigServiceProtocol,
        TEMP_DIR: Path,
    ):
        self.logger = logging.getLogger(__name__)
        self.TEMP_DIR = TEMP_DIR
        self.logger.info("Instantiating RMLMapperService")
        self.logger.info("Determining if system has Java installed")
        self.mapper_bin = (
            Path(__file__).parent.parent.parent.parent / "bin" / "mapper.jar"
        )
        custom_java_path = config_service.get("java_path")
        self.java_memory = config_service.get("java_memory") or "1G"
        self.java_path = None
        if custom_java_path:
            self.logger.info(f"Using custom Java path: {custom_java_path}")
            try:
                subprocess.run(
                    [custom_java_path, "-version"],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                self.java_path = custom_java_path
            except FileNotFoundError:
                self.logger.error("Java not found, trying default Java path")
        if not self.java_path:
            try:
                subprocess.run(
                    ["java", "-version"],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                self.java_path = "java"
            except subprocess.CalledProcessError:
                self.logger.error("Java not found, RML mappings will not be executed")
                return
            except OSError:
                self.logger.error("Java not found, RML mappings will not be executed")
                return

        self.logger.info(f"Java found at {self.java_path}, checking for mapper")

        if not self.mapper_bin.exists():
            self.logger.error("Mapper not found, RML mappings will not be executed")

        self.logger.info("RMLMapperService instantiated")

    def execute_rml_mapping(self, mapping: str) -> str:
        self.logger.info("Executing RML mapping")
        self.logger.info("Writing RML mapping to temp file")
        process_uuid = uuid4().hex
        rml_file: Path = self.TEMP_DIR / f"rml_{process_uuid}.ttl"

        rml_file.touch()
        rml_file.write_text(mapping)

        rdf_output_file: Path = self.TEMP_DIR / f"rdf_{process_uuid}.ttl"

        cmd_rml = (
            f"java -Xmx{self.java_memory} -jar {self.mapper_bin} -m {rml_file} -o {rdf_output_file} -s"
            " turtle"
        )

        self.logger.info(f"Executing command: {cmd_rml}")

        try:
            result = subprocess.run(
                cmd_rml,
                shell=True,
                capture_output=True,
                text=True,
            )

            if result.returncode != 0:
                self.logger.error(f"Error executing RML mapping: {result.stderr}")
                raise ServerException(
                    f"Error executing RML mapping: {result.stderr}",
                    ErrCodes.RML_MAPPING_EXECUTION_ERROR,
                )

            self.logger.info("RML mapping executed successfully")

            return rdf_output_file.read_text()

        except Exception as e:
            self.logger.error(f"Error executing RML mapping: {e}")
            raise ServerException(
                f"Error executing RML mapping: {e}",
                ErrCodes.RML_MAPPING_EXECUTION_ERROR,
            )
