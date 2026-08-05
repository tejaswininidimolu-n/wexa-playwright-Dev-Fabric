import { test } from '../fixtures/base.fixture';
import { LoginPage } from '../pages/LoginPage';
import { loginData } from '../test-data/loginData';

test.describe('Login', () => {
  test('signs in with valid credentials @smoke @regression', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.login(loginData.email, loginData.password);
  });

  test('rejects an incorrect password @regression', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.attemptLogin(loginData.email, loginData.invalidPassword);
    await loginPage.expectLoginRejected();
  });

  test('requires email and password @regression', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.submitEmptyForm();
    await loginPage.expectRequiredFieldValidation();
  });

  test('rejects an invalid email format @regression', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.attemptLogin(loginData.invalidEmail, loginData.password);
    await loginPage.expectInvalidEmailValidation();
  });
});
