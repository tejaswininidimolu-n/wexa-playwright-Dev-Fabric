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

  getMenuButtons(): Locator {
    return this.menuButtons;
  }

  getCloneButtons(): Locator {
    return this.cloneButtons;
  }
}
