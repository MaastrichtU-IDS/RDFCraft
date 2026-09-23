from kink import inject

from server.facades import (
    BaseFacade,
    FacadeResponse,
)
from server.service_protocols.shacl_service_protocol import (
    ShaclServiceProtocol,
)


@inject
class ValidateShaclFacade(BaseFacade):
    def __init__(
        self,
        shacl_service: ShaclServiceProtocol,
    ):
        super().__init__()
        self.shacl_service = shacl_service

    @BaseFacade.error_wrapper
    def execute(
        self,
        data_ttl: str,
        shapes_ttl: str,
    ) -> FacadeResponse:
        self.logger.info("Validating data graph against SHACL shapes")

        report = self.shacl_service.validate(data_ttl, shapes_ttl)

        return FacadeResponse(
            status=200,
            message="Validation complete",
            data=report.to_dict(),
        )
