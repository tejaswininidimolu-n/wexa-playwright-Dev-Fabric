import { test } from '../../fixtures/base.fixture';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { loginData } from '../../test-data/loginData';

test.describe('Home', () => {
  test('opens Learn Mode and API Integration Steps from Home @smoke @regression', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await loginPage.login(loginData.email, loginData.password);
    await homePage.expectHomePageDisplayed();

    await homePage.openLearnMode();
    await homePage.openApiIntegrationSteps();
    await homePage.closeOpenDialog();

    await homePage.openLearnMode();
    await homePage.openApiIntegrationSteps();
    await homePage.navigateBackToHome();
  });
});