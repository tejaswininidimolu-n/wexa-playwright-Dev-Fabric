import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

/** Result-state validation for approved read-only connector capabilities. */
export class ConnectorCapabilityPage extends BasePage {
  private readonly pipelineDialog: Locator;

  constructor(page: Page) {
    super(page);
    this.pipelineDialog = page.getByRole('dialog');
  }

  async expectOntology(connectorName: string): Promise<string[]> {
    await expect(this.page).toHaveURL(
      /\/context-graph\/cognitive\?.*connectorId=/,
      { timeout: 30_000 },
    );
    await expect(
      this.page.getByRole('heading', { name: 'Ontology Studio', exact: true }),
    ).toBeVisible();
    await expect(
      this.page.getByRole('heading', {
        name: `${connectorName} ontology`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });

    return this.page.getByRole('heading').allTextContents();
  }

  async expectPipeline(connectorName: string): Promise<string> {
    await expect(this.page).toHaveURL(/\/connect\/connectors\/?$/, {
      timeout: 30_000,
    });
    await expect(this.pipelineDialog).toBeVisible({ timeout: 30_000 });
    await expect(
      this.pipelineDialog.getByRole('heading', {
        name: `${connectorName} — pipeline`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      this.pipelineDialog.getByRole('button', { name: 'Close', exact: true }),
    ).toBeVisible();

    return (await this.pipelineDialog.textContent())?.trim().replace(/\s+/g, ' ') ?? '';
  }

  async closePipeline(): Promise<void> {
    await this.pipelineDialog
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await expect(this.pipelineDialog).toBeHidden();
    await expect(this.page.getByTestId('connector-count')).toBeVisible();
  }

  async expectDataAssets(connectorRuntimeId: string): Promise<string[]> {
    await expect(this.page).toHaveURL(
      (url) => {
        return (
          url.pathname === '/connect/catalog' &&
          url.searchParams.get('q') === connectorRuntimeId
        );
      },
      { timeout: 30_000 },
    );
    await expect(
      this.page.getByRole('heading', { name: 'Data Catalog', exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    return this.page.getByRole('heading').allTextContents();
  }

  async returnToConnectors(): Promise<void> {
    await this.page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/\/connect\/connectors\/?$/);
    await expect(this.page.getByTestId('connector-count')).toBeVisible({
      timeout: 30_000,
    });
  }

  async getSafeDiagnosticDom(): Promise<string> {
    return this.page.locator('main').evaluate((main) => {
      const clone = main.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, textarea').forEach((field) => {
        field.removeAttribute('value');
        field.textContent = '';
      });
      return clone.outerHTML;
    });
  }
}
