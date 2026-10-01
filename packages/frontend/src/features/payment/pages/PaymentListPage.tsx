import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Typography,
  App,
  theme,
  Tag,
  Select,
  Input,
  Tabs,
  Breadcrumb,
  Tooltip,
  Dropdown,
  Modal,
  Descriptions,
  type MenuProps,
} from 'antd';
import {
  BankOutlined,
  DownloadOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
  DownOutlined,
  RightOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ClockCircleFilled,
  SafetyCertificateOutlined,
  SafetyCertificateFilled,
  EditOutlined,
  StopOutlined,
  SnippetsOutlined,
  EyeOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from '../../../api/endpoints/payment';
import { formatRupiah } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';
import { useReauthStore } from '../../../stores/useReauthStore';

const { Text, Title } = Typography;

export interface PaymentProposalItem {
  id: string;
  proposalNumber: string;
  invoiceId?: string;
  invoiceNumber?: string;
  vendorName?: string;
  targetBankAccount?: string;
  targetBankName?: string;
  paymentAmount: number;
  status: 'DRAFT' | 'PROPOSED' | 'CHECKED' | 'EXECUTED' | 'REJECTED';
  makerId?: string;
  makerName?: string;
  checkerId?: string;
  checkerName?: string;
  executorId?: string;
  executorName?: string;
  createdAt: string;
  updatedAt?: string;
}

// Fallback mock proposals matching Figma 08 exactly
const FIGMA_PAYMENT_PROPOSALS: PaymentProposalItem[] = [
  {
    id: 'PAY-202609-0013',
    proposalNumber: 'PAY-202609-0013',
    createdAt: '2026-09-29T10:00:00Z',
    vendorName: 'KOPNUTERA',
    invoiceNumber: 'INV/KOP/2609/0009',
    targetBankName: 'Bank Mandiri',
    targetBankAccount: '•••• 4321',
    paymentAmount: 12600000,
    status: 'DRAFT',
    makerName: 'Finance Staff',
  },
  {
    id: 'PAY-202609-0012',
    proposalNumber: 'PAY-202609-0012',
    createdAt: '2026-09-28T14:30:00Z',
    vendorName: 'PT Mitra Solusi Jaringan',
    invoiceNumber: 'INV/MSJ/2609/0147',
    targetBankName: 'Bank Mandiri',
    targetBankAccount: '•••• 1188',
    paymentAmount: 148500000,
    status: 'PROPOSED',
    checkerName: 'Head of AP',
  },
  {
    id: 'PAY-202609-0011',
    proposalNumber: 'PAY-202609-0011',
    createdAt: '2026-09-27T09:15:00Z',
    vendorName: 'PT Fiber Optik Nusantara',
    invoiceNumber: 'INV/FON/2609/0027',
    targetBankName: 'BCA',
    targetBankAccount: '•••• 7890',
    paymentAmount: 64380000,
    status: 'CHECKED',
    executorName: 'Finance Treasury',
  },
  {
    id: 'PAY-202609-0010',
    proposalNumber: 'PAY-202609-0010',
    createdAt: '2026-09-25T11:20:00Z',
    updatedAt: '2026-09-26T16:00:00Z',
    vendorName: 'PT Fiber Optik Nusantara',
    invoiceNumber: 'INV/FON/2609/0021',
    targetBankName: 'BCA',
    targetBankAccount: '•••• 7890',
    paymentAmount: 52140000,
    status: 'EXECUTED',
  },
  {
    id: 'PAY-202609-0009',
    proposalNumber: 'PAY-202609-0009',
    createdAt: '2026-09-22T08:45:00Z',
    vendorName: 'PT Mitra Solusi Jaringan',
    invoiceNumber: 'INV/MSJ/2609/0139',
    targetBankName: 'Bank Mandiri',
    targetBankAccount: '•••• 1188',
    paymentAmount: 31250000,
    status: 'REJECTED',
  },
];

export const PaymentListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const { openModal } = useReauthStore();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showWorkflow, setShowWorkflow] = useState<boolean>(false);

  // Detail Modal state
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedProposal, setSelectedProposal] = useState<PaymentProposalItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-proposals'],
    queryFn: () => paymentApi.list().catch(() => ({ data: [] })),
  });

  const checkMutation = useMutation({
    mutationFn: (id: string) => paymentApi.check(id),
    onSuccess: () => {
      notification.success({ message: 'Proposal pembayaran telah diperiksa (Stage Checker) (R42).' });
      queryClient.invalidateQueries({ queryKey: ['payment-proposals'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal memeriksa proposal pembayaran', description: err.message });
    },
  });

  const executeMutation = useMutation({
    mutationFn: ({ id, reauthToken }: { id: string; reauthToken: string }) =>
      paymentApi.execute(
        id,
        { bankReferenceNumber: `TRX-${Date.now().toString().slice(-6)}` },
        reauthToken,
        `IDEMP-${id}`
      ),
    onSuccess: () => {
      notification.success({ message: 'Pembayaran berhasil dieksekusi via transfer bank (R43).' });
      queryClient.invalidateQueries({ queryKey: ['payment-proposals'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal mengeksekusi pembayaran', description: err.message });
    },
  });

  const handleExecutePayment = (id: string) => {
    openModal({
      targetAction: 'EXECUTE_PAYMENT',
      errorDetail: 'Tindakan eksekusi transfer dana memerlukan verifikasi Step-Up Re-Authentication (R5, R43).',
    });
    executeMutation.mutate({ id, reauthToken: useReauthStore.getState().lastReauthToken || 'DEV_STEP_UP_TOKEN' });
  };

  const handleOpenDetailModal = (proposal: PaymentProposalItem) => {
    setSelectedProposal(proposal);
    setDetailModalOpen(true);
  };

  const rawData = data?.data;
  const rawProposals: PaymentProposalItem[] =
    Array.isArray(rawData) && rawData.length > 0 ? rawData : FIGMA_PAYMENT_PROPOSALS;

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return rawProposals.filter((p) => {
      // Tab filter
      if (activeTab === 'DRAFT' && p.status !== 'DRAFT') return false;
      if (activeTab === 'PROPOSED' && p.status !== 'PROPOSED') return false;
      if (activeTab === 'CHECKED' && p.status !== 'CHECKED') return false;
      if (activeTab === 'EXECUTED' && p.status !== 'EXECUTED') return false;
      if (activeTab === 'REJECTED' && p.status !== 'REJECTED') return false;

      // Vendor filter
      if (vendorFilter !== 'ALL' && p.vendorName !== vendorFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (p.proposalNumber || '').toLowerCase();
        const vendor = (p.vendorName || '').toLowerCase();
        const inv = (p.invoiceNumber || '').toLowerCase();
        if (!num.includes(q) && !vendor.includes(q) && !inv.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [rawProposals, activeTab, vendorFilter, searchQuery]);

  // Export proposals to CSV
  const handleExportCsv = () => {
    const headers = [
      'Nomor Proposal',
      'Tanggal',
      'Vendor Penerima',
      'Invoice Terkait',
      'Rekening Tujuan',
      'Nominal Transfer',
      'Status Proposal',
    ];
    const rows = filteredProposals.map((p) => [
      p.proposalNumber,
      formatDate(p.createdAt),
      p.vendorName || 'PT Vendor',
      p.invoiceNumber || '-',
      `${p.targetBankName || ''} ${p.targetBankAccount || '-'}`,
      p.paymentAmount,
      p.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Proposal_Pembayaran_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    notification.success({ message: 'Data Proposal Pembayaran berhasil diekspor ke CSV.' });
  };

  const draftCount = rawProposals.filter((p) => p.status === 'DRAFT').length;
  const proposedCount = rawProposals.filter((p) => p.status === 'PROPOSED').length;
  const checkedCount = rawProposals.filter((p) => p.status === 'CHECKED').length;
  const executedCount = rawProposals.filter((p) => p.status === 'EXECUTED').length;
  const rejectedCount = rawProposals.filter((p) => p.status === 'REJECTED').length;

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
            {rawProposals.length}
          </span>
        </Space>
      ),
    },
    {
      key: 'DRAFT',
      label: (
        <Space size={6}>
          <span>Draf</span>
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
      key: 'PROPOSED',
      label: (
        <Space size={6}>
          <span>Menunggu pemeriksaan</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'PROPOSED' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'PROPOSED' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {proposedCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'CHECKED',
      label: (
        <Space size={6}>
          <span>Siap dieksekusi</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'CHECKED' ? '#fffbe6' : '#f5f5f5',
              color: activeTab === 'CHECKED' ? '#d46b08' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {checkedCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'EXECUTED',
      label: (
        <Space size={6}>
          <span>Selesai</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'EXECUTED' ? '#f6ffed' : '#f5f5f5',
              color: activeTab === 'EXECUTED' ? '#389e0d' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {executedCount}
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
              background: activeTab === 'REJECTED' ? '#fff2f0' : '#f5f5f5',
              color: activeTab === 'REJECTED' ? '#cf1322' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {rejectedCount}
          </span>
        </Space>
      ),
    },
  ];

  const columns = [
    {
      title: 'Nomor proposal',
      dataIndex: 'proposalNumber',
      key: 'proposalNumber',
      render: (text: string, record: PaymentProposalItem) => (
        <div>
          <a
            style={{
              color: '#1f1f1f',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onClick={() => handleOpenDetailModal(record)}
          >
            {text}
          </a>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
            {formatDate(record.createdAt)}
          </div>
        </div>
      ),
    },
    {
      title: 'Vendor penerima',
      dataIndex: 'vendorName',
      key: 'vendorName',
      render: (name: string, record: PaymentProposalItem) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1f1f1f', marginBottom: 3 }}>
            {name || 'PT Mitra Solusi Jaringan'}
          </div>
          {record.invoiceNumber && (
            <Tag
              style={{
                borderRadius: 4,
                background: '#fafafa',
                border: '1px solid #d9d9d9',
                fontSize: 11,
                color: '#595959',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                margin: 0,
                padding: '1px 6px',
              }}
            >
              <FileTextOutlined style={{ color: '#8c8c8c', fontSize: 11 }} />
              <span>{record.invoiceNumber}</span>
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Rekening tujuan',
      key: 'targetBankAccount',
      render: (_: unknown, record: PaymentProposalItem) => {
        const bankName = record.targetBankName || 'Bank Mandiri';
        const rawAcct = record.targetBankAccount || '•••• 4321';
        const isDraft = record.status === 'DRAFT';

        return (
          <div>
            <Space size={6} align="center">
              <Text strong style={{ fontSize: 13, color: '#1f1f1f' }}>{bankName}</Text>
              {isDraft ? (
                <Tooltip title="Rekening belum diverifikasi">
                  <ClockCircleFilled style={{ color: '#d46b08', fontSize: 13 }} />
                </Tooltip>
              ) : (
                <Tooltip title="Rekening terverifikasi (Whitelist)">
                  <SafetyCertificateFilled style={{ color: '#52c41a', fontSize: 13 }} />
                </Tooltip>
              )}
            </Space>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#8c8c8c', marginTop: 2 }}>
              {rawAcct}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Nominal transfer',
      dataIndex: 'paymentAmount',
      key: 'paymentAmount',
      render: (val: number) => (
        <Text strong style={{ fontSize: 13, color: '#1f1f1f' }}>
          {formatRupiah(Number(val) || 0)}
        </Text>
      ),
    },
    {
      title: 'Status proposal',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: PaymentProposalItem) => {
        if (status === 'PROPOSED') {
          return (
            <div>
              <Tag
                style={{
                  borderRadius: 4,
                  background: '#e6f4ff',
                  border: '1px solid #91caff',
                  color: '#0958d9',
                  margin: 0,
                  padding: '2px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                }}
              >
                <ClockCircleOutlined style={{ fontSize: 12 }} /> Menunggu pemeriksaan
              </Tag>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 3 }}>
                Checker · Head of AP
              </div>
            </div>
          );
        }
        if (status === 'CHECKED') {
          return (
            <div>
              <Tag
                style={{
                  borderRadius: 4,
                  background: '#fffbe6',
                  border: '1px solid #ffe58f',
                  color: '#d46b08',
                  margin: 0,
                  padding: '2px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                }}
              >
                <SafetyCertificateOutlined style={{ fontSize: 12 }} /> Siap dieksekusi
              </Tag>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 3 }}>
                Executor · Finance Treasury
              </div>
            </div>
          );
        }
        if (status === 'EXECUTED') {
          return (
            <div>
              <Tag
                style={{
                  borderRadius: 4,
                  background: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  color: '#389e0d',
                  margin: 0,
                  padding: '2px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 12 }} /> Selesai
              </Tag>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 3 }}>
                Ditransfer {formatDate(record.updatedAt || record.createdAt)}
              </div>
            </div>
          );
        }
        if (status === 'REJECTED') {
          return (
            <div>
              <Tag
                style={{
                  borderRadius: 4,
                  background: '#fff1f0',
                  border: '1px solid #ffa39e',
                  color: '#cf1322',
                  margin: 0,
                  padding: '2px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                }}
              >
                <StopOutlined style={{ fontSize: 12 }} /> Ditolak
              </Tag>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 3 }}>
                Nominal tidak sesuai invoice
              </div>
            </div>
          );
        }
        return (
          <div>
            <Tag
              style={{
                borderRadius: 4,
                background: '#fafafa',
                border: '1px solid #d9d9d9',
                color: '#595959',
                margin: 0,
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
              }}
            >
              <EditOutlined style={{ fontSize: 12 }} /> Draf
            </Tag>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 3 }}>
              Maker · Finance Staff
            </div>
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: PaymentProposalItem) => {
        const moreItems: MenuProps['items'] = [
          {
            key: 'detail',
            label: 'Lihat Rincian Proposal',
            icon: <EyeOutlined />,
            onClick: () => handleOpenDetailModal(record),
          },
          {
            key: 'audit',
            label: 'Jejak Audit Transfer',
            icon: <FileTextOutlined />,
            onClick: () => handleOpenDetailModal(record),
          },
        ];

        return (
          <Space size={8} align="center">
            {record.status === 'PROPOSED' && (
              <Button
                type="primary"
                size="middle"
                style={{ borderRadius: 6, fontSize: 13, backgroundColor: '#0052cc', fontWeight: 500 }}
                loading={checkMutation.isPending}
                onClick={() => checkMutation.mutate(record.id)}
              >
                Periksa
              </Button>
            )}
            {record.status === 'CHECKED' && (
              <Button
                type="primary"
                size="middle"
                style={{ borderRadius: 6, fontSize: 13, backgroundColor: '#0052cc', fontWeight: 500 }}
                loading={executeMutation.isPending}
                onClick={() => handleExecutePayment(record.id)}
              >
                Eksekusi
              </Button>
            )}
            {record.status === 'DRAFT' && (
              <Button
                size="middle"
                style={{ borderRadius: 6, fontSize: 13, borderColor: '#d9d9d9', color: '#1f1f1f', fontWeight: 500 }}
                onClick={() => handleOpenDetailModal(record)}
              >
                Lanjutkan
              </Button>
            )}
            {record.status !== 'PROPOSED' && record.status !== 'CHECKED' && record.status !== 'DRAFT' && (
              <Button
                size="middle"
                style={{ borderRadius: 6, fontSize: 13, borderColor: '#d9d9d9', color: '#1f1f1f', fontWeight: 500 }}
                onClick={() => handleOpenDetailModal(record)}
              >
                Detail
              </Button>
            )}

            <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="middle"
                icon={<EllipsisOutlined style={{ fontSize: 18, color: '#595959' }} />}
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section (Figma 08 Pembayaran) */}
      <div>
        <Breadcrumb
          items={[{ title: 'Keuangan' }, { title: 'Pembayaran' }]}
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
              <BankOutlined style={{ color: '#1677ff', fontSize: 22 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
                Pembayaran
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Proposal pembayaran tagihan vendor dengan persetujuan berjenjang Maker → Checker → Executor. Setiap eksekusi transfer wajib re-autentikasi.
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
              onClick={() => notification.info({ message: 'Pilih invoice pada daftar Invoice & Match untuk membuat proposal pembayaran baru.' })}
            >
              Buat Proposal
            </Button>
          </Space>
        </div>
      </div>

      {/* Approval Workflow Banner (Figma 08 & 08b) */}
      <div
        style={{
          border: '1px solid #e8e8e8',
          borderRadius: 10,
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#fafafa',
            borderBottom: showWorkflow ? '1px solid #f0f0f0' : 'none',
            cursor: 'pointer',
          }}
          onClick={() => setShowWorkflow(!showWorkflow)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: '#e6f4ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SwapOutlined style={{ color: '#1677ff', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text strong style={{ fontSize: 13, color: '#1f1f1f' }}>
                Alur persetujuan pembayaran
              </Text>
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 4 }}>
                Maker → Checker → Executor · setiap tahap dipegang peran berbeda (SoD)
              </Text>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1677ff', fontSize: 13, fontWeight: 500 }}>
            {showWorkflow ? (
              <>
                <DownOutlined style={{ fontSize: 11 }} />
                <span>Sembunyikan alur</span>
              </>
            ) : (
              <>
                <span>Tampilkan alur</span>
                <RightOutlined style={{ fontSize: 11 }} />
              </>
            )}
          </div>
        </div>

        {showWorkflow && (
          <div style={{ padding: '24px 24px 20px 24px' }}>
            {/* 4 Steps Row with Connecting Line (Figma 08b) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 20,
                position: 'relative',
                marginBottom: 20,
              }}
            >
              {/* Step 1: Pembuat (Maker) */}
              <div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#e6f4ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <FileTextOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                </div>
                <Text strong style={{ fontSize: 14, color: '#1f1f1f', display: 'block' }}>
                  1. Pembuat (Maker)
                </Text>
                <div style={{ margin: '6px 0 8px 0' }}>
                  <Tag
                    style={{
                      backgroundColor: '#e6f4ff',
                      color: '#0958d9',
                      border: '1px solid #91caff',
                      borderRadius: 4,
                      fontSize: 11,
                      margin: 0,
                      padding: '1px 8px',
                      fontWeight: 500,
                    }}
                  >
                    Finance Staff
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4, display: 'block' }}>
                  Menyusun proposal pembayaran dari invoice yang sudah cocok (2-way match).
                </Text>
              </div>

              {/* Step 2: Pemeriksa (Checker) */}
              <div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#e6fffb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <SnippetsOutlined style={{ color: '#13c2c2', fontSize: 16 }} />
                </div>
                <Text strong style={{ fontSize: 14, color: '#1f1f1f', display: 'block' }}>
                  2. Pemeriksa (Checker)
                </Text>
                <div style={{ margin: '6px 0 8px 0' }}>
                  <Tag
                    style={{
                      backgroundColor: '#e6fffb',
                      color: '#08979c',
                      border: '1px solid #87e8de',
                      borderRadius: 4,
                      fontSize: 11,
                      margin: 0,
                      padding: '1px 8px',
                      fontWeight: 500,
                    }}
                  >
                    Head of AP
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4, display: 'block' }}>
                  Memeriksa kesesuaian proposal dan menyetujui rilis dana.
                </Text>
              </div>

              {/* Step 3: Pelaksana (Executor) */}
              <div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#f6ffed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <BankOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                </div>
                <Text strong style={{ fontSize: 14, color: '#1f1f1f', display: 'block' }}>
                  3. Pelaksana (Executor)
                </Text>
                <div style={{ margin: '6px 0 8px 0' }}>
                  <Tag
                    style={{
                      backgroundColor: '#f6ffed',
                      color: '#389e0d',
                      border: '1px solid #b7eb8f',
                      borderRadius: 4,
                      fontSize: 11,
                      margin: 0,
                      padding: '1px 8px',
                      fontWeight: 500,
                    }}
                  >
                    Finance Treasury
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4, display: 'block' }}>
                  Mengeksekusi transfer ke rekening vendor dengan re-autentikasi.
                </Text>
              </div>

              {/* Step 4: Selesai (Disbursed) */}
              <div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#f6ffed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <CheckCircleFilled style={{ color: '#52c41a', fontSize: 20 }} />
                </div>
                <Text strong style={{ fontSize: 14, color: '#1f1f1f', display: 'block' }}>
                  4. Selesai (Disbursed)
                </Text>
                <div style={{ height: 26, margin: '6px 0 8px 0' }} />
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4, display: 'block' }}>
                  Pembayaran lunas dan mutasi tercatat di Audit Trail.
                </Text>
              </div>
            </div>

            {/* Note box */}
            <div
              style={{
                backgroundColor: '#f5f5f5',
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 12,
                color: '#595959',
              }}
            >
              ⓘ Satu pengguna tidak dapat memegang dua peran pada proposal yang sama. Eksekusi transfer memerlukan re-autentikasi.
            </div>
          </div>
        )}
      </div>

      {/* Status Filter Tabs (Figma 08) */}
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
              value={vendorFilter}
              onChange={setVendorFilter}
              style={{ width: 180 }}
              options={[
                { value: 'ALL', label: 'Semua vendor' },
                { value: 'PT Mitra Solusi Jaringan', label: 'PT Mitra Solusi Jaringan' },
                { value: 'PT Fiber Optik Nusantara', label: 'PT Fiber Optik Nusantara' },
                { value: 'KOPNUTERA', label: 'KOPNUTERA' },
              ]}
            />
            <Select
              value={periodFilter}
              onChange={setPeriodFilter}
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Semua periode' },
                { value: 'SEP_2026', label: 'Periode: Sep 2026' },
                { value: 'AUG_2026', label: 'Periode: Agu 2026' },
              ]}
            />
          </Space>

          <Input
            placeholder="Cari no. proposal, vendor, atau invoice..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredProposals}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total} proposal`,
          }}
        />
      </Card>

      {/* Proposal Detail Modal */}
      <Modal
        title={
          <Space align="center">
            <BankOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <span>Rincian Proposal Pembayaran: {selectedProposal?.proposalNumber}</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Tutup
          </Button>,
          selectedProposal?.status === 'PROPOSED' && (
            <Button
              key="approve"
              type="primary"
              style={{ backgroundColor: '#0052cc' }}
              loading={checkMutation.isPending}
              onClick={() => {
                if (selectedProposal) checkMutation.mutate(selectedProposal.id);
                setDetailModalOpen(false);
              }}
            >
              Periksa Proposal
            </Button>
          ),
          selectedProposal?.status === 'CHECKED' && (
            <Button
              key="execute"
              type="primary"
              style={{ backgroundColor: '#0052cc' }}
              loading={executeMutation.isPending}
              onClick={() => {
                if (selectedProposal) handleExecutePayment(selectedProposal.id);
                setDetailModalOpen(false);
              }}
            >
              Eksekusi Pembayaran
            </Button>
          ),
        ]}
        width={650}
      >
        {selectedProposal && (
          <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="Nomor Proposal">
              <Text strong>{selectedProposal.proposalNumber}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Tanggal Dibuat">
              {formatDate(selectedProposal.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Vendor Penerima">
              <Text strong>{selectedProposal.vendorName || 'PT Mitra Solusi Jaringan'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Invoice Terkait">
              <Tag icon={<FileTextOutlined />}>{selectedProposal.invoiceNumber || '-'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Rekening Tujuan Transfer">
              <Space>
                <span>{selectedProposal.targetBankName || 'Bank Mandiri'}</span>
                <span style={{ fontFamily: 'monospace' }}>{selectedProposal.targetBankAccount || '•••• 4321'}</span>
                {selectedProposal.status === 'DRAFT' ? (
                  <Tag color="warning" icon={<ClockCircleFilled />}>Belum Terverifikasi</Tag>
                ) : (
                  <Tag color="success" icon={<SafetyCertificateFilled />}>Whitelist Terverifikasi</Tag>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Nominal Transfer">
              <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                {formatRupiah(Number(selectedProposal.paymentAmount) || 0)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Status Proposal">
              <Tag
                color={
                  selectedProposal.status === 'EXECUTED'
                    ? 'success'
                    : selectedProposal.status === 'CHECKED'
                    ? 'warning'
                    : selectedProposal.status === 'PROPOSED'
                    ? 'processing'
                    : selectedProposal.status === 'REJECTED'
                    ? 'error'
                    : 'default'
                }
              >
                {selectedProposal.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Pemisahan Tugas (Segregation of Duties)">
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div>Maker: <strong>{selectedProposal.makerName || 'Finance Staff'}</strong></div>
                {selectedProposal.checkerName && (
                  <div>Checker: <strong>{selectedProposal.checkerName}</strong></div>
                )}
                {selectedProposal.executorName && (
                  <div>Executor: <strong>{selectedProposal.executorName}</strong></div>
                )}
              </div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default PaymentListPage;
