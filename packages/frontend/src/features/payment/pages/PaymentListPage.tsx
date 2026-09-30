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
  type MenuProps,
} from 'antd';
import {
  CheckOutlined,
  ThunderboltOutlined,
  DollarCircleOutlined,
  BankOutlined,
  DownloadOutlined,
  SearchOutlined,
  SwapOutlined,
  DownOutlined,
  UpOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from '../../../api/endpoints/payment';
import { formatRupiah } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';
import { useReauthStore } from '../../../stores/useReauthStore';
import { PaymentWorkflowSteps } from '../components/PaymentWorkflowSteps';

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

const mapPaymentStatusToStep = (
  status?: string
): 'DRAFT' | 'PENDING_CHECK' | 'APPROVED_FOR_PAYMENT' | 'IN_PROGRESS' | 'PAID' | 'REJECTED' => {
  if (status === 'PROPOSED') return 'PENDING_CHECK';
  if (status === 'CHECKED') return 'APPROVED_FOR_PAYMENT';
  if (status === 'EXECUTED') return 'PAID';
  if (status === 'REJECTED') return 'REJECTED';
  return 'DRAFT';
};

export const PaymentListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const { openModal } = useReauthStore();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showWorkflow, setShowWorkflow] = useState<boolean>(true);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-proposals'],
    queryFn: () => paymentApi.list(),
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

  const rawProposals: PaymentProposalItem[] = data?.data || [];

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
      p.targetBankAccount || '-',
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
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'ALL' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'ALL' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {rawProposals.length}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'DRAFT',
      label: (
        <Space size={6}>
          <span>Draf</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'DRAFT' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'DRAFT' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {draftCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'PROPOSED',
      label: (
        <Space size={6}>
          <span>Menunggu pemeriksaan</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'PROPOSED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'PROPOSED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {proposedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'CHECKED',
      label: (
        <Space size={6}>
          <span>Siap dieksekusi</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'CHECKED' ? '#fffbe6' : '#f5f5f5', color: activeTab === 'CHECKED' ? '#d46b08' : '#8c8c8c', border: 'none' }}>
            {checkedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'EXECUTED',
      label: (
        <Space size={6}>
          <span>Selesai</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'EXECUTED' ? '#f6ffed' : '#f5f5f5', color: activeTab === 'EXECUTED' ? '#389e0d' : '#8c8c8c', border: 'none' }}>
            {executedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'REJECTED',
      label: (
        <Space size={6}>
          <span>Ditolak</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'REJECTED' ? '#fff2f0' : '#f5f5f5', color: activeTab === 'REJECTED' ? '#cf1322' : '#8c8c8c', border: 'none' }}>
            {rejectedCount}
          </Tag>
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
          <Text strong style={{ color: token.colorPrimary, fontSize: 13 }}>
            {text}
          </Text>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
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
          <Text strong style={{ fontSize: 13, display: 'block' }}>
            {name || 'PT Mitra Solusi Jaringan'}
          </Text>
          {record.invoiceNumber && (
            <div style={{ marginTop: 2 }}>
              <Tag
                style={{
                  borderRadius: 4,
                  background: '#f5f5f5',
                  border: '1px solid #e8e8e8',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  margin: 0,
                }}
              >
                <FileTextOutlined style={{ color: '#8c8c8c' }} />
                <span>{record.invoiceNumber}</span>
              </Tag>
            </div>
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
        const masked = rawAcct.length > 4 ? `•••• ${rawAcct.slice(-4)}` : rawAcct;

        return (
          <div>
            <Space size={4}>
              <Text strong style={{ fontSize: 13 }}>{bankName}</Text>
              {record.status === 'DRAFT' ? (
                <ClockCircleOutlined style={{ color: '#faad14' }} />
              ) : (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              )}
            </Space>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: token.colorTextSecondary }}>
              {masked}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Nominal transfer',
      dataIndex: 'paymentAmount',
      key: 'paymentAmount',
      render: (val: number) => <Text strong style={{ fontSize: 13 }}>{formatRupiah(Number(val) || 0)}</Text>,
    },
    {
      title: 'Status proposal',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: PaymentProposalItem) => {
        if (status === 'PROPOSED') {
          return (
            <div>
              <Tag color="processing" style={{ borderRadius: 4, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ClockCircleOutlined /> Menunggu pemeriksaan
              </Tag>
              <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                Checker · Head of AP
              </div>
            </div>
          );
        }
        if (status === 'CHECKED') {
          return (
            <div>
              <Tag color="warning" style={{ borderRadius: 4, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckOutlined /> Siap dieksekusi
              </Tag>
              <div style={{ fontSize: 11, color: '#d46b08', marginTop: 2 }}>
                Executor · Finance Treasury
              </div>
            </div>
          );
        }
        if (status === 'EXECUTED') {
          return (
            <div>
              <Tag color="success" style={{ borderRadius: 4, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircleOutlined /> Selesai
              </Tag>
              <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                Ditransfer {formatDate(record.updatedAt || record.createdAt)}
              </div>
            </div>
          );
        }
        if (status === 'REJECTED') {
          return (
            <div>
              <Tag color="error" style={{ borderRadius: 4, margin: 0 }}>Ditolak</Tag>
              <div style={{ fontSize: 11, color: '#cf1322', marginTop: 2 }}>
                Nominal tidak sesuai invoice
              </div>
            </div>
          );
        }
        return (
          <div>
            <Tag style={{ borderRadius: 4, margin: 0 }}>Draf</Tag>
            <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
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
          },
          {
            key: 'audit',
            label: 'Jejak Audit Transfer',
            icon: <FileTextOutlined />,
          },
        ];

        return (
          <Space size="small">
            {record.status === 'PROPOSED' && (
              <Button
                type="primary"
                size="small"
                style={{ borderRadius: 6 }}
                loading={checkMutation.isPending}
                onClick={() => checkMutation.mutate(record.id)}
              >
                Periksa
              </Button>
            )}
            {record.status === 'CHECKED' && (
              <Button
                type="primary"
                size="small"
                style={{ background: '#1677ff', borderRadius: 6 }}
                loading={executeMutation.isPending}
                onClick={() => handleExecutePayment(record.id)}
              >
                Eksekusi
              </Button>
            )}
            {record.status === 'DRAFT' && (
              <Button size="small" style={{ borderRadius: 6 }}>
                Lanjutkan
              </Button>
            )}
            {record.status !== 'PROPOSED' && record.status !== 'CHECKED' && record.status !== 'DRAFT' && (
              <Button size="small" style={{ borderRadius: 6 }}>
                Detail
              </Button>
            )}

            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button size="small" type="text" icon={<MoreOutlined />} />
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
              icon={<DollarCircleOutlined />}
              onClick={() => notification.info({ message: 'Pilih invoice pada daftar Invoice & Match untuk membuat proposal pembayaran baru.' })}
            >
              Buat Proposal
            </Button>
          </Space>
        </div>
      </div>

      {/* Approval Workflow Banner (Figma 08b) */}
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 10,
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#fafafa',
            borderBottom: showWorkflow ? '1px solid #f0f0f0' : 'none',
            cursor: 'pointer',
          }}
          onClick={() => setShowWorkflow(!showWorkflow)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <div>
              <Text strong style={{ fontSize: 13, color: '#1f1f1f' }}>
                Alur persetujuan pembayaran
              </Text>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                Maker → Checker → Executor · setiap tahap dipegang peran berbeda (SoD)
              </Text>
            </div>
          </div>
          <Button type="link" size="small" style={{ fontSize: 12, color: '#1677ff' }}>
            {showWorkflow ? 'Sembunyikan alur' : 'Tampilkan alur'}{' '}
            {showWorkflow ? <UpOutlined /> : <DownOutlined />}
          </Button>
        </div>

        {showWorkflow && (
          <div style={{ padding: '16px 20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 16,
              }}
            >
              {/* Step 1: Maker */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: '#fafafa',
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <FileTextOutlined style={{ color: '#1677ff' }} />
                  <Text strong style={{ fontSize: 13 }}>1. Pembuat (Maker)</Text>
                </div>
                <Tag color="blue" style={{ fontSize: 11, borderRadius: 4, margin: '4px 0 6px 0' }}>
                  Finance Staff
                </Tag>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.3 }}>
                  Menyusun proposal pembayaran dari invoice yang sudah cocok (2-way match).
                </Text>
              </div>

              {/* Step 2: Checker */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: '#fafafa',
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <FileTextOutlined style={{ color: '#13c2c2' }} />
                  <Text strong style={{ fontSize: 13 }}>2. Pemeriksa (Checker)</Text>
                </div>
                <Tag color="cyan" style={{ fontSize: 11, borderRadius: 4, margin: '4px 0 6px 0' }}>
                  Head of AP
                </Tag>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.3 }}>
                  Memeriksa kesesuaian proposal dan menyetujui rilis dana.
                </Text>
              </div>

              {/* Step 3: Executor */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: '#fafafa',
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <BankOutlined style={{ color: '#52c41a' }} />
                  <Text strong style={{ fontSize: 13 }}>3. Pelaksana (Executor)</Text>
                </div>
                <Tag color="green" style={{ fontSize: 11, borderRadius: 4, margin: '4px 0 6px 0' }}>
                  Finance Treasury
                </Tag>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.3 }}>
                  Mengeksekusi transfer ke rekening vendor dengan re-autentikasi.
                </Text>
              </div>

              {/* Step 4: Disbursed */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: '#fafafa',
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text strong style={{ fontSize: 13 }}>4. Selesai (Disbursed)</Text>
                </div>
                <Tag color="success" style={{ fontSize: 11, borderRadius: 4, margin: '4px 0 6px 0' }}>
                  Selesai
                </Tag>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.3 }}>
                  Pembayaran lunas dan mutasi tercatat di Audit Trail.
                </Text>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f5f5f5',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                color: '#595959',
              }}
            >
              ⓘ Satu pengguna tidak dapat memegang dua peran pada proposal yang sama. Eksekusi transfer memerlukan re-autentikasi.
            </div>

            {/* Existing PaymentWorkflowSteps preserved for comprehensive testing */}
            <div style={{ marginTop: 12 }}>
              <PaymentWorkflowSteps
                status={mapPaymentStatusToStep(rawProposals[0]?.status)}
                makerName="Dewi Lestari (AP Maker)"
                checkerName="Hendra Wijaya (Head of AP)"
                executorName="Rina Kartika (Finance Treasury)"
              />
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
            style={{ width: 290 }}
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
    </div>
  );
};

export default PaymentListPage;
