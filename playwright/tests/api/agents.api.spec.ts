import { request as playwrightRequest } from '@playwright/test';

import { test, expect } from '../../fixtures/authenticated.fixture';
import { AgentApi } from '../../helpers/agent.api';
import type { AgentSummary, FabricModel } from '../../test-data/agentInfo';
import { getFabricBaseUrl } from '../../utils/env';

function expectAgentSummary(agent: AgentSummary): void {
  expect(typeof agent._id).toBe('string');
  expect(agent._id).not.toBe('');
  expect(typeof agent.name).toBe('string');
  expect(agent.name).not.toBe('');
  expect(typeof agent.kind).toBe('string');
  expect(typeof agent.created_at).toBe('number');
  expect(typeof agent.updated_at).toBe('number');
}

function expectModel(model: FabricModel): void {
  expect(typeof model.id).toBe('string');
  expect(typeof model.name).toBe('string');
  expect(typeof model.provider).toBe('string');
  expect(typeof model.kind).toBe('string');
  expect(typeof model.contextWindow).toBe('number');
  expect(typeof model.health).toBe('string');
  expect(typeof model.isDefault).toBe('boolean');
  expect(typeof model.managed).toBe('boolean');
}

test.describe('Safe Agent API @api', () => {
  test('AG-API-001 validates Agent list response contract', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const body = await api.getAgents();
    expect(Array.isArray(body.agentflows)).toBe(true);
    expect(Number.isInteger(body.total_count)).toBe(true);
    expect(body.total_count).toBeGreaterThanOrEqual(body.agentflows.length);
    body.agentflows.forEach(expectAgentSummary);
  });

  test('AG-API-002 validates runtime-discovered Agent details', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const list = await api.getAgents();
    expect(list.agentflows.length).toBeGreaterThan(0);
    const summary = list.agentflows[0];
    const detail = await api.getAgent(summary._id);
    expect(detail._id).toBe(summary._id);
    expect(detail.name).toBe(summary.name);
    expect(detail.kind).toBe(summary.kind);
    expect(typeof detail.projectID).toBe('string');
    expect(Array.isArray((detail as unknown as { agents: unknown[] }).agents)).toBe(true);
  });

  test('AG-API-003 validates a nonexistent syntactically valid Agent ID', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const response = await api.getAgentResponse('000000000000000000000000');
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expect(typeof body.detail).toBe('string');
  });

  test('AG-API-004 validates model catalog response contract', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const body = await api.getModels();
    expect(body.models.length).toBeGreaterThan(0);
    body.models.forEach(expectModel);
  });

  test('AG-API-005 validates skills response including an empty list', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const body = await api.getSkills();
    expect(Number.isInteger(body.total_count)).toBe(true);
    expect(Array.isArray(body.skills)).toBe(true);
    expect(body.total_count).toBeGreaterThanOrEqual(body.skills.length);
  });

  test('AG-API-006 validates observed unauthenticated Agent-list response', async () => {
    const unauthenticated = await playwrightRequest.newContext({
      baseURL: getFabricBaseUrl(),
    });
    try {
      const response = await unauthenticated.get('/data-api/agentflows', {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(401);
      expect(response.headers()['content-type']).toContain('application/json');
      expect(await response.json()).toEqual({
        detail: 'Please provide an authorization token',
      });
    } finally {
      await unauthenticated.dispose();
    }
  });
});
