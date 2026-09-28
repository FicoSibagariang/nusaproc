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
} from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  FileDoneOutlined,
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
      return;
    }
    setLoadingPo(true);
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
          return {
            poItemId: item.id,
            quantityReceived: goodQty,
            quantityRejected: rejectQty,
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

        {/* Simultaneous Invoice & Tax Invoice Upload Component (R29) */}
        <Card title="Unggah Serentak Tagihan Vendor & Faktur Pajak (R29 Simultaneous Upload)" style={{ marginBottom: 24 }}>
          <Dragger
            name="files"
            multiple
            action="/api/v1/storage/upload"
            accept=".pdf,.png,.jpg,.jpeg"
            beforeUpload={(file) => {
              const isValidType =
                file.type === 'application/pdf' ||
                file.type === 'image/png' ||
                file.type === 'image/jpeg';
              if (!isValidType) {
                message.error('Format file harus PDF, PNG, atau JPEG!');
              }
              return isValidType || Upload.LIST_IGNORE;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: token.colorPrimary, fontSize: 48 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
              Tarik file ke sini
            </p>
            <p className="ant-upload-hint">
              Mendukung file PDF asli, PNG, atau JPEG. File akan otomatis divalidasi magic bytes dan dipindai antivirus secara instan (R51).
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
    </div>
  );
};

export default BastCreateForm;
