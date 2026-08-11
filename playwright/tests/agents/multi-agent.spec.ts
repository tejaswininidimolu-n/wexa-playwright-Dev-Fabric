import { MultiAgentFlowsPage } from '../../pages/MultiAgentFlowsPage';
import { test, expect } from '../../fixtures/authenticated.fixture';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.describe('Safe Multi-Agent coverage @multi-agent @functional @regression', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'multi-agent');
  });

  test('AG-MA-001 Multi-Agent Flows page health @smoke', async ({ page }) => {
    const flows = new MultiAgentFlowsPage(page);
    await flows.navigateFromHome();
    await flows.waitForReady();
  });

  test('AG-MA-002 Inspect Multi-Agent create form and Cancel @functional @regression', async ({ page }) => {
    const flows = new MultiAgentFlowsPage(page);
    await flows.navigateFromHome();
    await flows.openCreateForm();
    const labels = flows.getCreateFieldLabels();
    await expect(labels.filter({ hasText: /^Name \*$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Type \*$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Description$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Role$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Default Goal$/ })).toBeVisible();
    const master = flows.getCreateTypeRadio('master');
    const associate = flows.getCreateTypeRadio('associate');
    await expect(master).toBeVisible();
    await expect(associate).toBeVisible();
    await expect(master, 'Master must be selected by default.').toBeChecked();
    await expect(flows.getCreateSubmitButton()).toBeDisabled();
    await associate.check();
    await expect(associate).toBeChecked();
    await master.check();
    await expect(master).toBeChecked();
    await flows.cancelCreateForm();
  });

  test('AG-MA-003 Exercise Multi-Agent type and status filters @functional', async ({ page }) => {
    const flows = new MultiAgentFlowsPage(page);
    await flows.navigateFromHome();
    for (const filter of ['master', 'associate', 'All', 'active', 'inactive', 'all'] as const) {
      await flows.selectFilter(filter);
    }
  });
});
