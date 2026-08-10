import { expect, type Locator, type Page } from '@playwright/test';

import type { ConnectorInfo } from '../test-data/connectorInfo';
import {
  APPROVED_READ_ONLY_CAPABILITIES,
  type ApprovedReadOnlyCapability,
  type ConnectorActionAvailability,
} from '../test-data/connectorCapability';
import { BasePage } from './base.page';

const CONNECTORS_PATH = '/connect/connectors';
const CONNECTOR_CARD_SELECTOR = '[data-testid^="connector-card-"]';
const CONNECTOR_NAME_SELECTOR = 'img[alt$=" logo"]';

/** UI interactions and runtime discovery for the Fabric Connectors page. */
export class ConnectorsPage extends BasePage {
  private readonly navigationButton: Locator;
  private readonly heading: Locator;
  private readonly connectorCountSummary: Locator;
  private readonly connectorCards: Locator;
  private readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.navigationButton = page.getByTestId('nav-connect/connectors');
    this.heading = page.getByRole('heading', {
      name: 'Connectors',
      exact: true,
    });
    this.connectorCountSummary = page.getByTestId('connector-count');
    this.connectorCards = page.locator(CONNECTOR_CARD_SELECTOR);
    this.searchInput = page.getByTestId('connector-search');
  }

  /** Opens the verified Connectors route directly. */
  override async goto(): Promise<void> {
    try {
      await this.page.goto(CONNECTORS_PATH);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/ERR_CONNECTION_(?:CLOSED|RESET)|ERR_NETWORK_CHANGED/.test(error.message)
      ) {
        throw error;
      }
      await this.page.goto(CONNECTORS_PATH);
    }
    await this.waitForReady();
  }

  /** Opens Home and follows the verified Connectors navigation control. */
  async navigateFromHome(): Promise<void> {
    await this.page.goto('/');
    await expect(this.navigationButton).toBeVisible({ timeout: 30_000 });
    await this.navigationButton.click();
    await expect(this.page).toHaveURL(new RegExp(`${CONNECTORS_PATH}/?$`), {
      timeout: 30_000,
    });
    await this.waitForReady();
  }

  /** Reconstructs the list after UI overlays that unmount the card shell. */
  async reloadList(): Promise<void> {
    await this.page.goto(CONNECTORS_PATH, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** Waits for the page shell and asynchronous connector count to render. */
  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${CONNECTORS_PATH}/?$`));
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await expect(this.searchInput).toBeVisible({ timeout: 30_000 });
    await expect(this.connectorCountSummary).toBeVisible({ timeout: 30_000 });
    await expect(
      this.connectorCards.first(),
      'Connector summary loaded, but connector cards did not render.',
    ).toBeVisible({ timeout: 30_000 });
  }

  getConnectorCards(): Locator {
    return this.connectorCards;
  }

  async getConnectorCount(): Promise<number> {
    return this.connectorCards.count();
  }

  async getConnectorNames(): Promise<string[]> {
    const cards = await this.connectorCards.all();

    return Promise.all(cards.map((card) => this.readConnectorName(card)));
  }

  async getConnectors(): Promise<ConnectorInfo[]> {
    const cards = await this.connectorCards.all();

    return Promise.all(
      cards.map(async (card) => {
        const testId = await card.getAttribute('data-testid');
        const runtimeId = testId?.replace(/^connector-card-/, '').trim() ?? '';
        const name = await this.readConnectorName(card);
        const description = await this.readOptionalText(card.locator('p').first());
        const status = await this.readOptionalText(card.locator('span').first());

        return {
          runtimeId,
          name,
          ...(description ? { description } : {}),
          ...(status ? { status } : {}),
        };
      }),
    );
  }

  getConnectorByName(name: string): Locator {
    return this.page
      .getByAltText(`${name} logo`, { exact: true })
      .locator(
        'xpath=ancestor::*[starts-with(@data-testid, "connector-card-")][1]',
      );
  }

  /** Opens the connector editor exposed by its card. */
  async openConnector(name: string, runtimeId?: string): Promise<void> {
    const connector = this.resolveConnector(name, runtimeId);
    await expect(connector, `Connector card not found: ${name}`).toHaveCount(1, {
      timeout: 30_000,
    });
    await connector.getByRole('button', { name: 'Edit', exact: true }).click();
  }

  async getAvailableActions(
    name: string,
    runtimeId?: string,
  ): Promise<ConnectorActionAvailability[]> {
    const connector = this.resolveConnector(name, runtimeId);
    await expect(connector, `Connector card not found: ${name}`).toHaveCount(1, {
      timeout: 30_000,
    });

    return connector.getByRole('button').evaluateAll((buttons) =>
      buttons
        .map((button) => ({
          name: button.textContent?.trim().replace(/\s+/g, ' ') ?? '',
          available: !(button as HTMLButtonElement).disabled,
        }))
        .filter((action) => action.name.length > 0),
    );
  }

  /** Opens the menu for inspection only and dismisses it without selection. */
  async getOverflowActions(
    name: string,
    runtimeId?: string,
  ): Promise<ConnectorActionAvailability[]> {
    const connector = this.resolveConnector(name, runtimeId);
    await expect(connector, `Connector card not found: ${name}`).toHaveCount(1, {
      timeout: 30_000,
    });
    const menuButton = connector.getByRole('button', {
      name: `More actions for ${name}`,
      exact: true,
    });
    const menu = this.page.getByRole('menu');

    await menuButton.click();
    await expect(menu).toBeVisible();
    try {
      return await menu.getByRole('menuitem').evaluateAll((items) =>
        items.map((item) => ({
          name: item.textContent?.trim().replace(/\s+/g, ' ') ?? '',
          available:
            item.getAttribute('aria-disabled') !== 'true' &&
            !item.hasAttribute('disabled'),
        })),
      );
    } finally {
      await this.page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    }
  }

  /** Executes only the explicitly approved, verified read-only menu actions. */
  async openReadOnlyCapability(
    connectorName: string,
    capability: ApprovedReadOnlyCapability,
    connectorRuntimeId?: string,
  ): Promise<void> {
    if (!APPROVED_READ_ONLY_CAPABILITIES.includes(capability)) {
      throw new Error(`Capability is not approved for execution: ${capability}`);
    }

    const connector = this.resolveConnector(connectorName, connectorRuntimeId);
    await expect(
      connector,
      `Connector card not found: ${connectorName}`,
    ).toHaveCount(1, { timeout: 30_000 });
    await connector
      .getByRole('button', {
        name: `More actions for ${connectorName}`,
        exact: true,
      })
      .click();

    const action = this.page.getByRole('menuitem', {
      name: capability,
      exact: true,
    });
    await expect(action).toBeVisible();
    await expect(action).toBeEnabled();
    await action.click();
  }

  private async readConnectorName(card: Locator): Promise<string> {
    const logoAlt = await card.locator(CONNECTOR_NAME_SELECTOR).getAttribute('alt');
    return logoAlt?.replace(/\s+logo$/i, '').trim() ?? '';
  }

  private resolveConnector(name: string, runtimeId?: string): Locator {
    return runtimeId
      ? this.page.getByTestId(`connector-card-${runtimeId}`)
      : this.getConnectorByName(name);
  }

  private async readOptionalText(locator: Locator): Promise<string | undefined> {
    if ((await locator.count()) === 0) {
      return undefined;
    }

    const value = (await locator.textContent())?.trim();
    return value || undefined;
  }
}
