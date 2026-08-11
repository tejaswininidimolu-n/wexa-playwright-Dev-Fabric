import { AgentApi } from '../../helpers/agent.api';
import { AGENT_TYPES, AgentsPage } from '../../pages/AgentsPage';
import { AgentSimulationPage } from '../../pages/AgentSimulationPage';
import { test, expect } from '../../fixtures/authenticated.fixture';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.describe('Safe Agent regression @regression', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'agent-regression');
  });

  test('AG-RG-001 Agent navigation and list loading', async ({ page }) => {
    const agentsPage = new AgentsPage(page);
    await agentsPage.navigateFromHome();
    await agentsPage.waitForAgentCards();
    const count = await agentsPage.getAgentCount();
    await page.goto('/');
    await agentsPage.navigateFromHome();
    await agentsPage.waitForAgentCards();
    expect(await agentsPage.getAgentCount()).toBe(count);
  });

  test('AG-RG-002 Search/filter reset', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const { agentflows } = await api.getAgents();
    expect(agentflows.length).toBeGreaterThan(0);
    const agentsPage = new AgentsPage(page);
    await agentsPage.goto();
    const initialCount = await agentsPage.getAgentCount();
    await agentsPage.search(agentflows[0].name);
    await agentsPage.selectTypeFilter(AGENT_TYPES[0]);
    await agentsPage.clearSearch();
    await agentsPage.selectTypeFilter('All');
    await agentsPage.waitForAgentCount(initialCount);
    expect(await agentsPage.getAgentCount()).toBe(initialCount);
  });

  test('AG-RG-003 List/details API consistency', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const list = await api.getAgents();
    expect(list.agentflows.length).toBeGreaterThan(0);
    for (const summary of list.agentflows) {
      const detail = await api.getAgent(summary._id);
      expect(detail._id).toBe(summary._id);
      expect(detail.name).toBe(summary.name);
      expect(detail.kind).toBe(summary.kind);
    }
  });

  test('AG-RG-004 New Agent cancellation safety', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const before = await api.getAgents();
    const agentsPage = new AgentsPage(page);
    await agentsPage.goto();
    await agentsPage.openNewAgentChooser();
    await agentsPage.selectChooserType('Conversational');
    await agentsPage.cancelNewAgentChooser();
    const after = await api.getAgents();
    expect(after.total_count).toBe(before.total_count);
    expect(after.agentflows.map((agent) => agent._id).sort()).toEqual(
      before.agentflows.map((agent) => agent._id).sort(),
    );
  });

  test('AG-RG-005 Model default and health metadata', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const { models } = await api.getModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.filter((model) => model.isDefault).length).toBeGreaterThan(0);
    for (const model of models) {
      expect(model.health.trim()).not.toBe('');
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  test('AG-RG-006 Simulation form boundaries without execution', async ({ page }) => {
    const simulation = new AgentSimulationPage(page);
    await simulation.navigateFromHome();
    await expect(simulation.getAgentSelect()).toBeEnabled();
    await expect(simulation.getScenarioInput()).toHaveAttribute('placeholder', /Describe/);
    await expect(simulation.getRepetitionsInput()).toHaveAttribute('type', 'number');
    for (const preset of [1, 10, 50] as const) {
      await expect(simulation.getRepetitionPreset(preset)).toBeVisible();
    }
    await expect(simulation.getRunButton()).toBeVisible();
  });

  test('AG-RG-007 Menu/clone control separation without activation', async ({ page }) => {
    const agentsPage = new AgentsPage(page);
    await agentsPage.goto();
    const count = await agentsPage.getAgentCount();
    expect(count).toBeGreaterThan(0);
    await expect(agentsPage.getMenuButtons()).toHaveCount(count);
    await expect(agentsPage.getCloneButtons()).toHaveCount(count);
    for (let index = 0; index < count; index += 1) {
      await expect(agentsPage.getMenuButtons().nth(index)).toHaveAttribute('title', 'More');
      await expect(agentsPage.getCloneButtons().nth(index)).toHaveAttribute('title', 'Duplicate');
    }
  });
});
