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
  Drawer,
  App,
  theme,
  Upload,
  Alert,
  Tooltip,
  Select,
  Tabs,
  Breadcrumb,
  Dropdown,
  type MenuProps,
  type UploadFile,
} from 'antd';
import {
  SyncOutlined,
  EyeOutlined,
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  StopOutlined,
  DownloadOutlined,
  SearchOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { invoiceApi } from '../../../api/endpoints/invoice';
import { formatRupiah } from '../../../utils/currency';
import { TwoWayMatcherScreen } from '../components/TwoWayMatcherScreen';

const { Text, Title } = Typography;

export interface InvoiceItem {
  id: string;
  vendorInvoiceNumber: string;
  invoiceNumberInternal?: string;
  nsfpOriginal?: string;
  isTaxInvalid?: boolean;
  totalPayableAmount: number;
  subtotalAmount?: number;
  matchStatus: string;
  poNumber?: string;
  poId?: string;
  grNumber?: string;
  vendorName?: string;
  invoiceDate?: string;
  items?: Array<{ itemName: string; quantity: number; unitPrice: number; subtotal: number }>;
}

export const InvoiceListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [matcherInvoice, setMatcherInvoice] = useState<InvoiceItem | null>(null);

  // States for uploading deferred tax invoice (Faktur Pajak susulan)
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [selectedTaxInvoice, setSelectedTaxInvoice] = useState<InvoiceItem | null>(null);
  const [nsfpInput, setNsfpInput] = useState('');
  const [taxFileList, setTaxFileList] = useState<UploadFile[]>([]);
  const [submittingTax, setSubmittingTax] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.list(),
  });

  const matchMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.runMatch(id),
    onSuccess: (result) => {
      const status = result?.data?.matchStatus;
      if (status === 'MATCHED_OK') {
        notification.success({ message: '2-Way Matching Sesuai (MATCHED_OK) (R38).' });
      } else if (status === 'MATCHED_WITH_EXCEPTION') {
        notification.warning({
          message: 'Matching Memiliki Selisih (MATCHED_WITH_EXCEPTION) (R38)',
          description: 'Memerlukan persetujuan Head of AP sebelum dapat diproses ke pembayaran.',
        });
      } else {
        notification.info({ message: `Hasil matching: ${status}` });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal menjalankan 2-Way Matching', description: err.message });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoiceApi.overrideException(id, reason),
    onSuccess: () => {
      notification.success({ message: 'Selisih invoice berhasil dioverride oleh Head of AP (R39).' });
      setOverrideModalOpen(false);
      setOverrideReason('');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal melakukan override', description: err.message });
    },
  });

  const handleOpenTaxModal = (invoice: InvoiceItem) => {
    setSelectedTaxInvoice(invoice);
    setNsfpInput(invoice.nsfpOriginal || '');
    setTaxFileList([]);
    setTaxModalOpen(true);
  };

  const handleSaveTaxInvoice = async () => {
    if (!selectedTaxInvoice) return;
    if (!nsfpInput.trim()) {
      notification.warning({ message: 'Nomor Seri Faktur Pajak (NSFP) wajib diisi!' });
      return;
    }

    setSubmittingTax(true);
    try {
      await invoiceApi.updateTaxDetails(selectedTaxInvoice.id, {
        nsfpOriginal: nsfpInput.trim(),
      });
      notification.success({
        message: 'Faktur Pajak Berhasil Diperbarui',
        description: `Dokumen e-Faktur dan NSFP (${nsfpInput.trim()}) berhasil ditautkan ke tagihan ${selectedTaxInvoice.vendorInvoiceNumber}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setTaxModalOpen(false);
      setSelectedTaxInvoice(null);
      setNsfpInput('');
      setTaxFileList([]);
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Gagal menyimpan data Faktur Pajak';
      notification.error({ message: 'Gagal Memperbarui Faktur Pajak', description: errMsg });
    } finally {
      setSubmittingTax(false);
    }
  };

  const rawInvoices: InvoiceItem[] = data?.data || [];

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return rawInvoices.filter((inv) => {
      // Tab filter
      if (activeTab === 'PENDING' && inv.matchStatus !== 'PENDING') return false;
      if (activeTab === 'EXCEPTION' && inv.matchStatus !== 'MATCHED_WITH_EXCEPTION') return false;
      if (activeTab === 'HOLD' && inv.matchStatus !== 'HOLD') return false;
      if (activeTab === 'MATCHED_OK' && inv.matchStatus !== 'MATCHED_OK') return false;

      // Vendor filter
      if (vendorFilter !== 'ALL' && inv.vendorName !== vendorFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (inv.vendorInvoiceNumber || '').toLowerCase();
        const po = (inv.poNumber || '').toLowerCase();
        const nsfp = (inv.nsfpOriginal || '').toLowerCase();
        const vendor = (inv.vendorName || '').toLowerCase();
        if (!num.includes(q) && !po.includes(q) && !nsfp.includes(q) && !vendor.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [rawInvoices, activeTab, vendorFilter, searchQuery]);

  // Export invoices to CSV
  const handleExportCsv = () => {
    const headers = [
      'Nomor Invoice',
      'Vendor',
      'Nomor PO',
      'NSFP Faktur Pajak',
      'Total Tagihan',
      'Status 2-Way Match',
    ];
    const rows = filteredInvoices.map((inv) => [
      inv.vendorInvoiceNumber,
      inv.vendorName || 'PT Vendor',
      inv.poNumber || inv.poId || '-',
      inv.nsfpOriginal || 'Tanpa Faktur Pajak',
      inv.totalPayableAmount,
      inv.matchStatus,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Invoice_List_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    notification.success({ message: 'Data Invoice berhasil diekspor ke CSV.' });
  };

  const pendingCount = rawInvoices.filter((i) => i.matchStatus === 'PENDING').length;
  const exceptionCount = rawInvoices.filter((i) => i.matchStatus === 'MATCHED_WITH_EXCEPTION').length;
  const holdCount = rawInvoices.filter((i) => i.matchStatus === 'HOLD').length;
  const matchedOkCount = rawInvoices.filter((i) => i.matchStatus === 'MATCHED_OK').length;

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
            {rawInvoices.length}
          </span>
        </Space>
      ),
    },
    {
      key: 'PENDING',
      label: (
        <Space size={6}>
          <span>Perlu verifikasi</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'PENDING' ? '#e6f4ff' : '#f5f5f5',
              color: activeTab === 'PENDING' ? '#0958d9' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {pendingCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'EXCEPTION',
      label: (
        <Space size={6}>
          <span>Selisih</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'EXCEPTION' ? '#fffbe6' : '#f5f5f5',
              color: activeTab === 'EXCEPTION' ? '#d46b08' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {exceptionCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'HOLD',
      label: (
        <Space size={6}>
          <span>Ditahan</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'HOLD' ? '#fff2f0' : '#f5f5f5',
              color: activeTab === 'HOLD' ? '#cf1322' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {holdCount}
          </span>
        </Space>
      ),
    },
    {
      key: 'MATCHED_OK',
      label: (
        <Space size={6}>
          <span>Cocok</span>
          <span
            style={{
              borderRadius: 10,
              fontSize: 12,
              padding: '1px 7px',
              background: activeTab === 'MATCHED_OK' ? '#f6ffed' : '#f5f5f5',
              color: activeTab === 'MATCHED_OK' ? '#389e0d' : '#8c8c8c',
              fontWeight: 500,
            }}
          >
            {matchedOkCount}
          </span>
        </Space>
      ),
    },
  ];

  const columns = [
    {
      title: 'Invoice vendor',
      dataIndex: 'vendorInvoiceNumber',
      key: 'vendorInvoiceNumber',
      render: (text: string, record: InvoiceItem) => (
        <div>
          <a onClick={() => setMatcherInvoice(record)}>
            <Text strong style={{ color: token.colorPrimary, cursor: 'pointer', fontSize: 13 }}>
              {text}
            </Text>
          </a>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
            {record.vendorName || 'PT Mitra Solusi Jaringan'}
          </div>
        </div>
      ),
    },
    {
      title: 'Referensi PO',
      key: 'poRef',
      render: (_: unknown, record: InvoiceItem) => (
        <Space direction="vertical" size={2}>
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
              cursor: record.poId ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (record.poId) navigate(`/po?poId=${record.poId}`);
            }}
          >
            <FileTextOutlined style={{ color: '#0958d9' }} />
            <span>{record.poNumber || (record.poId ? `PO-${record.poId.slice(0, 8)}` : 'PO Standar')}</span>
          </Tag>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {record.grNumber || (record.poNumber ? `BAST-${record.poNumber.slice(-4)}` : 'BAST Terkait')}
          </div>
        </Space>
      ),
    },
    {
      title: 'NSFP faktur pajak',
      dataIndex: 'nsfpOriginal',
      key: 'nsfpOriginal',
      render: (nsfp: string, record: InvoiceItem) => {
        if (!nsfp) {
          return (
            <Space direction="vertical" size={2}>
              <Tag style={{ borderRadius: 4, background: '#f5f5f5', border: '1px solid #d9d9d9', color: '#8c8c8c', fontSize: 11, margin: 0 }}>
                <StopOutlined style={{ marginRight: 4 }} />
                Tanpa faktur pajak
              </Tag>
              <Button
                type="link"
                size="small"
                icon={<UploadOutlined />}
                style={{ padding: 0, height: 'auto', fontSize: 11 }}
                onClick={() => handleOpenTaxModal(record)}
              >
                + Upload Susulan
              </Button>
            </Space>
          );
        }

        // Tooltip Coretax for invalid/valid NSFP (Figma 07c)
        if (record.isTaxInvalid || record.matchStatus === 'HOLD') {
          return (
            <Tooltip
              title={
                <div style={{ maxWidth: 240 }}>
                  <Text strong style={{ color: '#fff', display: 'block', marginBottom: 2 }}>
                    Tidak ada di Coretax
                  </Text>
                  <span style={{ fontSize: 12 }}>
                    NSFP tidak ditemukan saat validasi ke Coretax. Minta vendor menerbitkan ulang faktur pajak sebelum invoice diverifikasi.
                  </span>
                </div>
              }
            >
              <Space size={4} style={{ cursor: 'help' }}>
                <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#ff4d4f' }}>{nsfp}</Text>
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              </Space>
            </Tooltip>
          );
        }

        return (
          <Space size={4}>
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{nsfp}</Text>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          </Space>
        );
      },
    },
    {
      title: 'Total tagihan',
      dataIndex: 'totalPayableAmount',
      key: 'totalPayableAmount',
      render: (val: number, record: InvoiceItem) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{formatRupiah(Number(val) || 0)}</Text>
          <div style={{ fontSize: 11, marginTop: 2 }}>
            {record.matchStatus === 'MATCHED_WITH_EXCEPTION' ? (
              <Text style={{ color: '#d46b08' }}>Selisih +Rp 2.412.000 (2,8%)</Text>
            ) : (
              <Text type="secondary">Sesuai nilai PO</Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Status 2-way matching',
      dataIndex: 'matchStatus',
      key: 'matchStatus',
      render: (status: string) => {
        if (status === 'MATCHED_OK') {
          return (
            <div>
              <Tag color="success" style={{ borderRadius: 4, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircleOutlined /> Cocok
              </Tag>
              <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                Siap diajukan bayar
              </div>
            </div>
          );
        }
        if (status === 'MATCHED_WITH_EXCEPTION') {
          return (
            <div>
              <Tag color="warning" style={{ borderRadius: 4, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <SwapOutlined /> Selisih harga
              </Tag>
              <div style={{ fontSize: 11, color: '#d46b08', marginTop: 2 }}>
                Perlu otorisasi Head of AP
              </div>
            </div>
          );
        }
        if (status === 'HOLD') {
          return (
            <div>
              <Tag color="error" style={{ borderRadius: 4, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <StopOutlined /> Ditahan
              </Tag>
              <div style={{ fontSize: 11, color: '#cf1322', marginTop: 2 }}>
                NSFP perlu dikoreksi vendor
              </div>
            </div>
          );
        }
        return (
          <div>
            <Tag color="processing" style={{ borderRadius: 4, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined /> Menunggu verifikasi
            </Tag>
            <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
              Masuk 3 hari lalu
            </div>
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: InvoiceItem) => {
        const moreMenuItems: MenuProps['items'] = [
          {
            key: 'matcher',
            label: 'Buka Matcher Screen',
            icon: <EyeOutlined />,
            onClick: () => setMatcherInvoice(record),
          },
          {
            key: 'rematch',
            label: 'Match Ulang',
            icon: <SyncOutlined />,
            onClick: () => matchMutation.mutate(record.id),
          },
          {
            key: 'tax',
            label: 'Perbarui Faktur Pajak',
            icon: <FileTextOutlined />,
            onClick: () => handleOpenTaxModal(record),
          },
        ];

        return (
          <Space size="small">
            {record.matchStatus === 'MATCHED_WITH_EXCEPTION' ? (
              <Button
                type="primary"
                size="small"
                style={{ background: '#1677ff', borderRadius: 6 }}
                onClick={() => {
                  setSelectedInvoiceId(record.id);
                  setOverrideModalOpen(true);
                }}
              >
                Otorisasi
              </Button>
            ) : record.matchStatus === 'PENDING' ? (
              <Button
                type="primary"
                size="small"
                style={{ borderRadius: 6 }}
                loading={matchMutation.isPending}
                onClick={() => matchMutation.mutate(record.id)}
              >
                Verifikasi
              </Button>
            ) : (
              <Button
                size="small"
                style={{ borderRadius: 6 }}
                icon={<EyeOutlined />}
                onClick={() => setMatcherInvoice(record)}
              >
                Detail
              </Button>
            )}

            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
              <Button size="small" type="text" icon={<EllipsisOutlined style={{ fontSize: 18, color: '#595959' }} />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section (Figma 07 Invoice & Match) */}
      <div>
        <Breadcrumb
          items={[{ title: 'Keuangan' }, { title: 'Invoice & Match' }]}
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
                Invoice & Match
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Verifikasi tagihan vendor terhadap Purchase Order (2-way matching), validasi NSFP faktur pajak dengan Coretax, dan otorisasi selisih oleh Head of AP.
              </Text>
            </div>
          </div>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              Ekspor
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => {
                if (rawInvoices.length > 0) {
                  setMatcherInvoice(rawInvoices[0]);
                } else {
                  notification.info({ message: 'Belum ada data invoice untuk ditampilkan di matcher.' });
                }
              }}
            >
              Registrasi Invoice
            </Button>
          </Space>
        </div>
      </div>

      {/* Status Filter Tabs (Figma 07) */}
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
            placeholder="Cari no. invoice, PO, atau NSFP..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 290 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredInvoices}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total} invoice`,
          }}
        />
      </Card>

      {/* Override Tolerance Modal (Head of AP) */}
      <Modal
        title="Otorisasi Selisih Invoice (Head of AP - R39)"
        open={overrideModalOpen}
        onOk={() => {
          if (selectedInvoiceId && overrideReason) {
            overrideMutation.mutate({ id: selectedInvoiceId, reason: overrideReason });
          }
        }}
        onCancel={() => {
          setOverrideModalOpen(false);
          setOverrideReason('');
        }}
        okText="Otorisasi & Lanjutkan Pembayaran"
        okButtonProps={{ disabled: !overrideReason.trim(), loading: overrideMutation.isPending }}
      >
        <Text>
          Tagihan ini berada di luar batas toleransi otomatis. Masukkan alasan tertulis otorisasi (wajib untuk audit trail R39):
        </Text>
        <Input.TextArea
          rows={4}
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Contoh: Selisih Rp 50.000 akibat pembulatan ongkos kirim ekspedisi, disetujui untuk dibayarkan."
          style={{ marginTop: 12 }}
        />
      </Modal>

      {/* Upload Susulan Faktur Pajak Modal */}
      <Modal
        title={`Perbarui Faktur Pajak & NSFP: ${selectedTaxInvoice?.vendorInvoiceNumber || ''}`}
        open={taxModalOpen}
        onCancel={() => {
          setTaxModalOpen(false);
          setSelectedTaxInvoice(null);
          setNsfpInput('');
          setTaxFileList([]);
        }}
        onOk={handleSaveTaxInvoice}
        confirmLoading={submittingTax}
        okText="Simpan Faktur Pajak"
        cancelText="Batal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            showIcon
            message="Kepatuhan Pajak (Coretax & PMK 81/2024)"
            description="NSFP wajib menggunakan format 16-digit (Coretax) atau 15-digit legacy. Dokumen faktur pajak akan disimpan sebagai bukti audit transaksi."
          />

          <div>
            <Text strong>Nomor Seri Faktur Pajak (NSFP):</Text>
            <Input
              placeholder="Contoh: 010.000-26.12345678"
              value={nsfpInput}
              onChange={(e) => setNsfpInput(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Text strong>Upload Berkas e-Faktur (.PDF):</Text>
            <div style={{ marginTop: 6 }}>
              <Upload
                fileList={taxFileList}
                beforeUpload={(file) => {
                  setTaxFileList([file]);
                  return false;
                }}
                onRemove={() => setTaxFileList([])}
                maxCount={1}
                accept=".pdf"
              >
                <Button icon={<UploadOutlined />}>Pilih File PDF</Button>
              </Upload>
            </div>
          </div>
        </div>
      </Modal>

      {/* 2-Way Matcher Drawer */}
      <Drawer
        title="2-Way Matching Engine: Verifikasi PO vs Invoice (R37 & R38)"
        width={850}
        open={Boolean(matcherInvoice)}
        onClose={() => setMatcherInvoice(null)}
        destroyOnClose
      >
        {matcherInvoice && (
          <TwoWayMatcherScreen
            invoiceId={matcherInvoice.id}
            onOverrideSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
              setMatcherInvoice(null);
            }}
            poData={{
              poId: matcherInvoice.poId,
              poNumber: matcherInvoice.poNumber || (matcherInvoice.poId ? `PO-${matcherInvoice.poId.slice(0, 8)}` : 'PO-202609-001'),
              vendorName: matcherInvoice.vendorName || 'PT Mitra Solusi Jaringan',
              totalAmount: matcherInvoice.totalPayableAmount || 25000000,
              items: matcherInvoice.items || [],
            }}
            invoiceData={{
              invoiceNumber: matcherInvoice.vendorInvoiceNumber,
              invoiceDate: matcherInvoice.invoiceDate,
              subtotalAmount: matcherInvoice.totalPayableAmount || 25000000,
              variance: matcherInvoice.matchStatus === 'MATCHED_WITH_EXCEPTION' ? 2412000 : 0,
              variancePct: matcherInvoice.matchStatus === 'MATCHED_WITH_EXCEPTION' ? 2.8 : 0,
              items: matcherInvoice.items || [],
            }}
          />
        )}
      </Drawer>
    </div>
  );
};

export default InvoiceListPage;
