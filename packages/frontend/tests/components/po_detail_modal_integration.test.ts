import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Purchase Order Detail Modal & PO List Integration', () => {
  const frontendRoot = join(__dirname, '../../');
  const poDetailModalPath = join(frontendRoot, 'src/features/po/components/PoDetailModal.tsx');
  const poListPath = join(frontendRoot, 'src/features/po/pages/PoListPage.tsx');
  const poApiPath = join(frontendRoot, 'src/api/endpoints/po.ts');
  const prListPath = join(frontendRoot, 'src/features/pr/pages/PrListPage.tsx');
  const prDetailPath = join(frontendRoot, 'src/features/pr/components/PrDetailModal.tsx');
  const bastDetailPath = join(frontendRoot, 'src/features/receipt/components/BastDetailModal.tsx');
  const receiptListPath = join(frontendRoot, 'src/features/receipt/pages/ReceiptListPage.tsx');
  const ncrListPath = join(frontendRoot, 'src/features/receipt/pages/NcrListPage.tsx');
  const actionDashboardPath = join(frontendRoot, 'src/features/dashboard/ActionDashboard.tsx');
  const twoWayMatcherPath = join(frontendRoot, 'src/features/invoice/components/TwoWayMatcherScreen.tsx');

  it('verifies po.ts exports PoDetailData, PoItemDetail, and PoAmendmentDetail interfaces', () => {
    expect(existsSync(poApiPath)).toBe(true);
    const content = readFileSync(poApiPath, 'utf-8');

    expect(content).toContain('export interface PoItemDetail');
    expect(content).toContain('export interface PoAmendmentDetail');
    expect(content).toContain('export interface PoDetailData');
    expect(content).toContain('getById');
  });

  it('verifies PoDetailModal component exists with comprehensive PO breakdown', () => {
    expect(existsSync(poDetailModalPath)).toBe(true);
    const content = readFileSync(poDetailModalPath, 'utf-8');

    // Live Query wiring
    expect(content).toContain('purchase-order-detail');
    expect(content).toContain('poApi.getById');

    // Financial breakdown
    expect(content).toContain('Subtotal Nilai DPP');
    expect(content).toContain('Pajak (PPN Terhitung)');
    expect(content).toContain('Grand Total Pemesanan');

    // Items table with fulfillment & three-way matching metrics
    expect(content).toContain('quantityOrdered');
    expect(content).toContain('quantityReceived');
    expect(content).toContain('quantityInvoiced');
    expect(content).toContain('scroll={{ x: 700 }}');

    // Terms & conditions and amendments
    expect(content).toContain('termsAndConditions');
    expect(content).toContain('amendments');
    expect(content).toContain('scroll={{ x: 600 }}');

    // Actions & SoD enforcement (R24, R25, R27)
    expect(content).toContain('poApi.downloadPdf');
    expect(content).toContain('poApi.approve');
    expect(content).toContain('poApi.issue');
    expect(content).toContain('Segregation of Duties (R25)');
    expect(content).toContain('/receipts/create?poId=');
  });

  it('verifies PoListPage integrates PoDetailModal and supports deep-linking via ?poId=', () => {
    expect(existsSync(poListPath)).toBe(true);
    const content = readFileSync(poListPath, 'utf-8');

    expect(content).toContain('PoDetailModal');
    expect(content).toContain('selectedDetailPoId');
    expect(content).toContain('detailModalOpen');
    expect(content).toContain('useSearchParams');
    expect(content).toContain("searchParams.get('poId')");
    expect(content).toContain('nextParams.delete');
    expect(content).toContain('Klik untuk melihat rincian lengkap dokumen PO');
    expect(content).toContain('Detail');
    expect(content).toContain('scroll={{ x: 800 }}');
  });

  it('verifies other pages and modals link directly to PO Detail modal via /po?poId=', () => {
    // 1. PrListPage
    const prListContent = readFileSync(prListPath, 'utf-8');
    expect(prListContent).toContain('/po?poId=${po.id}');

    // 2. PrDetailModal
    const prDetailContent = readFileSync(prDetailPath, 'utf-8');
    expect(prDetailContent).toContain('/po?poId=${po.id}');

    // 3. BastDetailModal
    const bastDetailContent = readFileSync(bastDetailPath, 'utf-8');
    expect(bastDetailContent).toContain('/po?poId=${receipt.poId}');

    // 4. ReceiptListPage
    const receiptListContent = readFileSync(receiptListPath, 'utf-8');
    expect(receiptListContent).toContain('/po?poId=${record.poId}');

    // 5. NcrListPage
    const ncrListContent = readFileSync(ncrListPath, 'utf-8');
    expect(ncrListContent).toContain('/po?poId=${record.poId}');

    // 6. ActionDashboard
    const actionDashboardContent = readFileSync(actionDashboardPath, 'utf-8');
    expect(actionDashboardContent).toContain('/po?poId=${po.id}');
    expect(actionDashboardContent).toContain('/approvals/po?poId=${po.id}');

    // 7. TwoWayMatcherScreen
    const twoWayMatcherContent = readFileSync(twoWayMatcherPath, 'utf-8');
    expect(twoWayMatcherContent).toContain('/po?poId=${poData.poId}');
  });
});
