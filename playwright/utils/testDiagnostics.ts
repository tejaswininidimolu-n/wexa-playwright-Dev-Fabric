import type { Page, TestInfo } from '@playwright/test';

/** Attaches safe page context when a UI test fails. */
export async function attachPageDiagnostics(
  page: Page,
  testInfo: TestInfo,
  feature: string,
): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;

  const diagnostics = {
    url: page.url(),
    title: await page.title().catch(() => '<unavailable>'),
    mainText: await page
      .locator('main')
      .innerText({ timeout: 5_000 })
      .catch(() => '<main unavailable>'),
  };
  await testInfo.attach(`${feature}-diagnostics`, {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  });
}
