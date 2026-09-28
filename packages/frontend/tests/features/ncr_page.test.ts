import { describe, it, expect } from 'bun:test';
import { receiptApi } from '../../src/api';
import { routes } from '../../src/routes';

describe('US5 / R30: Dedicated Non-Conformance Report (NCR) Frontend Integration', () => {
  it('defines listNcrs and resolveNcr endpoint methods in receiptApi', () => {
    expect(typeof receiptApi.listNcrs).toBe('function');
    expect(typeof receiptApi.resolveNcr).toBe('function');
  });

  it('maps /ncr route to dedicated NcrListPage component in router configuration', () => {
    const rootRoute = routes.find((r) => r.path === '/');
    expect(rootRoute).toBeDefined();

    const ncrRoute = rootRoute?.children?.find((c) => c.path === 'ncr');
    expect(ncrRoute).toBeDefined();
    expect(ncrRoute?.element).toBeDefined();
  });
});
