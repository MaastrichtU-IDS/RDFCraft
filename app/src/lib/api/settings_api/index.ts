import ApiService from '../../services/api_service';

class SettingsApi {
  private static getApiClient(): ApiService {
    return ApiService.getInstance('default');
  }

  public static async getOpenAIURL(): Promise<string> {
    const result = await this.getApiClient().callApi<string, string>(
      `/settings/openai-url`,
      {
        method: 'GET',
        parser(data) {
          return data as string;
        },
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get OpenAI URL: ${result.message} (status: ${result.status})`,
    );
  }

  public static async getOpenAIKey(): Promise<string> {
    const result = await this.getApiClient().callApi<string, string>(
      `/settings/openai-key`,
      {
        method: 'GET',
        parser(data) {
          return data as string;
        },
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get OpenAI Key: ${result.message} (status: ${result.status})`,
    );
  }

  public static async getJavaMemory(): Promise<string> {
    const result = await this.getApiClient().callApi<string, string>(
      `/settings/java-memory`,
      {
        method: 'GET',
        parser(data) {
          return data as string;
        },
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get Java Memory: ${result.message} (status: ${result.status})`,
    );
  }

  public static async getJavaPath(): Promise<string> {
    const result = await this.getApiClient().callApi<string, string>(
      `/settings/java-path`,
      {
        method: 'GET',
        parser(data) {
          return data as string;
        },
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get Java Path: ${result.message} (status: ${result.status})`,
    );
  }

  public static async updateOpenAIURL(openai_url: string): Promise<boolean> {
    const result = await this.getApiClient().callApi<boolean>(
      `/settings/openai-url`,
      {
        method: 'PUT',
        body: openai_url,
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to update OpenAI URL: ${result.message} (status: ${result.status})`,
    );
  }

  public static async updateOpenAIKey(openai_key: string): Promise<boolean> {
    const result = await this.getApiClient().callApi<boolean>(
      `/settings/openai-key`,
      {
        method: 'PUT',
        body: openai_key,
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to update OpenAI Key: ${result.message} (status: ${result.status})`,
    );
  }

  public static async updateJavaMemory(java_memory: string): Promise<boolean> {
    const result = await this.getApiClient().callApi<boolean>(
      `/settings/java-memory`,
      {
        method: 'PUT',
        body: java_memory,
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to update Java Memory: ${result.message} (status: ${result.status})`,
    );
  }

  public static async updateJavaPath(java_path: string): Promise<boolean> {
    const result = await this.getApiClient().callApi<boolean>(
      `/settings/java-path`,
      {
        method: 'PUT',
        body: java_path,
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to update Java Path: ${result.message} (status: ${result.status})`,
    );
  }

  public static async getSystem(): Promise<string> {
    const result = await this.getApiClient().callApi<string, string>(
      `/settings/system`,
      {
        method: 'GET',
        parser(data) {
          return data as string;
        },
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get System: ${result.message} (status: ${result.status})`,
    );
  }

  public static async getArch(): Promise<string> {
    const result = await this.getApiClient().callApi<string, string>(
      `/settings/arch`,
      {
        method: 'GET',
        parser(data) {
          return data as string;
        },
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get Arch: ${result.message} (status: ${result.status})`,
    );
  }

  public static async getAppDirectory(): Promise<string> {
    const result = await this.getApiClient().callApi<string, string>(
      `/settings/app-dir`,
      {
        method: 'GET',
        parser(data) {
          return data as string;
        },
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to get App Directory: ${result.message} (status: ${result.status})`,
    );
  }

  public static async clearTempDirectory(): Promise<boolean> {
    const result = await this.getApiClient().callApi<boolean>(
      `/settings/clear-temp`,
      {
        method: 'DELETE',
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to clear Temp Directory: ${result.message} (status: ${result.status})`,
    );
  }

  public static async clearLogs(): Promise<boolean> {
    const result = await this.getApiClient().callApi<boolean>(
      `/settings/logs`,
      {
        method: 'DELETE',
        parser: () => true,
      },
    );

    if (result.type === 'success') {
      return result.data;
    }

    throw new Error(
      `Failed to clear Logs: ${result.message} (status: ${result.status})`,
    );
  }

  public static getLogsURL(): string {
    return `${this.getApiClient().baseUrl}settings/logs`;
  }
}

export default SettingsApi;
