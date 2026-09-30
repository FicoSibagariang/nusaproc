import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Figma UI Refinement: Vendor, Invoice & Payment Lists (04, 07, 08)', () => {
  const frontendRoot = join(__dirname, '../../');
  const vendorPath = join(frontendRoot, 'src/features/vendor/pages/VendorListPage.tsx');
  const invoicePath = join(frontendRoot, 'src/features/invoice/pages/InvoiceListPage.tsx');
  const paymentPath = join(frontendRoot, 'src/features/payment/pages/PaymentListPage.tsx');

  describe('1. Vendor & Rekening Bank (04 & 04b)', () => {
    it('verifies VendorListPage has correct Figma breadcrumb, icon, and header', () => {
      expect(existsSync(vendorPath)).toBe(true);
      const content = readFileSync(vendorPath, 'utf-8');

      expect(content).toContain("items={[{ title: 'Pengadaan' }, { title: 'Vendor & Rekening' }]}");
      expect(content).toContain('Vendor & Rekening Bank');
      expect(content).toContain('Tambah Vendor Baru');
      expect(content).toContain('handleCopyNpwp');
    });

    it('verifies bank popover (04b) and status filter tabs', () => {
      const content = readFileSync(vendorPath, 'utf-8');

      // Popover
      expect(content).toContain('renderBankPopoverContent');
      expect(content).toContain('Rekening bank');
      expect(content).toContain('Tampilkan');
      expect(content).toContain('Verifikasi 4-Eyes');
      expect(content).toContain('+ Tambah rekening');

      // Status tabs
      expect(content).toContain('statusTabItems');
      expect(content).toContain('Disetujui');
      expect(content).toContain('Prospek');
      expect(content).toContain('scroll={{ x: 900 }}');
    });
  });

  describe('2. Invoice & Match (07 & 07c)', () => {
    it('verifies InvoiceListPage has correct breadcrumb, header, and export', () => {
      expect(existsSync(invoicePath)).toBe(true);
      const content = readFileSync(invoicePath, 'utf-8');

      expect(content).toContain("items={[{ title: 'Keuangan' }, { title: 'Invoice & Match' }]}");
      expect(content).toContain('Invoice & Match');
      expect(content).toContain('Registrasi Invoice');
      expect(content).toContain('handleExportCsv');
    });

    it('verifies status tabs and Coretax NSFP tooltip (07c)', () => {
      const content = readFileSync(invoicePath, 'utf-8');

      // Status tabs
      expect(content).toContain('Perlu verifikasi');
      expect(content).toContain('Selisih');
      expect(content).toContain('Ditahan');
      expect(content).toContain('Cocok');

      // Coretax tooltip (Figma 07c)
      expect(content).toContain('Tidak ada di Coretax');
      expect(content).toContain('NSFP tidak ditemukan saat validasi ke Coretax');
      expect(content).toContain('scroll={{ x: 900 }}');
    });
  });

  describe('3. Pembayaran & Alur Persetujuan (08 & 08b)', () => {
    it('verifies PaymentListPage has correct breadcrumb, header, and export', () => {
      expect(existsSync(paymentPath)).toBe(true);
      const content = readFileSync(paymentPath, 'utf-8');

      expect(content).toContain("items={[{ title: 'Keuangan' }, { title: 'Pembayaran' }]}");
      expect(content).toContain('Pembayaran');
      expect(content).toContain('Buat Proposal');
      expect(content).toContain('handleExportCsv');
    });

    it('verifies expandable approval workflow banner (08b) and status tabs', () => {
      const content = readFileSync(paymentPath, 'utf-8');

      // Workflow banner (Figma 08b)
      expect(content).toContain('Alur persetujuan pembayaran');
      expect(content).toContain('Maker → Checker → Executor');
      expect(content).toContain('Sembunyikan alur');
      expect(content).toContain('1. Pembuat (Maker)');
      expect(content).toContain('2. Pemeriksa (Checker)');
      expect(content).toContain('3. Pelaksana (Executor)');
      expect(content).toContain('4. Selesai (Disbursed)');

      // Status tabs
      expect(content).toContain('Draf');
      expect(content).toContain('Menunggu pemeriksaan');
      expect(content).toContain('Siap dieksekusi');
      expect(content).toContain('scroll={{ x: 800 }}');
    });
  });
});
