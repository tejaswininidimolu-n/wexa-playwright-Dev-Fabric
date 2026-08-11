import { randomUUID } from 'node:crypto';

import type { Response } from '@playwright/test';

import { test, expect } from '../../fixtures/authenticated.fixture';
import { AgentApi } from '../../helpers/agent.api';
import { MultiAgentFlowsPage } from '../../pages/MultiAgentFlowsPage';
import type {
  EmbeddedFlowAgent,
  MultiAgentExecutionExchange,
} from '../../test-data/multiAgentFlowInfo';
import { attachPageDiagnostics } from '../../utils/testDiagnostics';

test.use({ trace: 'retain-on-failure' });

test.describe('Disposable Multi-Agent execution discovery @e2e @stateful @api @product-defect', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachPageDiagnostics(page, testInfo, 'multi-agent-execution');
  });

  test('AG-MA-E2E-004 performs one harmless controlled execution', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(420_000);
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const flowName = `QA-MultiAgent-Execution-${suffix}`;
    const titles = {
      initial: `QA Execution Initial ${suffix}`,
      decision: `QA Execution Decision ${suffix}`,
      approved: `QA Execution Approved ${suffix}`,
      rejected: `QA Execution Rejected ${suffix}`,
    };
    const harmlessGoal = 'Validate a harmless one-child composition without executing it.';
    const flows = new MultiAgentFlowsPage(page);
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const configuredDefaultModel = (await api.getModels()).models.find(
      (model) => model.isDefault,
    );
    expect(
      configuredDefaultModel,
      'Fabric must expose a configured default model for execution preparation.',
    ).toBeTruthy();
    let flowId: string | undefined;
    let created = false;
    let executionCount = 0;
    let cleanupFailure: Error | undefined;

    const responseBody = async (response: Response): Promise<Record<string, unknown>> => {
      try {
        return (await response.json()) as Record<string, unknown>;
      } catch {
        return {};
      }
    };

    const findString = (value: unknown, keys: RegExp): string | undefined => {
      if (!value || typeof value !== 'object') return undefined;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (keys.test(key) && (typeof child === 'string' || typeof child === 'number')) {
          return String(child);
        }
      }
      for (const child of Object.values(value as Record<string, unknown>)) {
        const found = findString(child, keys);
        if (found) return found;
      }
      return undefined;
    };

    const summarize = async (response: Response): Promise<MultiAgentExecutionExchange> => {
      const body = await responseBody(response);
      let requestKeys: string[] = [];
      try {
        requestKeys = Object.keys(
          response.request().postDataJSON() as Record<string, unknown>,
        ).sort();
      } catch {
        // The observed request may have no JSON body.
      }
      const url = new URL(response.url());
      const explicitExecutionId = typeof body.execution_id === 'string'
        ? body.execution_id
        : typeof body.run_id === 'string'
          ? body.run_id
          : undefined;
      return {
        method: response.request().method(),
        path: `${url.pathname}${url.search}`,
        status: response.status(),
        requestKeys,
        responseKeys: Object.keys(body).sort(),
        executionId: explicitExecutionId
          ?? findString(body, /^(execution_?id|run_?id)$/i),
        statusValue: findString(body, /^(status|state)$/i),
        responseBody: body,
      };
    };

    const addSkilled = async (title: string, addButton: ReturnType<MultiAgentFlowsPage['getAddFirstAgentButton']>) => {
      await expect(addButton).toBeVisible({ timeout: 30_000 });
      await addButton.click();
      await flows.getAgentTitleInput().fill(title);
      await page.getByPlaceholder(
        'Use @ to add existing details or create a new one for the task.',
        { exact: true },
      ).fill('Return only a harmless acknowledgement without using any action or tool.');
      await flows.selectEmbeddedAgentModel(configuredDefaultModel?.id as string);
      const responsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/data-api/agentflow/${flowId}/skilled`,
      { timeout: 30_000 });
      await flows.getCreateEmbeddedAgentButton().click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
      await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 30_000 });
      return response;
    };

    try {
      expect((await api.getFlows()).agentflows.some((flow) => flow.name === flowName))
        .toBe(false);
      const creation = await flows.createMasterFlow(
        flowName,
        'Disposable controlled Multi-Agent execution audit',
        'Harmless execution coordinator',
        '',
      );
      expect(creation.status).toBe(200);
      flowId = creation.id;
      created = true;
      expect(flowId).toBeTruthy();

      await page.goto(`/orchestrate/process-flows/${flowId}/build`);
      await addSkilled(titles.initial, flows.getAddFirstAgentButton());
      const initialState = await api.getFlow(flowId as string);
      const initial = (initialState.agents as unknown as EmbeddedFlowAgent[])[0];
      expect(initialState.initialAgent).toBe(initial._id);

      await flows.getAddNextAgentButtons().click();
      await flows.getAgentTypeButton('Decision').click();
      await flows.getAgentTitleInput().fill(titles.decision);
      await flows.getConditionAddButton().click();
      await flows.getConditionAddButton().click();
      await flows.getBranchKeyInputs().nth(0).fill('approved');
      await flows.getConditionDescriptionInputs().nth(0)
        .fill('The preceding output is a harmless acknowledgement');
      await flows.getBranchKeyInputs().nth(1).fill('rejected');
      await flows.getConditionDescriptionInputs().nth(1)
        .fill('The preceding output is not a harmless acknowledgement');
      await flows.selectEmbeddedAgentModel(configuredDefaultModel?.id as string);
      const decisionResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/data-api/agentflow/${flowId}/decider`,
      { timeout: 30_000 });
      await flows.getCreateEmbeddedAgentButton().click();
      expect((await decisionResponsePromise).ok()).toBe(true);
      const decisionState = await api.getFlow(flowId as string);
      const decision = (decisionState.agents as unknown as EmbeddedFlowAgent[])
        .find((agent) => agent.title === titles.decision);
      expect(decision).toBeTruthy();

      await addSkilled(
        titles.approved,
        flows.getDecisionBranchAddButton(decision?._id as string, 'approved'),
      );
      await addSkilled(
        titles.rejected,
        flows.getDecisionBranchAddButton(decision?._id as string, 'rejected'),
      );
      const composed = await api.getFlow(flowId as string);
      const agents = composed.agents as unknown as EmbeddedFlowAgent[];
      expect(agents).toHaveLength(4);
      expect(composed.initialAgent).toBe(initial._id);
      const persistedInitial = agents.find((agent) => agent._id === initial._id);
      const persistedDecision = agents.find((agent) => agent._id === decision?._id);
      const persistedApproved = agents.find((agent) => agent.title === titles.approved);
      const persistedRejected = agents.find((agent) => agent.title === titles.rejected);
      expect(persistedInitial?.next_agent).toBe(persistedDecision?._id);
      expect(persistedDecision?.next_agents).toEqual({
        approved: persistedApproved?._id,
        rejected: persistedRejected?._id,
      });
      for (const agent of agents) {
        expect(
          (agent as unknown as { llm?: { model?: string } }).llm?.model,
          `Embedded Agent ${agent._id} must persist the dynamically selected default model.`,
        ).toBe(configuredDefaultModel?.id);
      }

      const runNavigation = flows.getFlowNavigationControl('Run');
      await expect(runNavigation).toBeVisible({ timeout: 30_000 });
      await runNavigation.click();
      await expect(page).toHaveURL(new RegExp(`/process-flows/${flowId}/run/?$`));
      const preExecution = await flows.inspectRunPage();
      const runButton = flows.getRunExecutionButton();
      const goalInput = flows.getRunGoalInput();
      await expect(goalInput, 'Run page must expose an observed goal/input control.').toBeVisible();
      await expect(runButton, 'Run page must expose an observed execution control.').toBeVisible();
      const runControlBeforeGoal = {
        disabled: await runButton.isDisabled(),
        text: (await runButton.innerText()).trim(),
      };
      await goalInput.fill(harmlessGoal);
      await expect(runButton).toBeEnabled();
      await testInfo.attach('run-page-before-execution', {
        body: JSON.stringify({
          url: page.url(),
          title: await page.title(),
          flowId,
          flowName,
          inspection: preExecution,
          runControlBeforeGoal,
          safety: { connectorSkills: 0, externalActions: 0, intendedExecutions: 1 },
        }, null, 2),
        contentType: 'application/json',
      });

      const observedResponses: Response[] = [];
      const browserConsoleErrors: Array<{ type: string; text: string }> = [];
      const networkErrors: Array<{ method: string; path: string; error: string | null }> = [];
      const observeConsole = (message: import('@playwright/test').ConsoleMessage) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          browserConsoleErrors.push({ type: message.type(), text: message.text() });
        }
      };
      const observeRequestFailure = (failedRequest: import('@playwright/test').Request) => {
        const url = new URL(failedRequest.url());
        networkErrors.push({
          method: failedRequest.method(),
          path: `${url.pathname}${url.search}`,
          error: failedRequest.failure()?.errorText ?? null,
        });
      };
      const observeResponse = (response: Response) => {
        const url = new URL(response.url());
        if (
          url.origin === new URL(page.url()).origin &&
          (/execut|run|history|agentflow/i.test(url.pathname) || url.pathname.includes(flowId as string))
        ) observedResponses.push(response);
      };
      page.on('response', observeResponse);
      page.on('console', observeConsole);
      page.on('requestfailed', observeRequestFailure);
      executionCount += 1;
      await runButton.click();

      await expect.poll(
        () => observedResponses.some((response) => response.request().method() !== 'GET'),
        { timeout: 30_000, message: 'Run control did not emit an execution mutation.' },
      ).toBe(true);
      const executionResponse = observedResponses.find(
        (response) => response.request().method() !== 'GET',
      ) as Response;
      const executionExchange = await summarize(executionResponse);
      expect(executionResponse.ok()).toBe(true);

      await page.waitForTimeout(5_000);
      await expect.poll(async () => (await page.locator('main').innerText()).trim(), {
        timeout: 120_000,
        intervals: [2_000, 5_000, 10_000],
        message: 'Run UI did not expose a terminal status or result.',
      }).toMatch(/completed|succeeded|success|failed|error/i);
      const runResultText = (await page.locator('main').innerText()).trim();
      page.off('response', observeResponse);
      page.off('console', observeConsole);
      page.off('requestfailed', observeRequestFailure);
      const exchanges = await Promise.all(observedResponses.map(summarize));
      const executionId = executionExchange.executionId
        ?? exchanges.map((exchange) => exchange.executionId).find(Boolean);
      expect(executionId, 'Execution response must expose an execution ID.').toBeTruthy();

      const historyNavigation = flows.getFlowNavigationControl('History');
      await expect(historyNavigation).toBeVisible();
      const historyResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/execution_flows'),
      { timeout: 30_000 });
      await historyNavigation.click();
      await expect(page).toHaveURL(new RegExp(`/process-flows/${flowId}/history/?$`));
      const historyResponse = await historyResponsePromise;
      expect(historyResponse.ok()).toBe(true);
      const historyBody = await responseBody(historyResponse);
      const historyRecords = Array.isArray(historyBody.data)
        ? historyBody.data as Array<Record<string, unknown>>
        : [];
      const historyRecord = historyRecords.find((record) =>
        record.execution_id === executionId || record._id === executionId);
      expect(historyRecord, 'History API must contain the execution returned by Run.').toBeTruthy();
      expect(historyRecord?.agentflow_id).toBe(flowId);
      await page.waitForTimeout(2_000);
      const historyBeforeRefresh = (await page.locator('main').innerText()).trim();
      expect(historyBeforeRefresh).toMatch(/completed|succeeded|success|failed|error/i);
      expect(historyBeforeRefresh).toContain('1 execution');
      const refreshedHistoryResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/execution_flows'),
      { timeout: 30_000 });
      await page.reload();
      const refreshedHistoryResponse = await refreshedHistoryResponsePromise;
      const refreshedHistoryBody = await responseBody(refreshedHistoryResponse);
      const refreshedRecords = Array.isArray(refreshedHistoryBody.data)
        ? refreshedHistoryBody.data as Array<Record<string, unknown>>
        : [];
      const historyAfterRefresh = (await page.locator('main').innerText()).trim();
      expect(refreshedRecords.some((record) =>
        record.execution_id === executionId || record._id === executionId)).toBe(true);
      const runtimeModelUsed = exchanges
        .map((exchange) => findString(exchange.responseBody, /^model_used$/i))
        .find(Boolean);
      const terminalError = exchanges
        .map((exchange) => findString(exchange.responseBody, /^(error|detail|message|conclusion)$/i))
        .find((value) => /no skills found for the agent/i.test(value ?? ''));

      const evidence = {
        flowId,
        flowName,
        harmlessGoal,
        configuredDefaultModel: {
          id: configuredDefaultModel?.id,
          name: configuredDefaultModel?.name,
          provider: configuredDefaultModel?.provider,
          health: configuredDefaultModel?.health,
        },
        initialAgent: composed.initialAgent,
        decisionAgent: decision?._id,
        decisionNextAgents: (agents.find((agent) => agent._id === decision?._id))?.next_agents,
        embeddedAgents: agents.map((agent) => ({
          id: agent._id,
          title: agent.title,
          type: agent.agent_type,
          model: (agent as unknown as { llm?: { model?: string } }).llm?.model,
          nextAgent: agent.next_agent,
          nextAgents: agent.next_agents,
        })),
        execution: executionExchange,
        runtimeModelUsed,
        terminalError,
        exchanges,
        browserConsoleErrors,
        networkErrors,
        runResultText,
        historyUrl: page.url(),
        historyEndpoint: new URL(historyResponse.url()).pathname,
        historyRecord,
        historyBeforeRefresh,
        historyAfterRefresh,
      };
      await testInfo.attach('controlled-execution-contract', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('controlled-execution-history', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      console.log(`MULTI_AGENT_EXECUTION=${JSON.stringify(evidence)}`);
      expect(executionCount).toBe(1);
      expect.soft(
        terminalError ?? '',
        'UI/API permit an embedded skilled Agent with skills: [], but runtime must not reject that accepted configuration.',
      ).not.toContain('No skills found for the agent');
      if (runtimeModelUsed) {
        expect.soft(
          runtimeModelUsed,
          'Execution model metadata must resolve to the explicitly persisted Fabric model.',
        ).toBe(configuredDefaultModel?.providerModelRef);
      }
      expect(
        String(historyRecord?.status ?? ''),
        'A harmless composed Flow execution should complete successfully.',
      ).toMatch(/completed|succeeded|success/i);
    } finally {
      if (created) {
        try {
          const cleanup = await flows.deleteFlowByExactName(flowName, flowId);
          expect(cleanup.status).toBe(200);
          expect((await api.getFlows()).agentflows.some(
            (flow) => flow._id === flowId || flow.name === flowName,
          )).toBe(false);
          console.log(`EXECUTION_FLOW_CLEANUP=${JSON.stringify({ flowName, flowId, cleanup })}`);
        } catch (error) {
          cleanupFailure = error instanceof Error ? error : new Error(String(error));
        }
      }
      if (cleanupFailure) throw cleanupFailure;
    }
  });
});
