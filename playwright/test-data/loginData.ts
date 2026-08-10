import { requireEnv } from '../utils/env';

/** Reusable credentials for authenticated tests. */
export const loginData = Object.freeze({
  get email(): string {
    return requireEnv('FABRIC_LOGIN_EMAIL');
  },
  get password(): string {
    return requireEnv('FABRIC_LOGIN_PASSWORD');
  },
  invalidEmail: 'not-an-email',
  invalidPassword: 'Incorrect@123',
});
