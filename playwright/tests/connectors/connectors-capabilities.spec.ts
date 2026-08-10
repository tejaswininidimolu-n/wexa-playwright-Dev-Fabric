import { test, expect } from '../../fixtures/authenticated.fixture';
import { ConnectorDetailsPage } from '../../pages/ConnectorDetailsPage';
import { ConnectorsPage } from '../../pages/ConnectorsPage';
import {
  classifyConnectorCapability,
  type ConnectorActionAvailability,
  type ConnectorCapability,
  type ConnectorCapabilityInventory,
  type ConnectorCapabilitySource,
} from '../../test-data/connectorCapability';

function toCapabilities(
  actions: ConnectorActionAvailability[],
  source: ConnectorCapabilitySource,
): ConnectorCapability[] {
  return actions.map((action) => ({
    name: action.name,
    source,
    risk: classifyConnectorCapability(action.name),
    available: action.available,
  }));
}

test.describe('Connector capability detection', () => {
  test('inventories capabilities without executing them @regression', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    const connectorsPage = new ConnectorsPage(page);
    const detailsPage = new ConnectorDetailsPage(page);
    const inventory: ConnectorCapabilityInventory[] = [];
    const failures: string[] = [];

    await connectorsPage.navigateFromHome();
    const connectorNames = await connectorsPage.getConnectorNames();
    expect(connectorNames.length).toBeGreaterThan(0);

    for (const connectorName of connectorNames) {
      let discoveredCapabilities: ConnectorCapability[] = [];

      try {
        await test.step(`Inventory connector: ${connectorName}`, async () => {
          const cardActions = await connectorsPage.getAvailableActions(connectorName);
          const overflowActions =
            await connectorsPage.getOverflowActions(connectorName);

          expect(cardActions.length, 'No connector card actions were detected.').toBeGreaterThan(0);
          expect(
            overflowActions.length,
            'The connector overflow menu contained no actions.',
          ).toBeGreaterThan(0);

          await connectorsPage.openConnector(connectorName);
          await detailsPage.expectLoaded(connectorName);

          const modalActions = await detailsPage.getAvailableActions();
          const configurationFields =
            await detailsPage.getConfigurationCapabilities();
          const eventTriggers = await detailsPage.getEventTriggers();

          discoveredCapabilities = [
            ...toCapabilities(cardActions, 'card'),
            ...toCapabilities(overflowActions, 'overflow-menu'),
            ...toCapabilities(modalActions, 'configuration-modal'),
            {
              name: 'Configuration fields',
              source: 'configuration-fields',
              risk: 'configuration',
              available: configurationFields.length > 0,
              itemCount: configurationFields.length,
            },
            {
              name: 'Event triggers',
              source: 'event-triggers',
              risk: 'state-changing',
              available: eventTriggers.length > 0,
              itemCount: eventTriggers.length,
            },
          ];

          inventory.push({ connectorName, capabilities: discoveredCapabilities });

          const available = discoveredCapabilities.filter(
            (capability) => capability.available,
          );
          const notExecuted = available.filter(
            (capability) =>
              capability.risk === 'state-changing' ||
              capability.risk === 'destructive' ||
              capability.risk === 'unknown',
          );

          console.log(`\n${connectorName}`);
          available.forEach((capability) =>
            console.log(
              `  ${capability.name}: available [${capability.risk}]` +
                (capability.itemCount === undefined
                  ? ''
                  : ` (${capability.itemCount})`),
            ),
          );
          console.log(
            `  Risky actions detected but NOT executed: ${
              notExecuted.map((capability) => capability.name).join(', ') || 'none'
            }`,
          );

          await detailsPage.goBackToConnectors();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${connectorName}: ${message}`);
        const safeName = connectorName.replace(/[^a-z0-9_-]+/gi, '-');

        await testInfo.attach(`capabilities-${safeName}-diagnostics`, {
          body: JSON.stringify(
            {
              connectorName,
              url: page.url(),
              title: await page.title().catch(() => '<unavailable>'),
              discoveredCapabilities,
              modalDom: await detailsPage
                .getDiagnosticDom()
                .catch(() => '<details DOM unavailable>'),
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
        await testInfo.attach(`capabilities-${safeName}-screenshot`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });

        if (await detailsPage.isOpen().catch(() => false)) {
          await detailsPage.goBackToConnectors().catch(() => undefined);
        }
        if (!page.url().match(/\/connect\/connectors\/?$/)) {
          await connectorsPage.goto().catch(() => undefined);
        }
      }
    }

    const availableCapabilities = inventory.flatMap((entry) =>
      entry.capabilities.filter((capability) => capability.available),
    );
    const riskTotals = availableCapabilities.reduce<Record<string, number>>(
      (totals, capability) => ({
        ...totals,
        [capability.risk]: (totals[capability.risk] ?? 0) + 1,
      }),
      {},
    );

    console.log('\nCONNECTOR CAPABILITY INVENTORY');
    console.log(
      `Connectors=${inventory.length}; capabilities=${availableCapabilities.length}; ` +
        `risk totals=${JSON.stringify(riskTotals)}`,
    );

    expect(failures, `Capability inventory failures:\n${failures.join('\n')}`).toEqual(
      [],
    );
    expect(inventory).toHaveLength(connectorNames.length);
  });
});
