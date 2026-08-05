import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ErrorCode, InternalError } from '@domain/common/exceptions';

@Injectable()
export class EvolutionApiClient {
  constructor(private readonly config: ConfigService) {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async delete<T>(path: string, ignoredStatuses: number[] = []): Promise<T> {
    return this.request<T>('DELETE', path, undefined, ignoredStatuses);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    ignoredStatuses: number[] = [],
  ): Promise<T> {
    const baseUrl = this.config.get<string>('EVOLUTION_API_URL');
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY');
    if (!baseUrl || !apiKey) {
      throw new InternalError(ErrorCode.MESSAGING_NOT_CONFIGURED);
    }

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: {
          apikey: apiKey,
          'content-type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (ignoredStatuses.includes(response.status)) {
        return undefined as T;
      }
      if (!response.ok) {
        throw new InternalError(ErrorCode.EVOLUTION_API_ERROR, {
          method,
          path,
          status: response.status,
          body: (await response.text().catch(() => '')).slice(0, 500),
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof InternalError) throw error;
      throw new InternalError(ErrorCode.EVOLUTION_API_ERROR, {
        method,
        path,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
