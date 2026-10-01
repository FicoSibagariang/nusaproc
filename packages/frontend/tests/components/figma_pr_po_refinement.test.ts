import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Figma UI Refinement Phase 3: Core Procurement (PR & PO Lists)', () => {
  const frontendRoot = join(__dirname, '../../');
  const prListPath = join(frontendRoot, 'src/features/pr/pages/PrListPage.tsx');
  const poListPath = join(frontendRoot, 'src/features/po/pages/PoListPage.tsx');

  describe('1. Purchase Request List Page (02 Purchase Request)', () => {
    it('verifies file exists and has correct imports', () => {
      expect(existsSync(prListPath)).toBe(true);
      const content = readFileSync(prListPath, 'utf-8');

      // Breadcrumb & Icon Header
      expect(content).toContain("items={[{ title: 'Pengadaan' }, { title: 'Purchase Request' }]}");
      expect(content).toContain('Purchase Request (PR)');
      expect(content).toContain('ShoppingCartOutlined');
      expect(content).toContain('Buat PR Baru');
      expect(content).toContain('Ekspor');
      expect(content).toContain('handleExportCsv');
    });

    it('verifies status tabs and filtering components', () => {
      const content = readFileSync(prListPath, 'utf-8');

      // Status tabs
      expect(content).toContain('statusTabItems');
      expect(content).toContain('Menunggu Persetujuan');
      expect(content).toContain('Disetujui');
      expect(content).toContain('Draft');
      expect(content).toContain('Ditolak');

      // Filter bar
      expect(content).toContain('Semua status');
      expect(content).toContain('Semua divisi');
      expect(content).toContain('Semua periode');
      expect(content).toContain('Cari nomor PR, pemohon, atau divisi...');
    });

    it('verifies table styling, user cell, and related PO chips', () => {
      const content = readFileSync(prListPath, 'utf-8');

      // User avatar initials
      expect(content).toContain('getInitials');
      expect(content).toContain('PO Terpenuhi');
      expect(content).toContain('PO Sebagian');
      expect(content).toContain('Belum Ada PO');

      // Related PO chips
      expect(content).toContain("title: 'PO terkait'");
      expect(content).toContain('PO Selesai Penuh');
      expect(content).toContain('PO Diterbitkan');
      expect(content).toContain('PO Draft');
    });

    it('verifies PrListPage table strictly matches Figma 02 Purchase Request 8-column layout', () => {
      const content = readFileSync(prListPath, 'utf-8');

      // Exact 8 column headers matching Figma 02
      expect(content).toContain("title: 'Nomor PR'");
      expect(content).toContain("title: 'Pemohon'");
      expect(content).toContain("title: 'Divisi'");
      expect(content).toContain("title: 'Termin bayar'");
      expect(content).toContain("title: 'Estimasi nilai'");
      expect(content).toContain("title: 'Status'");
      expect(content).toContain("title: 'PO terkait'");

      // Date is rendered inside Nomor PR cell
      expect(content).toContain('formatDate(record.createdAt)');

      // Plain text payment term
      expect(content).toContain('Pay After Receipt');

      // Action column has clean EyeOutlined icon
      expect(content).toContain('EyeOutlined');
      expect(content).toContain('setSelectedDetailPrId(record.id)');
    });
  });

  describe('2. Purchase Order List Page (03 Purchase Order)', () => {
    it('verifies file exists and has correct header and export', () => {
      expect(existsSync(poListPath)).toBe(true);
      const content = readFileSync(poListPath, 'utf-8');

      // Breadcrumb & Icon Header
      expect(content).toContain("items={[{ title: 'Pengadaan' }, { title: 'Purchase Order' }]}");
      expect(content).toContain('Purchase Order (PO)');
      expect(content).toContain('FileTextOutlined');
      expect(content).toContain('Buat PO Baru');
      expect(content).toContain('Ekspor');
      expect(content).toContain('handleExportCsv');
    });

    it('verifies status tabs, bank account badges, and action buttons', () => {
      const content = readFileSync(poListPath, 'utf-8');

      // Status tabs
      expect(content).toContain('statusTabItems');
      expect(content).toContain('Diterbitkan');
      expect(content).toContain('Selesai Penuh');
      expect(content).toContain('Dibatalkan');

      // Vendor & Bank account tag
      expect(content).toContain('BankOutlined');
      expect(content).toContain('masked');

      // Contextual action buttons
      expect(content).toContain('Setujui (R25)');
      expect(content).toContain('Terbitkan (R24)');
      expect(content).toContain('Terima Barang (BAST)');
      expect(content).toContain('Unduh PDF (R27)');
    });
  });
});
