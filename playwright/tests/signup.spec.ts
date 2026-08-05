import { test } from '../fixtures/base.fixture';
import { OnboardingPage } from '../pages/OnboardingPage';
import { SignupPage } from '../pages/SignupPage';
import { createSignupData } from '../test-data/signupData';
import { loginData } from '../test-data/loginData';

test.describe('Signup', () => {
  test('creates an account, department, and project @smoke @regression', async ({
    page,
  }) => {
    const signupPage = new SignupPage(page);
    const onboardingPage = new OnboardingPage(page);
    const signupData = createSignupData();

    await signupPage.openLoginPage(signupData.loginUrl);
    await signupPage.expectSignupLinkVisible();
    await signupPage.openSignupForm();
    await signupPage.expectSignupFormVisible();
    await signupPage.fillSignupForm(signupData.account);
    await signupPage.expectSignupDetails(signupData.account);
    await signupPage.createAccount();

    await onboardingPage.expectDepartmentOnboardingVisible();
    await onboardingPage.createDepartment(signupData.onboarding.departmentName);
    await onboardingPage.expectProjectOnboardingVisible();
    await onboardingPage.createProject(signupData.onboarding.projectName);
  });

  test('rejects mismatched passwords @regression', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const signupData = createSignupData({ confirmPassword: 'Different@123' });

    await signupPage.openLoginPage(signupData.loginUrl);
    await signupPage.openSignupForm();
    await signupPage.fillSignupForm(signupData.account);
    await signupPage.createAccount();
    await signupPage.expectPasswordMismatch();
  });

  test('rejects an already registered email @regression', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const signupData = createSignupData({ email: loginData.email });

    await signupPage.openLoginPage(signupData.loginUrl);
    await signupPage.openSignupForm();
    await signupPage.fillSignupForm(signupData.account);
    await signupPage.createAccount();
    await signupPage.expectDuplicateEmailRejected();
  });

  test('requires mandatory fields @regression', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const signupData = createSignupData();

    await signupPage.openLoginPage(signupData.loginUrl);
    await signupPage.openSignupForm();
    await signupPage.createAccount();
    await signupPage.expectRequiredFieldValidation();
  });

  test('rejects an invalid email format @regression', async ({ page }) => {
    const signupPage = new SignupPage(page);
    const signupData = createSignupData({ email: loginData.invalidEmail });

    await signupPage.openLoginPage(signupData.loginUrl);
    await signupPage.openSignupForm();
    await signupPage.fillSignupForm(signupData.account);
    await signupPage.createAccount();
    await signupPage.expectInvalidEmailValidation();
  });
});
