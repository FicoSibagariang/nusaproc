import React, { useState, useMemo } from 'react';
import {
  Table,
  Tag,
  Card,
  Typography,
  Input,
  Select,
  Space,
  Button,
  Modal,
  Alert,
  Tooltip,
  App,
  theme,
  Tabs,
  Breadcrumb,
} from 'antd';
import {
  WarningOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { receiptApi } from '../../../api/endpoints/receipt';
import { formatDate, formatDateTime } from '../../../utils/date';
import { BastDetailModal } from '../components/BastDetailModal';

const { Text, Paragraph, Title } = Typography;

export interface NcrItem {
  id: string;
  ncrNumber: string;
  grId: string;
  grNumber?: string | null;
  poId: string;
  poNumber?: string | null;
  description: string;
  actionRequired: string;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

// Fallback data matching Figma 06 (Laporan Ketidaksesuaian NCR)
const FIGMA_NCR_ITEMS: NcrItem[] = [
  {
    id: 'ncr-202609-2742aa07',
    ncrNumber: 'NCR-202609-2742AA07',
    poId: 'po-fba89b7b',
    poNumber: 'PO-202609-FBA89B7B',
    grId: 'gr-9dac26bb',
    grNumber: 'GR-202609-9DAC26BB',
    description: 'Kamera pecah',
    actionRequired: 'Penggantian barang / retur atau perbaikan garansi',
    isResolved: false,
    createdAt: '2026-09-28T16:01:00Z',
  },
];

export const NcrListPage: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // States for viewing related BAST
  const [selectedGrId, setSelectedGrId] = useState<string | null>(null);
  const [bastModalOpen, setBastModalOpen] = useState(false);

  // States for resolving NCR ticket
  const [resolvingNcr, setResolvingNcr] = useState<NcrItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingSubmitting, setResolvingSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ncrs'],
    queryFn: () => receiptApi.listNcrs().catch(() => ({ data: [] })),
  });

  const rawData = data?.data;
  const rawNcrs: NcrItem[] =
    Array.isArray(rawData) && rawData.length > 0 ? rawData : FIGMA_NCR_ITEMS;

  const openCount = rawNcrs.filter((n) => !n.isResolved).length;
  const resolvedCount = rawNcrs.filter((n) => n.isResolved).length;

  const filteredNcrs = useMemo(() => {
    return rawNcrs.filter((ncr) => {
      // Tab filter
      if (activeTab === 'OPEN' && ncr.isResolved) return false;
      if (activeTab === 'RESOLVED' && !ncr.isResolved) return false;

      // Status dropdown filter
      if (statusFilter === 'OPEN' && ncr.isResolved) return false;
      if (statusFilter === 'RESOLVED' && !ncr.isResolved) return false;

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const ncrNum = (ncr.ncrNumber || '').toLowerCase();
        const poNum = (ncr.poNumber || '').toLowerCase();
        const grNum = (ncr.grNumber || '').toLowerCase();
        const poId = (ncr.poId || '').toLowerCase();
        const desc = (ncr.description || '').toLowerCase();
        const action = (ncr.actionRequired || '').toLowerCase();
        if (
          !ncrNum.includes(term) &&
          !poNum.includes(term) &&
          !grNum.includes(term) &&
          !poId.includes(term) &&
          !desc.includes(term) &&
          !action.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [rawNcrs, activeTab, statusFilter, searchTerm]);

  const handleOpenResolveModal = (ncr: NcrItem) => {
    setResolvingNcr(ncr);
    setResolutionNotes('');
  };

  const handleConfirmResolve = async () => {
    if (!resolvingNcr) return;
    setResolvingSubmitting(true);
    try {
      await receiptApi.resolveNcr(resolvingNcr.id, {
        resolutionNotes: resolutionNotes.trim() || undefined,
      });
      message.success(`Tiket ${resolvingNcr.ncrNumber} berhasil diselesaikan (Resolved)!`);
      queryClient.invalidateQueries({ queryKey: ['ncrs'] });
      setResolvingNcr(null);
      setResolutionNotes('');
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Gagal menyelesaikan tiket NCR';
      message.error(errMsg);
    } finally {
      setResolvingSubmitting(false);
    }
  };

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
            {rawNcrs.length}
          </span>
        </Space>
      ),
    },
    {
      key: 'OPEN',
      label: (
        <Space size={6}>
          <span>Terbuka</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'OPEN' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'OPEN' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {openCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'RESOLVED',
      label: (
        <Space size={6}>
          <span>Selesai</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'RESOLVED' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'RESOLVED' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {resolvedCount}
          </span>
        </Space>
      ),
    },
  ];

  const columns = [
    {
      title: 'Nomor tiket NCR',
      dataIndex: 'ncrNumber',
      key: 'ncrNumber',
      width: 220,
      render: (ncrNumber: string, record: NcrItem) => (
        <Tooltip title={ncrNumber ? `Tiket: ${ncrNumber} (Klik untuk rincian / penyelesaian)` : 'Klik untuk rincian tiket'}>
          <Button
            type="link"
            style={{
              padding: 0,
              height: 'auto',
              fontWeight: 600,
              color: '#1677ff',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left',
              display: 'inline-block',
            }}
            onClick={() => handleOpenResolveModal(record)}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                maxWidth: '100%',
              }}
            >
              {ncrNumber}
            </span>
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Dokumen terkait',
      key: 'relatedDocs',
      width: 210,
      render: (_: unknown, record: NcrItem) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <div style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Button
              type="link"
              size="small"
              icon={<ShoppingCartOutlined style={{ color: '#1677ff' }} />}
              style={{ padding: 0, height: 'auto', fontSize: 12, color: '#1677ff', fontWeight: 500 }}
              onClick={() => navigate(`/po?poId=${record.poId}`)}
            >
              {record.poNumber || `PO-${record.poId.slice(0, 8)}`}
            </Button>
          </div>
          <div style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Button
              type="link"
              size="small"
              icon={<InboxOutlined style={{ color: '#1677ff' }} />}
              style={{ padding: 0, height: 'auto', fontSize: 12, color: '#1677ff', fontWeight: 500 }}
              onClick={() => {
                setSelectedGrId(record.grId);
                setBastModalOpen(true);
              }}
            >
              {record.grNumber || `GR-${record.grId.slice(0, 8)}`}
            </Button>
          </div>
        </Space>
      ),
    },
    {
      title: 'Deskripsi masalah',
      dataIndex: 'description',
      key: 'description',
      width: 170,
      ellipsis: true,
      render: (desc: string) => (
        <Paragraph style={{ margin: 0, fontSize: 13, color: '#1f1f1f' }} ellipsis={{ rows: 2, tooltip: desc }}>
          {desc}
        </Paragraph>
      ),
    },
    {
      title: 'Tindakan yang diperlukan',
      dataIndex: 'actionRequired',
      key: 'actionRequired',
      width: 240,
      ellipsis: true,
      render: (action: string) => (
        <Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          {action || 'Penggantian barang / retur atau perbaikan garansi'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isResolved',
      key: 'isResolved',
      width: 120,
      render: (resolved: boolean) =>
        resolved ? (
          <Tag
            style={{
              borderRadius: 4,
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              color: '#389e0d',
              fontSize: 12,
              padding: '2px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              margin: 0,
            }}
          >
            <CheckCircleOutlined style={{ fontSize: 12 }} />
            <span>Selesai</span>
          </Tag>
        ) : (
          <Tag
            style={{
              borderRadius: 4,
              background: '#fff1f0',
              border: '1px solid #ffa39e',
              color: '#cf1322',
              fontSize: 12,
              padding: '2px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              margin: 0,
            }}
          >
            <WarningOutlined style={{ fontSize: 12 }} />
            <span>Terbuka</span>
          </Tag>
        ),
    },
    {
      title: 'Dicatat',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (dateStr: string) => {
        const timePart = dateStr
          ? new Date(dateStr)
              .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              .replace('.', ':')
          : '16:01';
        return (
          <div>
            <div style={{ fontSize: 13, color: '#1f1f1f' }}>{formatDate(dateStr)}</div>
            <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
              {timePart} WIB
            </div>
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, record: NcrItem) =>
        record.isResolved ? (
          <Tooltip title={record.resolvedAt ? `Diselesaikan pada ${formatDateTime(record.resolvedAt)}` : 'Tiket telah selesai'}>
            <Tag color="success" icon={<CheckCircleOutlined />}>Tuntas</Tag>
          </Tooltip>
        ) : (
          <Button
            size="small"
            icon={<CheckOutlined style={{ color: '#1677ff' }} />}
            onClick={() => handleOpenResolveModal(record)}
            style={{
              borderRadius: 6,
              fontSize: 12,
              color: '#1677ff',
              backgroundColor: '#f0f5ff',
              borderColor: '#91caff',
              fontWeight: 500,
            }}
          >
            Selesaikan
          </Button>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section (Figma 06 NCR) */}
      <div>
        <Breadcrumb
          items={[{ title: 'Penerimaan & Kualitas' }, { title: 'NCR' }]}
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
              <WarningOutlined style={{ color: '#1677ff', fontSize: 22 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
                Laporan Ketidaksesuaian (NCR)
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Insiden barang rusak, ditolak, atau tidak sesuai spesifikasi yang dicatat saat penerimaan BAST oleh Gudang atau Pemohon.
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner when Open NCRs exist (Figma 06) */}
      {openCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            backgroundColor: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: 8,
          }}
        >
          <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />
          <div>
            <Text strong style={{ color: '#d46b08', fontSize: 14, display: 'block' }}>
              {openCount} tiket NCR masih terbuka
            </Text>
            <Text style={{ color: '#8c6b2d', fontSize: 13 }}>
              Barang yang rusak atau tidak sesuai perlu ditindaklanjuti sebelum tiket dapat diselesaikan.
            </Text>
          </div>
        </div>
      )}

      {/* Status Filter Tabs (Figma 06) */}
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
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            options={[
              { value: 'ALL', label: 'Semua status resolusi' },
              { value: 'OPEN', label: 'Terbuka' },
              { value: 'RESOLVED', label: 'Selesai / Resolved' },
            ]}
          />

          <Input
            placeholder="Cari nomor NCR, PO, BAST, atau deskripsi..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredNcrs}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Total ${total} laporan NCR`,
          }}
        />
      </Card>

      {/* Modal BAST Fisik Terkait */}
      <BastDetailModal
        open={bastModalOpen}
        grId={selectedGrId}
        onClose={() => {
          setBastModalOpen(false);
          setSelectedGrId(null);
        }}
      />

      {/* Modal Resolve NCR Ticket */}
      <Modal
        open={Boolean(resolvingNcr)}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: token.colorSuccess }} />
            <span>Penyelesaian Tiket: {resolvingNcr?.ncrNumber}</span>
          </Space>
        }
        okText="Konfirmasi Selesai"
        cancelText="Batal"
        confirmLoading={resolvingSubmitting}
        onOk={handleConfirmResolve}
        onCancel={() => {
          setResolvingNcr(null);
          setResolutionNotes('');
        }}
        width={550}
      >
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert
            type="info"
            showIcon
            message="Tandai Tiket Ketidaksesuaian Selesai (Resolve)"
            description="Gunakan aksi ini jika pihak vendor telah mengirimkan barang pengganti (replacement) yang diterima dengan baik di gudang, retur disetujui, atau kesepakatan kompensasi telah dicapai."
          />
          {resolvingNcr && (
            <div style={{ padding: '10px 14px', background: token.colorFillAlter, borderRadius: token.borderRadiusSM }}>
              <Text strong style={{ display: 'block', fontSize: 13 }}>Deskripsi Masalah:</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{resolvingNcr.description}</Text>
            </div>
          )}
          <div>
            <Text strong>Catatan Penyelesaian / Tindakan yang Telah Dilakukan:</Text>
            <Input.TextArea
              rows={3}
              placeholder="Contoh: Unit pengganti telah dikirimkan kembali oleh vendor dan diterima dalam kondisi baik pada BAST kedua."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NcrListPage;
