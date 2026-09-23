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
        prefixes: {
          // RMLGenerator always mints its internal map nodes (TriplesMap,
          // SubjectMap, PredicateObjectMap, PredicateMap, ObjectMap, ...)
          // under this exact, hardcoded base IRI (see
          // @rmlio/yarrrml-parser/lib/abstract-generator.js). Registering it
          // as the default `:` prefix keeps every node addressable as a
          // short, stable `:map_id` -- both for readability and because the
          // repair pipeline's Stage 2/3 prompts identify map nodes this way
          // (see applyStage3Correction.ts).
          '': 'http://mapping.example.com/',
          rr: 'http://www.w3.org/ns/r2rml#',
          rml: 'http://semweb.mmlab.be/ns/rml#',
          ql: 'http://semweb.mmlab.be/ns/ql#',
          rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          xsd: 'http://www.w3.org/2001/XMLSchema#',
          // RML-FN (see applyRmlTextCorrection.ts) -- registered here too so
          // a mapping the repair loop has already folded a function-valued
          // fix into still renders those prefixes compactly on the next
          // regeneration.
          fnml: 'http://semweb.mmlab.be/ns/fnml#',
          fno: 'https://w3id.org/function/ontology#',
          grel: 'http://users.ugent.be/~bjdmeest/function/grel.ttl#',
          ...prefixes.reduce(
            (acc, prefix) => ({ ...acc, [prefix.prefix]: prefix.uri }),
            {},
          ),
        },
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
