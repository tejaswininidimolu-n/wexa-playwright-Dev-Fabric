import type { SignupDetails } from '../pages/SignupPage';

/** Complete data set required by the signup and onboarding workflow. */
export interface SignupTestData {
  readonly loginUrl: string;
  readonly account: SignupDetails;
  readonly onboarding: {
    readonly departmentName: string;
    readonly projectName: string;
  };
}

/** Generates an email that is unique across local and parallel test runs. */
function generateUniqueEmail(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);

  return `tyvikilo${timestamp}${randomSuffix}@denipl.net`;
}

/**
 * Creates fresh signup data for each test while preserving every existing
 * value except the email address, which must be unique for account creation.
 */
export function createSignupData(
  accountOverrides: Partial<SignupDetails> = {},
): SignupTestData {
  return {
    loginUrl: 'http://dev.fabric.wexa.ai/login',
    account: {
      firstName: 'Test',
      lastName: 'Dep',
      organizationName: 'Test Department',
      email: generateUniqueEmail(),
      password: 'Test@123',
      confirmPassword: 'Test@123',
      ...accountOverrides,
    },
    onboarding: {
      departmentName: 'Sales Assistant',
      projectName: 'Sales Agent',
    },
  };
}
