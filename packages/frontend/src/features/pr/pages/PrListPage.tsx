import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Card,
  Typography,
  Modal,
  Input,
  Select,
  Tabs,
  Breadcrumb,
  App,
  theme,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { prApi } from '../../../api/endpoints/pr';
import { divisionsApi } from '../../../api/endpoints/organization';
import { formatRupiah } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';
import { useAuthStore } from '../../../stores/useAuthStore';
import { StatusTag } from '../../../components/common/StatusTag';
import { PrDetailModal } from '../components/PrDetailModal';

const { Text, Title } = Typography;

export interface PurchaseRequestRow {
  id: string;
  prNumber: string;
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  costCenter: string;
  divisionId: string;
  divisionName?: string;
  branchId: string;
  branchName?: string;
  requiredDate: string;
  paymentTermType: string;
  status: string;
  totalEstimatedAmount: number;
  remainingQuantity?: number;
  poCount?: number;
  relatedPos?: Array<{
    id: string;
    poNumber: string;
    status: string;
    vendorName?: string | null;
    grandTotalAmount?: number;
    createdAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const FALLBACK_DIVISION_NAMES: Record<string, string> = {
  'DIV-IT': 'Divisi Teknologi Informasi & Infrastruktur',
  'DIV-OPS': 'Divisi Operasional & Jaringan',
  'DIV-FIN': 'Divisi Keuangan & Akuntansi',
  'DIV-LOG': 'Divisi Logistik & Pengadaan',
  'DIV-GEN': 'Divisi Umum & SDM',
  '4': 'Divisi Teknologi Informasi & Infrastruktur',
  '1': 'Divisi Operasional & Jaringan',
  '2': 'Divisi Keuangan & Akuntansi',
  '3': 'Divisi Logistik & Pengadaan',
  '5': 'Divisi Umum & SDM',
};

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'US';
}

export const PrListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedDetailPrId, setSelectedDetailPrId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-requests'],
    queryFn: () => prApi.list(),
  });

  const { data: divisionsData } = useQuery({
    queryKey: ['divisions', true],
    queryFn: () => divisionsApi.list({ isActive: true }).catch(() => ({ data: [] })),
  });

  const activeDivisions = divisionsData?.data || [];

  const divisionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(FALLBACK_DIVISION_NAMES).forEach(([k, v]) => map.set(k, v));
    activeDivisions.forEach((d) => {
      map.set(d.code, d.name);
      map.set(d.id, d.name);
    });
    return map;
  }, [activeDivisions]);

  const submitMutation = useMutation({
    mutationFn: (id: string) => prApi.submit(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Request berhasil diajukan untuk persetujuan (R9).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal mengajukan PR', description: err.message });
    },
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      prApi.decide(id, {
        decision,
        rejectionReason: reason,
        approverMaxLimit: user?.activeRole === 'ADMIN' ? 999_999_999_999 : 100_000_000,
        approverDivisionId: user?.activeRole === 'ADMIN' ? undefined : user?.divisionId,
      }),
    onSuccess: (_, variables) => {
      notification.success({
        message: variables.decision === 'APPROVED' ? 'PR Disetujui (R13).' : 'PR Ditolak.',
      });
      setRejectModalOpen(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.detail || err?.message || 'Gagal memproses persetujuan PR';
      notification.error({ message: 'Persetujuan PR Ditolak Sistem', description: errMsg });
    },
  });

  const prList: PurchaseRequestRow[] = data?.data || [];

  // Filtered PR list based on status tab, dropdowns, and search query
  const filteredPrList = useMemo(() => {
    return prList.filter((pr) => {
      // Status tab filter
      if (activeTab === 'SUBMITTED' && pr.status !== 'SUBMITTED') return false;
      if (activeTab === 'APPROVED' && pr.status !== 'APPROVED') return false;
      if (activeTab === 'DRAFT' && pr.status !== 'DRAFT') return false;
      if (activeTab === 'REJECTED' && pr.status !== 'REJECTED') return false;

      // Status dropdown filter
      if (filterStatus !== 'ALL' && pr.status !== filterStatus) return false;

      // Division dropdown filter
      if (filterDivision !== 'ALL' && pr.divisionId !== filterDivision) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (pr.prNumber || '').toLowerCase();
        const requester = (pr.requesterName || '').toLowerCase();
        const email = (pr.requesterEmail || '').toLowerCase();
        const divName = (divisionNameMap.get(pr.divisionId) || pr.divisionId || '').toLowerCase();
        const costCenter = (pr.costCenter || '').toLowerCase();
        if (
          !num.includes(q) &&
          !requester.includes(q) &&
          !email.includes(q) &&
          !divName.includes(q) &&
          !costCenter.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [prList, activeTab, filterStatus, filterDivision, searchQuery, divisionNameMap]);

  // Export filtered PR list to CSV
  const handleExportCsv = () => {
    const headers = [
      'Nomor PR',
      'Tgl Pengajuan',
      'Pemohon (Requester)',
      'Email',
      'Divisi & Unit Pengaju',
      'Cost Center',
      'Termin Bayar',
      'Estimasi Nilai',
      'Status',
    ];
    const rows = filteredPrList.map((pr) => [
      pr.prNumber,
      formatDate(pr.createdAt),
      pr.requesterName || '',
      pr.requesterEmail || '',
      divisionNameMap.get(pr.divisionId) || pr.divisionId,
      pr.costCenter || '',
      pr.paymentTermType || 'Pay After Receipt',
      pr.totalEstimatedAmount,
      pr.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Purchase_Requests_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    notification.success({ message: 'Data Purchase Request berhasil diekspor ke CSV.' });
  };

  // Status counts for tab badges
  const submittedCount = prList.filter((p) => p.status === 'SUBMITTED').length;
  const approvedCount = prList.filter((p) => p.status === 'APPROVED').length;
  const draftCount = prList.filter((p) => p.status === 'DRAFT').length;
  const rejectedCount = prList.filter((p) => p.status === 'REJECTED').length;

  const statusTabItems = [
    {
      key: 'ALL',
      label: (
        <Space size={6}>
          <span>Semua</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'ALL' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'ALL' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {prList.length}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'SUBMITTED',
      label: (
        <Space size={6}>
          <span>Menunggu Persetujuan</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'SUBMITTED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'SUBMITTED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {submittedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'APPROVED',
      label: (
        <Space size={6}>
          <span>Disetujui</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'APPROVED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'APPROVED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {approvedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'DRAFT',
      label: (
        <Space size={6}>
          <span>Draft</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'DRAFT' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'DRAFT' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {draftCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'REJECTED',
      label: (
        <Space size={6}>
          <span>Ditolak</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'REJECTED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'REJECTED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {rejectedCount}
          </Tag>
        </Space>
      ),
    },
  ];

  const columns: ColumnsType<PurchaseRequestRow> = [
    {
      title: 'Nomor PR',
      dataIndex: 'prNumber',
      key: 'prNumber',
      render: (text: string, record: PurchaseRequestRow) => (
        <div>
          <Tooltip title="Klik untuk melihat rincian lengkap dokumen PR">
            <Button
              type="link"
              style={{
                padding: 0,
                fontWeight: 600,
                height: 'auto',
                color: token.colorPrimary,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={() => {
                setSelectedDetailPrId(record.id);
                setDetailModalOpen(true);
              }}
            >
              <FileTextOutlined />
              <span>{text}</span>
            </Button>
          </Tooltip>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
            {formatDate(record.createdAt)}
          </div>
        </div>
      ),
    },
    {
      title: 'Tgl Pengajuan',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (date: string) => <Text>{formatDate(date)}</Text>,
    },
    {
      title: 'Pemohon (Requester)',
      key: 'requester',
      render: (_: unknown, record: PurchaseRequestRow) => {
        const initials = getInitials(record.requesterName, record.requesterEmail);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#e6f4ff',
                color: '#0958d9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.2 }}>
                {record.requesterName || record.requesterEmail || 'Requester'}
              </Text>
              {record.requesterEmail && record.requesterName && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.requesterEmail}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Divisi & Unit Pengaju',
      key: 'division',
      render: (_: unknown, record: PurchaseRequestRow) => {
        const resolvedName =
          record.divisionName ||
          divisionNameMap.get(record.divisionId) ||
          FALLBACK_DIVISION_NAMES[record.divisionId] ||
          record.divisionId ||
          '-';

        return (
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 13 }}>{resolvedName}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.costCenter ? `Cost Center: ${record.costCenter}` : (record.divisionId ? `Kode: ${record.divisionId}` : '')}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Termin Bayar',
      dataIndex: 'paymentTermType',
      key: 'paymentTermType',
      render: (term: string) => (
        <Tag color={term === 'PAY_AFTER_RECEIPT' ? 'blue' : 'orange'}>
          {term === 'PAY_AFTER_RECEIPT' ? 'Pay After Receipt' : 'Advance / COD'}
        </Tag>
      ),
    },
    {
      title: 'Estimasi Nilai',
      dataIndex: 'totalEstimatedAmount',
      key: 'totalEstimatedAmount',
      render: (val: number) => <Text strong>{formatRupiah(Number(val) || 0)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: PurchaseRequestRow) => {
        const isApproved = status === 'APPROVED';
        const isFullyOrdered =
          record.remainingQuantity === 0 ||
          (record.poCount !== undefined && record.poCount > 0 && record.remainingQuantity === 0);

        return (
          <Space direction="vertical" size={4}>
            <StatusTag status={status} category="pr" />
            {isApproved && (
              isFullyOrdered ? (
                <Tag
                  color="cyan"
                  icon={<CheckCircleOutlined />}
                  style={{ borderRadius: 6, fontSize: 11, margin: 0 }}
                >
                  PO Terpenuhi
                </Tag>
              ) : record.relatedPos && record.relatedPos.length > 0 ? (
                <Tag color="blue" style={{ borderRadius: 6, fontSize: 11, margin: 0 }}>
                  PO Sebagian
                </Tag>
              ) : (
                <Tag color="default" style={{ borderRadius: 6, fontSize: 11, margin: 0 }}>
                  Belum Ada PO
                </Tag>
              )
            )}
          </Space>
        );
      },
    },
    {
      title: 'PO Terkait',
      key: 'relatedPos',
      width: 180,
      render: (_: unknown, record: PurchaseRequestRow) => {
        const pos = record.relatedPos || [];
        if (pos.length === 0) {
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.status === 'APPROVED' ? 'Belum terbit PO' : '-'}
            </Text>
          );
        }
        return (
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {pos.map((po) => {
              const statusLabel =
                po.status === 'COMPLETED'
                  ? 'PO Selesai Penuh'
                  : po.status === 'ISSUED'
                  ? 'PO Diterbitkan'
                  : po.status === 'DRAFT'
                  ? 'PO Draft'
                  : `PO ${po.status}`;

              return (
                <Tooltip
                  key={po.id}
                  title={
                    <div>
                      <div><Text strong style={{ color: '#fff' }}>{po.poNumber}</Text></div>
                      <div>Vendor: {po.vendorName || '-'}</div>
                      {po.grandTotalAmount !== undefined && (
                        <div>Nilai: {formatRupiah(po.grandTotalAmount)}</div>
                      )}
                      <div style={{ fontSize: 11, color: '#d9d9d9', marginTop: 4 }}>
                        Klik untuk membuka rincian dokumen PO
                      </div>
                    </div>
                  }
                >
                  <div
                    onClick={() => navigate(`/po?poId=${po.id}`)}
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '4px 8px',
                      borderRadius: 6,
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #e8e8e8',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0958d9', fontWeight: 600, fontSize: 11 }}>
                      <FileTextOutlined />
                      <span>{po.poNumber}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#8c8c8c' }}>{statusLabel}</span>
                  </div>
                </Tooltip>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: PurchaseRequestRow) => {
        const isSelfRequester = Boolean(record.requesterId && user?.id && record.requesterId === user.id);
        const canApprove = (user?.activeRole === 'APPROVER' || user?.activeRole === 'ADMIN') && !isSelfRequester;

        return (
          <Space size="small">
            <Tooltip title="Lihat Detail PR">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedDetailPrId(record.id);
                  setDetailModalOpen(true);
                }}
              >
                Detail
              </Button>
            </Tooltip>
            {record.status === 'DRAFT' && (user?.activeRole === 'REQUESTER' || user?.activeRole === 'ADMIN') && (
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate(record.id)}
              >
                Ajukan
              </Button>
            )}
            {record.status === 'SUBMITTED' && (
              <>
                {isSelfRequester ? (
                  <Tooltip title="Pelanggaran SoD (R15): Anda adalah pembuat PR ini. Persetujuan harus dilakukan oleh akun Approver lain.">
                    <Button
                      type="primary"
                      size="small"
                      disabled
                      icon={<CheckCircleOutlined />}
                    >
                      Setujui
                    </Button>
                  </Tooltip>
                ) : (
                  canApprove && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      loading={decideMutation.isPending}
                      onClick={() => decideMutation.mutate({ id: record.id, decision: 'APPROVED' })}
                    >
                      Setujui
                    </Button>
                  )
                )}
                {canApprove && (
                  <Button
                    danger
                    size="small"
                    icon={<CloseCircleOutlined />}
                    onClick={() => {
                      setSelectedPrId(record.id);
                      setRejectModalOpen(true);
                    }}
                  >
                    Tolak
                  </Button>
                )}
              </>
            )}
            {record.status === 'APPROVED' && (user?.activeRole === 'ACCOUNT_PAYABLE' || user?.activeRole === 'ADMIN') && (
              (record.remainingQuantity ?? 1) > 0 ? (
                <Button
                  type="dashed"
                  size="small"
                  icon={<ShoppingCartOutlined />}
                  onClick={() => navigate(`/po/create?prId=${record.id}`)}
                >
                  {record.relatedPos && record.relatedPos.length > 0 ? 'Terbitkan Sisa PO' : 'Terbitkan PO'}
                </Button>
              ) : (
                <Tag color="success">Selesai (PO Terpenuhi)</Tag>
              )
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section (Figma 02 Purchase Request) */}
      <div>
        <Breadcrumb
          items={[{ title: 'Pengadaan' }, { title: 'Purchase Request' }]}
          style={{ marginBottom: 12, fontSize: 13 }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#e6f4ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShoppingCartOutlined style={{ color: '#1677ff', fontSize: 22 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
                Purchase Request (PR)
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Kelola dan pantau pengajuan pengadaan barang/jasa dari seluruh unit kerja.
              </Text>
            </div>
          </div>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              Ekspor
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/pr/create')}
            >
              Buat PR Baru
            </Button>
          </Space>
        </div>
      </div>

      {/* Status Filter Tabs (Figma 02) */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={statusTabItems}
        style={{ marginBottom: -8 }}
      />

      {/* Main Table Card with Filter Row */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f0f0f0',
        }}
      >
        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Space wrap size="middle">
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 160 }}
              options={[
                { value: 'ALL', label: 'Semua status' },
                { value: 'SUBMITTED', label: 'Menunggu Persetujuan' },
                { value: 'APPROVED', label: 'Disetujui' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'REJECTED', label: 'Ditolak' },
              ]}
            />
            <Select
              value={filterDivision}
              onChange={setFilterDivision}
              style={{ width: 220 }}
              options={[
                { value: 'ALL', label: 'Semua divisi' },
                ...activeDivisions.map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
            <Select
              value={filterPeriod}
              onChange={setFilterPeriod}
              style={{ width: 160 }}
              options={[
                { value: 'ALL', label: 'Semua periode' },
                { value: '30D', label: '30 Hari Terakhir' },
                { value: '90D', label: 'Kuartal Ini' },
                { value: '2026', label: 'Tahun 2026' },
              ]}
            />
          </Space>

          <Input
            placeholder="Cari nomor PR, pemohon, atau divisi..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredPrList}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total} PR`,
          }}
        />
      </Card>

      {/* Reject Modal */}
      <Modal
        title="Tolak Permintaan Pembelian"
        open={rejectModalOpen}
        onOk={() => {
          if (selectedPrId && rejectionReason) {
            decideMutation.mutate({ id: selectedPrId, decision: 'REJECTED', reason: rejectionReason });
          }
        }}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectionReason('');
        }}
        okText="Konfirmasi Penolakan"
        okButtonProps={{ danger: true, disabled: !rejectionReason }}
      >
        <Text>Masukkan alasan penolakan purchase request secara terperinci:</Text>
        <Input.TextArea
          rows={4}
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Contoh: Estimasi anggaran melebihi alokasi CAPEX Q3"
          style={{ marginTop: 12 }}
        />
      </Modal>

      {/* PR Detail Modal */}
      <PrDetailModal
        open={detailModalOpen}
        prId={selectedDetailPrId}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedDetailPrId(null);
        }}
        onStatusUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
        }}
      />
    </div>
  );
};

export default PrListPage;
