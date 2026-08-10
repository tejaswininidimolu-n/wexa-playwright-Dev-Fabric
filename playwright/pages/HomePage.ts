import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

/**
 * Encapsulates Home experience actions such as Learn Mode and API integration
 * walkthrough navigation.
 */
export class HomePage extends BasePage {
  private readonly learnModeButton: Locator;
  private readonly apiIntegrationStepsButton: Locator;
  private readonly backButton: Locator;
  private readonly headerCloseIconButton: Locator;
  private readonly learnModeTopicInput: Locator;
  private readonly learnModeSubmitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.learnModeButton = page.getByRole('button', { name: /Learn Mode/i });
    this.apiIntegrationStepsButton = page.getByRole('button', {
      name: /API integration steps/i,
    });
    this.backButton = page.getByRole('button', { name: 'Back', exact: true });
    this.headerCloseIconButton = page
      .locator('header')
      .getByRole('button')
      .filter({ hasText: /^$/ })
      .first();
    this.learnModeTopicInput = page.getByRole('textbox', {
      name: /Enter a topic/i,
    });
    this.learnModeSubmitButton = page
      .locator('#main-content')
      .getByRole('button')
      .filter({ hasText: /^$/ })
      .first();
  }

  /** Verifies that the Home page is visible after successful authentication. */
  async expectHomePageDisplayed(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login\/?(?:[?#].*)?$/);
    await expect(this.learnModeButton).toBeVisible();
  }

  /** Opens Learn Mode from Home. */
  async openLearnMode(): Promise<void> {
    await this.learnModeButton.click();
    await expect(this.apiIntegrationStepsButton).toBeVisible();
  }

  /** Opens the API Integration Steps content under Learn Mode. */
  async openApiIntegrationSteps(): Promise<void> {
    await this.apiIntegrationStepsButton.click();
    await expect(this.backButton).toBeVisible();
    await expect(this.learnModeTopicInput).toHaveValue(/api integration steps/i);
    await expect(this.learnModeSubmitButton).toBeVisible();
  }

  /** Navigates back from API Integration Steps to the Home page. */
  async navigateBackToHome(): Promise<void> {
    await this.backButton.click();
    await this.expectHomePageDisplayed();
  }

  /** Closes open Learn Mode overlays/dialogs if present. */
  async closeOpenDialog(): Promise<void> {
    if (await this.headerCloseIconButton.isVisible()) {
      await this.headerCloseIconButton.click();
    } else {
      await this.backButton.click();
    }

    await this.expectHomePageDisplayed();
  }
}