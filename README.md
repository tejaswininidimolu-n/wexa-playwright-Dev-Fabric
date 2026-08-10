# Wexa Fabric Playwright Framework

TypeScript and Playwright test framework for Wexa Fabric. The current suite covers login, signup/onboarding, authentication APIs, and an initial authenticated Home workflow. Connector automation is not included yet.

## Installation

1. Install Node.js and npm.
2. Install project dependencies:

   ```bash
   npm install
   npx playwright install chromium
   ```

3. Copy the environment template and provide credentials for a dedicated non-production automation account:

   ```bash
   cp .env.example .env
   ```

## Environment configuration

The uncommitted `.env` file supports:

```dotenv
FABRIC_BASE_URL=https://your-fabric-environment.example
FABRIC_LOGIN_EMAIL=automation-user@example.com
FABRIC_LOGIN_PASSWORD=your-secret-password
```

`FABRIC_BASE_URL` is shared by browser and API tests. It defaults to `http://localhost:3000` when omitted. Login credentials have no defaults and authenticated tests fail with a clear missing-variable error when either is absent. Do not use production credentials or commit `.env`.

## Test commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the normal suite, excluding state-changing tests. |
| `npm run test:smoke` | Run safe smoke coverage. |
| `npm run test:regression` | Run regression coverage, excluding state-changing tests. |
| `npm run test:api` | Run authentication API tests. |
| `npm run test:functional` | Run tests in the functional suite; succeeds cleanly while the suite is empty. |
| `npm run test:e2e` | Run tests in the end-to-end suite; succeeds cleanly while the suite is empty. |
| `npm run test:headed` | Run tests with a visible browser. |
| `npm run test:debug` | Run with Playwright debugging enabled. |
| `npm run test:stateful` | Explicitly run state-changing tests serially. This can create accounts and projects. |
| `npm run typecheck` | Type-check without emitting files. |
| `npm run report` | Open the generated HTML report. |

The account-creation journey is tagged `@stateful`, excluded from normal commands, and forced to one worker when explicitly requested. Run it only against an approved disposable environment.

## Authentication approach

Login behavior tests import `playwright/fixtures/base.fixture.ts` so they start unauthenticated.

Authenticated feature tests should import `test` from `playwright/fixtures/authenticated.fixture.ts`. That fixture logs in once per Playwright worker, captures storage state in memory, and initializes an isolated authenticated context for each test. This avoids repeated UI login without sharing mutable browser contexts between tests.

## Project structure

```text
playwright/
  constants/    Shared framework constants
  fixtures/     Base and authenticated Playwright fixtures
  helpers/      API and orchestration helpers
  pages/        Page Objects
  test-data/    Typed, non-secret test inputs
  tests/        UI and API specifications grouped by intent
  utils/        Environment and framework utilities
playwright.config.ts
tsconfig.json
.env.example
```

Playwright writes HTML reports to `playwright-report/` and runtime artifacts to `test-results/`; both are ignored by Git.
