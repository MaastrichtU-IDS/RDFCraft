import encodeFileToBase64 from '../../../utils/base64encoder';
import ApiService from '../../services/api_service';
import { ShapeSet } from './types';

class ShapesApi {
  private static getApiClient(): ApiService {
    return ApiService.getInstance('default');
  }

  public static async getShapesInWorkspace(
    workspaceUuid: string,
  ): Promise<ShapeSet[]> {
    const result = await this.getApiClient().callApi<ShapeSet[]>(
      `/workspaces/${workspaceUuid}/shapes`,
      {
        method: 'GET',
        parser: data => data as ShapeSet[],
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get shape sets: ${result.message} (status: ${result.status})`,
    );
  }

  public static async createShapesInWorkspace(
    workspaceUuid: string,
    name: string,
    description: string,
    file: File,
  ): Promise<boolean> {
    const base64EncodedFile = await encodeFileToBase64(file);
    const data = {
      name,
      description,
      content: base64EncodedFile,
    };

    const result = await this.getApiClient().callApi<boolean>(
      `/workspaces/${workspaceUuid}/shapes`,
      {
        method: 'POST',
        body: data,
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to create shape set: ${result.message} (status: ${result.status})`,
    );
  }

  public static async createShapesFromContentInWorkspace(
    workspaceUuid: string,
    name: string,
    description: string,
    content: string,
  ): Promise<boolean> {
    const file = new File([content], `${name}.ttl`, { type: 'text/turtle' });
    return this.createShapesInWorkspace(workspaceUuid, name, description, file);
  }

  public static async deleteShapesInWorkspace(
    workspaceUuid: string,
    shapesUuid: string,
  ): Promise<boolean> {
    const result = await this.getApiClient().callApi<boolean>(
      `/workspaces/${workspaceUuid}/shapes/${shapesUuid}`,
      {
        method: 'DELETE',
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to delete shape set: ${result.message} (status: ${result.status})`,
    );
  }
}

export default ShapesApi;
