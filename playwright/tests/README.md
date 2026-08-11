# Test suites

Tests use searchable intent tags: `@smoke`, `@api`, `@functional`, `@regression`,
`@e2e`, and `@product-defect`. Any test that mutates Fabric is also tagged
`@stateful`; normal scripts exclude those tests, and stateful tests run serially
only through the explicit `test:stateful` command.

Coverage is organized as follows:

- Smoke: authentication, Home/navigation, Connectors, Agents, Multi-Agent Flows,
  and Agent Simulation.
- API: authentication, Agent list/details, model catalog, skills, Flow
  list/details, plus execution polling and History in the controlled E2E test.
- Functional/regression: connector discovery/details/capabilities, Agent search,
  type/cancel behavior, Flow form/type/filter behavior, composition, removal,
  decision branches, graph persistence, and UI/API consistency.
- E2E: disposable Agent and Multi-Agent lifecycles. Every created resource uses a
  unique name, is deleted in `finally`, and is verified absent through the API.

Known product-defect tests are intentionally not skipped or marked as expected
failures: Default Goal persistence, the runtime rejection of accepted
`skills: []`, and the execution-model metadata discrepancy. The controlled
execution test remains opt-in and must never be included in a safe validation run.
