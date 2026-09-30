import React, { useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Table,
  Button,
  Space,
  theme,
  Empty,
  Breadcrumb,
  Tooltip,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  WalletOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatRupiah, formatRupiahCompact } from '../../utils/currency';
import { prApi } from '../../api/endpoints/pr';
import { poApi } from '../../api/endpoints/po';
import { invoiceApi } from '../../api/endpoints/invoice';
import { receiptApi } from '../../api/endpoints/receipt';
import { paymentApi } from '../../api/endpoints/payment';
import type { AppRole } from '@nusaproc/shared';
import { ROLE_LABELS } from '../../components/layout/RoleSwitcher';

const { Text, Title } = Typography;

export interface ActionTask {
  id: string;
  taskType: string;
  referenceNumber: string;
  description: string;
  amount?: number;
  slaRemainingMinutes: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionUrl: string;
  createdAt?: string;
}

/**
 * Calculates remaining SLA minutes from creation timestamp with SLA deadline in hours.
 */
export function calculateSlaRemainingMinutes(createdAtStr?: string, slaHours: number = 48): number {
  if (!createdAtStr) return 0;
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return 0;
  const deadline = createdTime + slaHours * 60 * 60 * 1000;
  const diffMinutes = Math.round((deadline - Date.now()) / (60 * 1000));
  return diffMinutes;
}

export const ActionDashboard: React.FC = () => {
  const { token } = theme.useToken();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeRole: AppRole = (user?.activeRole as AppRole) || 'REQUESTER';

  // 1. Fetch live transaction data across domains
  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: ['dashboard-prs'],
    queryFn: () => prApi.list().catch(() => ({ data: [] })),
  });

  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ['dashboard-pos'],
    queryFn: () => poApi.list().catch(() => ({ data: [] })),
  });

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => invoiceApi.list().catch(() => ({ data: [] })),
  });

  const { data: receiptData, isLoading: receiptLoading } = useQuery({
    queryKey: ['dashboard-receipts'],
    queryFn: () => receiptApi.list().catch(() => ({ data: [] })),
  });

  const { data: ncrData, isLoading: ncrLoading } = useQuery({
    queryKey: ['dashboard-ncrs'],
    queryFn: () => receiptApi.listNcrs().catch(() => ({ data: [] })),
  });

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ['dashboard-payments'],
    queryFn: () => paymentApi.list().catch(() => ({ data: [] })),
  });

  const isGlobalLoading = prLoading || poLoading || invoiceLoading || receiptLoading || ncrLoading || paymentLoading;

  const prList: any[] = prData?.data || [];
  const poList: any[] = poData?.data || [];
  const invoiceList: any[] = invoiceData?.data || [];
  const receiptList: any[] = receiptData?.data || [];
  const ncrList: any[] = ncrData?.data || [];
  const paymentList: any[] = paymentData?.data || [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-prs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-pos'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-ncrs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-payments'] });
  };

  // 2. Build live action tasks queue dynamically according to the active role (R56)
  const tasks: ActionTask[] = useMemo(() => {
    const list: ActionTask[] = [];

    if (activeRole === 'APPROVER') {
      // PRs needing approval
      const pendingPrs = prList.filter((pr) => pr.status === 'PENDING_APPROVAL' || pr.status === 'SUBMITTED');
      pendingPrs.forEach((pr) => {
        list.push({
          id: `pr-${pr.id}`,
          taskType: 'Persetujuan Purchase Request',
          referenceNumber: pr.prNumber,
          description: pr.businessJustification || (pr.divisionName ? `Pengadaan ${pr.divisionName}` : 'Persetujuan Pengadaan'),
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 48),
          priority: pr.isEmergency ? 'HIGH' : Number(pr.totalEstimatedAmount) >= 50_000_000 ? 'HIGH' : 'MEDIUM',
          actionUrl: '/approvals/pr',
          createdAt: pr.createdAt,
        });
      });

      // POs needing approval
      const pendingPos = poList.filter((po) => po.status === 'DRAFT');
      pendingPos.forEach((po) => {
        list.push({
          id: `po-${po.id}`,
          taskType: 'Persetujuan Purchase Order',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} (Persetujuan PO sebelum diterbitkan)`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.createdAt, 48),
          priority: Number(po.grandTotalAmount) >= 50_000_000 ? 'HIGH' : 'MEDIUM',
          actionUrl: `/approvals/po?poId=${po.id}`,
          createdAt: po.createdAt,
        });
      });
    } else if (activeRole === 'ACCOUNT_PAYABLE') {
      // Approved PRs with remaining unfulfilled items waiting for PO issuance
      const approvedPrs = prList.filter(
        (pr) => pr.status === 'APPROVED' && (pr.remainingQuantity === undefined || Number(pr.remainingQuantity) > 0)
      );
      approvedPrs.forEach((pr) => {
        list.push({
          id: `pr-po-${pr.id}`,
          taskType: 'Terbitkan PO dari PR',
          referenceNumber: pr.prNumber,
          description: `${pr.businessJustification || 'PR disetujui, siap diterbitkan PO'} (Sisa item: ${pr.remainingQuantity ?? '-'})`,
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.updatedAt || pr.createdAt, 24),
          priority: pr.isEmergency ? 'HIGH' : 'MEDIUM',
          actionUrl: `/po/create?prId=${pr.id}`,
          createdAt: pr.updatedAt || pr.createdAt,
        });
      });

      // POs approved waiting to be issued to vendor
      const approvedPos = poList.filter((po) => po.status === 'APPROVED');
      approvedPos.forEach((po) => {
        list.push({
          id: `po-issue-${po.id}`,
          taskType: 'Kirim (Issue) PO ke Vendor',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} (PO telah disetujui, siap dikirim ke vendor)`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.approvedAt || po.createdAt, 24),
          priority: 'MEDIUM',
          actionUrl: `/po?poId=${po.id}`,
          createdAt: po.approvedAt || po.createdAt,
        });
      });

      // Invoices with matching exceptions
      const exceptionInvoices = invoiceList.filter((inv) => inv.matchStatus === 'MATCHED_WITH_EXCEPTION');
      exceptionInvoices.forEach((inv) => {
        list.push({
          id: `inv-exc-${inv.id}`,
          taskType: 'Review Exception Invoice',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Selisih matching invoice terdeteksi — butuh telaah/override Head of AP (R38)',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 24),
          priority: 'HIGH',
          actionUrl: '/invoices',
          createdAt: inv.createdAt,
        });
      });

      // Invoices unmatched
      const unmatchedInvoices = invoiceList.filter((inv) => inv.matchStatus === 'UNMATCHED');
      unmatchedInvoices.forEach((inv) => {
        list.push({
          id: `inv-unmatch-${inv.id}`,
          taskType: 'Pemeriksaan 2-Way Match',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Invoice baru diunggah, jalankan verifikasi 2-Way Matching (R38)',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 24),
          priority: 'MEDIUM',
          actionUrl: '/invoices',
          createdAt: inv.createdAt,
        });
      });
    } else if (activeRole === 'WAREHOUSE') {
      // Issued POs waiting for Goods Receipt / BAST
      const issuedPos = poList.filter((po) => po.status === 'ISSUED');
      issuedPos.forEach((po) => {
        list.push({
          id: `po-rcpt-${po.id}`,
          taskType: 'Penerimaan Barang (BAST)',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} | Menunggu penerimaan fisik barang & surat jalan`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.issuedAt || po.createdAt, 48),
          priority: 'MEDIUM',
          actionUrl: `/receipts/create?poId=${po.id}`,
          createdAt: po.issuedAt || po.createdAt,
        });
      });
    } else if (activeRole === 'FINANCE') {
      // Invoices ready for payment proposal
      const readyInvoices = invoiceList.filter(
        (inv) => inv.matchStatus === 'MATCHED_OK' || inv.matchStatus === 'EXCEPTION_OVERRIDDEN'
      );
      readyInvoices.forEach((inv) => {
        list.push({
          id: `inv-pay-${inv.id}`,
          taskType: 'Buat Proposal Pembayaran',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: `Invoice ${inv.vendorInvoiceNumber} telah lolos 2-way match, siap dibuat proposal pembayaran (R41)`,
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.matchedAt || inv.createdAt, 48),
          priority: 'MEDIUM',
          actionUrl: '/payments',
          createdAt: inv.matchedAt || inv.createdAt,
        });
      });

      // Payment proposals needing verification / execution
      const pendingPayments = paymentList.filter((prop) => prop.status === 'PROPOSED' || prop.status === 'VERIFIED');
      pendingPayments.forEach((prop) => {
        list.push({
          id: `prop-${prop.id}`,
          taskType: prop.status === 'PROPOSED' ? 'Verifikasi Proposal Pembayaran' : 'Eksekusi Transfer Pembayaran',
          referenceNumber: prop.proposalNumber,
          description: `Metode: ${prop.paymentMethod || 'BANK_TRANSFER'} | Menunggu proses ${prop.status.toLowerCase()} (R42)`,
          amount: Number(prop.totalPaymentAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(prop.proposedAt, 24),
          priority: 'HIGH',
          actionUrl: '/payments',
          createdAt: prop.proposedAt,
        });
      });
    } else if (activeRole === 'REQUESTER') {
      // Requesters monitor their rejected PRs or draft PRs needing submission
      const draftPrs = prList.filter((pr) => pr.status === 'DRAFT' && (!user?.id || pr.requesterId === user?.id));
      draftPrs.forEach((pr) => {
        list.push({
          id: `pr-draft-${pr.id}`,
          taskType: 'Lengkapi & Ajukan PR Draft',
          referenceNumber: pr.prNumber,
          description: pr.businessJustification || 'PR masih dalam status draft, lengkapi dan ajukan untuk disetujui',
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 72),
          priority: pr.isEmergency ? 'HIGH' : 'LOW',
          actionUrl: '/pr',
          createdAt: pr.createdAt,
        });
      });

      const rejectedPrs = prList.filter((pr) => pr.status === 'REJECTED' && (!user?.id || pr.requesterId === user?.id));
      rejectedPrs.forEach((pr) => {
        list.push({
          id: `pr-rej-${pr.id}`,
          taskType: 'Revisi PR yang Ditolak',
          referenceNumber: pr.prNumber,
          description: `PR ditolak approver: "${pr.rejectionReason || 'Perlu penyesuaian anggaran'}"`,
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: 0,
          priority: 'HIGH',
          actionUrl: '/pr',
          createdAt: pr.updatedAt || pr.createdAt,
        });
      });
    } else if (activeRole === 'AUDITOR') {
      // Auditors monitor active high-value items & unmatched exceptions
      const highValPrs = prList.filter((pr) => Number(pr.totalEstimatedAmount) >= 100_000_000);
      highValPrs.forEach((pr) => {
        list.push({
          id: `aud-pr-${pr.id}`,
          taskType: 'Audit Investigasi PR > Rp 100 Juta',
          referenceNumber: pr.prNumber,
          description: `Pengadaan bernilai tinggi ${pr.divisionName || ''} - verifikasi kepatuhan limit & SoD`,
          amount: Number(pr.totalEstimatedAmount),
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 96),
          priority: 'MEDIUM',
          actionUrl: '/audit',
          createdAt: pr.createdAt,
        });
      });

      const exceptionInvoices = invoiceList.filter((inv) => inv.matchStatus === 'MATCHED_WITH_EXCEPTION');
      exceptionInvoices.forEach((inv) => {
        list.push({
          id: `aud-inv-${inv.id}`,
          taskType: 'Audit Exception 2-Way Match',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Invoice dengan selisih nominal/kuantitas (Tinjau audit trail & justifikasi override AP)',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 48),
          priority: 'HIGH',
          actionUrl: '/audit',
          createdAt: inv.createdAt,
        });
      });
    } else {
      // ADMIN: Unified oversight of all pending approvals and bottlenecks
      const pendingPrs = prList.filter((pr) => pr.status === 'PENDING_APPROVAL' || pr.status === 'SUBMITTED');
      pendingPrs.forEach((pr) => {
        list.push({
          id: `admin-pr-${pr.id}`,
          taskType: 'Persetujuan PR (Overdue)',
          referenceNumber: pr.prNumber,
          description: pr.businessJustification || 'Menunggu persetujuan berjenjang',
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 48),
          priority: pr.isEmergency ? 'HIGH' : 'MEDIUM',
          actionUrl: '/approvals/pr',
          createdAt: pr.createdAt,
        });
      });

      const pendingPos = poList.filter((po) => po.status === 'DRAFT');
      pendingPos.forEach((po) => {
        list.push({
          id: `admin-po-${po.id}`,
          taskType: 'Persetujuan PO (Draft)',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} | Menunggu persetujuan PO`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.createdAt, 48),
          priority: 'MEDIUM',
          actionUrl: `/approvals/po?poId=${po.id}`,
          createdAt: po.createdAt,
        });
      });

      const exceptionInvoices = invoiceList.filter((inv) => inv.matchStatus === 'MATCHED_WITH_EXCEPTION');
      exceptionInvoices.forEach((inv) => {
        list.push({
          id: `admin-inv-${inv.id}`,
          taskType: 'Review Exception Invoice',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Selisih matching invoice terdeteksi',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 24),
          priority: 'HIGH',
          actionUrl: '/invoices',
          createdAt: inv.createdAt,
        });
      });

      const pendingPayments = paymentList.filter((prop) => prop.status === 'PROPOSED' || prop.status === 'VERIFIED');
      pendingPayments.forEach((prop) => {
        list.push({
          id: `admin-prop-${prop.id}`,
          taskType: prop.status === 'PROPOSED' ? 'Verifikasi Proposal (Checker)' : 'Eksekusi Transfer Pembayaran',
          referenceNumber: prop.proposalNumber,
          description: `Status: ${prop.status} | Menunggu penyelesaian pembayaran`,
          amount: Number(prop.totalPaymentAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(prop.proposedAt, 24),
          priority: 'HIGH',
          actionUrl: '/payments',
          createdAt: prop.proposedAt,
        });
      });
    }

    // Sort by urgent SLA first (ascending remaining minutes)
    return list.sort((a, b) => a.slaRemainingMinutes - b.slaRemainingMinutes);
  }, [activeRole, prList, poList, invoiceList, receiptList, paymentList, user?.id]);

  // 3. Dynamic KPI Calculation matching Figma 01 Dashboard
  const urgentTasksCount = tasks.filter((t) => t.slaRemainingMinutes <= 60).length;
  const totalQueueAmount = tasks.reduce((sum, t) => sum + (t.amount || 0), 0);

  const completedCount = useMemo(() => {
    if (activeRole === 'APPROVER') {
      return (
        prList.filter((p) => p.status === 'APPROVED').length +
        poList.filter((p) => p.status === 'APPROVED' || p.status === 'ISSUED').length
      );
    }
    if (activeRole === 'ACCOUNT_PAYABLE') {
      return (
        poList.filter((p) => p.status === 'ISSUED').length +
        invoiceList.filter((i) => i.matchStatus === 'MATCHED_OK' || i.matchStatus === 'EXCEPTION_OVERRIDDEN').length
      );
    }
    if (activeRole === 'WAREHOUSE') {
      return receiptList.length;
    }
    if (activeRole === 'FINANCE') {
      return paymentList.filter((p) => p.status === 'EXECUTED').length;
    }
    if (activeRole === 'REQUESTER') {
      return prList.filter((p) => p.status === 'APPROVED' && (!user?.id || p.requesterId === user?.id)).length;
    }
    // Admin / Auditor
    return (
      prList.filter((p) => p.status === 'APPROVED').length +
      poList.filter((p) => p.status === 'ISSUED').length +
      paymentList.filter((p) => p.status === 'EXECUTED').length
    );
  }, [activeRole, prList, poList, invoiceList, receiptList, paymentList, user?.id]);

  // Procure-to-Pay Pipeline Metrics
  const approvedPrsCount = prList.filter((p) => p.status === 'APPROVED').length;
  const draftPosCount = poList.filter((p) => p.status === 'DRAFT').length;
  const issuedPosCount = poList.filter((p) => p.status === 'ISSUED').length;
  const completedPosCount = Math.max(0, poList.length - draftPosCount - issuedPosCount);
  const openNcrCount = ncrList.filter((n) => !n.isResolved).length;

  // Table Columns matching Figma 01 Dashboard
  const columns = [
    {
      title: 'Tipe aksi',
      dataIndex: 'taskType',
      key: 'taskType',
      render: (text: string, record: ActionTask) => {
        let tagColor = 'default';
        let tagLabel = 'Prioritas normal';
        if (record.priority === 'HIGH') {
          tagColor = 'red';
          tagLabel = 'Prioritas tinggi';
        } else if (record.priority === 'MEDIUM') {
          tagColor = 'gold';
          tagLabel = 'Prioritas sedang';
        }

        return (
          <Space direction="vertical" size={4}>
            <Text strong style={{ fontSize: 13, color: '#262626' }}>{text}</Text>
            <Tag color={tagColor} style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
              {tagLabel}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'No. referensi',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      render: (text: string, record: ActionTask) => (
        <Tooltip title="Klik untuk membuka dokumen terkait">
          <Tag
            icon={<FileTextOutlined style={{ color: token.colorPrimary }} />}
            style={{
              cursor: 'pointer',
              borderRadius: 4,
              padding: '2px 8px',
              fontWeight: 500,
              color: '#262626',
              background: '#f5f7fa',
              border: '1px solid #e8e8e8',
            }}
            onClick={() => navigate(record.actionUrl)}
          >
            {text}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Deskripsi',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => (
        <Text style={{ fontSize: 13, color: '#595959' }}>{desc}</Text>
      ),
    },
    {
      title: 'Nominal',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount?: number) => (
        <Text strong style={{ fontSize: 13 }}>
          {amount ? formatRupiah(amount) : '-'}
        </Text>
      ),
    },
    {
      title: 'Status SLA',
      dataIndex: 'slaRemainingMinutes',
      key: 'sla',
      render: (mins: number) => {
        if (mins <= 0) {
          return (
            <Tag color="error" icon={<WarningOutlined />} style={{ borderRadius: 4 }}>
              Lewat SLA ({Math.abs(mins)} mnt)
            </Tag>
          );
        }
        const isUrgent = mins <= 60;
        const isWarning = mins <= 720;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        const timeText = hours > 0 ? `${hours} jam ${remMins > 0 ? `${remMins} mnt` : ''}` : `${remMins} mnt`;

        return (
          <Tag
            color={isUrgent ? 'error' : isWarning ? 'warning' : 'cyan'}
            icon={<ClockCircleOutlined />}
            style={{ borderRadius: 4, padding: '2px 8px' }}
          >
            Sisa {timeText}
          </Tag>
        );
      },
    },
    {
      title: 'Tindakan',
      key: 'action',
      align: 'right' as const,
      render: (_: unknown, record: ActionTask) => (
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate(record.actionUrl)}
          style={{ borderRadius: 6, fontSize: 12 }}
        >
          Proses Sekarang
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Breadcrumb matching Figma 01 */}
      <div>
        <Breadcrumb
          items={[{ title: 'Beranda' }, { title: 'Dashboard' }]}
          style={{ marginBottom: 12, fontSize: 12 }}
        />

        {/* Page Header (Figma 01 Dashboard) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Square Blue Icon Container */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#e6f4ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AppstoreOutlined style={{ color: '#0958d9', fontSize: 22 }} />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 700, fontSize: 22 }}>
                Dashboard Aksi
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Halo, {user?.fullName || 'Pengguna'} ({ROLE_LABELS[activeRole] || activeRole}) — fokus pada tugas yang memerlukan aksi segera.
              </Text>
            </div>
          </div>

          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isGlobalLoading}
            style={{ borderRadius: 8, height: 38 }}
          >
            Muat Ulang
          </Button>
        </div>
      </div>

      {/* 4 Top KPI Metric Cards matching Figma 01 */}
      <Row gutter={[16, 16]}>
        {/* 1. Tugas menunggu */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f0f0f0',
            }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: '#595959', fontWeight: 500 }}>Tugas menunggu</Text>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#e6f4ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ClockCircleOutlined style={{ color: '#1677ff', fontSize: 18 }} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.1, marginBottom: 8 }}>
              {tasks.length}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tindakan yang perlu Anda proses
            </Text>
          </Card>
        </Col>

        {/* 2. SLA hampir habis */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f0f0f0',
            }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: '#595959', fontWeight: 500 }}>SLA hampir habis</Text>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#fffbe6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.1, marginBottom: 8 }}>
              {urgentTasksCount}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {urgentTasksCount === 0 ? 'Tidak ada yang mendesak' : `${urgentTasksCount} tugas butuh tindakan segera`}
            </Text>
          </Card>
        </Col>

        {/* 3. Transaksi selesai */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f0f0f0',
            }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: '#595959', fontWeight: 500 }}>Transaksi selesai</Text>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#f6ffed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.1, marginBottom: 8 }}>
              {completedCount}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Dokumen selesai diproses
            </Text>
          </Card>
        </Col>

        {/* 4. Nilai antrean */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f0f0f0',
            }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: '#595959', fontWeight: 500 }}>Nilai antrean</Text>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#e6fffb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WalletOutlined style={{ color: '#13c2c2', fontSize: 18 }} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.1, marginBottom: 8 }}>
              {formatRupiahCompact(totalQueueAmount)}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Total nilai dokumen yang menunggu
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Section 2: Antrean tugas aksi & SLA (Figma 01) */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f0f0f0',
        }}
        title={
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong style={{ fontSize: 16, color: '#1f1f1f', display: 'block' }}>
                  Antrean tugas aksi & SLA
                </Text>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  Urutkan berdasarkan batas waktu SLA terdekat.
                </Text>
              </div>
              <Tag
                color="blue"
                style={{
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: '#e6f4ff',
                  color: '#0958d9',
                  border: 'none',
                }}
              >
                {tasks.length} item perlu tindakan
              </Tag>
            </div>
          </div>
        }
      >
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={isGlobalLoading}
          pagination={tasks.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
          scroll={{ x: 750 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Semua tugas telah selesai diproses! Tidak ada antrean aksi saat ini."
              />
            ),
          }}
        />
      </Card>

      {/* Section 3: Ringkasan dokumen alur pengadaan (Procure-to-Pay Pipeline Cards - Figma 01) */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f0f0f0',
        }}
        title={
          <div style={{ padding: '4px 0' }}>
            <Text strong style={{ fontSize: 16, color: '#1f1f1f', display: 'block' }}>
              Ringkasan dokumen alur pengadaan
            </Text>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              Jumlah dokumen aktif di setiap tahap, dari permintaan sampai penerimaan.
            </Text>
          </div>
        }
      >
        <Row gutter={[16, 16]}>
          {/* Card 1: Purchase Request */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/pr')}
              style={{
                borderRadius: 8,
                backgroundColor: '#fff',
                border: '1px solid #f0f0f0',
                height: '100%',
              }}
            >
              <Space style={{ marginBottom: 12 }}>
                <ShoppingCartOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                <Text strong style={{ fontSize: 13 }}>Purchase Request</Text>
              </Space>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.2, marginBottom: 6 }}>
                {prList.length}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {approvedPrsCount === prList.length && prList.length > 0
                  ? 'Semua disetujui'
                  : `${approvedPrsCount} disetujui · ${Math.max(0, prList.length - approvedPrsCount)} aktif`}
              </Text>
            </Card>
          </Col>

          {/* Card 2: Purchase Order */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/po')}
              style={{
                borderRadius: 8,
                backgroundColor: '#fff',
                border: '1px solid #f0f0f0',
                height: '100%',
              }}
            >
              <Space style={{ marginBottom: 12 }}>
                <FileTextOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                <Text strong style={{ fontSize: 13 }}>Purchase Order</Text>
              </Space>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.2, marginBottom: 6 }}>
                {poList.length}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {`${draftPosCount} draft · ${issuedPosCount} diterbitkan · ${completedPosCount} selesai`}
              </Text>
            </Card>
          </Col>

          {/* Card 3: Penerimaan (BAST) */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/receipts')}
              style={{
                borderRadius: 8,
                backgroundColor: '#fff',
                border: '1px solid #f0f0f0',
                height: '100%',
              }}
            >
              <Space style={{ marginBottom: 12 }}>
                <InboxOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <Text strong style={{ fontSize: 13 }}>Penerimaan (BAST)</Text>
              </Space>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.2, marginBottom: 6 }}>
                {receiptList.length}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {receiptList.length > 0 ? 'Semua diterima di gudang' : 'Belum ada penerimaan'}
              </Text>
            </Card>
          </Col>

          {/* Card 4: NCR */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/ncr')}
              style={{
                borderRadius: 8,
                backgroundColor: '#fff',
                border: '1px solid #f0f0f0',
                height: '100%',
              }}
            >
              <Space style={{ marginBottom: 12 }}>
                <WarningOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                <Text strong style={{ fontSize: 13 }}>NCR</Text>
              </Space>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.2, marginBottom: 6 }}>
                {ncrList.length}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {openNcrCount > 0 ? `${openNcrCount} tiket masih terbuka` : 'Tidak ada tiket terbuka'}
              </Text>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ActionDashboard;
