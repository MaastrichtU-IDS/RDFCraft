import { Prefix } from '@/lib/api/prefix_api/types';
import RMLGenerator from '@rmlio/yarrrml-parser/lib/rml-generator';
import { Writer } from 'n3';
import ApiService from '../../services/api_service';
import { MappingGraph } from '../mapping_service/types';

class YARRRMLService {
  private static getApiClient(): ApiService {
    return ApiService.getInstance('default');
  }

  public static async getYARRRMLMapping(
    workspaceUuid: string,
    mappingUuid: string,
  ): Promise<string> {
    const result = await this.getApiClient().callApi<string>(
      `/workspaces/${workspaceUuid}/mapping/${mappingUuid}/yarrrml`,
      {
        method: 'GET',
        parser: data => data as string,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get YARRRML mapping: ${result.message} (status: ${result.status})`,
    );
  }

  /**
   * Like getYARRRMLMapping, but converts the given in-memory MappingGraph
   * directly instead of whatever is currently persisted for its uuid --
   * needed to actually test a candidate fix (getYARRRMLMapping would
   * silently ignore it and re-read the saved mapping instead).
   */
  public static async getYARRRMLMappingPreview(
    workspaceUuid: string,
    mapping: MappingGraph,
  ): Promise<string> {
    const result = await this.getApiClient().callApi<string>(
      `/workspaces/${workspaceUuid}/mapping/yarrrml-preview`,
      {
        method: 'POST',
        body: mapping,
        parser: data => data as string,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get YARRRML preview: ${result.message} (status: ${result.status})`,
    );
  }

  public static async yarrrmlToRML(yarrrml: string, prefixes: Prefix[]): Promise<string> {
    const y2r = new RMLGenerator();
    const quads = y2r.convert(yarrrml);
    const writer = new Writer(
      {
        format: 'application/Turtle',
        prefixes: prefixes.reduce(
          (acc, prefix) => ({ ...acc, [prefix.prefix]: prefix.uri }),
          {},
        ),
      }
    );
    writer.addQuads(quads);
    return new Promise((resolve, reject) => {
      writer.end((error: Error | null, result: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  public static async rmlToTTL(rml: string): Promise<string> {
    const result = await this.getApiClient().callApi<string>(
      '/rml/run-rml-mapping',
      {
        method: 'POST',
        body: rml,
        parser: data => data as string,
        timeout: 0,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to convert RML to TTL: ${result.message} (status: ${result.status})`,
    );
  }
}

export default YARRRMLService;
