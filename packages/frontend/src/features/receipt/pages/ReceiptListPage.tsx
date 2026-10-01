import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Tag,
  Card,
  Typography,
  theme,
  Tooltip,
  Space,
  Select,
  Input,
  Tabs,
  Breadcrumb,
  App,
} from 'antd';
import {
  PlusOutlined,
  FileDoneOutlined,
  EyeOutlined,
  InboxOutlined,
  DownloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { receiptApi } from '../../../api/endpoints/receipt';
import { formatDate } from '../../../utils/date';
import { BastDetailModal } from '../components/BastDetailModal';

const { Text, Title } = Typography;

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
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedGrId, setSelectedGrId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => receiptApi.list(),
  });

  const { data: ncrData } = useQuery({
    queryKey: ['ncrs', false],
    queryFn: () => receiptApi.listNcrs({ isResolved: false }).catch(() => ({ data: [] })),
  });

  const openNcrs = ncrData?.data || [];
  const openNcrByGrId = useMemo(() => {
    const map = new Map<string, number>();
    openNcrs.forEach((n: any) => {
      if (n.grId) {
        map.set(n.grId, (map.get(n.grId) || 0) + 1);
      }
    });
    return map;
  }, [openNcrs]);

  const receipts: ReceiptRow[] = data?.data || [];

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // Tab filter
      if (activeTab === 'WAREHOUSE' && r.receiptType !== 'WAREHOUSE') return false;
      if (activeTab === 'DIRECT_REQUESTER' && r.receiptType !== 'DIRECT_REQUESTER') return false;

      // Type dropdown filter
      if (filterType !== 'ALL' && r.receiptType !== filterType) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const gr = (r.grNumber || '').toLowerCase();
        const po = (r.poNumber || '').toLowerCase();
        const vendor = (r.vendorName || '').toLowerCase();
        const sj = (r.deliveryNoteNumber || '').toLowerCase();
        if (!gr.includes(q) && !po.includes(q) && !vendor.includes(q) && !sj.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [receipts, activeTab, filterType, searchQuery]);

  // Export BAST to CSV
  const handleExportCsv = () => {
    const headers = [
      'Nomor BAST/GR',
      'Nomor PO',
      'Vendor',
      'Tipe Penerimaan',
      'Surat Jalan',
      'Tanggal Terima',
      'Catatan Kondisi',
    ];
    const rows = filteredReceipts.map((r) => [
      r.grNumber,
      r.poNumber || r.poId,
      r.vendorName || '',
      r.receiptType === 'WAREHOUSE' ? 'Gudang' : 'Jasa / Direct',
      r.deliveryNoteNumber || 'Tidak ada',
      formatDate(r.receivedDate || r.createdAt),
      r.notes || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `BAST_Penerimaan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    notification.success({ message: 'Data Penerimaan Barang (BAST) berhasil diekspor ke CSV.' });
  };

  const warehouseCount = receipts.filter((r) => r.receiptType === 'WAREHOUSE').length;
  const serviceCount = receipts.filter((r) => r.receiptType === 'DIRECT_REQUESTER').length;

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
            {receipts.length}
          </span>
        </Space>
      ),
    },
    {
      key: 'WAREHOUSE',
      label: (
        <Space size={6}>
          <span>Gudang</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'WAREHOUSE' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'WAREHOUSE' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {warehouseCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'DIRECT_REQUESTER',
      label: (
        <Space size={6}>
          <span>Jasa</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'DIRECT_REQUESTER' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'DIRECT_REQUESTER' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {serviceCount}
          </span>
        </Space>
      ),
    },
  ];

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
      title: 'PO & vendor',
      key: 'poAndVendor',
      render: (_: unknown, record: ReceiptRow) => (
        <Space direction="vertical" size={2}>
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
            {record.vendorName || 'PT Mitra Solusi Jaringan'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'No. surat jalan',
      dataIndex: 'deliveryNoteNumber',
      key: 'deliveryNoteNumber',
      render: (sj?: string | null) => (
        sj ? <Text style={{ fontSize: 13 }}>{sj}</Text> : <Text type="secondary" style={{ fontSize: 12 }}>Tidak ada</Text>
      ),
    },
    {
      title: 'Tipe penerimaan',
      dataIndex: 'receiptType',
      key: 'receiptType',
      render: (type: string) => (
        <Tag
          style={{
            borderRadius: 4,
            background: type === 'WAREHOUSE' ? '#e6f4ff' : '#f9f0ff',
            border: type === 'WAREHOUSE' ? '1px solid #91caff' : '1px solid #d3adf7',
            color: type === 'WAREHOUSE' ? '#0958d9' : '#722ed1',
            fontSize: 12,
            padding: '1px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <InboxOutlined />
          <span>{type === 'WAREHOUSE' ? 'Gudang' : 'Jasa'}</span>
        </Tag>
      ),
    },
    {
      title: 'Tanggal terima',
      dataIndex: 'receivedDate',
      key: 'receivedDate',
      render: (dateStr: string, record: ReceiptRow) => (
        <Text style={{ fontSize: 13 }}>{formatDate(dateStr || record.createdAt)}</Text>
      ),
    },
    {
      title: 'Catatan kondisi barang',
      dataIndex: 'notes',
      key: 'notes',
      render: (notes: string | null | undefined, record: ReceiptRow) => {
        const ncrCount = openNcrByGrId.get(record.id) || 0;
        if (ncrCount > 0) {
          return (
            <Tooltip title="Terdapat laporan ketidaksesuaian barang (NCR) yang belum selesai untuk BAST ini">
              <Tag
                style={{
                  borderRadius: 4,
                  background: '#fff2f0',
                  border: '1px solid #ffccc7',
                  color: '#cf1322',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  fontWeight: 500,
                  fontSize: 11,
                }}
                onClick={() => navigate('/ncr')}
              >
                <WarningOutlined style={{ marginRight: 4 }} />
                {ncrCount} NCR terbuka
              </Tag>
            </Tooltip>
          );
        }
        return notes ? (
          <Text style={{ fontSize: 13 }}>{notes}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Tidak ada catatan</Text>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: ReceiptRow) => (
        <Tooltip title="Lihat Rincian BAST">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined style={{ fontSize: 16 }} />}
            onClick={() => {
              setSelectedGrId(record.id);
              setDetailModalOpen(true);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section (Figma 05 Penerimaan BAST) */}
      <div>
        <Breadcrumb
          items={[{ title: 'Penerimaan & Kualitas' }, { title: 'Penerimaan (BAST)' }]}
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
              <InboxOutlined style={{ color: '#1677ff', fontSize: 22 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
                Penerimaan Barang (BAST)
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Catat penerimaan barang fisik di gudang atau serah terima jasa dari vendor rekanan.
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
              onClick={() => navigate('/receipts/create')}
            >
              Catat Penerimaan
            </Button>
          </Space>
        </div>
      </div>

      {/* Status Filter Tabs (Figma 05) */}
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
              value={filterType}
              onChange={setFilterType}
              style={{ width: 160 }}
              options={[
                { value: 'ALL', label: 'Semua tipe' },
                { value: 'WAREHOUSE', label: 'Gudang' },
                { value: 'DIRECT_REQUESTER', label: 'Jasa / Direct' },
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
            placeholder="Cari nomor BAST, PO, atau vendor..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredReceipts}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total} BAST`,
          }}
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
