import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Phase 6: Governance, User Management, Organization & Feedback UI Refinement (Figma 09, 10, 11, 12)', () => {
  const frontendRoot = join(__dirname, '../../');

  describe('1. AuditLogPage (Figma 09 · Audit Trail & WORM Chaining R51–R55)', () => {
    const pagePath = join(frontendRoot, 'src/features/audit/pages/AuditLogPage.tsx');

    it('exists and is defined', () => {
      expect(existsSync(pagePath)).toBe(true);
    });

    it('contains Figma 09 Breadcrumb navigation and Page Title', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Breadcrumb');
      expect(content).toContain('Tata Kelola & Kepatuhan');
      expect(content).toContain('Audit Trail & Kriptografi');
      expect(content).toContain('Audit Trail & Kepatuhan Kriptografis (R51–R55)');
    });

    it('renders cryptographic WORM chaining KPI cards & integrity check', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Status Integritas Hash');
      expect(content).toContain('WORM Compliant');
      expect(content).toContain('HTTP 405 Guard');
      expect(content).toContain('SHA-256 Hash Chaining');
      expect(content).toContain('Unduh Bundel Bukti (ZIP) (R55)');
    });

    it('includes status filter tabs and cryptographic hash columns', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Semua Entri');
      expect(content).toContain('Purchase Request');
      expect(content).toContain('Purchase Order');
      expect(content).toContain('Penerimaan & NCR');
      expect(content).toContain('Faktur & Vendor');
      expect(content).toContain('Pembayaran');
      expect(content).toContain('currentEntryHash');
      expect(content).toContain('previousEntryHash');
      expect(content).toContain('scroll={{ x: 1250 }}');
    });
  });

  describe('2. AdminUsersPage (Figma 10 · Manajemen Pengguna US12)', () => {
    const pagePath = join(frontendRoot, 'src/features/admin/pages/AdminUsersPage.tsx');

    it('exists and is defined', () => {
      expect(existsSync(pagePath)).toBe(true);
    });

    it('contains Figma 10 Breadcrumb navigation and Page Title', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Breadcrumb');
      expect(content).toContain('Tata Kelola & Sistem');
      expect(content).toContain('Manajemen Pengguna');
      expect(content).toContain('Manajemen Pengguna & Hak Akses (US12)');
    });

    it('includes status filter tabs and Figma 8:197 user cell avatar rendering', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('statusTabItems');
      expect(content).toContain('Semua Pengguna');
      expect(content).toContain('Aktif');
      expect(content).toContain('Nonaktif');
      expect(content).toContain('initials');
      expect(content).toContain('scroll={{ x: 1050 }}');
    });

    it('maintains user creation modal and delegation cascade revocation (R64)', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Tambah Pengguna Baru');
      expect(content).toContain('Seluruh delegasi terkait dibatalkan (R64)');
      expect(content).toContain('isTaxSpecialist');
      expect(content).toContain('updateRolesMutation');
    });
  });

  describe('3. AdminOrganizationPage (Figma 11 · Master Cabang & Divisi)', () => {
    const pagePath = join(frontendRoot, 'src/features/admin/pages/AdminOrganizationPage.tsx');

    it('exists and is defined', () => {
      expect(existsSync(pagePath)).toBe(true);
    });

    it('contains Figma 11 Breadcrumb navigation and Page Title', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Breadcrumb');
      expect(content).toContain('Master Data');
      expect(content).toContain('Kantor Cabang & Divisi');
      expect(content).toContain('Master Organisasi: Cabang & Divisi');
    });

    it('provides dual tabs for Branches and Divisions', () => {
      const content = readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Kantor Cabang');
      expect(content).toContain('Unit Divisi');
      expect(content).toContain('Tambah Kantor Cabang');
      expect(content).toContain('Tambah Divisi Perusahaan');
      expect(content).toContain('scroll={{ x: 800 }}');
    });
  });

  describe('4. AdminFeedbackPage & Floating Widget (Figma 12 · Masukan & Laporan + Figma 8:291)', () => {
    const feedbackPagePath = join(frontendRoot, 'src/features/admin/pages/AdminFeedbackPage.tsx');
    const widgetPath = join(frontendRoot, 'src/components/feedback/FeedbackWidget.tsx');

    it('AdminFeedbackPage contains breadcrumbs and triage features', () => {
      expect(existsSync(feedbackPagePath)).toBe(true);
      const content = readFileSync(feedbackPagePath, 'utf-8');
      expect(content).toContain('Breadcrumb');
      expect(content).toContain('Tata Kelola & Sistem');
      expect(content).toContain('Masukan & Laporan Kendala');
      expect(content).toContain('Pusat Masukan & Laporan Kendala (Feedback)');
      expect(content).toContain('Tindak Lanjut & Triage Administrator');
      expect(content).toContain('scroll={{ x: 1100 }}');
    });

    it('FeedbackWidget implements Figma 8:291 floating trigger and screenshot capture', () => {
      expect(existsSync(widgetPath)).toBe(true);
      const content = readFileSync(widgetPath, 'utf-8');
      expect(content).toContain('np-feedback-trigger-btn');
      expect(content).toContain('html-to-image');
      expect(content).toContain('feedbackApi.submit');
      expect(content).toContain('Feedback');
    });
  });
});
