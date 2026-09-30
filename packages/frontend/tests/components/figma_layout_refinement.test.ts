import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getGroupedNavigationMenuItems } from '../../src/components/layout/navigation';

describe('Figma UI Refinement v1: Layout, Header, Grouped Navigation & Safe Role Switcher', () => {
  const frontendRoot = join(__dirname, '../../');
  const layoutPath = join(frontendRoot, 'src/components/layout/AppLayout.tsx');
  const roleSwitcherPath = join(frontendRoot, 'src/components/layout/RoleSwitcher.tsx');
  const navPath = join(frontendRoot, 'src/components/layout/navigation.tsx');

  it('verifies AppLayout.tsx matches Figma 01 Dashboard header, search bar, and sider collapse', () => {
    expect(existsSync(layoutPath)).toBe(true);
    const content = readFileSync(layoutPath, 'utf-8');

    // Header styling & branding
    expect(content).toContain('#0052cc');
    expect(content).toContain('nusaproc');

    // Global Search Bar
    expect(content).toContain('Cari nomor PR, PO, vendor, atau BAST...');
    expect(content).toContain('SearchOutlined');

    // Grouped navigation menu wiring
    expect(content).toContain('getGroupedNavigationMenuItems');
    expect(content).toContain('Ciutkan menu');

    // RoleSwitcher chip integration
    expect(content).toContain('<RoleSwitcher />');
  });

  it('verifies RoleSwitcher.tsx implements Figma 01c, 01d, and 01e modals', () => {
    expect(existsSync(roleSwitcherPath)).toBe(true);
    const content = readFileSync(roleSwitcherPath, 'utf-8');

    // Profile menu items and descriptions (01c)
    expect(content).toContain('Masuk Sebagai');
    expect(content).toContain('Administrator Sistem');
    expect(content).toContain('Auditor Internal');
    expect(content).toContain('Pemohon');
    expect(content).toContain('Kelola pengguna, cabang, dan sistem');

    // Safe Role Switching Modal (01d)
    expect(content).toContain('Ganti peran ke');
    expect(content).toContain('Pekerjaan yang belum disimpan di halaman ini akan hilang');
    expect(content).toContain('Peran saat ini');
    expect(content).toContain('Peran baru');

    // Safe Logout Modal (01e)
    expect(content).toContain('Keluar dari NusaProc?');
    expect(content).toContain('Anda perlu masuk kembali dengan Google SSO atau kata sandi');
  });

  it('verifies getGroupedNavigationMenuItems groups menu items into PENGADAAN, PENERIMAAN, KEUANGAN, TATA KELOLA', () => {
    expect(existsSync(navPath)).toBe(true);
    const adminGroups = getGroupedNavigationMenuItems('ADMIN');

    const groupLabels = adminGroups
      .filter((item: any) => item?.type === 'group')
      .map((g: any) => g?.label);

    expect(groupLabels).toContain('PENGADAAN');
    expect(groupLabels).toContain('PENERIMAAN & KUALITAS');
    expect(groupLabels).toContain('KEUANGAN');
    expect(groupLabels).toContain('TATA KELOLA');

    // Top item should be Dashboard
    expect(adminGroups[0]?.key).toBe('/dashboard');
  });

  it('verifies AppLayout pins the collapse menu footer button at the bottom across all screen heights', () => {
    const content = readFileSync(layoutPath, 'utf-8');

    // Ant Design sider-children flex override
    expect(content).toContain('.app-layout-sider .ant-layout-sider-children');
    expect(content).toContain('display: flex !important;');
    expect(content).toContain('flex-direction: column !important;');

    // Inner scrollable and pinned footer container
    expect(content).toContain("flex: 1");
    expect(content).toContain("minHeight: 0");
    expect(content).toContain("overflowY: 'auto'");
    expect(content).toContain("flexShrink: 0");
    expect(content).toContain("borderTop: '1px solid #f0f0f0'");

    // Toggle button and tooltips
    expect(content).toContain('Ciutkan menu');
    expect(content).toContain('Perluas menu');
    expect(content).toContain('MenuFoldOutlined');
    expect(content).toContain('MenuUnfoldOutlined');
  });
});

