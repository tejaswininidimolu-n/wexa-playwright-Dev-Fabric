import { AgentApi } from '../../helpers/agent.api';
import { AGENT_TYPES, AgentsPage } from '../../pages/AgentsPage';
import { test, expect } from '../../fixtures/authenticated.fixture';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.describe('Safe Agent functional @functional', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'agent-functional');
  });

  test('AG-FN-001 Search existing Agents using a dynamic name', async ({ page, request }) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const { agentflows } = await api.getAgents();
    expect(agentflows.length).toBeGreaterThan(0);
    const runtimeName = agentflows[0].name;
    expect(runtimeName.trim()).not.toBe('');

    const agentsPage = new AgentsPage(page);
    await agentsPage.waitForReady();
    await agentsPage.search(runtimeName);
    const matches = agentsPage.getAgentCardByName(runtimeName);
    await expect(matches.first()).toBeVisible({ timeout: 30_000 });
    expect(await matches.count()).toBeGreaterThan(0);
    for (let index = 0; index < await matches.count(); index += 1) {
      await expect(matches.nth(index)).toBeVisible();
    }
  });

  test('AG-FN-002 Exercise displayed Agent type filters', async ({ page }) => {
    const agentsPage = new AgentsPage(page);
    await agentsPage.goto();
    for (const type of AGENT_TYPES) {
      await agentsPage.selectTypeFilter(type);
      const cards = agentsPage.getAgentCards();
      for (let index = 0; index < await cards.count(); index += 1) {
        await expect(cards.nth(index)).toBeVisible();
      }
    }
    await agentsPage.selectTypeFilter('All');
  });

  test('AG-FN-003 Open New Agent chooser and safely Cancel', async ({ page }) => {
    const agentsPage = new AgentsPage(page);
    await agentsPage.goto();
    const initialCount = await agentsPage.getAgentCount();
    await agentsPage.openNewAgentChooser();
    await agentsPage.cancelNewAgentChooser();
    expect(await agentsPage.getAgentCount()).toBe(initialCount);
  });

  test('AG-FN-004 Validate chooser selection and Continue behavior', async ({ page }) => {
    const agentsPage = new AgentsPage(page);
    await agentsPage.goto();
    await agentsPage.openNewAgentChooser();
    for (const type of AGENT_TYPES) {
      await expect(agentsPage.getChooserOption(type)).toBeVisible();
      await agentsPage.selectChooserType(type);
      await expect(agentsPage.getChooserContinueButton()).toBeEnabled();
    }
    await agentsPage.cancelNewAgentChooser();
  });
});
