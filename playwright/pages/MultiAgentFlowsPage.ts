import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';
import type {
  MultiAgentGraphInspection,
  MultiAgentFlowMutation,
  MultiAgentPostCreateInspection,
  MultiAgentRunPageInspection,
} from '../test-data/multiAgentFlowInfo';

const MULTI_AGENT_PATH = '/orchestrate/process-flows';
const ACTIVE_FILTER_CLASS = 'bg-cs-primary-500/15';

export class MultiAgentFlowsPage extends BasePage {
  private readonly navigationButton: Locator;
  private readonly heading: Locator;
  private readonly searchInput: Locator;
  private readonly createButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.navigationButton = page.getByTestId('nav-process-flows');
    this.heading = page.getByRole('heading', {
      name: 'Multi-Agent Flows',
      exact: true,
    });
    this.searchInput = page.getByPlaceholder('Search flows...', { exact: true });
    this.createButtons = page.getByRole('button', {
      name: 'Create Multi-Agent Flow',
      exact: true,
    });
  }

  async navigateFromHome(): Promise<void> {
    await this.page.goto(MULTI_AGENT_PATH);
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${MULTI_AGENT_PATH}/?$`));
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await expect(this.searchInput).toBeVisible();
    await expect(this.createButtons.first()).toBeVisible();
  }

  getSearchInput(): Locator {
    return this.searchInput;
  }

  getFilter(name: 'All' | 'master' | 'associate' | 'all' | 'active' | 'inactive'): Locator {
    return this.page.getByRole('button', { name, exact: true }).first();
  }

  async selectFilter(name: 'All' | 'master' | 'associate' | 'all' | 'active' | 'inactive'): Promise<void> {
    const filter = this.getFilter(name);
    await filter.click();
    await expect(filter).toHaveClass(new RegExp(ACTIVE_FILTER_CLASS));
  }

  async openCreateForm(): Promise<void> {
    await this.createButtons.first().click();
    await expect(
      this.page.getByRole('heading', {
        name: 'Create Multi-Agent Flow',
        exact: true,
      }),
    ).toBeVisible();
  }

  getCreateFieldLabels(): Locator {
    return this.page.locator('label');
  }

  getCreateSubmitButton(): Locator {
    return this.page.getByRole('button', {
      name: 'Create Multi-Agent Flow',
      exact: true,
    }).last();
  }

  getCreateTypeRadio(type: 'master' | 'associate'): Locator {
    return this.page.getByRole('radio', { name: type, exact: true });
  }

  async cancelCreateForm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(this.getCreateSubmitButton()).toHaveCount(1);
  }

  async createMasterFlow(
    name: string,
    description: string,
    role: string,
    defaultGoal: string,
  ): Promise<MultiAgentFlowMutation> {
    await this.openCreateForm();
    await this.page
      .getByPlaceholder('e.g. Lead Qualification Team', { exact: true })
      .fill(name);
    await this.page
      .getByPlaceholder('What does this flow do?', { exact: true })
      .fill(description);
    await this.page
      .getByPlaceholder('e.g. Sales Agent', { exact: true })
      .fill(role);
    await this.page
      .getByRole('radio', { name: 'master', exact: true })
      .check();
    await this.page
      .getByPlaceholder('The default goal for this flow...', { exact: true })
      .fill(defaultGoal);

    const submit = this.getCreateSubmitButton();
    await expect(submit).toBeEnabled();
    const responsePromise = this.page.waitForResponse((response) => {
      if (response.request().method() === 'GET') return false;
      try {
        const data = response.request().postDataJSON() as Record<string, unknown>;
        return data.name === name;
      } catch {
        return false;
      }
    });
    await submit.click();
    const response = await responsePromise;
    const requestBody = response.request().postDataJSON() as Record<string, unknown>;
    const responseBody = (await response.json()) as Record<string, unknown>;
    const url = new URL(response.url());
    return {
      method: response.request().method(),
      path: `${url.pathname}${url.search}`,
      status: response.status(),
      requestKeys: Object.keys(requestBody).sort(),
      responseKeys: Object.keys(responseBody).sort(),
      ...(typeof responseBody._id === 'string' ? { id: responseBody._id } : {}),
      ...(typeof responseBody.name === 'string' ? { name: responseBody.name } : {}),
      ...(typeof responseBody.kind === 'string'
        ? { type: responseBody.kind }
        : typeof responseBody.type === 'string'
          ? { type: responseBody.type }
          : {}),
    };
  }

  async openFlowByExactName(name: string): Promise<void> {
    const exactName = this.page.getByText(name, { exact: true }).first();
    await expect(exactName, `Created Flow was not rendered: ${name}`).toBeVisible({
      timeout: 30_000,
    });
    const interactive = exactName.locator(
      'xpath=ancestor-or-self::*[self::button or self::a or @role="button"][1]',
    );
    if ((await interactive.count()) > 0) await interactive.click();
    else await exactName.click();
    await expect(this.page).toHaveURL(
      /\/orchestrate\/process-flows\/[a-z0-9]+(?:\/(?:build|manage|run|history))?\/?$/i,
      { timeout: 30_000 },
    );
  }

  async inspectCurrentFlowUi(): Promise<MultiAgentPostCreateInspection> {
    const main = this.page.locator('main');
    return {
      url: this.page.url(),
      mainText: (await main.innerText()).trim().replace(/\s+/g, ' '),
      headings: await main
        .locator('h1,h2,h3,h4,[role="heading"]')
        .allTextContents(),
      buttons: (await main.getByRole('button').allTextContents())
        .map((text) => text.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
      labels: (await main.locator('label,legend').allTextContents())
        .map((text) => text.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
      inputs: await main.locator('input,textarea,select').evaluateAll((elements) =>
        elements.map((element) => ({
          type: element.getAttribute('type'),
          placeholder: element.getAttribute('placeholder'),
        })),
      ),
    };
  }

  getAddFirstAgentButton(): Locator {
    return this.page.getByTitle('Add first agent');
  }

  getAddNextAgentButtons(): Locator {
    return this.page.getByTitle('Add New Agent');
  }

  getAgentTitleInput(): Locator {
    return this.page.getByPlaceholder("Enter agent's title", { exact: true });
  }

  getCreateEmbeddedAgentButton(): Locator {
    return this.page.getByRole('button', { name: 'Create', exact: true });
  }

  async selectEmbeddedAgentModel(modelId: string): Promise<void> {
    const modelSelect = this.page
      .locator('label')
      .getByText('Language Model', { exact: true })
      .locator('xpath=following::select[1]');
    if (!(await modelSelect.isVisible().catch(() => false))) {
      await this.page.getByRole('button', { name: 'Advanced', exact: true }).click({
        timeout: 30_000,
      });
    }
    await expect(modelSelect).toBeVisible();
    await modelSelect.selectOption(modelId);
    await expect(modelSelect).toHaveValue(modelId);
  }

  getAgentTypeButton(type: 'Actions' | 'Decision'): Locator {
    const description = type === 'Actions'
      ? 'Executes tasks using connected tools'
      : 'Branches flow based on conditions';
    return this.page.getByRole('button').filter({ hasText: description });
  }

  getConditionAddButton(): Locator {
    return this.page.getByRole('button', { name: 'Add', exact: true }).first();
  }

  getBranchKeyInputs(): Locator {
    return this.page.getByPlaceholder('Branch key (e.g. yes)', { exact: true });
  }

  getConditionDescriptionInputs(): Locator {
    return this.page.getByPlaceholder('Condition description', { exact: true });
  }

  async inspectGraph(): Promise<MultiAgentGraphInspection> {
    return {
      nodes: await this.page.locator('.react-flow__node').evaluateAll((elements) =>
        elements.map((element) => ({
          id: element.getAttribute('data-id') ?? element.id ?? null,
          text: (element.textContent ?? '').trim().replace(/\s+/g, ' '),
        }))),
      edges: await this.page.locator('.react-flow__edge').evaluateAll((elements) =>
        elements.map((element) => ({
          id: element.getAttribute('data-id') ?? element.id ?? null,
          testId: element.getAttribute('data-testid'),
        }))),
    };
  }

  async openEmbeddedAgent(title: string): Promise<void> {
    await this.page.getByText(title, { exact: true }).click();
    await expect(this.page.locator('span').getByText('Edit Agent', { exact: true }))
      .toBeVisible();
  }

  getDeleteEmbeddedAgentButton(): Locator {
    return this.page
      .locator('span')
      .getByText('Edit Agent', { exact: true })
      .locator('xpath=ancestor::div[contains(@class, "w-[320px]")][1]')
      .getByRole('button', { name: 'Delete', exact: true });
  }

  getDecisionBranchAddButton(decisionAgentId: string, branch: string): Locator {
    return this.page
      .getByTestId(`rf__node-plus-node-${decisionAgentId}-${branch}`)
      .getByTitle('Add New Agent');
  }

  getFlowNavigationControl(name: 'Build' | 'Run' | 'History'): Locator {
    return this.page
      .getByRole('link', { name, exact: true })
      .or(this.page.getByRole('button', { name, exact: true }))
      .first();
  }

  async inspectRunPage(): Promise<MultiAgentRunPageInspection> {
    const base = await this.inspectCurrentFlowUi();
    const controls = await this.page.locator('main input, main textarea, main select, main button')
      .evaluateAll((elements) => elements.map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type'),
        name: element.getAttribute('name'),
        placeholder: element.getAttribute('placeholder'),
        text: (element.textContent ?? '').trim().replace(/\s+/g, ' '),
        disabled: (element as HTMLInputElement | HTMLButtonElement).disabled,
      })));
    return { ...base, controls };
  }

  getRunGoalInput(): Locator {
    return this.page.getByRole('textbox', {
      name: 'Describe what you want to accomplish…',
      exact: true,
    });
  }

  getRunExecutionButton(): Locator {
    return this.page.getByRole('button', {
      name: /^(run|run flow|start run|execute|execute flow)$/i,
    }).first();
  }

  async deleteFlowByExactName(
    name: string,
    expectedId?: string,
  ): Promise<MultiAgentFlowMutation> {
    await this.navigateFromHome();
    await this.searchInput.fill(name);
    const exactName = this.page.getByText(name, { exact: true }).first();
    await expect(exactName, `Owned cleanup Flow not found: ${name}`).toBeVisible({
      timeout: 30_000,
    });

    const containerWithButton = exactName.locator(
      'xpath=ancestor::*[.//button][1]',
    );
    const actionButtons = containerWithButton.getByRole('button');
    let menuButton: Locator | undefined;
    for (let index = 0; index < await actionButtons.count(); index += 1) {
      const candidate = actionButtons.nth(index);
      const accessible = `${await candidate.getAttribute('aria-label') ?? ''} ${await candidate.getAttribute('title') ?? ''}`;
      if (/more|menu|action|option/i.test(accessible)) {
        menuButton = candidate;
        break;
      }
    }

    if (menuButton) {
      await menuButton.click();
    } else {
      await this.openFlowByExactName(name);
    }

    const deleteControl = this.page
      .getByRole('menuitem', { name: /delete|remove/i })
      .or(this.page.getByRole('button', { name: /delete|remove/i }))
      .first();
    await expect(
      deleteControl,
      `No delete control was exposed for owned Flow: ${name}`,
    ).toBeVisible();
    await deleteControl.click();

    const confirm = this.page
      .getByRole('button', { name: /delete|remove/i })
      .last();
    await expect(confirm).toBeVisible();
    const confirmationInput = this.page.getByRole('textbox', {
      name: `Type ${name} to confirm`,
      exact: true,
    });
    await expect(confirmationInput).toBeVisible();
    await confirmationInput.fill(name);
    await expect(confirm).toBeEnabled();
    const responsePromise = this.page.waitForResponse((response) => {
      const path = new URL(response.url()).pathname;
      return response.request().method() === 'DELETE' &&
        (!expectedId || path.endsWith(`/${expectedId}`));
    });
    await confirm.click();
    const response = await responsePromise;
    const url = new URL(response.url());
    let requestKeys: string[] = [];
    let responseKeys: string[] = [];
    let responseBody: Record<string, unknown> = {};
    try {
      const requestBody = response.request().postDataJSON() as Record<string, unknown>;
      requestKeys = Object.keys(requestBody).sort();
    } catch {
      // DELETE requests may have no body.
    }
    try {
      responseBody = (await response.json()) as Record<string, unknown>;
      responseKeys = Object.keys(responseBody).sort();
    } catch {
      // A successful deletion may return no JSON body.
    }

    await this.navigateFromHome();
    await this.searchInput.fill(name);
    await expect(this.page.getByText(name, { exact: true })).toHaveCount(0, {
      timeout: 30_000,
    });
    return {
      method: response.request().method(),
      path: `${url.pathname}${url.search}`,
      status: response.status(),
      requestKeys,
      responseKeys,
      ...(typeof responseBody._id === 'string' ? { id: responseBody._id } : {}),
      ...(typeof responseBody.name === 'string' ? { name: responseBody.name } : {}),
    };
  }
}
