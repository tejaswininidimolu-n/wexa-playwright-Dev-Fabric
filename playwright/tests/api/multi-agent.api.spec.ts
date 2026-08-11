import { test, expect } from '../../fixtures/authenticated.fixture';
import { AgentApi } from '../../helpers/agent.api';

test.describe('Safe Multi-Agent Flow API @api @regression @multi-agent', () => {
  test('AG-MA-API-001 validates Flow list and details contracts', async ({
    page,
    request,
  }, testInfo) => {
    const api = await AgentApi.fromAuthenticatedPage(page, request);
    const listResponse = await api.getFlowsResponse();
    expect(listResponse.status()).toBe(200);
    const list = await listResponse.json();
    expect(Array.isArray(list.agentflows)).toBe(true);
    expect(Number.isInteger(list.total_count)).toBe(true);
    expect(list.total_count).toBeGreaterThanOrEqual(list.agentflows.length);
    expect(list.agentflows.every((flow: { kind?: string }) => flow.kind === 'flow')).toBe(true);

    const candidate = list.agentflows[0] as { _id: string; name: string } | undefined;
    if (candidate) {
      const detailResponse = await api.getFlowResponse(candidate._id);
      expect(detailResponse.status()).toBe(200);
      const detail = await detailResponse.json();
      expect(detail._id).toBe(candidate._id);
      expect(detail.name).toBe(candidate.name);
      expect(Array.isArray(detail.agents)).toBe(true);
      await testInfo.attach('flow-api-contract', {
        body: JSON.stringify({
          listStatus: listResponse.status(),
          totalCount: list.total_count,
          detailStatus: detailResponse.status(),
          flow: { id: detail._id, name: detail.name, kind: detail.kind },
          detailKeys: Object.keys(detail).sort(),
        }, null, 2),
        contentType: 'application/json',
      });
      return;
    }

    const missingResponse = await api.getFlowResponse('000000000000000000000000');
    expect(missingResponse.status()).toBe(404);
    await testInfo.attach('flow-api-contract', {
      body: JSON.stringify({
        listStatus: listResponse.status(),
        totalCount: list.total_count,
        detailStatus: missingResponse.status(),
        detailCoverage: 'No existing Flow was available; validated the observed not-found contract.',
      }, null, 2),
      contentType: 'application/json',
    });
  });
});
