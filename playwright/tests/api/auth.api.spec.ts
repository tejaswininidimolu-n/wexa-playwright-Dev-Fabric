import { expect, test } from '../../fixtures/base.fixture';
import { loginData } from '../../test-data/loginData';
import { createSignupData } from '../../test-data/signupData';

const applicationUrl = process.env.BASE_URL ?? 'http://dev.fabric.wexa.ai';
const loginEndpoint = new URL('/identity-api/users/login', applicationUrl).toString();
const signupEndpoint = new URL('/identity-api/users/signup', applicationUrl).toString();

test.describe('Authentication API @regression', () => {
  test('rejects invalid login credentials', async ({ request }) => {
    const response = await request.post(loginEndpoint, {
      data: {
        email: loginData.email,
        password: loginData.invalidPassword,
      },
    });

    expect([400, 401]).toContain(response.status());
    expect(await response.body()).not.toHaveLength(0);
  });

  test('validates required signup fields', async ({ request }) => {
    const response = await request.post(signupEndpoint, { data: {} });

    expect([400, 422]).toContain(response.status());
    expect(await response.body()).not.toHaveLength(0);
  });

  test('rejects signup for an existing email', async ({ request }) => {
    const signupData = createSignupData({ email: loginData.email });
    const { firstName, lastName, organizationName, email, password } =
      signupData.account;

    const response = await request.post(signupEndpoint, {
      data: {
        email,
        hash: password,
        fullName: `${firstName} ${lastName}`,
        name: `${firstName} ${lastName}`,
        organizationName,
      },
    });

    expect([400, 409]).toContain(response.status());
    expect(await response.text()).toMatch(/already\s+(registered|exists)/i);
  });
});
