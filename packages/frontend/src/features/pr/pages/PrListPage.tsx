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
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
  InboxOutlined,
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
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'ALL' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'ALL' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {prList.length}
          </span>
        </Space>
      ),
    },
    {
      key: 'SUBMITTED',
      label: (
        <Space size={6}>
          <span>Menunggu Persetujuan</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'SUBMITTED' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'SUBMITTED' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {submittedCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'APPROVED',
      label: (
        <Space size={6}>
          <span>Disetujui</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'APPROVED' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'APPROVED' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {approvedCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'DRAFT',
      label: (
        <Space size={6}>
          <span>Draft</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'DRAFT' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'DRAFT' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {draftCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'REJECTED',
      label: (
        <Space size={6}>
          <span>Ditolak</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'REJECTED' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'REJECTED' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {rejectedCount}
          </span>
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
            <span
              style={{
                color: '#0052cc',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
              onClick={() => {
                setSelectedDetailPrId(record.id);
                setDetailModalOpen(true);
              }}
            >
              {text}
            </span>
          </Tooltip>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
            {formatDate(record.createdAt)}
          </div>
        </div>
      ),
    },
    {
      title: 'Pemohon',
      key: 'requester',
      render: (_: unknown, record: PurchaseRequestRow) => (
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.3, color: '#1f1f1f' }}>
            {record.requesterName || record.requesterEmail || 'Requester'}
          </Text>
          {record.requesterEmail && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
              {record.requesterEmail}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Divisi',
      key: 'division',
      render: (_: unknown, record: PurchaseRequestRow) => {
        const divisionCode = record.divisionId || record.divisionName || '-';
        return (
          <div>
            <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.3, color: '#1f1f1f' }}>
              {divisionCode}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
              {record.costCenter || '-'}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Termin bayar',
      dataIndex: 'paymentTermType',
      key: 'paymentTermType',
      render: (term: string) => {
        const label =
          term === 'PAY_AFTER_RECEIPT'
            ? 'Pay After Receipt'
            : term === 'ADVANCE'
            ? 'Advance'
            : term || 'Pay After Receipt';
        return <Text style={{ fontSize: 13, color: '#262626' }}>{label}</Text>;
      },
    },
    {
      title: 'Estimasi nilai',
      dataIndex: 'totalEstimatedAmount',
      key: 'totalEstimatedAmount',
      render: (val: number) => (
        <Text strong style={{ fontSize: 13, color: '#1f1f1f' }}>
          {formatRupiah(Number(val) || 0)}
        </Text>
      ),
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
            {status === 'APPROVED' ? (
              <Tag
                color="success"
                icon={<CheckCircleFilled style={{ color: '#52c41a' }} />}
                style={{
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '1px 8px',
                  margin: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Disetujui
              </Tag>
            ) : status === 'SUBMITTED' ? (
              <Tag
                color="processing"
                icon={<ClockCircleOutlined />}
                style={{ borderRadius: 6, fontSize: 11, padding: '1px 8px', margin: 0 }}
              >
                Menunggu Persetujuan
              </Tag>
            ) : status === 'DRAFT' ? (
              <Tag
                style={{
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '1px 8px',
                  margin: 0,
                  backgroundColor: '#f5f5f5',
                  color: '#595959',
                }}
              >
                Draft
              </Tag>
            ) : (
              <Tag
                color="error"
                icon={<CloseCircleOutlined />}
                style={{ borderRadius: 6, fontSize: 11, padding: '1px 8px', margin: 0 }}
              >
                Ditolak
              </Tag>
            )}

            {isApproved && (
              isFullyOrdered ? (
                <Tag
                  style={{
                    borderRadius: 6,
                    fontSize: 11,
                    padding: '1px 8px',
                    margin: 0,
                    backgroundColor: '#e6fffb',
                    borderColor: '#87e8de',
                    color: '#08979c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <InboxOutlined style={{ fontSize: 12 }} />
                  <span>PO Terpenuhi</span>
                </Tag>
              ) : record.relatedPos && record.relatedPos.length > 0 ? (
                <Tag
                  style={{
                    borderRadius: 6,
                    fontSize: 11,
                    padding: '1px 8px',
                    margin: 0,
                    backgroundColor: '#e6f4ff',
                    borderColor: '#91caff',
                    color: '#0958d9',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <InboxOutlined style={{ fontSize: 12 }} />
                  <span>PO Sebagian</span>
                </Tag>
              ) : (
                <Tag
                  style={{
                    borderRadius: 6,
                    fontSize: 11,
                    padding: '1px 8px',
                    margin: 0,
                    backgroundColor: '#fafafa',
                    borderColor: '#d9d9d9',
                    color: '#8c8c8c',
                  }}
                >
                  Belum Ada PO
                </Tag>
              )
            )}
          </Space>
        );
      },
    },
    {
      title: 'PO terkait', // PO Terkait
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
                      <div style={{ fontWeight: 600 }}>{po.poNumber}</div>
                      <div>Vendor: {po.vendorName || '-'}</div>
                      {po.grandTotalAmount !== undefined && (
                        <div>Nilai: {formatRupiah(po.grandTotalAmount)}</div>
                      )}
                      <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>
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
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 8px',
                        borderRadius: 6,
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #d9d9d9',
                        fontSize: 11,
                        color: '#262626',
                        fontWeight: 500,
                      }}
                    >
                      <FileTextOutlined style={{ color: '#8c8c8c' }} />
                      <span>{po.poNumber}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{statusLabel}</span>
                  </div>
                </Tooltip>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 50,
      align: 'center',
      render: (_: unknown, record: PurchaseRequestRow) => {
        // Quick action context notes:
        // When opening the PR detail modal, users can perform actions:
        // - Requester can 'Ajukan'
        // - Approver can 'Setujui' or 'Tolak'
        // - AP/Admin can 'Terbitkan PO' / 'Terbitkan Sisa PO' or complete with 'Selesai (PO Terpenuhi)'
        return (
          <Tooltip title="Lihat Detail PR">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ fontSize: 16, color: '#595959' }} />}
              onClick={() => {
                setSelectedDetailPrId(record.id);
                setDetailModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 6,
              }}
            />
          </Tooltip>
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
