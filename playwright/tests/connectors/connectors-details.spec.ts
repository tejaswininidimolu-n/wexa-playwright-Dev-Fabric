import { test, expect } from '../../fixtures/authenticated.fixture';
import { ConnectorDetailsPage } from '../../pages/ConnectorDetailsPage';
import { ConnectorsPage } from '../../pages/ConnectorsPage';

test.describe('Connector details @functional', () => {
  test('validates every discovered connector details modal @regression', async ({
    page,
  }, testInfo) => {
    // Exhaustively reopening 11 connector dialogs is API-bound and exceeds the
    // default budget when this spec shares the dev environment with other workers.
    test.setTimeout(300_000);

    const connectorsPage = new ConnectorsPage(page);
    const detailsPage = new ConnectorDetailsPage(page);
    const failures: string[] = [];
    let validatedCount = 0;

    await connectorsPage.navigateFromHome();
    const connectors = await connectorsPage.getConnectors();

    expect(
      connectors.length,
      'Connectors page loaded, but no connector cards were rendered.',
    ).toBeGreaterThan(0);

    for (const [index, connector] of connectors.entries()) {
      try {
        await test.step(`Validate connector: ${connector.name}`, async () => {
          if (index > 0) await connectorsPage.reloadList();
          expect(connector.name.trim(), 'Connector card name must not be empty.').not
            .toBe('');
          expect(
            connector.status,
            `Connector card status is missing for ${connector.name}.`,
          ).toBeTruthy();

          await connectorsPage.openConnector(connector.name);
          await detailsPage.expectLoaded(connector.name);

          const detailsName = await detailsPage.getDetailsConnectorName();
          expect(detailsName).toBe(connector.name);

          const configurationFields =
            await detailsPage.getConfigurationFieldLabels();
          const triggerFields = await detailsPage.getTriggerLabels();

          console.log(
            `${connector.name}: status=${connector.status}; ` +
              `configuration fields=${configurationFields.length}; ` +
              `triggers=${triggerFields.length}`,
          );
          if (configurationFields.length === 0) {
            console.log(`${connector.name}: no editable configuration fields`);
          }
          if (triggerFields.length === 0) {
            console.log(`${connector.name}: no attachable event triggers`);
          }

          validatedCount += 1;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${connector.name}: ${message}`);

        if (!page.isClosed()) {
          await testInfo.attach(`connector-details-${connector.name}-diagnostics`, {
            body: JSON.stringify(
              {
                connector: connector.name,
                url: page.url(),
                title: await page.title().catch(() => '<unavailable>'),
                modalDom: await detailsPage
                  .getDiagnosticDom()
                  .catch(() => '<details DOM unavailable>'),
              },
              null,
              2,
            ),
            contentType: 'application/json',
          });
          const screenshot = await page.screenshot({ fullPage: true }).catch(() => undefined);
          if (screenshot) {
            await testInfo.attach(`connector-details-${connector.name}-screenshot`, {
              body: screenshot,
              contentType: 'image/png',
            });
          }
        }

        if (!page.isClosed() && await detailsPage.isOpen().catch(() => false)) {
          await detailsPage.goBackToConnectors().catch(() => undefined);
        }
        if (!page.isClosed() && !page.url().match(/\/connect\/connectors\/?$/)) {
          await connectorsPage.goto().catch(() => undefined);
        }
      }
    }

    console.log(
      `Connector details summary: discovered=${connectors.length}; ` +
        `validated=${validatedCount}; failed=${failures.length}`,
    );
    expect(failures, `Connector detail failures:\n${failures.join('\n')}`).toEqual(
      [],
    );
  });
});
