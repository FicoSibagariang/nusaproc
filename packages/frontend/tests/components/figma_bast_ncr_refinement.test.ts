import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Figma UI Refinement: Warehouse & Quality (BAST & NCR Lists)', () => {
  const frontendRoot = join(__dirname, '../../');
  const bastListPath = join(frontendRoot, 'src/features/receipt/pages/ReceiptListPage.tsx');
  const ncrListPath = join(frontendRoot, 'src/features/receipt/pages/NcrListPage.tsx');

  describe('1. Penerimaan Barang BAST List Page (05 Penerimaan BAST)', () => {
    it('verifies BAST list has correct Figma breadcrumb, icon, and header', () => {
      expect(existsSync(bastListPath)).toBe(true);
      const content = readFileSync(bastListPath, 'utf-8');

      // Breadcrumb & Icon Header
      expect(content).toContain("items={[{ title: 'Penerimaan & Kualitas' }, { title: 'Penerimaan (BAST)' }]}");
      expect(content).toContain('Penerimaan Barang (BAST)');
      expect(content).toContain('InboxOutlined');
      expect(content).toContain('Catat Penerimaan');
      expect(content).toContain('Ekspor');
      expect(content).toContain('handleExportCsv');
    });

    it('verifies BAST status tabs, filter bar, and NCR indicator in table', () => {
      const content = readFileSync(bastListPath, 'utf-8');

      // Status tabs
      expect(content).toContain('statusTabItems');
      expect(content).toContain('Gudang');
      expect(content).toContain('Jasa');

      // Filter bar
      expect(content).toContain('Semua tipe');
      expect(content).toContain('Semua periode');
      expect(content).toContain('Cari nomor BAST, PO, atau vendor...');

      // Open NCR badge tag in table
      expect(content).toContain('NCR terbuka');
      expect(content).toContain('scroll={{ x: 800 }}');
    });
  });

  describe('2. Laporan Ketidaksesuaian NCR List Page (06 NCR)', () => {
    it('verifies NCR list has correct Figma breadcrumb, icon, and alert banner', () => {
      expect(existsSync(ncrListPath)).toBe(true);
      const content = readFileSync(ncrListPath, 'utf-8');

      // Breadcrumb & Icon Header
      expect(content).toContain("items={[{ title: 'Penerimaan & Kualitas' }, { title: 'NCR' }]}");
      expect(content).toContain('Laporan Ketidaksesuaian (NCR)');
      expect(content).toContain('WarningOutlined');

      // Open NCR warning banner
      expect(content).toContain('tiket NCR masih terbuka');
    });

    it('verifies NCR status tabs, filter dropdown, and table actions', () => {
      const content = readFileSync(ncrListPath, 'utf-8');

      // Status tabs
      expect(content).toContain('statusTabItems');
      expect(content).toContain('Terbuka');
      expect(content).toContain('Selesai');

      // Filter bar
      expect(content).toContain('Semua status resolusi');
      expect(content).toContain('Cari nomor NCR, PO, BAST, atau deskripsi...');

      // Table columns & action
      expect(content).toContain('Nomor tiket NCR');
      expect(content).toContain('Dokumen terkait');
      expect(content).toContain('Tindakan yang diperlukan');
      expect(content).toContain('Selesaikan');
      expect(content).toContain('scroll={{ x: 900 }}');
    });
  });
});
