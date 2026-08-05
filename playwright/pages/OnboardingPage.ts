import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

/**
 * Encapsulates the post-signup onboarding actions for creating a department
 * and a project while keeping their locators out of the test specification.
 */
export class OnboardingPage extends BasePage {
  private readonly createDepartmentButton: Locator;
  private readonly departmentNameInput: Locator;
  private readonly submitDepartmentButton: Locator;
  private readonly createProjectButton: Locator;
  private readonly projectNameInput: Locator;
  private readonly submitProjectButton: Locator;

  constructor(page: Page) {
    super(page);
    this.createDepartmentButton = page.getByTestId('onboarding-create-department');
    this.departmentNameInput = page.getByTestId('onboarding-department-name');
    this.submitDepartmentButton = page.getByTestId('onboarding-department-submit');
    this.createProjectButton = page.getByTestId('onboarding-create-project');
    this.projectNameInput = page.getByRole('textbox', {
      name: 'e.g. Customer Success',
    });
    this.submitProjectButton = page.getByRole('button', { name: 'Create' });
  }

  /** Verifies that account creation advanced to department onboarding. */
  async expectDepartmentOnboardingVisible(): Promise<void> {
    await expect(this.createDepartmentButton).toBeVisible({ timeout: 15_000 });
  }

  /** Creates a department using the original Codegen interaction sequence. */
  async createDepartment(departmentName: string): Promise<void> {
    await this.createDepartmentButton.click();
    await this.departmentNameInput.fill(departmentName);
    await this.submitDepartmentButton.click();
  }

  /** Verifies that department creation advanced to project onboarding. */
  async expectProjectOnboardingVisible(): Promise<void> {
    await expect(this.createProjectButton).toBeVisible({ timeout: 15_000 });
  }

  /** Creates a project using the original Codegen interaction sequence. */
  async createProject(projectName: string): Promise<void> {
    await this.createProjectButton.click();
    await this.projectNameInput.click();
    await this.projectNameInput.fill(projectName);
    await expect(this.projectNameInput).toHaveValue(projectName);
    await this.submitProjectButton.click();
  }
}
