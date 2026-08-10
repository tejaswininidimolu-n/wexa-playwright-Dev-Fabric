import { MultiAgentFlowsPage } from '../../pages/MultiAgentFlowsPage';
import { test, expect } from '../../fixtures/authenticated.fixture';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.describe('Safe Multi-Agent coverage @multi-agent', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'multi-agent');
  });

  test('AG-MA-001 Multi-Agent Flows page health', async ({ page }) => {
    const flows = new MultiAgentFlowsPage(page);
    await flows.navigateFromHome();
    await flows.waitForReady();
  });

  test('AG-MA-002 Inspect Multi-Agent create form and Cancel', async ({ page }) => {
    const flows = new MultiAgentFlowsPage(page);
    await flows.navigateFromHome();
    await flows.openCreateForm();
    const labels = flows.getCreateFieldLabels();
    await expect(labels.filter({ hasText: /^Name \*$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Type \*$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Description$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Role$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Default Goal$/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'master', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'associate', exact: true })).toBeVisible();
    await flows.cancelCreateForm();
  });

  test('AG-MA-003 Exercise Multi-Agent type and status filters', async ({ page }) => {
    const flows = new MultiAgentFlowsPage(page);
    await flows.navigateFromHome();
    for (const filter of ['master', 'associate', 'All', 'active', 'inactive', 'all'] as const) {
      await flows.selectFilter(filter);
    }
  });
});
