import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Purchase Order Detail Modal & PO List Integration', () => {
  const frontendRoot = join(__dirname, '../../');
  const poDetailModalPath = join(frontendRoot, 'src/features/po/components/PoDetailModal.tsx');
  const poListPath = join(frontendRoot, 'src/features/po/pages/PoListPage.tsx');
  const poApiPath = join(frontendRoot, 'src/api/endpoints/po.ts');

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

  it('verifies PoListPage integrates PoDetailModal and clickable PO number', () => {
    expect(existsSync(poListPath)).toBe(true);
    const content = readFileSync(poListPath, 'utf-8');

    expect(content).toContain('PoDetailModal');
    expect(content).toContain('selectedDetailPoId');
    expect(content).toContain('detailModalOpen');
    expect(content).toContain('Klik untuk melihat rincian lengkap dokumen PO');
    expect(content).toContain('Detail');
    expect(content).toContain('scroll={{ x: 800 }}');
  });
});
