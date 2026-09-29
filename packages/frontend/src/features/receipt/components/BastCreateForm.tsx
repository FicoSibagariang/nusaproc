import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  DatePicker,
  Button,
  Card,
  Upload,
  Typography,
  Table,
  InputNumber,
  Radio,
  App,
  theme,
  Select,
  Space,
  Row,
  Col,
  Alert,
  Modal,
  Tag,
  type UploadFile,
} from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  FileDoneOutlined,
  BarcodeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { poApi } from '../../../api/endpoints/po';
import { receiptApi, type CreateReceiptPayload } from '../../../api/endpoints/receipt';
import { PageHeader } from '../../../components/common/PageHeader';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

interface PoOptionItem {
  id: string;
  poNumber: string;
  vendorName?: string;
  status: string;
}

interface PoItemRow {
  id: string;
  itemName: string;
  quantityOrdered: number;
  quantityAlreadyReceived: number;
  remainingQuantity: number;
  uom: string;
}

const DEFAULT_PO_ITEMS: PoItemRow[] = [
  { id: '51000000-0000-0000-0000-000000000001', itemName: 'Core Edge Router 10G', quantityOrdered: 10, quantityAlreadyReceived: 0, remainingQuantity: 10, uom: 'Unit' },
  { id: '51000000-0000-0000-0000-000000000002', itemName: 'SFP+ 10G Optical Transceiver', quantityOrdered: 20, quantityAlreadyReceived: 0, remainingQuantity: 20, uom: 'Pcs' },
];

export const BastCreateForm: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryPoId = searchParams.get('poId');
  const [form] = Form.useForm();
  const [poList, setPoList] = useState<PoOptionItem[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [poItems, setPoItems] = useState<PoItemRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPo, setLoadingPo] = useState(false);
  const [serialNumberMap, setSerialNumberMap] = useState<Record<string, string[]>>({});
  const [snModalOpen, setSnModalOpen] = useState(false);
  const [activeSnItem, setActiveSnItem] = useState<PoItemRow | null>(null);
  const [snInputText, setSnInputText] = useState('');
  const [invoiceFileList, setInvoiceFileList] = useState<UploadFile[]>([]);
  const [taxInvoiceFileList, setTaxInvoiceFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    poApi
      .list()
      .then(async (res) => {
        const list = res.data || [];
        // Hanya PO berstatus ISSUED atau AMENDED yang dapat dibuatkan BAST (Draft, Completed, Cancelled disaring)
        let receivablePos = Array.isArray(list)
          ? list.filter((p: any) => p.status === 'ISSUED' || p.status === 'AMENDED')
          : [];

        // Jika ada query parameter poId tapi belum masuk dalam daftar list yang ter-fetch
        if (queryPoId && !receivablePos.some((p: any) => p.id === queryPoId)) {
          try {
            const singlePoRes = await poApi.getById(queryPoId);
            const singlePo = singlePoRes?.data;
            if (singlePo && (singlePo.status === 'ISSUED' || singlePo.status === 'AMENDED')) {
              receivablePos = [singlePo, ...receivablePos];
            }
          } catch {
            // Abaikan jika tidak ditemukan
          }
        }

        if (receivablePos.length > 0) {
          setPoList(receivablePos);
          // Prioritaskan PO yang diminta dari query param ?poId=... jika valid
          const targetPo =
            (queryPoId && receivablePos.find((p: any) => p.id === queryPoId)) || receivablePos[0];
          setSelectedPoId(targetPo.id);
          form.setFieldValue('poId', targetPo.id);
          loadPoDetails(targetPo.id);
        } else {
          setPoList([]);
          setSelectedPoId('');
          form.setFieldValue('poId', undefined);
          setPoItems([]);
        }
      })
      .catch(() => {
        setPoList([]);
        setSelectedPoId('');
        form.setFieldValue('poId', undefined);
        setPoItems([]);
      });
  }, [queryPoId]);

  const loadPoDetails = async (poId: string) => {
    if (!poId) {
      setPoItems([]);
      setSerialNumberMap({});
      return;
    }
    setLoadingPo(true);
    setSerialNumberMap({});
    try {
      const res = await poApi.getById(poId);
      if (res.data?.items && res.data.items.length > 0) {
        const mappedItems: PoItemRow[] = res.data.items.map((item: any) => {
          const qtyOrdered = Number(item.quantityOrdered) || 1;
          const qtyReceivedSoFar = Number(item.quantityReceived) || 0;
          const remaining = Math.max(0, qtyOrdered - qtyReceivedSoFar);
          return {
            id: item.id || `item-${Math.random()}`,
            itemName: item.itemName,
            quantityOrdered: qtyOrdered,
            quantityAlreadyReceived: qtyReceivedSoFar,
            remainingQuantity: remaining,
            uom: item.uom || 'Unit',
          };
        });

        setPoItems(mappedItems);

        // Inisialisasi nilai formulir: default diterima baik = sisa pesanan, cacat = 0
        mappedItems.forEach((item) => {
          form.setFieldValue(['items', item.id, 'goodQty'], item.remainingQuantity);
          form.setFieldValue(['items', item.id, 'rejectQty'], 0);
          form.setFieldValue(['items', item.id, 'defectNotes'], '');
        });
      } else {
        setPoItems([]);
      }
    } catch {
      setPoItems([]);
    } finally {
      setLoadingPo(false);
    }
  };

  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    loadPoDetails(poId);
  };

  const openSnModal = (item: PoItemRow) => {
    setActiveSnItem(item);
    const currentSerials = serialNumberMap[item.id] || [];
    setSnInputText(currentSerials.join('\n'));
    setSnModalOpen(true);
  };

  const handleSaveSn = () => {
    if (!activeSnItem) return;
    const parsed = snInputText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const uniqueSerials = Array.from(new Set(parsed));

    setSerialNumberMap((prev) => ({
      ...prev,
      [activeSnItem.id]: uniqueSerials,
    }));
    setSnModalOpen(false);
    setActiveSnItem(null);
    setSnInputText('');
  };

  const columns = [
    {
      title: 'Nama Barang / Jasa',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Pesanan PO',
      key: 'orderSummary',
      width: 140,
      render: (_: unknown, record: PoItemRow) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.quantityOrdered} {record.uom}</Text>
          {record.quantityAlreadyReceived > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Diterima lalu: {record.quantityAlreadyReceived} {record.uom}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>
            Sisa pesan: {record.remainingQuantity} {record.uom}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Qty Diterima Baik (Lolos QC)',
      key: 'goodQty',
      width: 170,
      render: (_: unknown, record: PoItemRow) => (
        <Form.Item
          name={['items', record.id, 'goodQty']}
          initialValue={record.remainingQuantity}
          rules={[
            { required: true, message: 'Qty diterima baik wajib diisi' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                const goodVal = Number(value ?? 0);
                const rejectVal = Number(getFieldValue(['items', record.id, 'rejectQty']) ?? 0);
                if (goodVal < 0) {
                  return Promise.reject(new Error('Qty tidak boleh negatif'));
                }
                if (goodVal + rejectVal > record.remainingQuantity) {
                  return Promise.reject(
                    new Error(`Total Qty Baik (${goodVal}) + Cacat (${rejectVal}) > sisa (${record.remainingQuantity})`)
                  );
                }
                return Promise.resolve();
              },
            }),
          ]}
          style={{ margin: 0 }}
        >
          <InputNumber
            min={0}
            max={record.remainingQuantity}
            style={{ width: '100%' }}
            addonAfter={record.uom}
          />
        </Form.Item>
      ),
    },
    {
      title: 'Serial Number (S/N)',
      key: 'serialNumbers',
      width: 170,
      render: (_: unknown, record: PoItemRow) => {
        const serials = serialNumberMap[record.id] || [];
        const count = serials.length;
        return (
          <Space direction="vertical" size={2}>
            {count > 0 ? (
              <Button
                size="small"
                type="dashed"
                icon={<BarcodeOutlined />}
                onClick={() => openSnModal(record)}
                style={{ borderColor: token.colorPrimary, color: token.colorPrimary }}
              >
                {count} S/N Tersimpan
              </Button>
            ) : (
              <Button
                size="small"
                icon={<BarcodeOutlined />}
                onClick={() => openSnModal(record)}
              >
                + Input S/N
              </Button>
            )}
            {count > 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {serials.slice(0, 2).join(', ')}{count > 2 ? ` (+${count - 2})` : ''}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Qty Cacat / Ditolak (NCR R30)',
      key: 'rejectQty',
      width: 170,
      render: (_: unknown, record: PoItemRow) => (
        <Form.Item
          name={['items', record.id, 'rejectQty']}
          initialValue={0}
          rules={[
            { required: true, message: 'Qty cacat wajib diisi (0 jika tidak ada)' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                const rejectVal = Number(value ?? 0);
                const goodVal = Number(getFieldValue(['items', record.id, 'goodQty']) ?? 0);
                if (rejectVal < 0) {
                  return Promise.reject(new Error('Qty tidak boleh negatif'));
                }
                if (goodVal + rejectVal > record.remainingQuantity) {
                  return Promise.reject(
                    new Error(`Total Qty Baik (${goodVal}) + Cacat (${rejectVal}) > sisa (${record.remainingQuantity})`)
                  );
                }
                if (goodVal === 0 && rejectVal === 0) {
                  return Promise.reject(new Error('Minimal salah satu Qty harus > 0'));
                }
                return Promise.resolve();
              },
            }),
          ]}
          style={{ margin: 0 }}
        >
          <InputNumber
            min={0}
            max={record.remainingQuantity}
            style={{ width: '100%' }}
            addonAfter={record.uom}
          />
        </Form.Item>
      ),
    },
    {
      title: 'Keterangan Cacat / Alasan Ditolak (NCR R30)',
      key: 'defectNotes',
      width: 250,
      render: (_: unknown, record: PoItemRow) => (
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.items?.[record.id]?.rejectQty !== currentValues.items?.[record.id]?.rejectQty
          }
        >
          {({ getFieldValue }) => {
            const rejectQty = Number(getFieldValue(['items', record.id, 'rejectQty']) || 0);
            const isDefect = rejectQty > 0;
            return (
              <Form.Item
                name={['items', record.id, 'defectNotes']}
                rules={[
                  {
                    required: isDefect,
                    message: 'Wajib mengisi rincian cacat untuk penerbitan laporan NCR!',
                  },
                ]}
                style={{ margin: 0 }}
              >
                <Input.TextArea
                  rows={2}
                  placeholder={
                    isDefect
                      ? 'Wajib diisi: rincian kerusakan/cacat untuk penerbitan laporan NCR'
                      : 'Opsional (hanya jika ada barang cacat)'
                  }
                  style={{
                    borderColor: isDefect ? token.colorWarning : undefined,
                  }}
                />
              </Form.Item>
            );
          }}
        </Form.Item>
      ),
    },
  ];

  const handleSubmit = async (values: Record<string, any>) => {
    if (invoiceFileList.length === 0) {
      message.warning('Wajib melampirkan berkas fisik Tagihan / Invoice atau Surat Jalan vendor saat penerimaan barang (R29)!');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateReceiptPayload = {
        poId: values.poId || selectedPoId,
        receiptType: values.receiptType || 'WAREHOUSE',
        deliveryNoteNumber: values.deliveryNoteNumber || undefined,
        receivedDate: values.receivedDate ? dayjs(values.receivedDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        notes: values.notes,
        items: poItems.map((item) => {
          const itemVal = values.items?.[item.id] || {};
          const goodQty = Number(itemVal.goodQty ?? item.remainingQuantity ?? 0);
          const rejectQty = Number(itemVal.rejectQty ?? 0);
          const defectNotes = itemVal.defectNotes?.trim() || undefined;
          const serials = serialNumberMap[item.id] || [];
          return {
            poItemId: item.id,
            quantityReceived: goodQty,
            quantityRejected: rejectQty,
            serialNumbers: serials.length > 0 ? serials : undefined,
            conditionNotes:
              defectNotes ||
              (rejectQty > 0
                ? `Terdapat ${rejectQty} ${item.uom} cacat/rusak saat serah terima fisik (NCR R30)`
                : undefined),
          };
        }),
      };

      const res = await receiptApi.create(payload);
      const grNumber = res?.data?.grNumber || 'BAST';
      const ncrCount = res?.data?.ncrRecords?.length || 0;
      if (ncrCount > 0) {
        message.warning(
          `Berita Acara Serah Terima (${grNumber}) berhasil disimpan (R29). Sistem otomatis menerbitkan ${ncrCount} laporan ketidaksesuaian barang (NCR - R30) untuk unit yang cacat!`
        );
      } else {
        message.success(`Berita Acara Serah Terima (${grNumber}) berhasil disimpan & diterbitkan (R29)!`);
      }
      navigate('/receipts');
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Gagal menyimpan BAST';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        title="Pencatatan Penerimaan Barang / Jasa (BAST - R29)"
        subtitle="Pencatatan serah terima fisik barang dari vendor oleh tim gudang/penerima independen (R29, R31 SoD)."
        icon={<FileDoneOutlined style={{ color: token.colorPrimary }} />}
        breadcrumbs={[
          { title: 'Beranda', href: '/dashboard' },
          { title: 'Daftar BAST', href: '/receipts' },
          { title: 'Penerimaan Baru' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/receipts')}>
            Kembali
          </Button>
        }
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          poId: selectedPoId,
          receiptType: 'WAREHOUSE',
          receivedDate: dayjs(),
        }}
        onFinish={handleSubmit}
      >
        <Card title="Informasi Penerimaan Fisik (BAST)" style={{ marginBottom: 24 }}>
          {poList.length === 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Belum Ada PO Siap Diterima"
              description="Penerimaan barang (BAST) hanya dapat dilakukan untuk PO yang telah disetujui dan diterbitkan secara resmi (status ISSUED atau AMENDED). PO dengan status Draft tidak dapat dibuatkan BAST."
            />
          )}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="poId"
                label="Pilih Surat Pesanan (PO)"
                rules={[{ required: true, message: 'Wajib memilih nomor PO yang telah terbit!' }]}
              >
                <Select
                  placeholder={poList.length === 0 ? 'Tidak ada PO berstatus ISSUED / AMENDED' : 'Pilih PO'}
                  onChange={handlePoChange}
                  disabled={poList.length === 0}
                  notFoundContent="Tidak ada PO siap terima"
                >
                  {poList.map((po) => (
                    <Select.Option key={po.id} value={po.id}>
                      {po.poNumber} {po.vendorName ? `— ${po.vendorName}` : ''} ({po.status})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="receiptType"
                label="Tipe Penerimaan"
                rules={[{ required: true, message: 'Wajib memilih tipe penerimaan!' }]}
              >
                <Select placeholder="Pilih Tipe Penerimaan">
                  <Select.Option value="WAREHOUSE">Gudang / Warehouse (Standar)</Select.Option>
                  <Select.Option value="DIRECT_REQUESTER">Langsung ke Pengaju (Direct Requester)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="deliveryNoteNumber"
                label="Nomor Surat Jalan Vendor (Opsional)"
              >
                <Input placeholder="Contoh: SJ-202608-0091" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="receivedDate"
                label="Tanggal Penerimaan Fisik"
                rules={[{ required: true, message: 'Tanggal penerimaan wajib dipilih' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Catatan Kondisi Penerimaan">
            <TextArea rows={3} placeholder="Barang diterima lengkap dalam kardus bersegel tanpa kerusakan fisik..." />
          </Form.Item>
        </Card>

        <Card title="Daftar Item Diterima Fisik (Pemeriksaan Qty Baik vs Cacat - R29 & R30)" style={{ marginBottom: 24 }}>
          <Alert
            type="info"
            showIcon
            message="Pemeriksaan Fisik Parsial & Penanganan Barang Cacat (NCR - R30)"
            description="Jika terdapat barang yang rusak/cacat, masukkan kuantitasnya pada kolom 'Qty Cacat / Ditolak'. Sistem akan otomatis menerima unit yang baik ke inventaris dan menerbitkan dokumen Non-Conformance Report (NCR) resmi untuk unit yang cacat."
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={poItems}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="middle"
            loading={loadingPo}
            scroll={{ x: 600 }}
          />
        </Card>

        {/* 1. Wajib Unggah Tagihan / Invoice Fisik Vendor (R29) */}
        <Card
          title={
            <Space>
              <span>1. Unggah Tagihan / Invoice Fisik Vendor</span>
              <Tag color="red">Wajib saat Penerimaan</Tag>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Tagihan Fisik Wajib Dilampirkan saat Serah Terima Barang (R29)"
            description="Unggah berkas Invoice Fisik atau Surat Jalan asli yang dibawa oleh kurir/ekspedisi vendor saat serah terima barang di gudang. Faktur Pajak elektronik (e-Faktur) TIDAK diwajibkan di sini dan dapat diunggah menyusul oleh tim Finance/Pajak."
          />
          <Dragger
            name="invoiceFiles"
            fileList={invoiceFileList}
            onChange={({ fileList }) => setInvoiceFileList(fileList)}
            beforeUpload={(file) => {
              const isValidType =
                file.type === 'application/pdf' ||
                file.type === 'image/png' ||
                file.type === 'image/jpeg';
              if (!isValidType) {
                message.error('Format file harus PDF, PNG, atau JPEG!');
              }
              return false; // simpan di state lokal form
            }}
            accept=".pdf,.png,.jpg,.jpeg"
            maxCount={5}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: token.colorPrimary, fontSize: 44 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
              Klik atau tarik berkas Invoice Vendor ke sini (Wajib)
            </p>
            <p className="ant-upload-hint">
              Mendukung file PDF asli, foto fisik PNG, atau JPEG (maksimal 5 berkas).
            </p>
          </Dragger>
        </Card>

        {/* 2. Opsional / Menyusul: Unggah Faktur Pajak Elektronik (e-Faktur) */}
        <Card
          title={
            <Space>
              <span>2. Faktur Pajak Elektronik (e-Faktur)</span>
              <Tag color="blue">Opsional / Bisa Menyusul</Tag>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Faktur Pajak Dapat Diunggah Menyusul oleh Tim Pajak / Finance"
            description="Jika vendor belum menerbitkan e-Faktur saat pengiriman barang, bagian ini dapat dikosongkan. Tim Finance / Tax Specialist dapat melengkapi Faktur Pajak susulan dan memvalidasi NSFP Coretax di menu Verifikasi Tagihan (/invoices) sebelum proses pencairan pembayaran."
          />
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="nsfpOriginal"
                label="Nomor Seri Faktur Pajak (NSFP) — Jika Sudah Diterbitkan Vendor"
              >
                <Input placeholder="Contoh: 010.002-26.12345678 (16/17 digit)" allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Dragger
            name="taxInvoiceFiles"
            fileList={taxInvoiceFileList}
            onChange={({ fileList }) => setTaxInvoiceFileList(fileList)}
            beforeUpload={(file) => {
              const isValidType =
                file.type === 'application/pdf' ||
                file.type === 'image/png' ||
                file.type === 'image/jpeg';
              if (!isValidType) {
                message.error('Format file harus PDF, PNG, atau JPEG!');
              }
              return false; // simpan di state lokal form
            }}
            accept=".pdf,.png,.jpg,.jpeg"
            maxCount={2}
          >
            <p className="ant-upload-drag-icon">
              <FileTextOutlined style={{ color: token.colorTextSecondary, fontSize: 36 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 14 }}>
              Tarik berkas Faktur Pajak ke sini jika sudah ada (Opsional)
            </p>
            <p className="ant-upload-hint">
              Kosongkan jika belum tersedia dari vendor. Tim Pajak dapat melengkapinya di modul Tagihan.
            </p>
          </Dragger>
        </Card>

        <Space size={12}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            disabled={submitting || poList.length === 0}
          >
            Simpan & Terbitkan BAST
          </Button>
          <Button
            size="large"
            onClick={() => navigate('/receipts')}
            disabled={submitting}
          >
            Batal
          </Button>
        </Space>
      </Form>

      <Modal
        open={snModalOpen}
        onCancel={() => {
          setSnModalOpen(false);
          setActiveSnItem(null);
          setSnInputText('');
        }}
        onOk={handleSaveSn}
        okText="Simpan Serial Number"
        cancelText="Batal"
        title={
          <Space>
            <BarcodeOutlined style={{ color: token.colorPrimary }} />
            <span>Perekaman Serial Number (S/N)</span>
          </Space>
        }
        width={600}
      >
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeSnItem && (
            <div>
              <Text strong style={{ fontSize: 15 }}>{activeSnItem.itemName}</Text>
            </div>
          )}
          <Alert
            type="info"
            showIcon
            message="Petunjuk Input Serial Number"
            description="Pindai barcode langsung dengan scanner (akan otomatis berganti baris), atau salin & tempel daftar serial number dari file Excel/teks (satu nomor per baris atau dipisahkan koma)."
          />

          <div>
            <Text strong>Daftar Serial Number:</Text>
            <TextArea
              rows={6}
              value={snInputText}
              onChange={(e) => setSnInputText(e.target.value)}
              placeholder={"Contoh:\nSN-RTR-1001\nSN-RTR-1002\nSN-RTR-1003"}
              style={{ marginTop: 6, fontFamily: 'monospace' }}
            />
          </div>

          {(() => {
            const parsed = snInputText
              .split(/[\n,;]+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            const count = parsed.length;
            const itemGoodQty = activeSnItem
              ? Number(form.getFieldValue(['items', activeSnItem.id, 'goodQty']) ?? activeSnItem.remainingQuantity)
              : 0;
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary">
                  Total terinput: <Text strong>{count}</Text> S/N (Qty Diterima Baik: {itemGoodQty})
                </Text>
                {count > itemGoodQty && itemGoodQty > 0 && (
                  <Tag color="warning">Jumlah S/N ({count}) &gt; Qty Baik ({itemGoodQty})</Tag>
                )}
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};

export default BastCreateForm;
