import ApiService from '../../services/api_service';
import { ShaclValidationReport } from './types';

class ShaclApi {
  private static getApiClient(): ApiService {
    return ApiService.getInstance('default');
  }

  public static async validate(
    dataTtl: string,
    shapesTtl: string,
  ): Promise<ShaclValidationReport> {
    const result = await this.getApiClient().callApi<ShaclValidationReport>(
      `/shacl/validate`,
      {
        method: 'POST',
        body: { data_ttl: dataTtl, shapes_ttl: shapesTtl },
        timeout: 0,
        parser: data => data as ShaclValidationReport,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to validate SHACL: ${result.message} (status: ${result.status})`,
    );
  }
}

export default ShaclApi;
