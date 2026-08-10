import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';
import type { ConnectorActionAvailability } from '../test-data/connectorCapability';

/** Read-only inspection and navigation for the connector configuration modal. */
export class ConnectorDetailsPage extends BasePage {
  private readonly dialog: Locator;
  private readonly heading: Locator;
  private readonly body: Locator;
  private readonly cancelButton: Locator;
  private readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole('dialog');
    this.heading = this.dialog.getByRole('heading', { level: 2 });
    this.body = this.dialog.getByTestId('connector-modal-body');
    this.cancelButton = this.dialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    this.saveButton = this.dialog.getByRole('button', {
      name: 'Save changes',
      exact: true,
    });
  }

  async expectLoaded(connectorName: string): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 30_000 });
    await expect(this.heading).toHaveText(`Edit ${connectorName}`);
    await expect(this.body).toBeVisible();
    await expect(this.body).toContainText(
      'Connection credentials are loaded from the connector.',
      { timeout: 30_000 },
    );
    await expect(this.cancelButton).toBeVisible();
    await expect(this.saveButton).toBeVisible();
  }

  async getDetailsConnectorName(): Promise<string> {
    const heading = (await this.heading.textContent())?.trim() ?? '';
    return heading.replace(/^Edit\s+/i, '').trim();
  }

  async getConfigurationFieldLabels(): Promise<string[]> {
    return this.getFieldLabels(
      'input:not([type="checkbox"]), select, textarea',
    );
  }

  async getTriggerLabels(): Promise<string[]> {
    return this.getFieldLabels('input[type="checkbox"]');
  }

  async getAvailableActions(): Promise<ConnectorActionAvailability[]> {
    const actions = await this.dialog.getByRole('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        name:
          button.textContent?.trim().replace(/\s+/g, ' ') ||
          button.getAttribute('aria-label') ||
          '',
        available: !(button as HTMLButtonElement).disabled,
      })),
    );

    return actions.filter(
      (action, index) =>
        action.name.length > 0 &&
        actions.findIndex((candidate) => candidate.name === action.name) === index,
    );
  }

  async getConfigurationCapabilities(): Promise<string[]> {
    return this.getConfigurationFieldLabels();
  }

  async getEventTriggers(): Promise<string[]> {
    return this.getTriggerLabels();
  }

  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  /** Closes without saving and returns to the still-mounted connector list. */
  async goBackToConnectors(): Promise<void> {
    await this.cancel();
    await expect(this.page.getByTestId('connector-count')).toBeVisible();
  }

  /** Closes without saving; useful when the containing page will be discarded. */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.dialog).toBeHidden();
  }

  /** Returns a credential-safe copy of the modal DOM for failure attachments. */
  async getDiagnosticDom(): Promise<string> {
    if (!(await this.isOpen())) {
      return '<connector details dialog is not open>';
    }

    return this.dialog.evaluate((dialog) => {
      const clone = dialog.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, textarea').forEach((field) => {
        field.removeAttribute('value');
        field.textContent = '';
      });
      return clone.outerHTML;
    });
  }

  private async getFieldLabels(fieldSelector: string): Promise<string[]> {
    return this.dialog.locator(fieldSelector).evaluateAll((fields) =>
      fields
        .map((field) => {
          const root = field.closest('[role="dialog"]');
          const fieldId = field.getAttribute('id');
          const label = fieldId
            ? root?.querySelector(`label[for="${CSS.escape(fieldId)}"]`)
            : field.closest('label');
          return label?.textContent?.trim().replace(/\s+/g, ' ') ?? '';
        })
        .filter(Boolean),
    );
  }
}
