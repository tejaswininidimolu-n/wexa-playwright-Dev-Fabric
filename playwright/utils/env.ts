/** Reads a required environment variable and fails early when it is missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Required environment variable is missing: ${name}`);
  }

  return value;
}

/** The single application URL used by UI and API tests. */
export function getFabricBaseUrl(): string {
  return process.env.FABRIC_BASE_URL ?? 'http://localhost:3000';
}
