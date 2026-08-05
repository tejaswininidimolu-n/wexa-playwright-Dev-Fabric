import type { Page } from '@playwright/test';

/**
 * Base class for shared, application-agnostic page-object behavior.
 * Feature page objects should extend this class instead of duplicating setup.
 */
export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  /** Opens a path relative to the baseURL configured for the test run. */
  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }
}

