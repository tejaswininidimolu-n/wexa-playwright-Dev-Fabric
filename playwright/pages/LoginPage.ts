import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

/**
 * Encapsulates login-page locators and actions for reuse across authenticated
 * feature tests such as Agents, Knowledge Base, Executions, and Connectors.
 */
export class LoginPage extends BasePage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel('Email', { exact: true });
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    this.errorMessage = page.locator('[class*="bg-cs-error-bg"]');
  }

  /** Opens the login page at the supplied environment URL. */
  async open(): Promise<void> {
    await this.page.goto('/login');
  }

  /** Verifies that the login form is visible and ready for interaction. */
  async expectLoginFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }

  /**
   * Opens the login page, signs in with the supplied credentials using the
   * original Codegen action order, and waits for successful navigation.
   */
  async login(email: string, password: string): Promise<void> {
    await this.attemptLogin(email, password);
    await this.expectLoginSuccessful();
  }

  /** Submits credentials without assuming authentication will succeed. */
  async attemptLogin(email: string, password: string): Promise<void> {
    await this.open();
    await this.expectLoginFormVisible();
    await this.emailInput.click();
    await this.emailInput.fill(email);
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  /** Verifies that successful authentication navigated away from login. */
  async expectLoginSuccessful(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login\/?(?:[?#].*)?$/, {
      timeout: 15_000,
    });
  }

  /** Verifies that rejected credentials produce a visible error and no login. */
  async expectLoginRejected(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\/?(?:[?#].*)?$/);
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).not.toBeEmpty();
  }

  /** Submits an untouched form so browser-required validation can run. */
  async submitEmptyForm(): Promise<void> {
    await this.open();
    await this.expectLoginFormVisible();
    await this.signInButton.click();
  }

  /** Verifies native required-field validation for both login inputs. */
  async expectRequiredFieldValidation(): Promise<void> {
    expect(
      await this.emailInput.evaluate((input: HTMLInputElement) =>
        input.validity.valueMissing,
      ),
    ).toBe(true);
    expect(
      await this.passwordInput.evaluate((input: HTMLInputElement) =>
        input.validity.valueMissing,
      ),
    ).toBe(true);
    await expect(this.page).toHaveURL(/\/login\/?(?:[?#].*)?$/);
  }

  /** Verifies native email-format validation without submitting credentials. */
  async expectInvalidEmailValidation(): Promise<void> {
    expect(
      await this.emailInput.evaluate((input: HTMLInputElement) =>
        input.validity.typeMismatch,
      ),
    ).toBe(true);
    await expect(this.page).toHaveURL(/\/login\/?(?:[?#].*)?$/);
  }
}
