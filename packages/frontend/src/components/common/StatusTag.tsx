import React from 'react';
import { Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  AlertOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { AppRole } from '@nusaproc/shared';

export const ROLE_COLORS: Record<AppRole, string> = {
  REQUESTER: 'blue',
  APPROVER: 'purple',
  ACCOUNT_PAYABLE: 'cyan',
  WAREHOUSE: 'orange',
  FINANCE: 'green',
  AUDITOR: 'magenta',
  ADMIN: 'red',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  REQUESTER: 'Pengaju (Requester)',
  APPROVER: 'Penyetuju (Approver)',
  ACCOUNT_PAYABLE: 'Hutang Usaha (Account Payable)',
  WAREHOUSE: 'Gudang (Warehouse)',
  FINANCE: 'Keuangan (Finance)',
  AUDITOR: 'Auditor Internal',
  ADMIN: 'Administrator Sistem',
};

export interface RoleTagProps {
  role: AppRole;
  isTaxSpecialist?: boolean;
  style?: React.CSSProperties;
}

export const RoleTag: React.FC<RoleTagProps> = ({ role, isTaxSpecialist, style }) => {
  const color = ROLE_COLORS[role] || 'blue';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      <Tag color={color} style={{ margin: 0 }}>
        {role}
      </Tag>
      {isTaxSpecialist && (
        <Tag color="magenta" style={{ margin: 0, fontSize: 10 }}>
          PPN Specialist
        </Tag>
      )}
    </span>
  );
};

export type StatusCategory = 'pr' | 'po' | 'invoice' | 'payment' | 'ncr' | 'active' | 'generic';

export interface StatusTagProps {
  status: string | boolean;
  category?: StatusCategory;
  text?: string;
  tooltip?: string;
  style?: React.CSSProperties;
}

export const STATUS_LABELS: Record<string, string> = {
  // PR
  'PR:DRAFT': 'Draft',
  'PR:SUBMITTED': 'Diajukan',
  'PR:APPROVED': 'Disetujui',
  'PR:REJECTED': 'Ditolak',
  'PR:CLOSED_PARTIAL': 'Selesai Sebagian',
  // PO
  'PO:DRAFT': 'Draft',
  'PO:APPROVED': 'Disetujui',
  'PO:ISSUED': 'Diterbitkan (Issued)',
  'PO:COMPLETED': 'Selesai Penuh (Completed)',
  'PO:AMENDED': 'Diamandemen',
  'PO:CANCELLED': 'Dibatalkan',
  // Invoice
  'INVOICE:MATCHED_OK': 'Cocok Sempurna (Matched)',
  'INVOICE:MATCHED_WITH_EXCEPTION': 'Selisih (Exception)',
  'INVOICE:EXCEPTION_OVERRIDDEN': 'Dilepas (Overridden)',
  'INVOICE:UNMATCHED': 'Belum Dicocokkan',
  // Payment
  'PAYMENT:PROPOSED': 'Diajukan (Maker)',
  'PAYMENT:CHECKED': 'Diperiksa (Checker)',
  'PAYMENT:EXECUTED': 'Dibayar (Executor)',
  'PAYMENT:REJECTED': 'Ditolak',
  // NCR
  'NCR:RESOLVED': 'Selesai (Resolved)',
  'NCR:OPEN': 'Dalam Investigasi (Open)',
  // Active
  'ACTIVE': 'Aktif',
  'INACTIVE': 'Nonaktif',
};

export const STATUS_DESCRIPTIONS: Record<string, string> = {
  // PO
  'PO:DRAFT': 'Draf internal. Masih dapat diedit/direvisi bebas sebelum disetujui (Pre-Approval Revision).',
  'PO:APPROVED': 'PO telah disetujui oleh Approver, menunggu penerbitan (Issue) resmi ke vendor.',
  'PO:ISSUED': 'PO telah terbit resmi ke vendor. Barang siap diterima dan dibuatkan BAST di gudang.',
  'PO:COMPLETED': 'Selesai 100%. Seluruh barang telah diterima lengkap di gudang dan siap untuk penagihan/pembayaran.',
  'PO:AMENDED': 'PO telah mengalami amandemen resmi (R26/R27) dengan versi yang diperbarui.',
  'PO:CANCELLED': 'Dokumen PO telah dibatalkan resmi dan tidak dapat diproses lebih lanjut.',

  // PR
  'PR:DRAFT': 'Draf pengajuan pengadaan barang/jasa oleh Requester.',
  'PR:SUBMITTED': 'Pengajuan telah dikirimkan, menunggu persetujuan berjenjang (Approver).',
  'PR:APPROVED': 'Pengajuan telah disetujui penuh, siap diterbitkan menjadi Purchase Order (PO).',
  'PR:REJECTED': 'Pengajuan ditolak oleh Approver.',
  'PR:CLOSED_PARTIAL': 'Pengajuan ditutup sebagian karena alokasi kuantitas tidak terpenuhi penuh.',

  // Invoice
  'INVOICE:MATCHED_OK': 'Cocok sempurna (2-Way Matching lolos toleransi). Siap masuk proposal pembayaran.',
  'INVOICE:MATCHED_WITH_EXCEPTION': 'Terdapat selisih kuantitas atau harga di luar toleransi (menunggu review Head of AP).',
  'INVOICE:EXCEPTION_OVERRIDDEN': 'Selisih tagihan telah disetujui/dilepas secara manual oleh Head of AP dengan alasan sah.',
  'INVOICE:UNMATCHED': 'Tagihan baru, belum melalui proses pencocokan sistem 2-Way Matcher.',

  // Payment
  'PAYMENT:PROPOSED': 'Proposal pembayaran baru disusun oleh staf AP Maker.',
  'PAYMENT:CHECKED': 'Proposal telah diverifikasi kelayakannya oleh AP Checker.',
  'PAYMENT:EXECUTED': 'Dana telah ditransfer dan pembayaran sukses dieksekusi oleh Finance.',
  'PAYMENT:REJECTED': 'Proposal pembayaran ditolak dalam proses verifikasi.',

  // NCR
  'NCR:OPEN': 'Barang cacat/rusak sedang dalam proses klaim atau investigasi vendor.',
  'NCR:RESOLVED': 'Laporan ketidaksesuaian barang (NCR) telah selesai ditangani/diganti.',

  // Active / General
  'ACTIVE': 'Data berstatus aktif dan dapat digunakan dalam operasional.',
  'INACTIVE': 'Data berstatus nonaktif/tidak berlaku.',
};

export const StatusTag: React.FC<StatusTagProps> = ({ status, category = 'generic', text, tooltip, style }) => {
  const statusStr = typeof status === 'boolean' ? (status ? 'ACTIVE' : 'INACTIVE') : String(status).toUpperCase();

  const wrapWithTooltip = (tagNode: React.ReactNode, defaultTooltipKey?: string) => {
    const resolvedTooltip = tooltip ?? (defaultTooltipKey ? STATUS_DESCRIPTIONS[defaultTooltipKey] : undefined);
    if (!resolvedTooltip) return <>{tagNode}</>;
    return (
      <Tooltip title={resolvedTooltip} placement="top">
        <span style={{ display: 'inline-flex', cursor: 'help' }}>{tagNode}</span>
      </Tooltip>
    );
  };

  // Boolean or Active / Inactive
  if (statusStr === 'ACTIVE' || statusStr === 'AKTIF' || status === true) {
    return wrapWithTooltip(
      <Tag icon={<CheckCircleOutlined />} color="success" style={style}>
        {text || STATUS_LABELS['ACTIVE']}
      </Tag>,
      'ACTIVE'
    );
  }
  if (statusStr === 'INACTIVE' || statusStr === 'NONAKTIF' || status === false) {
    return wrapWithTooltip(
      <Tag icon={<StopOutlined />} color="error" style={style}>
        {text || STATUS_LABELS['INACTIVE']}
      </Tag>,
      'INACTIVE'
    );
  }

  // PR status
  if (category === 'pr') {
    switch (statusStr) {
      case 'DRAFT':
        return wrapWithTooltip(<Tag color="default" style={style}>{text || STATUS_LABELS['PR:DRAFT']}</Tag>, 'PR:DRAFT');
      case 'SUBMITTED':
        return wrapWithTooltip(<Tag icon={<ClockCircleOutlined />} color="processing" style={style}>{text || STATUS_LABELS['PR:SUBMITTED']}</Tag>, 'PR:SUBMITTED');
      case 'APPROVED':
        return wrapWithTooltip(<Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['PR:APPROVED']}</Tag>, 'PR:APPROVED');
      case 'REJECTED':
        return wrapWithTooltip(<Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || STATUS_LABELS['PR:REJECTED']}</Tag>, 'PR:REJECTED');
      case 'CLOSED_PARTIAL':
        return wrapWithTooltip(<Tag color="warning" style={style}>{text || STATUS_LABELS['PR:CLOSED_PARTIAL']}</Tag>, 'PR:CLOSED_PARTIAL');
      default:
        return wrapWithTooltip(<Tag color="default" style={style}>{text || statusStr}</Tag>);
    }
  }

  // PO status
  if (category === 'po') {
    switch (statusStr) {
      case 'DRAFT':
        return wrapWithTooltip(<Tag color="default" style={style}>{text || STATUS_LABELS['PO:DRAFT']}</Tag>, 'PO:DRAFT');
      case 'APPROVED':
        return wrapWithTooltip(<Tag icon={<SyncOutlined spin />} color="processing" style={style}>{text || STATUS_LABELS['PO:APPROVED']}</Tag>, 'PO:APPROVED');
      case 'ISSUED':
        return wrapWithTooltip(<Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['PO:ISSUED']}</Tag>, 'PO:ISSUED');
      case 'COMPLETED':
        return wrapWithTooltip(<Tag icon={<CheckCircleOutlined />} color="cyan" style={style}>{text || STATUS_LABELS['PO:COMPLETED']}</Tag>, 'PO:COMPLETED');
      case 'AMENDED':
        return wrapWithTooltip(<Tag color="warning" style={style}>{text || STATUS_LABELS['PO:AMENDED']}</Tag>, 'PO:AMENDED');
      case 'CANCELLED':
        return wrapWithTooltip(<Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || STATUS_LABELS['PO:CANCELLED']}</Tag>, 'PO:CANCELLED');
      default:
        return wrapWithTooltip(<Tag color="default" style={style}>{text || statusStr}</Tag>);
    }
  }

  // Invoice 2-Way Match status
  if (category === 'invoice') {
    switch (statusStr) {
      case 'MATCHED_OK':
        return wrapWithTooltip(<Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['INVOICE:MATCHED_OK']}</Tag>, 'INVOICE:MATCHED_OK');
      case 'MATCHED_WITH_EXCEPTION':
        return wrapWithTooltip(<Tag icon={<AlertOutlined />} color="warning" style={style}>{text || STATUS_LABELS['INVOICE:MATCHED_WITH_EXCEPTION']}</Tag>, 'INVOICE:MATCHED_WITH_EXCEPTION');
      case 'EXCEPTION_OVERRIDDEN':
        return wrapWithTooltip(<Tag color="purple" style={style}>{text || STATUS_LABELS['INVOICE:EXCEPTION_OVERRIDDEN']}</Tag>, 'INVOICE:EXCEPTION_OVERRIDDEN');
      case 'UNMATCHED':
      default:
        return wrapWithTooltip(<Tag color="default" style={style}>{text || STATUS_LABELS['INVOICE:UNMATCHED']}</Tag>, 'INVOICE:UNMATCHED');
    }
  }

  // Payment Proposal status
  if (category === 'payment') {
    switch (statusStr) {
      case 'PROPOSED':
        return wrapWithTooltip(<Tag icon={<ClockCircleOutlined />} color="processing" style={style}>{text || STATUS_LABELS['PAYMENT:PROPOSED']}</Tag>, 'PAYMENT:PROPOSED');
      case 'CHECKED':
        return wrapWithTooltip(<Tag color="warning" style={style}>{text || STATUS_LABELS['PAYMENT:CHECKED']}</Tag>, 'PAYMENT:CHECKED');
      case 'EXECUTED':
        return wrapWithTooltip(<Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['PAYMENT:EXECUTED']}</Tag>, 'PAYMENT:EXECUTED');
      case 'REJECTED':
        return wrapWithTooltip(<Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || STATUS_LABELS['PAYMENT:REJECTED']}</Tag>, 'PAYMENT:REJECTED');
      default:
        return wrapWithTooltip(<Tag color="default" style={style}>{text || statusStr}</Tag>);
    }
  }

  // NCR status
  if (category === 'ncr') {
    if (statusStr === 'RESOLVED' || statusStr === 'TRUE') {
      return wrapWithTooltip(<Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['NCR:RESOLVED']}</Tag>, 'NCR:RESOLVED');
    }
    return wrapWithTooltip(<Tag icon={<AlertOutlined />} color="error" style={style}>{text || STATUS_LABELS['NCR:OPEN']}</Tag>, 'NCR:OPEN');
  }

  // Default fallback mapper
  const fallbackColorMap: Record<string, string> = {
    APPROVED: 'success',
    ISSUED: 'success',
    COMPLETED: 'cyan',
    EXECUTED: 'success',
    RESOLVED: 'success',
    SUBMITTED: 'processing',
    PROPOSED: 'processing',
    PENDING_CHECK: 'warning',
    CHECKED: 'warning',
    AMENDED: 'warning',
    MATCHED_WITH_EXCEPTION: 'warning',
    REJECTED: 'error',
    CANCELLED: 'error',
    BLACKLISTED: 'error',
    DRAFT: 'default',
    UNMATCHED: 'default',
  };

  const genericKey = `${category.toUpperCase()}:${statusStr}`;
  return wrapWithTooltip(
    <Tag color={fallbackColorMap[statusStr] || 'default'} style={style}>{text || statusStr}</Tag>,
    STATUS_DESCRIPTIONS[genericKey] ? genericKey : statusStr
  );
};

export default StatusTag;

