import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

export const AGENT_TYPES = [
  'Conversational',
  'Task',
  'Voice',
  'Proxy',
  'Interop',
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export interface CreatedAgentResponses {
  shellStatus: number;
  configurationStatus: number;
  shell: Record<string, unknown>;
  configuration: Record<string, unknown>;
}

const AGENTS_PATH = '/orchestrate/agents';
const ACTIVE_FILTER_CLASS = 'bg-purple-600/10';
const ACTIVE_CHOOSER_CLASS = 'border-purple-500';

export class AgentsPage extends BasePage {
  private readonly navigationButton: Locator;
  private readonly heading: Locator;
  private readonly searchInput: Locator;
  private readonly primaryNewAgentButton: Locator;
  private readonly menuButtons: Locator;
  private readonly cloneButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.navigationButton = page.getByTestId('nav-agents');
    this.heading = page.getByRole('heading', { name: 'Agents', exact: true });
    this.searchInput = page.getByPlaceholder('Search agents…', { exact: true });
    this.primaryNewAgentButton = page
      .getByRole('button', { name: 'New agent', exact: true })
      .first();
    this.menuButtons = page.getByTestId('agent-menu');
    this.cloneButtons = page.getByTestId('agent-clone');
  }

  override async goto(): Promise<void> {
    await this.page.goto(AGENTS_PATH);
    await this.waitForReady();
  }

  async navigateFromHome(): Promise<void> {
    await this.page.goto('/');
    await expect(this.navigationButton).toBeVisible({ timeout: 30_000 });
    await this.navigationButton.click();
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${AGENTS_PATH}/?$`));
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await expect(this.searchInput).toBeVisible({ timeout: 30_000 });
    await expect(this.primaryNewAgentButton).toBeVisible({ timeout: 30_000 });
  }

  getAgentCards(): Locator {
    return this.menuButtons.locator(
      'xpath=ancestor::div[contains(@class,"rounded-xl")][1]',
    );
  }

  getAgentCardByName(name: string): Locator {
    return this.getAgentCards().filter({
      has: this.page.getByText(name, { exact: true }),
    });
  }

  async getAgentCount(): Promise<number> {
    await this.waitForAgentCards();
    return this.menuButtons.count();
  }

  async waitForAgentCount(expected: number): Promise<void> {
    await expect(
      this.menuButtons,
      `Expected the Agent list to settle at ${expected} cards.`,
    ).toHaveCount(expected, { timeout: 30_000 });
  }

  async waitForAgentCards(): Promise<void> {
    await expect(
      this.menuButtons.first(),
      'The Agent page loaded but no Agent cards rendered.',
    ).toBeVisible({ timeout: 30_000 });
  }

  async search(name: string): Promise<void> {
    await this.searchInput.fill(name);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  getTypeFilter(type: AgentType | 'All'): Locator {
    return this.page.getByRole('button', { name: type, exact: true }).last();
  }

  async selectTypeFilter(type: AgentType | 'All'): Promise<void> {
    const filter = this.getTypeFilter(type);
    await filter.click();
    await expect(filter).toHaveClass(new RegExp(ACTIVE_FILTER_CLASS));
  }

  async openNewAgentChooser(): Promise<void> {
    await this.primaryNewAgentButton.click();
    await expect(this.getChooserOption('Conversational')).toBeVisible();
    await expect(this.getChooserContinueButton()).toBeVisible();
  }

  getChooserOption(type: AgentType): Locator {
    return this.page
      .getByRole('button', { name: new RegExp(`^${type}`) })
      .first();
  }

  getChooserContinueButton(): Locator {
    return this.page.getByRole('button', { name: 'Continue', exact: true });
  }

  async selectChooserType(type: AgentType): Promise<void> {
    const option = this.getChooserOption(type);
    await option.click();
    await expect(option).toHaveClass(new RegExp(ACTIVE_CHOOSER_CLASS));
  }

  async cancelNewAgentChooser(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(this.getChooserContinueButton()).toBeHidden();
  }

  /** Creates one Conversational Agent from the verified three-step wizard. */
  async createConversationalAgent(
    name: string,
    description: string,
    instructions: string,
  ): Promise<CreatedAgentResponses> {
    await this.openNewAgentChooser();
    await this.selectChooserType('Conversational');
    await this.getChooserContinueButton().click();

    await this.page
      .getByPlaceholder('e.g. De-escalation Agent', { exact: true })
      .fill(name);
    await this.page
      .getByPlaceholder('Short summary — shown on the agent card.', {
        exact: true,
      })
      .fill(description);
    await this.page
      .getByPlaceholder(
        'Describe the job in plain language — this seeds the system prompt.',
        { exact: true },
      )
      .fill(instructions);

    const continueButton = this.page.getByRole('button', {
      name: 'Continue',
      exact: true,
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    const shellResponsePromise = this.page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'POST' &&
        url.pathname === '/data-api/agentflow/'
      );
    });
    const configurationResponsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      /\/data-api\/agentflow\/[^/]+\/skilled$/.test(
        new URL(response.url()).pathname,
      ),
    );

    await this.page
      .getByRole('button', { name: 'Create agent', exact: true })
      .click();
    const [shellResponse, configurationResponse] = await Promise.all([
      shellResponsePromise,
      configurationResponsePromise,
    ]);

    return {
      shellStatus: shellResponse.status(),
      configurationStatus: configurationResponse.status(),
      shell: (await shellResponse.json()) as Record<string, unknown>,
      configuration:
        (await configurationResponse.json()) as Record<string, unknown>,
    };
  }

  /** Deletes only the exact dynamically named Agent supplied by its owner test. */
  async deleteAgentByExactName(name: string): Promise<{
    method: string;
    path: string;
    status: number;
  }> {
    await this.goto();
    await this.search(name);
    const card = this.getAgentCardByName(name);
    await expect(card, `Owned cleanup Agent not found: ${name}`).toHaveCount(1, {
      timeout: 30_000,
    });
    await card.getByTestId('agent-menu').click();
    const deleteItem = this.page
      .getByRole('menuitem', { name: 'Delete agent', exact: true });
    await expect(deleteItem).toBeVisible();
    await deleteItem.click();

    const confirm = this.page
      .getByRole('button', { name: /delete|remove/i })
      .last();
    await expect(confirm).toBeVisible();
    const cleanupResponsePromise = this.page.waitForResponse((response) =>
      response.request().method() !== 'GET' &&
      new URL(response.url()).pathname !==
        '/context-api/api/v1/auth/initialize',
    );
    await confirm.click();
    const cleanupResponse = await cleanupResponsePromise;
    await expect(this.getAgentCardByName(name)).toHaveCount(0, {
      timeout: 30_000,
    });
    const url = new URL(cleanupResponse.url());
    return {
      method: cleanupResponse.request().method(),
      path: `${url.pathname}${url.search}`,
      status: cleanupResponse.status(),
    };
  }

  getMenuButtons(): Locator {
    return this.menuButtons;
  }

  getCloneButtons(): Locator {
    return this.cloneButtons;
  }
}
