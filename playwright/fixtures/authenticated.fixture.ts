import {
  test as base,
  expect,
  type BrowserContext,
} from '@playwright/test';

import { LoginPage } from '../pages/LoginPage';
import { loginData } from '../test-data/loginData';
import { getFabricBaseUrl } from '../utils/env';

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

interface AuthenticatedWorkerFixtures {
  authenticatedStorageState: StorageState;
}

/**
 * Fixture for authenticated feature tests. Authentication runs once per worker,
 * then each test receives an isolated browser context initialized from the same
 * storage state. Login behavior tests should continue using base.fixture.ts.
 */
export const test = base.extend<object, AuthenticatedWorkerFixtures>({
  storageState: async ({ authenticatedStorageState }, use) => {
    await use(authenticatedStorageState);
  },

  authenticatedStorageState: [
    async ({ browser }, use) => {
      const context = await browser.newContext({
        baseURL: getFabricBaseUrl(),
        storageState: undefined,
      });
      const page = await context.newPage();
      const loginPage = new LoginPage(page);

      await loginPage.login(loginData.email, loginData.password);
      await use(await context.storageState());
      await context.close();
    },
    { scope: 'worker' },
  ],
});

export { expect };
