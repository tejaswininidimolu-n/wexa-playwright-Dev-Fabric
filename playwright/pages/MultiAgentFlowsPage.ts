import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

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
    await this.page.goto('/');
    await this.navigationButton.click();
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

  async cancelCreateForm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(this.getCreateSubmitButton()).toHaveCount(1);
  }
}
