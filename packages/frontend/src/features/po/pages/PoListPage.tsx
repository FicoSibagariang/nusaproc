import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Typography,
  App,
  theme,
  Modal,
  Form,
  Select,
  Input,
  Alert,
  Tooltip,
  Tag,
  Tabs,
  Breadcrumb,
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  FilePdfOutlined,
  CheckOutlined,
  SendOutlined,
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  BankOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
  SafetyCertificateFilled,
  EllipsisOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { poApi, type UpdatePoPayload } from '../../../api/endpoints/po';
import { vendorApi } from '../../../api/endpoints/vendor';
import { formatRupiah } from '../../../utils/currency';
import { StatusTag } from '../../../components/common/StatusTag';
import { PoDetailModal } from '../components/PoDetailModal';

const { Text, Title } = Typography;
const { TextArea } = Input;

const formatDateIndo = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
};

function getInitials(name?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'PO';
}

export const PoListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPoForEdit, setSelectedPoForEdit] = useState<any>(null);
  const [vendorBankAccounts, setVendorBankAccounts] = useState<any[]>([]);
  const [editForm] = Form.useForm();
  const [selectedDetailPoId, setSelectedDetailPoId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Deep-linking: auto-open PO Detail Modal if ?poId=... or ?id=... is present in URL
  const poIdFromQuery = searchParams.get('poId') || searchParams.get('id');
  useEffect(() => {
    if (poIdFromQuery) {
      setSelectedDetailPoId(poIdFromQuery);
      setDetailModalOpen(true);
    }
  }, [poIdFromQuery]);

  // Fetch PO list from backend
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => poApi.list().catch(() => ({ data: [] })),
  });

  // Fetch verified vendors
  const { data: vendorRes } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.list({ status: 'APPROVED' }).catch(() => ({ data: [] })),
  });
  const rawVendors = vendorRes?.data;
  const vendorList = Array.isArray(rawVendors) ? rawVendors : [];

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePoPayload }) => poApi.update(id, payload),
    onSuccess: () => {
      notification.success({
        message: 'Purchase Order Berhasil Direvisi!',
        description: 'Vendor dan rincian PO telah diperbarui. Status persetujuan telah diatur ulang ke Draft.',
      });
      setEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal memperbarui PO';
      notification.error({ message: 'Gagal memperbarui PO', description: msg });
    },
  });

  const handleOpenEditModal = async (record: any) => {
    setSelectedPoForEdit(record);
    editForm.setFieldsValue({
      vendorId: record.vendorId,
      vendorBankAccountId: record.vendorBankAccountId,
      paymentTermType: record.paymentTermType || 'PAY_AFTER_RECEIPT',
      termsAndConditions: record.termsAndConditions,
      reason: '',
    });

    if (record.vendorId) {
      try {
        const bankRes = await vendorApi.listBankAccounts(record.vendorId);
        const banks = bankRes?.data || [];
        setVendorBankAccounts(banks);
      } catch {
        setVendorBankAccounts([]);
      }
    }
    setEditModalOpen(true);
  };

  const handleVendorChangeInModal = async (newVendorId: string) => {
    try {
      const bankRes = await vendorApi.listBankAccounts(newVendorId);
      const banks = bankRes?.data || [];
      setVendorBankAccounts(banks);
      if (banks.length > 0) {
        editForm.setFieldValue('vendorBankAccountId', banks[0].id);
      } else {
        editForm.setFieldValue('vendorBankAccountId', undefined);
      }
    } catch {
      setVendorBankAccounts([]);
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!selectedPoForEdit) return;
    updateMutation.mutate({
      id: selectedPoForEdit.id,
      payload: {
        vendorId: values.vendorId,
        vendorBankAccountId: values.vendorBankAccountId,
        paymentTermType: values.paymentTermType,
        termsAndConditions: values.termsAndConditions,
        reason: values.reason || 'Penggantian vendor sebelum persetujuan (Pre-Approval Revision)',
      },
    });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => poApi.approve(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Order berhasil disetujui (R25).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal menyetujui PO';
      notification.error({ message: 'Gagal menyetujui PO', description: msg });
    },
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => poApi.issue(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Order berhasil diterbitkan resmi (R24).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal menerbitkan PO';
      notification.error({ message: 'Gagal menerbitkan PO', description: msg });
    },
  });

  const handleDownloadPdf = async (id: string, poNumber: string) => {
    try {
      const blob = await poApi.downloadPdf(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${poNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notification.success({ message: `Dokumen PDF PO ${poNumber} berhasil diunduh.` });
    } catch (err: unknown) {
      notification.error({ message: 'Gagal mengunduh PDF', description: (err as Error).message });
    }
  };

  const rawList = data?.data;
  const poData = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];

  // Filtered PO list based on tabs, dropdowns, and search input
  const filteredPoList = useMemo(() => {
    return poData.filter((po: any) => {
      // Tab filter
      if (activeTab === 'DRAFT' && po.status !== 'DRAFT') return false;
      if (activeTab === 'ISSUED' && po.status !== 'ISSUED') return false;
      if (activeTab === 'COMPLETED' && po.status !== 'COMPLETED') return false;
      if (activeTab === 'CANCELLED' && po.status !== 'CANCELLED') return false;

      // Status dropdown filter
      if (filterStatus !== 'ALL' && po.status !== filterStatus) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (po.poNumber || '').toLowerCase();
        const vendor = (po.vendorName || '').toLowerCase();
        const creator = (po.requesterName || po.createdBy || '').toLowerCase();
        if (!num.includes(q) && !vendor.includes(q) && !creator.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [poData, activeTab, filterStatus, searchQuery]);

  // Export filtered PO list to CSV
  const handleExportCsv = () => {
    const headers = [
      'Nomor PO',
      'Tanggal',
      'Pembuat',
      'Vendor',
      'Rekening Bank',
      'Total Nilai',
      'Status',
    ];
    const rows = filteredPoList.map((po: any) => [
      po.poNumber,
      formatDateIndo(po.createdAt),
      po.requesterName || po.createdBy || 'Admin',
      po.vendorName || '',
      `${po.bankName || 'Bank'} ${po.accountNumber || ''}`,
      po.grandTotalAmount || po.totalAmount || 0,
      po.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Purchase_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    notification.success({ message: 'Data Purchase Order berhasil diekspor ke CSV.' });
  };

  // Status counts for tab badges
  const draftCount = poData.filter((p: any) => p.status === 'DRAFT').length;
  const issuedCount = poData.filter((p: any) => p.status === 'ISSUED').length;
  const completedCount = poData.filter((p: any) => p.status === 'COMPLETED').length;
  const cancelledCount = poData.filter((p: any) => p.status === 'CANCELLED').length;

  const statusTabItems = [
    {
      key: 'ALL',
      label: (
        <Space size={6}>
          <span>Semua</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'ALL' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'ALL' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {poData.length}
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
      key: 'ISSUED',
      label: (
        <Space size={6}>
          <span>Diterbitkan</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'ISSUED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'ISSUED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {issuedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'COMPLETED',
      label: (
        <Space size={6}>
          <span>Selesai Penuh</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'COMPLETED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'COMPLETED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {completedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'CANCELLED',
      label: (
        <Space size={6}>
          <span>Dibatalkan</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'CANCELLED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'CANCELLED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {cancelledCount}
          </Tag>
        </Space>
      ),
    },
  ];

  const columns = [
    {
      title: 'Nomor PO',
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text: string, record: any) => (
        <Tooltip title="Klik untuk melihat rincian lengkap dokumen PO">
          <span
            style={{
              color: '#0052cc',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
            onClick={() => {
              setSelectedDetailPoId(record.id);
              setDetailModalOpen(true);
            }}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Pembuat & tanggal',
      key: 'creator',
      render: (_: unknown, record: any) => {
        const creatorName = record.requesterName || record.createdBy || 'Admin';
        return (
          <div>
            <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.3, color: '#1f1f1f' }}>
              {creatorName}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
              {record.createdAt ? formatDateIndo(record.createdAt) : '-'}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Vendor & rekening',
      dataIndex: 'vendorName',
      key: 'vendorName',
      render: (text: string, record: any) => {
        const vendorName = text || record.vendor?.name || 'PT Mitra Solusi Jaringan';
        const bankName = record.bankName || 'Mandiri';
        const acct = record.accountNumber || record.bankAccountNumber || '0040';
        const masked = acct.length > 4 ? `••••${acct.slice(-4)}` : `••••${acct}`;

        return (
          <div>
            <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.3, color: '#1f1f1f' }}>
              {vendorName}
            </Text>
            <div style={{ marginTop: 3 }}>
              <Tag
                style={{
                  borderRadius: 4,
                  background: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  color: '#389e0d',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  margin: 0,
                  padding: '1px 6px',
                }}
              >
                {/* Bank account verified shield icon matching Figma 03 */}
                <SafetyCertificateFilled style={{ color: '#52c41a', fontSize: 12 }} />
                <span>{bankName}</span>
                <span>{masked}</span>
              </Tag>
              {/* BankOutlined fallback for accessibility */}
              <span style={{ display: 'none' }}><BankOutlined /></span>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Total nilai',
      key: 'totalAmount',
      render: (_: unknown, record: any) => {
        const val = record.grandTotalAmount ?? record.totalAmount ?? 0;
        return <Text style={{ fontSize: 13, fontWeight: 500, color: '#1f1f1f' }}>{formatRupiah(Number(val))}</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'DRAFT') {
          return (
            <Tag
              icon={<EditOutlined style={{ color: '#595959', fontSize: 11 }} />}
              style={{
                borderRadius: 6,
                fontSize: 11,
                padding: '1px 8px',
                margin: 0,
                backgroundColor: '#f5f5f5',
                borderColor: '#d9d9d9',
                color: '#595959',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Draft
            </Tag>
          );
        }
        if (status === 'ISSUED') {
          return (
            <Tag
              color="success"
              icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11 }} />}
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
              Diterbitkan
            </Tag>
          );
        }
        if (status === 'COMPLETED') {
          return (
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
              icon={<CheckCircleOutlined style={{ color: '#08979c', fontSize: 11 }} />}
            >
              Selesai Penuh
            </Tag>
          );
        }
        if (status === 'CANCELLED') {
          return (
            <Tag
              color="error"
              icon={<CloseCircleOutlined style={{ fontSize: 11 }} />}
              style={{ borderRadius: 6, fontSize: 11, padding: '1px 8px', margin: 0 }}
            >
              Dibatalkan
            </Tag>
          );
        }
        return <StatusTag status={status} category="po" />;
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 190,
      render: (_: unknown, record: any) => {
        const isDraft = record.status === 'DRAFT';
        const isIssued = record.status === 'ISSUED' || record.status === 'AMENDED' || record.status === 'PARTIALLY_RECEIVED';
        const isCompleted = record.status === 'COMPLETED';

        // Dropdown menu items for secondary actions
        const moreItems: MenuProps['items'] = [
          {
            key: 'detail',
            label: 'Detail Dokumen',
            icon: <EyeOutlined />,
            onClick: () => {
              setSelectedDetailPoId(record.id);
              setDetailModalOpen(true);
            },
          },
          ...(isDraft
            ? [
                {
                  key: 'edit-vendor',
                  label: 'Ganti Vendor',
                  icon: <EditOutlined />,
                  onClick: () => handleOpenEditModal(record),
                },
                ...(record.approvedBy
                  ? [
                      {
                        key: 'issue',
                        label: 'Terbitkan (R24)',
                        icon: <SendOutlined />,
                        onClick: () => issueMutation.mutate(record.id),
                      },
                    ]
                  : [
                      {
                        key: 'approve',
                        label: 'Setujui (R25)',
                        icon: <CheckOutlined />,
                        onClick: () => approveMutation.mutate(record.id),
                      },
                    ]),
              ]
            : []),
          ...(record.status === 'APPROVED'
            ? [
                {
                  key: 'issue-approved',
                  label: 'Terbitkan (R24)',
                  icon: <SendOutlined />,
                  onClick: () => issueMutation.mutate(record.id),
                },
              ]
            : []),
          ...(isIssued
            ? [
                {
                  key: 'receipt',
                  label: 'Terima Barang (BAST)',
                  icon: <InboxOutlined />,
                  onClick: () => navigate(`/receipts/create?poId=${record.id}`),
                },
              ]
            : []),
          {
            type: 'divider',
          },
          {
            key: 'download-pdf',
            label: 'Unduh PDF (R27)',
            icon: <FilePdfOutlined style={{ color: token.colorError }} />,
            onClick: () => handleDownloadPdf(record.id, record.poNumber),
          },
        ];

        return (
          <Space size={8}>
            {/* Primary Contextual Action Button (Figma 03) */}
            {isDraft && !record.approvedBy && (
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate(record.id)}
                style={{
                  backgroundColor: '#e6f4ff',
                  color: '#0958d9',
                  borderColor: '#91caff',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                Setujui (R25)
              </Button>
            )}

            {isDraft && record.approvedBy && (
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                loading={issueMutation.isPending}
                onClick={() => issueMutation.mutate(record.id)}
                style={{
                  backgroundColor: '#e6f4ff',
                  color: '#0958d9',
                  borderColor: '#91caff',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                Terbitkan (R24)
              </Button>
            )}

            {record.status === 'APPROVED' && (
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                loading={issueMutation.isPending}
                onClick={() => issueMutation.mutate(record.id)}
                style={{
                  backgroundColor: '#e6f4ff',
                  color: '#0958d9',
                  borderColor: '#91caff',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                Terbitkan (R24)
              </Button>
            )}

            {isIssued && (
              <Button
                size="small"
                icon={<InboxOutlined style={{ color: '#0958d9' }} />}
                onClick={() => navigate(`/receipts/create?poId=${record.id}`)}
                style={{
                  backgroundColor: '#e6f4ff',
                  color: '#0958d9',
                  borderColor: '#91caff',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                Terima Barang (BAST)
              </Button>
            )}

            {isCompleted && (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedDetailPoId(record.id);
                  setDetailModalOpen(true);
                }}
                style={{
                  backgroundColor: '#fff',
                  borderColor: '#d9d9d9',
                  color: '#262626',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                Lihat Detail
              </Button>
            )}

            {/* Ellipsis Dropdown for Secondary Actions */}
            <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<EllipsisOutlined style={{ fontSize: 18, color: '#595959' }} />}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                }}
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section (Figma 03 Purchase Order) */}
      <div>
        <Breadcrumb
          items={[{ title: 'Pengadaan' }, { title: 'Purchase Order' }]}
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
              <FileTextOutlined style={{ color: '#1677ff', fontSize: 22 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
                Purchase Order (PO)
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Pesanan resmi ke vendor terverifikasi — lengkap dengan persetujuan, penerbitan, dan unduhan PDF.
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
              onClick={() => navigate('/po/create')}
            >
              Buat PO Baru
            </Button>
          </Space>
        </div>
      </div>

      {/* Status Filter Tabs (Figma 03) */}
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
                { value: 'DRAFT', label: 'Draft' },
                { value: 'APPROVED', label: 'Disetujui' },
                { value: 'ISSUED', label: 'Diterbitkan' },
                { value: 'COMPLETED', label: 'Selesai Penuh' },
                { value: 'CANCELLED', label: 'Dibatalkan' },
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
            placeholder="Cari nomor PO, vendor, atau pembuat..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredPoList}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total} PO`,
          }}
        />
      </Card>

      {/* Edit PO Vendor Modal */}
      <Modal
        title={`Revisi PO: ${selectedPoForEdit?.poNumber || ''}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          message="Tata Kelola Pengadaan & Reset Persetujuan (R24 & R26)"
          description="Mengganti vendor pada PO draft akan otomatis memverifikasi rekening bank vendor baru dan me-reset status approval ke DRAFT agar ditinjau ulang."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="vendorId"
            label="Pilih Vendor Terverifikasi"
            rules={[{ required: true, message: 'Vendor wajib dipilih!' }]}
          >
            <Select
              placeholder="Pilih Vendor"
              showSearch
              optionFilterProp="children"
              onChange={handleVendorChangeInModal}
            >
              {vendorList.map((v: any) => (
                <Select.Option key={v.id} value={v.id}>
                  {v.name} ({v.vendorCode || 'VENDOR'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="vendorBankAccountId"
            label="Pilih Rekening Bank Terverifikasi (4-Eyes Check)"
            rules={[{ required: true, message: 'Rekening bank wajib dipilih!' }]}
          >
            <Select placeholder="Pilih Rekening Bank">
              {vendorBankAccounts.map((b: any) => (
                <Select.Option key={b.id} value={b.id}>
                  {b.bankName} — {b.accountNumberMasked || b.accountNumber} ({b.accountHolderName || 'Verified'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="paymentTermType"
            label="Termin Pembayaran"
            rules={[{ required: true, message: 'Termin pembayaran wajib dipilih!' }]}
          >
            <Select placeholder="Pilih Termin">
              <Select.Option value="PAY_AFTER_RECEIPT">Pay After Receipt (Standar)</Select.Option>
              <Select.Option value="ADVANCE_OR_COD">Advance / Cash on Delivery (COD)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="Alasan Pergantian Vendor / Revisi (Audit Trail)"
            rules={[{ required: true, message: 'Alasan perubahan wajib diisi untuk audit!' }]}
          >
            <TextArea
              rows={3}
              placeholder="Contoh: Vendor asal kehabisan stok, dialihkan ke vendor pengganti yang siap kirim."
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button
              type="link"
              onClick={() => {
                setEditModalOpen(false);
                navigate(`/po/create?poId=${selectedPoForEdit?.id}`);
              }}
            >
              Buka Formulir Lengkap (Edit Item)
            </Button>
            <Space>
              <Button onClick={() => setEditModalOpen(false)}>Batal</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Simpan & Reset Approval
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* PO Detail Modal */}
      <PoDetailModal
        open={detailModalOpen}
        poId={selectedDetailPoId}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedDetailPoId(null);
          if (searchParams.has('poId') || searchParams.has('id')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('poId');
            nextParams.delete('id');
            setSearchParams(nextParams, { replace: true });
          }
        }}
        onStatusUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        }}
      />
    </div>
  );
};

export default PoListPage;
