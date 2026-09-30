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
    queryFn: () => receiptApi.listNcrs(),
  });

  const rawNcrs: NcrItem[] = data?.data || [];

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
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'ALL' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'ALL' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {rawNcrs.length}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'OPEN',
      label: (
        <Space size={6}>
          <span>Terbuka</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'OPEN' ? '#fff2f0' : '#f5f5f5', color: activeTab === 'OPEN' ? '#cf1322' : '#8c8c8c', border: 'none' }}>
            {openCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'RESOLVED',
      label: (
        <Space size={6}>
          <span>Selesai</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'RESOLVED' ? '#f6ffed' : '#f5f5f5', color: activeTab === 'RESOLVED' ? '#389e0d' : '#8c8c8c', border: 'none' }}>
            {resolvedCount}
          </Tag>
        </Space>
      ),
    },
  ];

  const columns = [
    {
      title: 'Nomor tiket NCR',
      dataIndex: 'ncrNumber',
      key: 'ncrNumber',
      width: 170,
      render: (ncrNumber: string, record: NcrItem) => (
        <Tooltip title="Klik untuk meninjau atau menyelesaikan tiket ketidaksesuaian">
          <Button
            type="link"
            style={{
              padding: 0,
              height: 'auto',
              fontWeight: 600,
              color: token.colorPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => handleOpenResolveModal(record)}
          >
            <WarningOutlined style={{ color: record.isResolved ? '#52c41a' : '#ff4d4f' }} />
            <span>{ncrNumber}</span>
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Dokumen terkait',
      key: 'relatedDocs',
      width: 190,
      render: (_: unknown, record: NcrItem) => (
        <Space direction="vertical" size={2}>
          <div>
            <Button
              type="link"
              size="small"
              icon={<ShoppingCartOutlined style={{ color: '#1677ff' }} />}
              style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 500 }}
              onClick={() => navigate(`/po?poId=${record.poId}`)}
            >
              {record.poNumber || `PO-${record.poId.slice(0, 8)}`}
            </Button>
          </div>
          <div>
            <Button
              type="link"
              size="small"
              icon={<InboxOutlined style={{ color: '#52c41a' }} />}
              style={{ padding: 0, height: 'auto', fontSize: 12, color: '#52c41a', fontWeight: 500 }}
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
      ellipsis: true,
      render: (desc: string) => (
        <Paragraph style={{ margin: 0, fontSize: 13 }} ellipsis={{ rows: 2, tooltip: desc }}>
          {desc}
        </Paragraph>
      ),
    },
    {
      title: 'Tindakan yang diperlukan',
      dataIndex: 'actionRequired',
      key: 'actionRequired',
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
      render: (resolved: boolean) => (
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
              gap: 4,
            }}
          >
            <CheckCircleOutlined />
            <span>Selesai</span>
          </Tag>
        ) : (
          <Tag
            style={{
              borderRadius: 4,
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              color: '#ff4d4f',
              fontSize: 12,
              padding: '2px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <WarningOutlined />
            <span>Terbuka</span>
          </Tag>
        )
      ),
    },
    {
      title: 'Dicatat',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (dateStr: string) => (
        <div>
          <div style={{ fontSize: 12 }}>{formatDate(dateStr)}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
          </div>
        </div>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, record: NcrItem) => (
        record.isResolved ? (
          <Tooltip title={record.resolvedAt ? `Diselesaikan pada ${formatDateTime(record.resolvedAt)}` : 'Tiket telah selesai'}>
            <Tag color="success" icon={<CheckCircleOutlined />}>Tuntas</Tag>
          </Tooltip>
        ) : (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleOpenResolveModal(record)}
            style={{ borderRadius: 6 }}
          >
            Selesaikan
          </Button>
        )
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
