import { randomUUID } from 'node:crypto';

import { test, expect } from '../../fixtures/authenticated.fixture';
import { AgentApi } from '../../helpers/agent.api';
import { AgentsPage } from '../../pages/AgentsPage';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.describe('Disposable Agent lifecycle @e2e @stateful', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'agent-lifecycle');
  });

  test('AG-E2E-001 creates, persists, validates, and cleans an owned Agent', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(180_000);
    const uniqueName = `PW Agent ${Date.now()} ${randomUUID().slice(0, 8)}`;
    const description = 'Disposable Playwright Agent lifecycle record';
    const instructions = 'Reply only with a short harmless acknowledgement.';
    const agentsPage = new AgentsPage(page);
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    let createdId: string | undefined;
    let created = false;
    let cleanupFailure: Error | undefined;

    const shellObserver = async (response: import('@playwright/test').Response) => {
      if (
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/data-api/agentflow/' &&
        response.ok()
      ) {
        const body = (await response.json()) as { _id?: string; name?: string };
        if (body.name === uniqueName) {
          created = true;
          createdId = body._id;
        }
      }
    };
    page.on('response', shellObserver);

    try {
      await agentsPage.waitForReady();
      const creation = await agentsPage.createConversationalAgent(
        uniqueName,
        description,
        instructions,
      );
      created = true;
      createdId = String(creation.shell._id ?? '');

      expect(creation.shellStatus).toBe(200);
      expect(creation.configurationStatus).toBe(200);
      expect(createdId).not.toBe('');
      expect(creation.shell.name).toBe(uniqueName);
      expect(creation.shell.description).toBe(description);
      expect(creation.configuration._id).toBe(createdId);
      expect(Array.isArray(creation.configuration.agents)).toBe(true);

      await agentsPage.waitForReady();
      await agentsPage.search(uniqueName);
      await expect(agentsPage.getAgentCardByName(uniqueName)).toHaveCount(1, {
        timeout: 30_000,
      });

      const list = await api.getAgents();
      const persisted = list.agentflows.find(
        (agent) => agent._id === createdId && agent.name === uniqueName,
      );
      expect(persisted, 'Created Agent was absent from the list API.').toBeTruthy();
      expect(persisted?.description).toBe(description);

      const details = await api.getAgent(createdId);
      expect(details._id).toBe(createdId);
      expect(details.name).toBe(uniqueName);
      expect(details.description).toBe(description);
      expect(details.kind).toBe('agent');
      expect(Array.isArray((details as unknown as { agents: unknown[] }).agents)).toBe(true);
      expect((details as unknown as { agents: unknown[] }).agents.length).toBe(1);
    } finally {
      page.off('response', shellObserver);
      if (created) {
        try {
          const cleanup = await agentsPage.deleteAgentByExactName(uniqueName);
          expect(cleanup.status, `Cleanup ${cleanup.method} ${cleanup.path}`).toBe(200);
          const remaining = await api.getAgents();
          expect(
            remaining.agentflows.some(
              (agent) => agent._id === createdId || agent.name === uniqueName,
            ),
            `Cleanup verification failed for ${uniqueName} (${createdId ?? 'unknown ID'}).`,
          ).toBe(false);
          await testInfo.attach('agent-cleanup', {
            body: JSON.stringify({ uniqueName, createdId, cleanup }, null, 2),
            contentType: 'application/json',
          });
        } catch (error) {
          cleanupFailure = error instanceof Error ? error : new Error(String(error));
          await testInfo.attach('agent-cleanup-failure', {
            body: JSON.stringify(
              {
                uniqueName,
                createdId,
                error: cleanupFailure.message,
              },
              null,
              2,
            ),
            contentType: 'application/json',
          });
        }
      }
      if (cleanupFailure) throw cleanupFailure;
    }
  });
});
