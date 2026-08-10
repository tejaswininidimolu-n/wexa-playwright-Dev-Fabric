import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

/** Account details required by the signup form. */
export interface SignupDetails {
  readonly firstName: string;
  readonly lastName: string;
  readonly organizationName: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

/**
 * Encapsulates the signup page locators and actions so signup tests remain
 * focused on user behavior rather than page implementation details.
 */
export class SignupPage extends BasePage {
  private readonly signupLink: Locator;
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly organizationNameInput: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly createAccountButton: Locator;
  private readonly passwordMismatchMessage: Locator;
  private readonly duplicateEmailMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.signupLink = page.getByRole('link', { name: 'Sign up' });
    this.firstNameInput = page.getByRole('textbox', { name: 'First Name' });
    this.lastNameInput = page.getByRole('textbox', { name: 'Last Name' });
    this.organizationNameInput = page.getByRole('textbox', {
      name: 'Organization Name',
    });
    this.emailInput = page.getByLabel('Email', { exact: true });
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirm Password', {
      exact: true,
    });
    this.createAccountButton = page.getByRole('button', {
      name: 'Create Account',
    });
    this.passwordMismatchMessage = page.getByText('Passwords do not match', {
      exact: true,
    });
    this.duplicateEmailMessage = page.getByText(
      /already\s+(registered|exists)|email.*already/i,
    );
  }

  /** Opens the login page used as the entry point to the signup workflow. */
  async openLoginPage(): Promise<void> {
    await this.page.goto('/login');
  }

  /** Verifies that the signup entry point is available to the user. */
  async expectSignupLinkVisible(): Promise<void> {
    await expect(this.signupLink).toBeVisible();
  }

  /** Opens the signup form from the login page. */
  async openSignupForm(): Promise<void> {
    await this.signupLink.click();
  }

  /** Verifies that the signup form is ready for input. */
  async expectSignupFormVisible(): Promise<void> {
    await expect(this.firstNameInput).toBeVisible();
    await expect(this.createAccountButton).toBeVisible();
  }

  /** Enters all account details using the original Codegen interaction order. */
  async fillSignupForm(details: SignupDetails): Promise<void> {
    await this.firstNameInput.click();
    await this.firstNameInput.fill(details.firstName);
    await this.lastNameInput.click();
    await this.lastNameInput.fill(details.lastName);
    await this.organizationNameInput.click();
    await this.organizationNameInput.fill(details.organizationName);
    await this.emailInput.click();
    await this.emailInput.fill(details.email);
    await this.passwordInput.click();
    await this.passwordInput.fill(details.password);
    await this.confirmPasswordInput.click();
    await this.confirmPasswordInput.fill(details.confirmPassword);
  }

  /** Verifies that all signup values were entered correctly. */
  async expectSignupDetails(details: SignupDetails): Promise<void> {
    await expect(this.firstNameInput).toHaveValue(details.firstName);
    await expect(this.lastNameInput).toHaveValue(details.lastName);
    await expect(this.organizationNameInput).toHaveValue(details.organizationName);
    await expect(this.emailInput).toHaveValue(details.email);
    await expect(this.passwordInput).toHaveValue(details.password);
    await expect(this.confirmPasswordInput).toHaveValue(details.confirmPassword);
  }

  /** Submits the completed signup form. */
  async createAccount(): Promise<void> {
    await this.createAccountButton.click();
  }

  /** Verifies client-side rejection when password confirmation differs. */
  async expectPasswordMismatch(): Promise<void> {
    await expect(this.passwordMismatchMessage).toBeVisible();
    await expect(this.createAccountButton).toBeEnabled();
  }

  /** Verifies that an existing email cannot create another account. */
  async expectDuplicateEmailRejected(): Promise<void> {
    await expect(this.duplicateEmailMessage).toBeVisible();
    await expect(this.createAccountButton).toBeEnabled();
  }

  /** Verifies native required validation on the mandatory signup fields. */
  async expectRequiredFieldValidation(): Promise<void> {
    const requiredInputs = [
      this.organizationNameInput,
      this.emailInput,
      this.passwordInput,
      this.confirmPasswordInput,
    ];

    for (const input of requiredInputs) {
      expect(
        await input.evaluate((element: HTMLInputElement) =>
          element.validity.valueMissing,
        ),
      ).toBe(true);
    }
  }

  /** Verifies native validation for a malformed email address. */
  async expectInvalidEmailValidation(): Promise<void> {
    expect(
      await this.emailInput.evaluate((input: HTMLInputElement) =>
        input.validity.typeMismatch,
      ),
    ).toBe(true);
    await expect(this.createAccountButton).toBeEnabled();
  }
}
