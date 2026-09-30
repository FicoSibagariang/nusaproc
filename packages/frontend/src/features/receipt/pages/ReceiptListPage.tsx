import React, { useState } from 'react';
import { Table, Button, Tag, Card, Typography, theme, Tooltip, Space } from 'antd';
import { PlusOutlined, FileDoneOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { receiptApi } from '../../../api/endpoints/receipt';
import { PageHeader } from '../../../components/common/PageHeader';
import { formatDate } from '../../../utils/date';
import { BastDetailModal } from '../components/BastDetailModal';

const { Text } = Typography;

export interface ReceiptRow {
  id: string;
  grNumber: string;
  poId: string;
  poNumber?: string | null;
  vendorName?: string | null;
  receiptType: 'DIRECT_REQUESTER' | 'WAREHOUSE';
  deliveryNoteNumber?: string | null;
  receivedDate: string;
  receivedBy: string;
  receivedByName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export const ReceiptListPage: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const [selectedGrId, setSelectedGrId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => receiptApi.list(),
  });

  const receipts: ReceiptRow[] = data?.data || [];

  const columns = [
    {
      title: 'Nomor BAST / GR',
      dataIndex: 'grNumber',
      key: 'grNumber',
      render: (text: string, record: ReceiptRow) => (
        <Tooltip title="Klik untuk melihat rincian barang diterima & status NCR">
          <Button
            type="link"
            style={{
              padding: 0,
              fontWeight: 600,
              height: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: token.colorPrimary,
            }}
            onClick={() => {
              setSelectedGrId(record.id);
              setDetailModalOpen(true);
            }}
          >
            <FileDoneOutlined style={{ color: token.colorPrimary }} />
            <span>{text}</span>
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'PO & Vendor',
      key: 'poAndVendor',
      render: (_: unknown, record: ReceiptRow) => (
        <Space direction="vertical" size={0}>
          {record.poNumber ? (
            <Tooltip title="Klik untuk membuka rincian dokumen PO">
              <Button
                type="link"
                style={{ padding: 0, height: 'auto', fontWeight: 600, color: token.colorPrimary }}
                onClick={() => navigate(`/po?poId=${record.poId}`)}
              >
                {record.poNumber}
              </Button>
            </Tooltip>
          ) : (
            <Text type="secondary">-</Text>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.vendorName || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Nomor Surat Jalan',
      dataIndex: 'deliveryNoteNumber',
      key: 'deliveryNoteNumber',
      render: (sj?: string | null) => <Tag color="blue">{sj || '-'}</Tag>,
    },
    {
      title: 'Tipe Penerimaan',
      dataIndex: 'receiptType',
      key: 'receiptType',
      render: (type: string) => (
        <Tag color={type === 'WAREHOUSE' ? 'geekblue' : 'purple'}>
          {type === 'WAREHOUSE' ? 'Gudang' : 'Direct'}
        </Tag>
      ),
    },
    {
      title: 'Tanggal Penerimaan',
      dataIndex: 'receivedDate',
      key: 'receivedDate',
      render: (dateStr: string) => formatDate(dateStr),
    },
    {
      title: 'Catatan Kondisi Barang',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (notes?: string | null) => notes || <Text type="secondary">-</Text>,
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: ReceiptRow) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedGrId(record.id);
            setDetailModalOpen(true);
          }}
        >
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Daftar Berita Acara Serah Terima (BAST) & Penerimaan Barang"
        subtitle="Kelola penerimaan barang fisik di gudang atau serah terima jasa dari vendor rekanan (R28–R32)."
        icon={<FileDoneOutlined style={{ color: token.colorPrimary }} />}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/receipts/create')}
          >
            Penerimaan Barang (BAST)
          </Button>
        }
      />

      <Card>
        <Table
          columns={columns}
          dataSource={receipts}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <BastDetailModal
        open={detailModalOpen}
        grId={selectedGrId}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedGrId(null);
        }}
      />
    </div>
  );
};

export default ReceiptListPage;
