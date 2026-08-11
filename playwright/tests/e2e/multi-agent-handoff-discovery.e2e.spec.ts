import { randomUUID } from 'node:crypto';

import type { Response } from '@playwright/test';

import { test, expect } from '../../fixtures/authenticated.fixture';
import { AgentApi } from '../../helpers/agent.api';
import { MultiAgentFlowsPage } from '../../pages/MultiAgentFlowsPage';
import type { EmbeddedFlowAgent } from '../../test-data/multiAgentFlowInfo';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.use({ trace: 'retain-on-failure' });

test.describe('Multi-Agent removal and branch discovery @e2e @stateful @functional @regression', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'multi-agent-handoff-discovery');
  });

  const mutationSummary = async (response: Response) => {
    const url = new URL(response.url());
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      // Successful DELETE responses may have no JSON body.
    }
    let requestKeys: string[] = [];
    try {
      requestKeys = Object.keys(
        response.request().postDataJSON() as Record<string, unknown>,
      ).sort();
    } catch {
      // DELETE requests may have no body.
    }
    return {
      method: response.request().method(),
      path: url.pathname,
      queryKeys: [...url.searchParams.keys()].sort(),
      query: Object.fromEntries(url.searchParams.entries()),
      status: response.status(),
      requestKeys,
      responseKeys: Object.keys(body).sort(),
    };
  };

  test('AG-MA-E2E-002 isolates embedded skilled-Agent removal', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const flowName = `QA-MultiAgent-Removal-${suffix}`;
    const childTitle = `QA Removal Child ${suffix}`;
    const flows = new MultiAgentFlowsPage(page);
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    let flowId: string | undefined;
    let created = false;
    let cleanupFailure: Error | undefined;

    try {
      expect((await api.getFlows()).agentflows.some((flow) => flow.name === flowName))
        .toBe(false);
      const creation = await flows.createMasterFlow(
        flowName,
        'Disposable embedded-Agent removal discovery',
        'Removal audit master',
        '',
      );
      expect(creation.status).toBe(200);
      flowId = creation.id;
      created = true;
      expect(flowId).toBeTruthy();

      await page.goto(`/orchestrate/process-flows/${flowId}/build`);
      await expect(flows.getAddFirstAgentButton()).toBeVisible({ timeout: 30_000 });
      await flows.getAddFirstAgentButton().click();
      await flows.getAgentTitleInput().fill(childTitle);
      const attachResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST' &&
          url.pathname === `/data-api/agentflow/${flowId}/skilled`;
      });
      await flows.getCreateEmbeddedAgentButton().click();
      const attachResponse = await attachResponsePromise;
      expect(attachResponse.ok()).toBe(true);
      const beforeRemoval = await api.getFlow(flowId as string);
      const beforeAgents = beforeRemoval.agents as unknown as EmbeddedFlowAgent[];
      expect(beforeAgents).toHaveLength(1);
      const childId = beforeAgents[0]._id;
      expect(beforeRemoval.initialAgent).toBe(childId);
      expect(beforeAgents[0].next_agent).toBeNull();

      await flows.openEmbeddedAgent(childTitle);
      const deleteControl = flows.getDeleteEmbeddedAgentButton();
      await expect(deleteControl).toHaveCount(1);
      await expect(deleteControl).toBeVisible();
      const mutationResponsePromise = page.waitForResponse(
        (response) => response.request().method() !== 'GET' &&
          new URL(response.url()).pathname.includes(flowId as string),
        { timeout: 15_000 },
      ).catch(() => null);
      await deleteControl.click();
      await page.waitForTimeout(500);
      const confirmationVisible = await page.getByRole('dialog').isVisible()
        .catch(() => false);
      const mutationResponse = await mutationResponsePromise;
      const observedMutation = mutationResponse
        ? await mutationSummary(mutationResponse)
        : null;

      const afterRemoval = await api.getFlow(flowId as string);
      const afterAgents = afterRemoval.agents as unknown as EmbeddedFlowAgent[];
      const nodeVisibleAfterClick = await page.getByText(childTitle, { exact: true })
        .isVisible()
        .catch(() => false);
      await page.reload();
      await expect(page.getByText(childTitle, { exact: true })).toHaveCount(
        afterAgents.length ? 1 : 0,
        { timeout: 30_000 },
      );
      const persisted = await api.getFlow(flowId as string);
      const persistedAgents = persisted.agents as unknown as EmbeddedFlowAgent[];

      const evidence = {
        url: page.url(),
        pageTitle: await page.title(),
        flowId,
        flowName,
        childId,
        childTitle,
        deleteLocator: 'Edit Agent panel button with accessible name Delete',
        confirmationVisible,
        nodeVisibleAfterClick,
        observedMutation,
        before: {
          initialAgent: beforeRemoval.initialAgent,
          nextAgent: beforeAgents[0].next_agent,
          agentCount: beforeAgents.length,
        },
        after: {
          initialAgent: afterRemoval.initialAgent,
          agentCount: afterAgents.length,
          persistedAgentCount: persistedAgents.length,
        },
      };
      await testInfo.attach('embedded-agent-removal', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('embedded-agent-removal-ui', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      console.log(`EMBEDDED_AGENT_REMOVAL=${JSON.stringify(evidence)}`);

      expect(mutationResponse, 'Delete must emit an observable mutation response.').not.toBeNull();
      expect(mutationResponse?.ok()).toBe(true);
      expect(afterAgents).toHaveLength(0);
      expect(persistedAgents).toHaveLength(0);
      expect(afterRemoval.initialAgent ?? null).toBeNull();
      expect(nodeVisibleAfterClick).toBe(false);
    } finally {
      if (created) {
        try {
          const cleanup = await flows.deleteFlowByExactName(flowName, flowId);
          expect(cleanup.status).toBe(200);
          expect((await api.getFlows()).agentflows.some(
            (flow) => flow._id === flowId || flow.name === flowName,
          )).toBe(false);
          console.log(`REMOVAL_FLOW_CLEANUP=${JSON.stringify({ flowName, flowId, cleanup })}`);
        } catch (error) {
          cleanupFailure = error instanceof Error ? error : new Error(String(error));
        }
      }
      if (cleanupFailure) throw cleanupFailure;
    }
  });

  test('AG-MA-E2E-003 persists Decision branch targets without execution', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(150_000);
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const flowName = `QA-MultiAgent-Branches-${suffix}`;
    const skilledTitle = `QA Branch Skilled ${suffix}`;
    const decisionTitle = `QA Branch Decision ${suffix}`;
    const approvedTitle = `QA Approved Target ${suffix}`;
    const rejectedTitle = `QA Rejected Target ${suffix}`;
    const flows = new MultiAgentFlowsPage(page);
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    let flowId: string | undefined;
    let created = false;
    let cleanupFailure: Error | undefined;

    const addSkilled = async (title: string, addButton: ReturnType<MultiAgentFlowsPage['getAddFirstAgentButton']>) => {
      await expect(addButton).toBeVisible({ timeout: 30_000 });
      await addButton.click();
      await flows.getAgentTitleInput().fill(title);
      const responsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST' &&
          url.pathname === `/data-api/agentflow/${flowId}/skilled`;
      });
      await flows.getCreateEmbeddedAgentButton().click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
      return response;
    };

    try {
      expect((await api.getFlows()).agentflows.some((flow) => flow.name === flowName))
        .toBe(false);
      const creation = await flows.createMasterFlow(
        flowName,
        'Disposable Decision branch-target discovery',
        'Branch audit master',
        '',
      );
      expect(creation.status).toBe(200);
      flowId = creation.id;
      created = true;
      expect(flowId).toBeTruthy();

      await page.goto(`/orchestrate/process-flows/${flowId}/build`);
      await addSkilled(skilledTitle, flows.getAddFirstAgentButton());
      const oneAgent = await api.getFlow(flowId as string);
      const firstAgent = (oneAgent.agents as unknown as EmbeddedFlowAgent[])[0];
      expect(oneAgent.initialAgent).toBe(firstAgent._id);

      await flows.getAddNextAgentButtons().click();
      await flows.getAgentTypeButton('Decision').click();
      await flows.getAgentTitleInput().fill(decisionTitle);
      await flows.getConditionAddButton().click();
      await flows.getConditionAddButton().click();
      await flows.getBranchKeyInputs().nth(0).fill('approved');
      await flows.getConditionDescriptionInputs().nth(0).fill('Request is approved');
      await flows.getBranchKeyInputs().nth(1).fill('rejected');
      await flows.getConditionDescriptionInputs().nth(1).fill('Request is rejected');
      const decisionResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST' &&
          url.pathname === `/data-api/agentflow/${flowId}/decider`;
      });
      await flows.getCreateEmbeddedAgentButton().click();
      const decisionResponse = await decisionResponsePromise;
      expect(decisionResponse.ok()).toBe(true);
      const twoAgents = await api.getFlow(flowId as string);
      const decision = (twoAgents.agents as unknown as EmbeddedFlowAgent[])
        .find((agent) => agent.title === decisionTitle);
      expect(decision).toBeTruthy();
      expect(
        (twoAgents.agents as unknown as EmbeddedFlowAgent[])
          .find((agent) => agent._id === firstAgent._id)?.next_agent,
      ).toBe(decision?._id);

      const approvedResponse = await addSkilled(
        approvedTitle,
        flows.getDecisionBranchAddButton(decision?._id as string, 'approved'),
      );
      const approvedUrl = new URL(approvedResponse.url());
      expect(approvedUrl.searchParams.get('after_agent')).toBe(decision?._id);
      expect(approvedUrl.searchParams.get('add_on_side_if_decider')).toBe('approved');
      const afterApproved = await api.getFlow(flowId as string);
      const approvedAgent = (afterApproved.agents as unknown as EmbeddedFlowAgent[])
        .find((agent) => agent.title === approvedTitle);
      expect(approvedAgent).toBeTruthy();

      const rejectedResponse = await addSkilled(
        rejectedTitle,
        flows.getDecisionBranchAddButton(decision?._id as string, 'rejected'),
      );
      const rejectedUrl = new URL(rejectedResponse.url());
      expect(rejectedUrl.searchParams.get('after_agent')).toBe(decision?._id);
      expect(rejectedUrl.searchParams.get('add_on_side_if_decider')).toBe('rejected');

      const branched = await api.getFlow(flowId as string);
      const branchedAgents = branched.agents as unknown as EmbeddedFlowAgent[];
      const persistedDecision = branchedAgents.find((agent) => agent._id === decision?._id);
      const persistedApproved = branchedAgents.find((agent) => agent.title === approvedTitle);
      const persistedRejected = branchedAgents.find((agent) => agent.title === rejectedTitle);
      expect(persistedDecision?.next_agents).toEqual({
        approved: persistedApproved?._id,
        rejected: persistedRejected?._id,
      });
      expect(branched.initialAgent).toBe(firstAgent._id);
      const graphBeforeRefresh = await flows.inspectGraph();
      expect(graphBeforeRefresh.nodes.map((node) => node.id)).toEqual(
        expect.arrayContaining([
          'goal-node',
          firstAgent._id,
          decision?._id,
          persistedApproved?._id,
          persistedRejected?._id,
        ]),
      );
      expect(graphBeforeRefresh.edges.length).toBeGreaterThanOrEqual(4);

      await page.reload();
      for (const title of [skilledTitle, decisionTitle, approvedTitle, rejectedTitle]) {
        await expect(page.getByText(title, { exact: true })).toBeVisible({
          timeout: 30_000,
        });
      }
      const refreshed = await api.getFlow(flowId as string);
      const refreshedAgents = refreshed.agents as unknown as EmbeddedFlowAgent[];
      const refreshedDecision = refreshedAgents.find((agent) => agent._id === decision?._id);
      expect(refreshedDecision?.next_agents).toEqual({
        approved: persistedApproved?._id,
        rejected: persistedRejected?._id,
      });
      const graphAfterRefresh = await flows.inspectGraph();
      expect(graphAfterRefresh.edges.length).toBeGreaterThanOrEqual(4);

      const evidence = {
        url: page.url(),
        pageTitle: await page.title(),
        flowId,
        flowName,
        initialAgent: refreshed.initialAgent,
        agents: refreshedAgents,
        nextAgents: refreshedDecision?.next_agents,
        graphBeforeRefresh,
        graphAfterRefresh,
        requests: {
          decision: await mutationSummary(decisionResponse),
          approved: await mutationSummary(approvedResponse),
          rejected: await mutationSummary(rejectedResponse),
        },
      };
      await testInfo.attach('decision-branch-targets', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('decision-branch-targets-ui', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      console.log(`DECISION_BRANCH_TARGETS=${JSON.stringify(evidence)}`);
    } finally {
      if (created) {
        try {
          const cleanup = await flows.deleteFlowByExactName(flowName, flowId);
          expect(cleanup.status).toBe(200);
          expect((await api.getFlows()).agentflows.some(
            (flow) => flow._id === flowId || flow.name === flowName,
          )).toBe(false);
          console.log(`BRANCH_FLOW_CLEANUP=${JSON.stringify({ flowName, flowId, cleanup })}`);
        } catch (error) {
          cleanupFailure = error instanceof Error ? error : new Error(String(error));
        }
      }
      if (cleanupFailure) throw cleanupFailure;
    }
  });
});
