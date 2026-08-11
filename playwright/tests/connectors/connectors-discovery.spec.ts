import { test, expect } from '../../fixtures/authenticated.fixture';
import { ConnectorsPage } from '../../pages/ConnectorsPage';

test.describe('Connector discovery @functional', () => {
  test('discovers visible connectors dynamically @smoke @regression', async ({
    page,
  }, testInfo) => {
    const connectorsPage = new ConnectorsPage(page);

    try {
      await connectorsPage.navigateFromHome();

      const connectorCount = await connectorsPage.getConnectorCount();
      const connectorNames = await connectorsPage.getConnectorNames();

      expect(
        connectorCount,
        'Connectors page loaded, but no connector cards were rendered.',
      ).toBeGreaterThan(0);
      expect(connectorNames).toHaveLength(connectorCount);

      const emptyNames = connectorNames.filter((name) => name.trim().length === 0);
      expect(
        emptyNames,
        'Every rendered connector card must expose a non-empty connector name.',
      ).toEqual([]);

      const duplicateNames = connectorNames.filter(
        (name, index) => connectorNames.indexOf(name) !== index,
      );
      expect(
        duplicateNames,
        `Unexpected duplicate connector names: ${[...new Set(duplicateNames)].join(', ')}`,
      ).toEqual([]);

      console.log(`Discovered connectors: ${connectorCount}\n`);
      connectorNames.forEach((name, index) => console.log(`${index + 1}. ${name}`));
    } catch (error) {
      const diagnostics = {
        url: page.url(),
        title: await page.title().catch(() => '<unavailable>'),
        connectorCardCount: await connectorsPage.getConnectorCount().catch(() => -1),
        mainDom: await page
          .locator('main')
          .innerHTML({ timeout: 5_000 })
          .catch(() => '<main element unavailable>'),
      };

      await testInfo.attach('connector-discovery-diagnostics', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('connector-discovery-screenshot', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      throw error;
    }
  });
});
