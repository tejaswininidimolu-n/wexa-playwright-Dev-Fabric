import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Thin application-agnostic wrapper for API requests used in setup or API tests.
 * Add domain-specific API clients separately when endpoints are introduced.
 */
export class ApiHelper {
  constructor(private readonly request: APIRequestContext) {}

  async get(path: string): Promise<APIResponse> {
    return this.request.get(path);
  }
}

