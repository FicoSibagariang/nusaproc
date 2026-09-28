import React, { useState } from 'react';
import {
  Table,
  Tag,
  Card,
  Typography,
  Row,
  Col,
  Input,
  Select,
  Space,
  Badge,
  Button,
  Modal,
  Alert,
  Tooltip,
  App,
  theme,
} from 'antd';
import {
  WarningOutlined,
  SearchOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { receiptApi } from '../../../api/endpoints/receipt';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';
import { formatDateTime } from '../../../utils/date';
import { BastDetailModal } from '../components/BastDetailModal';

const { Text, Paragraph } = Typography;

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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);

  // States for viewing related BAST
  const [selectedGrId, setSelectedGrId] = useState<string | null>(null);
  const [bastModalOpen, setBastModalOpen] = useState(false);

  // States for resolving NCR ticket
  const [resolvingNcr, setResolvingNcr] = useState<NcrItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingSubmitting, setResolvingSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ncrs', statusFilter],
    queryFn: () => receiptApi.listNcrs({ isResolved: statusFilter }),
  });

  const rawNcrs: NcrItem[] = data?.data || [];

  const filteredNcrs = rawNcrs.filter((ncr) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ncr.ncrNumber.toLowerCase().includes(term) ||
      (ncr.poNumber && ncr.poNumber.toLowerCase().includes(term)) ||
      (ncr.grNumber && ncr.grNumber.toLowerCase().includes(term)) ||
      ncr.poId.toLowerCase().includes(term) ||
      ncr.description.toLowerCase().includes(term) ||
      ncr.actionRequired.toLowerCase().includes(term)
    );
  });

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

  const columns = [
    {
      title: 'Nomor Tiket NCR',
      dataIndex: 'ncrNumber',
      key: 'ncrNumber',
      width: 160,
      render: (ncrNumber: string) => (
        <Space>
          <WarningOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
          <Text strong style={{ color: token.colorWarning }}>
            {ncrNumber}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Dokumen Terkait',
      key: 'relatedDocs',
      width: 180,
      render: (_: unknown, record: NcrItem) => (
        <Space direction="vertical" size={2}>
          <div>
            <Button
              type="link"
              size="small"
              icon={<ShoppingCartOutlined />}
              style={{ padding: 0, height: 'auto', fontSize: 12 }}
              onClick={() => navigate('/po')}
            >
              PO: {record.poNumber || `${record.poId.slice(0, 8)}...`}
            </Button>
          </div>
          <div>
            <Button
              type="link"
              size="small"
              icon={<FileDoneOutlined />}
              style={{ padding: 0, height: 'auto', fontSize: 12, color: token.colorInfo }}
              onClick={() => {
                setSelectedGrId(record.grId);
                setBastModalOpen(true);
              }}
            >
              BAST: {record.grNumber || `${record.grId.slice(0, 8)}...`}
            </Button>
          </div>
        </Space>
      ),
    },
    {
      title: 'Deskripsi Masalah & Ketidaksesuaian',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => (
        <Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: desc }}>
          {desc}
        </Paragraph>
      ),
    },
    {
      title: 'Tindakan yang Diperlukan',
      dataIndex: 'actionRequired',
      key: 'actionRequired',
      ellipsis: true,
      render: (action: string) => (
        <Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          {action}
        </Text>
      ),
    },
    {
      title: 'Status Tiket',
      dataIndex: 'isResolved',
      key: 'isResolved',
      width: 160,
      render: (resolved: boolean, record: NcrItem) => (
        <Space direction="vertical" size={0}>
          <StatusTag status={resolved} category="ncr" />
          {resolved && record.resolvedByName && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Oleh: {record.resolvedByName}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Tanggal Pencatatan',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (dateStr: string) => (
        <Text style={{ fontSize: 12 }}>
          {formatDateTime(dateStr)}
        </Text>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 130,
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
            style={{ backgroundColor: token.colorSuccess, borderColor: token.colorSuccess }}
          >
            Resolve
          </Button>
        )
      ),
    },
  ];

  const openCount = rawNcrs.filter((n) => !n.isResolved).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Laporan Ketidaksesuaian Barang / Non-Conformance Reports (NCR) (R30, US5)"
        subtitle="Daftar insiden barang rusak, ditolak, atau tidak sesuai spesifikasi yang dicatat saat penerimaan BAST oleh Gudang / Pemohon."
        icon={<AuditOutlined style={{ color: token.colorWarning }} />}
        extra={
          <Badge count={openCount} overflowCount={99}>
            <Tag color="warning" style={{ padding: '4px 12px', fontSize: 13 }}>
              Tiket Open: {openCount}
            </Tag>
          </Badge>
        }
      />

      <Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Cari nomor NCR, PO, BAST, deskripsi..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Status Resolusi"
              style={{ width: '100%' }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value={false}>Open / Dalam Investigasi</Select.Option>
              <Select.Option value={true}>Selesai / Resolved</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredNcrs}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} laporan NCR` }}
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
