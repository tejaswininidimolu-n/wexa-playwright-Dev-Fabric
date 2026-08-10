import { test, expect } from '../../fixtures/authenticated.fixture';
import { ConnectorCapabilityPage } from '../../pages/ConnectorCapabilityPage';
import { ConnectorDetailsPage } from '../../pages/ConnectorDetailsPage';
import { ConnectorsPage } from '../../pages/ConnectorsPage';
import {
  APPROVED_READ_ONLY_CAPABILITIES,
  classifyConnectorCapability,
  type ApprovedReadOnlyCapability,
} from '../../test-data/connectorCapability';

interface ConnectorReadOnlyResult {
  readonly connectorName: string;
  readonly discovered: string[];
  readonly executed: string[];
  readonly skipped: string[];
  readonly failures: string[];
}

test.describe('Safe read-only connector capabilities', () => {
  test('executes only approved read-only capabilities @regression', async ({
    page,
  }, testInfo) => {
    test.setTimeout(900_000);

    const discoveryPage = new ConnectorsPage(page);
    const results: ConnectorReadOnlyResult[] = [];
    const mutationRequests: string[] = [];

    await discoveryPage.navigateFromHome();
    const connectors = await discoveryPage.getConnectors();
    expect(connectors.length).toBeGreaterThan(0);

    for (const connector of connectors) {
      const connectorPage = await page.context().newPage();
      const connectorsPage = new ConnectorsPage(connectorPage);
      const detailsPage = new ConnectorDetailsPage(connectorPage);
      const capabilityPage = new ConnectorCapabilityPage(connectorPage);
      const discovered = new Set<string>();
      const executed: string[] = [];
      const skipped: string[] = [];
      const failures: string[] = [];

      await connectorsPage.goto();

      connectorPage.on('request', (request) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
          mutationRequests.push(
            `${request.method()} ${new URL(request.url()).pathname}`,
          );
        }
      });

      await test.step(`Validate ${connector.name}`, async () => {
        await connectorsPage.waitForReady();
        const overflowActions = await connectorsPage.getOverflowActions(
          connector.name,
          connector.runtimeId,
        );
        overflowActions
          .filter(
            (action) =>
              action.available &&
              classifyConnectorCapability(action.name) === 'read-only',
          )
          .forEach((action) => discovered.add(action.name));

        for (const capability of APPROVED_READ_ONLY_CAPABILITIES) {
          const available = overflowActions.some(
            (action) => action.name === capability && action.available,
          );
          if (!available) {
            skipped.push(`${capability} (unavailable)`);
            continue;
          }

          await test.step(capability, async () => {
            const requestStart = mutationRequests.length;
            try {
              await connectorsPage.openReadOnlyCapability(
                connector.name,
                capability,
                connector.runtimeId,
              );
              await validateCapability(
                capability,
                connector.name,
                connector.runtimeId,
                capabilityPage,
              );
              executed.push(capability);

              if (capability === 'View pipeline') {
                await capabilityPage.closePipeline();
                executed.push('Close');
              } else {
                await capabilityPage.returnToConnectors();
              }
              await connectorsPage.waitForReady();

              expect(
                mutationRequests.slice(requestStart),
                `${capability} emitted a non-read-only network request.`,
              ).toEqual([]);
              await expect(connectorPage).not.toHaveURL(/\/login\/?$/);
              console.log(`${connector.name}: ${capability} passed`);
            } catch (error) {
              const failure = `${capability}: ${
                error instanceof Error ? error.message : error
              }`;
              failures.push(failure);
              console.error(`${connector.name}: ${failure}`);
              await capabilityPage.returnToConnectors().catch(async () => {
                await connectorsPage.navigateFromHome().catch(() => undefined);
              });
            }
          });
        }

        await test.step('Cancel', async () => {
          try {
            await connectorsPage.openConnector(
              connector.name,
              connector.runtimeId,
            );
            await detailsPage.expectLoaded(connector.name);
            const modalActions = await detailsPage.getAvailableActions();
            modalActions
              .filter(
                (action) =>
                  action.available &&
                  classifyConnectorCapability(action.name) === 'read-only',
              )
              .forEach((action) => discovered.add(action.name));

            await detailsPage.cancel();
            executed.push('Cancel');
          } catch (error) {
            failures.push(`Cancel: ${error instanceof Error ? error.message : error}`);
            if (await detailsPage.isOpen().catch(() => false)) {
              await detailsPage.cancel().catch(() => undefined);
            }
          }
        });

        if (discovered.has('Show')) {
          skipped.push('Show (credential exposure)');
        }
      });

      results.push({
        connectorName: connector.name,
        discovered: [...discovered],
        executed,
        skipped,
        failures,
      });

      if (failures.length > 0) {
        const safeName = connector.name.replace(/[^a-z0-9_-]+/gi, '-');
        await testInfo.attach(`readonly-${safeName}-diagnostics`, {
          body: JSON.stringify(
            {
              connector: connector.name,
              url: connectorPage.url(),
              title: await connectorPage.title().catch(() => '<unavailable>'),
              discovered: [...discovered],
              executed,
              skipped,
              failures,
              mainDom: await capabilityPage
                .getSafeDiagnosticDom()
                .catch(() => '<main DOM unavailable>'),
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
        const screenshot = await connectorPage
          .screenshot({ fullPage: true, timeout: 10_000 })
          .catch(() => undefined);
        if (screenshot) {
          await testInfo.attach(`readonly-${safeName}-screenshot`, {
            body: screenshot,
            contentType: 'image/png',
          });
        }
      }

      await connectorPage.close();
    }

    const allFailures = results.flatMap((result) =>
      result.failures.map((failure) => `${result.connectorName}: ${failure}`),
    );
    const executionCount = results.reduce(
      (total, result) => total + result.executed.length,
      0,
    );

    console.log('\nREAD-ONLY CAPABILITY RESULTS');
    results.forEach((result) =>
      console.log(
        `${result.connectorName}: executed=[${result.executed.join(', ')}]; ` +
          `skipped=[${result.skipped.join(', ')}]; failures=${result.failures.length}`,
      ),
    );
    console.log(`Total read-only executions: ${executionCount}`);

    expect(mutationRequests, 'Read-only testing emitted mutation requests.').toEqual(
      [],
    );
    expect(
      allFailures,
      `Read-only capability failures:\n${allFailures.join('\n')}`,
    ).toEqual([]);
  });
});

async function validateCapability(
  capability: ApprovedReadOnlyCapability,
  connectorName: string,
  connectorRuntimeId: string,
  capabilityPage: ConnectorCapabilityPage,
): Promise<void> {
  switch (capability) {
    case 'View ontology':
      await capabilityPage.expectOntology(connectorName);
      return;
    case 'View pipeline':
      await capabilityPage.expectPipeline(connectorName);
      return;
    case 'Browse data assets':
      await capabilityPage.expectDataAssets(connectorRuntimeId);
  }
}
