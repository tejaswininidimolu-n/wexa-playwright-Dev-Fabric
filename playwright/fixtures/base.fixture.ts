import { test as base, expect } from '@playwright/test';

/**
 * Framework-level fixture entry point. Add typed, reusable fixtures here as
 * shared dependencies emerge, then import `test` and `expect` from this file.
 */
export const test = base.extend<Record<string, never>>({});
export { expect };

