import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

import type {
  AgentDetail,
  AgentListResponse,
  ModelListResponse,
  SkillListResponse,
} from '../test-data/agentInfo';

const AGENT_LIST_PATH = '/data-api/agentflows';

/** Read-only Agent API client using the bearer header issued to the authenticated app. */
export class AgentApi {
  private constructor(
    private readonly request: APIRequestContext,
    private readonly authorization: string,
    private readonly projectId: string,
  ) {}

  static async fromAuthenticatedPage(
    page: Page,
    request: APIRequestContext,
  ): Promise<AgentApi> {
    const agentRequest = page.waitForRequest((candidate) =>
      new URL(candidate.url()).pathname === AGENT_LIST_PATH,
    );
    await page.goto('/orchestrate/process-flows');
    const capturedRequest = await agentRequest;
    const authorization = capturedRequest.headers().authorization;
    const projectId = new URL(capturedRequest.url()).searchParams.get('projectID');
    expect(
      authorization,
      'The authenticated app did not issue an authorization header for the Agent list.',
    ).toBeTruthy();
    expect(
      projectId,
      'The Agent list request did not include its required projectID.',
    ).toBeTruthy();
    return new AgentApi(request, authorization, projectId as string);
  }

  async getAgentListResponse(): Promise<APIResponse> {
    return this.get(this.withProject(AGENT_LIST_PATH));
  }

  async getAgents(): Promise<AgentListResponse> {
    const response = await this.getAgentListResponse();
    expect(response.status()).toBe(200);
    return response.json() as Promise<AgentListResponse>;
  }

  async getFlowsResponse(): Promise<APIResponse> {
    return this.get(`${this.withProject(AGENT_LIST_PATH)}&kind=flow`);
  }

  async getFlows(): Promise<AgentListResponse> {
    const response = await this.getFlowsResponse();
    expect(response.status()).toBe(200);
    return response.json() as Promise<AgentListResponse>;
  }

  async getAgentResponse(id: string): Promise<APIResponse> {
    return this.get(`/data-api/agentflow/${encodeURIComponent(id)}`);
  }

  async getAgent(id: string): Promise<AgentDetail> {
    const response = await this.getAgentResponse(id);
    expect(response.status()).toBe(200);
    return response.json() as Promise<AgentDetail>;
  }

  async getFlowResponse(id: string): Promise<APIResponse> {
    return this.get(
      `${AGENT_LIST_PATH.slice(0, -1)}/${encodeURIComponent(id)}?projectId=${encodeURIComponent(this.projectId)}`,
    );
  }

  async getFlow(id: string): Promise<AgentDetail> {
    const response = await this.getFlowResponse(id);
    expect(response.status()).toBe(200);
    return response.json() as Promise<AgentDetail>;
  }

  async getModelsResponse(): Promise<APIResponse> {
    return this.get('/context-api/api/v1/models');
  }

  async getModels(): Promise<ModelListResponse> {
    const response = await this.getModelsResponse();
    expect(response.status()).toBe(200);
    return response.json() as Promise<ModelListResponse>;
  }

  async getSkillsResponse(): Promise<APIResponse> {
    return this.get(this.withProject('/data-api/skills/category', 'projectId'));
  }

  async getSkills(): Promise<SkillListResponse> {
    const response = await this.getSkillsResponse();
    expect(response.status()).toBe(200);
    return response.json() as Promise<SkillListResponse>;
  }

  private get(path: string): Promise<APIResponse> {
    return this.request.get(path, {
      headers: { authorization: this.authorization },
    });
  }

  private withProject(path: string, parameter = 'projectID'): string {
    const parameters = new URLSearchParams({ [parameter]: this.projectId });
    return `${path}?${parameters.toString()}`;
  }
}
