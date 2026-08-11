import { randomUUID } from 'node:crypto';

import { test, expect } from '../../fixtures/authenticated.fixture';
import { AgentApi } from '../../helpers/agent.api';
import { MultiAgentFlowsPage } from '../../pages/MultiAgentFlowsPage';
import type {
  EmbeddedFlowAgent,
  MultiAgentFlowMutation,
  MultiAgentPostCreateInspection,
} from '../../test-data/multiAgentFlowInfo';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.use({ trace: 'retain-on-failure' });

test.describe('Disposable Multi-Agent composition audit @e2e @stateful @regression @product-defect', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'multi-agent-discovery');
  });

  test('AG-MA-E2E-001 validates one owned Master Flow composition lifecycle', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(180_000);
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const uniqueName = `QA-MultiAgent-Audit-${suffix}`;
    const childTitle = `QA Audit Child ${suffix}`;
    const decisionTitle = `QA Audit Decision ${suffix}`;
    const description = 'Disposable Multi-Agent composition audit';
    const role = 'Audit orchestration master';
    const defaultGoal = 'Validate a harmless one-child composition without executing it.';
    const flows = new MultiAgentFlowsPage(page);
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    let created = false;
    let flowId: string | undefined;
    let createMutation: MultiAgentFlowMutation | undefined;
    let cleanupMutation: MultiAgentFlowMutation | undefined;
    let postCreate: MultiAgentPostCreateInspection | undefined;
    let childMutation: MultiAgentFlowMutation | undefined;
    let decisionMutation: MultiAgentFlowMutation | undefined;
    let removalMutation: MultiAgentFlowMutation | undefined;
    let cleanupFailure: Error | undefined;

    const attachEvidence = async (name: string, body: unknown) => {
      await testInfo.attach(name, {
        body: JSON.stringify({
          url: page.url(),
          pageTitle: await page.title(),
          flowId,
          flowName: uniqueName,
          evidence: body,
        }, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach(`${name}-ui`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    };

    const creationObserver = async (response: import('@playwright/test').Response) => {
      if (
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/data-api/agentflow/' &&
        response.ok()
      ) {
        const body = (await response.json()) as { _id?: string; name?: string };
        if (body.name === uniqueName) {
          created = true;
          flowId = body._id;
        }
      }
    };
    page.on('response', creationObserver);

    try {
      const before = await api.getFlows();
      expect(
        before.agentflows.some(
          (flow) => flow.name === uniqueName,
        ),
        'Generated audit Flow name must not already exist.',
      ).toBe(false);

      await flows.navigateFromHome();
      await flows.openCreateForm();
      const labels = flows.getCreateFieldLabels();
      await expect(labels.filter({ hasText: /^Name \*$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Type \*$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Description$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Role$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Default Goal$/ })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'master', exact: true })).toBeChecked();
      await expect(flows.getCreateSubmitButton()).toBeDisabled();
      const nameInput = page.getByPlaceholder('e.g. Lead Qualification Team', {
        exact: true,
      });
      await nameInput.fill(uniqueName);
      await expect(flows.getCreateSubmitButton()).toBeEnabled();
      await attachEvidence('create-form-validation', {
        required: ['Name', 'Type'],
        optional: ['Description', 'Role', 'Default Goal'],
        defaultType: 'master',
        submitDisabledWithoutName: true,
        submitEnabledWithName: true,
      });
      await flows.cancelCreateForm();
      await expect(
        page.getByRole('heading', { name: 'Create Multi-Agent Flow', exact: true }),
      ).toBeHidden();
      expect((await api.getFlows()).agentflows.some((flow) => flow.name === uniqueName)).toBe(false);

      createMutation = await flows.createMasterFlow(
        uniqueName,
        description,
        role,
        defaultGoal,
      );
      created = createMutation.status >= 200 && createMutation.status < 300;
      flowId = createMutation.id;

      expect(createMutation.status).toBe(200);
      expect(createMutation.name).toBe(uniqueName);
      expect(flowId, 'Create response did not expose a Flow ID.').toBeTruthy();
      expect(createMutation.requestKeys).toEqual(
        expect.arrayContaining([
          'description',
          'kind',
          'name',
          'projectID',
          'role',
        ]),
      );

      const createdList = await api.getFlows();
      const createdSummary = createdList.agentflows.filter(
        (flow) => flow._id === flowId || flow.name === uniqueName,
      );
      expect(createdSummary).toHaveLength(1);
      expect(createdSummary[0]).toEqual(
        expect.objectContaining({ _id: flowId, name: uniqueName }),
      );
      const master = await api.getFlow(flowId as string);
      expect(master).toEqual(
        expect.objectContaining({
          _id: flowId,
          name: uniqueName,
          description,
          role,
        }),
      );
      expect.soft(
        master.default_goal,
        'The Create Flow Default Goal must persist in Flow detail.',
      ).toBe(defaultGoal);
      expect(master.agents).toEqual([]);
      await attachEvidence('flow-creation-and-master-configuration', {
        uniqueName,
        flowId,
        createMutation,
        api: {
          name: master.name,
          description: master.description,
          role: master.role,
          default_goal: master.default_goal,
          agents: master.agents,
        },
      });

      await page.goto(`/orchestrate/process-flows/${flowId}/build`);
      const addFirstAgent = flows.getAddFirstAgentButton();
      await expect(addFirstAgent).toBeVisible({ timeout: 30_000 });
      await addFirstAgent.click();
      await expect(
        page.locator('span').getByText('New Agent', { exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Agent Type', { exact: true })).toBeVisible();
      await expect(flows.getAgentTypeButton('Actions')).toBeVisible();
      await expect(flows.getAgentTypeButton('Decision')).toBeVisible();
      await expect(page.getByText('Title*', { exact: true })).toBeVisible();
      const createChild = flows.getCreateEmbeddedAgentButton();
      await expect(createChild).toBeDisabled();
      await flows.getAgentTitleInput().fill(childTitle);
      await expect(createChild).toBeEnabled();
      await page.getByPlaceholder('e.g., Data Processor', { exact: true }).fill('Audit verifier');
      await page
        .getByPlaceholder('Describe the role of agent', { exact: true })
        .fill('Embedded child used only to validate Flow composition.');
      await page
        .getByPlaceholder(
          'Use @ to add existing details or create a new one for the task.',
          { exact: true },
        )
        .fill('Return a harmless validation acknowledgement.');
      await attachEvidence('child-agent-validation', {
        required: ['Title'],
        saveDisabledWithoutTitle: true,
        selectedAgentType: 'Actions (skilled_agent)',
      });

      const childResponsePromise = page.waitForResponse((response) => {
        const path = new URL(response.url()).pathname;
        return response.request().method() === 'POST' &&
          path === `/data-api/agentflow/${flowId}/skilled`;
      });
      await createChild.click();
      const childResponse = await childResponsePromise;
      const childBody = (await childResponse.json()) as Record<string, unknown>;
      childMutation = {
        method: childResponse.request().method(),
        path: `${new URL(childResponse.url()).pathname}${new URL(childResponse.url()).search}`,
        status: childResponse.status(),
        requestKeys: Object.keys(
          childResponse.request().postDataJSON() as Record<string, unknown>,
        ).sort(),
        responseKeys: Object.keys(childBody).sort(),
        ...(typeof childBody._id === 'string' ? { id: childBody._id } : {}),
        ...(typeof childBody.title === 'string' ? { name: childBody.title } : {}),
      };
      expect(childResponse.ok()).toBe(true);
      await expect(page.getByText(childTitle, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText('Goal', { exact: true }).first()).toBeVisible();

      const composed = await api.getFlow(flowId as string);
      const embeddedAgents = composed.agents as unknown as EmbeddedFlowAgent[];
      expect(embeddedAgents).toHaveLength(1);
      expect(embeddedAgents[0]).toEqual(
        expect.objectContaining({
          title: childTitle,
          agent_type: 'skilled_agent',
        }),
      );
      expect(composed.initialAgent).toBe(embeddedAgents[0]._id);
      expect(embeddedAgents[0].next_agent).toBeNull();

      const firstAgentId = embeddedAgents[0]._id;
      const addNext = flows.getAddNextAgentButtons();
      await expect(addNext).toHaveCount(1);
      await addNext.click();
      await expect(flows.getAgentTypeButton('Decision')).toBeVisible();
      await flows.getAgentTypeButton('Decision').click();
      const createDecision = flows.getCreateEmbeddedAgentButton();
      await expect(createDecision).toBeDisabled();
      await flows.getAgentTitleInput().fill(decisionTitle);
      await flows.getConditionAddButton().click();
      await flows.getConditionAddButton().click();
      await expect(flows.getBranchKeyInputs()).toHaveCount(2);
      await flows.getBranchKeyInputs().nth(0).fill('approved');
      await flows.getConditionDescriptionInputs().nth(0).fill('Request is approved');
      await flows.getBranchKeyInputs().nth(1).fill('rejected');
      await flows.getConditionDescriptionInputs().nth(1).fill('Request is rejected');
      await expect(createDecision).toBeEnabled();

      const decisionResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST' &&
          url.pathname === `/data-api/agentflow/${flowId}/decider`;
      });
      await createDecision.click();
      const decisionResponse = await decisionResponsePromise;
      const decisionResponseBody = (await decisionResponse.json()) as Record<string, unknown>;
      const decisionUrl = new URL(decisionResponse.url());
      decisionMutation = {
        method: decisionResponse.request().method(),
        path: `${decisionUrl.pathname}${decisionUrl.search}`,
        status: decisionResponse.status(),
        requestKeys: Object.keys(
          decisionResponse.request().postDataJSON() as Record<string, unknown>,
        ).sort(),
        responseKeys: Object.keys(decisionResponseBody).sort(),
      };
      expect(decisionResponse.ok()).toBe(true);
      expect(decisionUrl.searchParams.get('after_agent')).toBe(firstAgentId);
      await expect(page.getByText(decisionTitle, { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      const multiAgent = await api.getFlow(flowId as string);
      const multiAgentNodes = multiAgent.agents as unknown as EmbeddedFlowAgent[];
      expect(multiAgentNodes).toHaveLength(2);
      const persistedFirst = multiAgentNodes.find((agent) => agent._id === firstAgentId);
      const persistedDecision = multiAgentNodes.find(
        (agent) => agent.title === decisionTitle,
      );
      expect(persistedDecision).toEqual(expect.objectContaining({
        agent_type: 'decider_agent',
        conditions: [
          { decision: 'approved', condition: 'Request is approved' },
          { decision: 'rejected', condition: 'Request is rejected' },
        ],
      }));
      expect(persistedFirst?.next_agent).toBe(persistedDecision?._id);
      expect(multiAgent.initialAgent).toBe(firstAgentId);

      const graphBeforeRefresh = await flows.inspectGraph();
      expect(graphBeforeRefresh.nodes.map((node) => node.id)).toEqual(
        expect.arrayContaining(['goal-node', firstAgentId, persistedDecision?._id]),
      );
      expect(graphBeforeRefresh.edges.length).toBeGreaterThanOrEqual(2);
      await attachEvidence('multi-agent-handoff-composition', {
        flowId,
        flowName: uniqueName,
        initialAgent: multiAgent.initialAgent,
        agents: multiAgentNodes,
        graph: graphBeforeRefresh,
        decisionMutation,
      });

      await page.reload();
      await expect(page.getByText(childTitle, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(decisionTitle, { exact: true })).toBeVisible();
      const persistedAfterRefresh = await api.getFlow(flowId as string);
      const refreshedNodes = persistedAfterRefresh.agents as unknown as EmbeddedFlowAgent[];
      expect(refreshedNodes).toHaveLength(2);
      expect(
        refreshedNodes.find((agent) => agent._id === firstAgentId)?.next_agent,
      ).toBe(persistedDecision?._id);
      expect(persistedAfterRefresh.initialAgent).toBe(firstAgentId);

      await flows.openEmbeddedAgent(decisionTitle);
      const deleteDecisionResponsePromise = page.waitForResponse(
        (response) => {
          const path = new URL(response.url()).pathname;
          return response.request().method() === 'DELETE' &&
            path === `/data-api/agentflow/${flowId}/agent/${persistedDecision?._id}`;
        },
        { timeout: 15_000 },
      );
      await flows.getDeleteEmbeddedAgentButton().click();
      const deleteDecisionResponse = await deleteDecisionResponsePromise;
      const removalUrl = new URL(deleteDecisionResponse.url());
      removalMutation = {
        method: deleteDecisionResponse.request().method(),
        path: `${removalUrl.pathname}${removalUrl.search}`,
        status: deleteDecisionResponse.status(),
        requestKeys: [],
        responseKeys: Object.keys(
          (await deleteDecisionResponse.json()) as Record<string, unknown>,
        ).sort(),
      };
      expect(deleteDecisionResponse.ok()).toBe(true);
      await expect(page.getByText(decisionTitle, { exact: true })).toHaveCount(0, {
        timeout: 30_000,
      });
      const afterRemoval = await api.getFlow(flowId as string);
      const remainingNodes = afterRemoval.agents as unknown as EmbeddedFlowAgent[];
      expect(remainingNodes).toHaveLength(1);
      expect(remainingNodes[0]._id).toBe(firstAgentId);
      expect(remainingNodes[0].next_agent).toBeNull();
      expect(afterRemoval.initialAgent).toBe(firstAgentId);

      postCreate = await flows.inspectCurrentFlowUi();
      expect(postCreate.mainText).toContain(childTitle);
      expect(postCreate.url).not.toMatch(/\/login\/?$/);

      await attachEvidence('final-composition-and-api-verification', {
        uniqueName,
        flowId,
        childTitle,
        childMutation,
        decisionMutation,
        removalMutation,
        hierarchy: {
          initialAgent: multiAgent.initialAgent,
          agentsBeforeRemoval: multiAgentNodes,
          agentsAfterRemoval: remainingNodes,
        },
        postCreate,
      });
      console.log(`MULTI_AGENT_AUDIT=${JSON.stringify({
        uniqueName,
        flowId,
        childTitle,
        createMutation,
        childMutation,
        decisionMutation,
        removalMutation,
        composition: {
          initialAgent: multiAgent.initialAgent,
          agentCountBeforeRemoval: multiAgentNodes.length,
          agentsBeforeRemoval: multiAgentNodes,
          agentCountAfterRemoval: remainingNodes.length,
        },
      })}`);
    } finally {
      page.off('response', creationObserver);
      if (created) {
        try {
          cleanupMutation = await flows.deleteFlowByExactName(uniqueName, flowId);
          expect(
            cleanupMutation.status,
            `Cleanup ${cleanupMutation.method} ${cleanupMutation.path}`,
          ).toBe(200);
          const remaining = await api.getFlows();
          expect(
            remaining.agentflows.some(
              (flow) => flow._id === flowId || flow.name === uniqueName,
            ),
            `Cleanup verification failed for ${uniqueName} (${flowId ?? 'unknown ID'}).`,
          ).toBe(false);
          await testInfo.attach('multi-agent-cleanup', {
            body: JSON.stringify(
              { uniqueName, flowId, cleanupMutation },
              null,
              2,
            ),
            contentType: 'application/json',
          });
          console.log(`MULTI_AGENT_CLEANUP=${JSON.stringify({
            uniqueName,
            flowId,
            cleanupMutation,
            uiRemoval: true,
            apiRemoval: true,
          })}`);
        } catch (error) {
          cleanupFailure = error instanceof Error ? error : new Error(String(error));
          await testInfo.attach('multi-agent-cleanup-failure', {
            body: JSON.stringify(
              { uniqueName, flowId, error: cleanupFailure.message },
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
