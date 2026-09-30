import React from 'react';
import {
  ShoppingCartOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  ShopOutlined,
  InboxOutlined,
  WarningOutlined,
  DollarOutlined,
  BankOutlined,
  AuditOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  TeamOutlined,
  ApartmentOutlined,
  CommentOutlined,
} from '@ant-design/icons';
import type { AppRole } from '@nusaproc/shared';
import type { MenuProps } from 'antd';

export type MenuItem = Required<MenuProps>['items'][number];

export function getNavigationMenuItemsForRole(role: AppRole): MenuItem[] {
  const commonItems: MenuItem[] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
  ];

  switch (role) {
    case 'REQUESTER':
      return [
        ...commonItems,
        {
          key: '/pr',
          icon: <ShoppingCartOutlined />,
          label: 'Purchase Request (PR)',
        },
      ];

    case 'APPROVER':
      return [
        ...commonItems,
        {
          key: '/approvals/pr',
          icon: <CheckCircleOutlined />,
          label: 'Persetujuan PR',
        },
        {
          key: '/approvals/po',
          icon: <FileDoneOutlined />,
          label: 'Persetujuan PO',
        },
      ];

    case 'ACCOUNT_PAYABLE':
      return [
        ...commonItems,
        {
          key: '/invoices',
          icon: <DollarOutlined />,
          label: 'Invoice & 2-Way Match',
        },
        {
          key: '/payments',
          icon: <BankOutlined />,
          label: 'Pengajuan Pembayaran',
        },
      ];

    case 'WAREHOUSE':
      return [
        ...commonItems,
        {
          key: '/receipts',
          icon: <InboxOutlined />,
          label: 'Penerimaan Barang (BAST)',
        },
        {
          key: '/ncr',
          icon: <WarningOutlined />,
          label: 'Laporan Ketidaksesuaian (NCR)',
        },
      ];

    case 'FINANCE':
      return [
        ...commonItems,
        {
          key: '/invoices',
          icon: <DollarOutlined />,
          label: 'Invoice & 2-Way Match',
        },
        {
          key: '/payments',
          icon: <BankOutlined />,
          label: 'Pemeriksaan & Transfer Pembayaran',
        },
      ];

    case 'AUDITOR':
      return [
        ...commonItems,
        {
          key: '/audit',
          icon: <AuditOutlined />,
          label: 'Audit Trail & Integrity Sandbox',
        },
      ];

    case 'ADMIN':
    default:
      return [
        ...commonItems,
        {
          key: '/pr',
          icon: <ShoppingCartOutlined />,
          label: 'Purchase Request (PR)',
        },
        {
          key: '/po',
          icon: <FileDoneOutlined />,
          label: 'Purchase Order (PO)',
        },
        {
          key: '/vendors',
          icon: <ShopOutlined />,
          label: 'Vendor & Rekening',
        },
        {
          key: '/receipts',
          icon: <InboxOutlined />,
          label: 'Penerimaan (BAST)',
        },
        {
          key: '/ncr',
          icon: <WarningOutlined />,
          label: 'NCR',
        },
        {
          key: '/invoices',
          icon: <DollarOutlined />,
          label: 'Invoice & Match',
        },
        {
          key: '/payments',
          icon: <BankOutlined />,
          label: 'Pembayaran',
        },
        {
          key: '/audit',
          icon: <AuditOutlined />,
          label: 'Audit Trail',
        },
        {
          key: '/admin/users',
          icon: <TeamOutlined />,
          label: 'Manajemen Pengguna & Hak Akses',
        },
        {
          key: '/admin/organization',
          icon: <ApartmentOutlined />,
          label: 'Master Cabang & Divisi',
        },
        {
          key: '/admin/feedback',
          icon: <CommentOutlined />,
          label: 'Masukan & Laporan Kendala',
        },
      ];
  }
}

/**
 * Returns navigation menu items grouped into sections matching Figma UI Refinement v1:
 * - Dashboard (Single top item)
 * - PENGADAAN (PR, Approvals, PO, Vendors)
 * - PENERIMAAN & KUALITAS (BAST, NCR)
 * - KEUANGAN (Invoices, Payments)
 * - TATA KELOLA (Audit Trail, Manajemen Pengguna, Master Cabang & Divisi)
 * - Masukan & Laporan (Footer item)
 */
export function getGroupedNavigationMenuItems(role: AppRole): MenuItem[] {
  const allowedItems = getNavigationMenuItemsForRole(role);
  const allowedKeys = new Set(allowedItems.map((item) => item?.key));

  const result: MenuItem[] = [];

  // 1. Dashboard (Always on top)
  if (allowedKeys.has('/dashboard')) {
    result.push({
      key: '/dashboard',
      icon: <AppstoreOutlined />,
      label: 'Dashboard',
    });
  }

  // 2. PENGADAAN
  const pengadaanChildren: MenuItem[] = [];
  if (allowedKeys.has('/pr')) {
    pengadaanChildren.push({
      key: '/pr',
      icon: <ShoppingCartOutlined />,
      label: 'Purchase Request (PR)',
    });
  }
  if (allowedKeys.has('/approvals/pr')) {
    pengadaanChildren.push({
      key: '/approvals/pr',
      icon: <CheckCircleOutlined />,
      label: 'Persetujuan PR',
    });
  }
  if (allowedKeys.has('/po')) {
    pengadaanChildren.push({
      key: '/po',
      icon: <FileTextOutlined />,
      label: 'Purchase Order (PO)',
    });
  }
  if (allowedKeys.has('/approvals/po')) {
    pengadaanChildren.push({
      key: '/approvals/po',
      icon: <FileDoneOutlined />,
      label: 'Persetujuan PO',
    });
  }
  if (allowedKeys.has('/vendors')) {
    pengadaanChildren.push({
      key: '/vendors',
      icon: <ShopOutlined />,
      label: 'Vendor & Rekening',
    });
  }
  if (pengadaanChildren.length > 0) {
    result.push({
      type: 'group',
      label: 'PENGADAAN',
      key: 'group-pengadaan',
      children: pengadaanChildren,
    });
  }

  // 3. PENERIMAAN & KUALITAS
  const penerimaanChildren: MenuItem[] = [];
  if (allowedKeys.has('/receipts')) {
    penerimaanChildren.push({
      key: '/receipts',
      icon: <InboxOutlined />,
      label: 'Penerimaan (BAST)',
    });
  }
  if (allowedKeys.has('/ncr')) {
    penerimaanChildren.push({
      key: '/ncr',
      icon: <WarningOutlined />,
      label: 'NCR',
    });
  }
  if (penerimaanChildren.length > 0) {
    result.push({
      type: 'group',
      label: 'PENERIMAAN & KUALITAS',
      key: 'group-penerimaan',
      children: penerimaanChildren,
    });
  }

  // 4. KEUANGAN
  const keuanganChildren: MenuItem[] = [];
  if (allowedKeys.has('/invoices')) {
    keuanganChildren.push({
      key: '/invoices',
      icon: <DollarOutlined />,
      label: 'Invoice & Match',
    });
  }
  if (allowedKeys.has('/payments')) {
    keuanganChildren.push({
      key: '/payments',
      icon: <BankOutlined />,
      label: 'Pembayaran',
    });
  }
  if (keuanganChildren.length > 0) {
    result.push({
      type: 'group',
      label: 'KEUANGAN',
      key: 'group-keuangan',
      children: keuanganChildren,
    });
  }

  // 5. TATA KELOLA
  const tataKelolaChildren: MenuItem[] = [];
  if (allowedKeys.has('/audit')) {
    tataKelolaChildren.push({
      key: '/audit',
      icon: <AuditOutlined />,
      label: 'Audit Trail',
    });
  }
  if (allowedKeys.has('/admin/users')) {
    tataKelolaChildren.push({
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: 'Manajemen Pengguna',
    });
  }
  if (allowedKeys.has('/admin/organization')) {
    tataKelolaChildren.push({
      key: '/admin/organization',
      icon: <ApartmentOutlined />,
      label: 'Master Cabang & Divisi',
    });
  }
  if (tataKelolaChildren.length > 0) {
    result.push({
      type: 'group',
      label: 'TATA KELOLA',
      key: 'group-tata-kelola',
      children: tataKelolaChildren,
    });
  }

  // 6. Masukan & Laporan (Footer / Feedback)
  if (allowedKeys.has('/admin/feedback')) {
    result.push({
      key: '/admin/feedback',
      icon: <CommentOutlined />,
      label: 'Masukan & Laporan',
    });
  }

  return result;
}

