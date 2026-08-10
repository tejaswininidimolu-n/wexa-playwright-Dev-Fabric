import { AgentApi } from '../../helpers/agent.api';
import { AgentsPage } from '../../pages/AgentsPage';
import { AgentSimulationPage } from '../../pages/AgentSimulationPage';
import { test, expect } from '../../fixtures/authenticated.fixture';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.describe('Safe Agent smoke @smoke', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'agent-smoke');
  });

  test('AG-SM-001 Agents page health', async ({ page }) => {
    const agentsPage = new AgentsPage(page);
    await agentsPage.navigateFromHome();
    await agentsPage.waitForReady();
  });

  test('AG-SM-002 Agent list API health', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const response = await api.getAgentListResponse();
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.agentflows)).toBe(true);
    expect(typeof body.total_count).toBe('number');
  });

  test('AG-SM-003 Agent cards render dynamically', async ({ page }) => {
    const agentsPage = new AgentsPage(page);
    await agentsPage.goto();
    expect(await agentsPage.getAgentCount()).toBeGreaterThan(0);
    await expect(agentsPage.getAgentCards().first()).toBeVisible();
  });

  test('AG-SM-004 Model catalog API health', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const response = await api.getModelsResponse();
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.length).toBeGreaterThan(0);
  });

  test('AG-SM-005 Agent Simulation page health', async ({ page }) => {
    const simulation = new AgentSimulationPage(page);
    await simulation.navigateFromHome();
    await simulation.waitForReady();
  });
});
