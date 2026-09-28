import React from 'react';
import {
  Modal,
  Descriptions,
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Alert,
  Spin,
  theme,
  Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileDoneOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AlertOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  receiptApi,
  type ReceiptDetailData,
  type ReceiptItemData,
  type ReceiptNcrData,
} from '../../../api/endpoints/receipt';
import { formatDate, formatDateTime } from '../../../utils/date';

const { Text, Title, Paragraph } = Typography;

export interface BastDetailModalProps {
  open: boolean;
  grId: string | null;
  onClose: () => void;
}

export const BastDetailModal: React.FC<BastDetailModalProps> = ({
  open,
  grId,
  onClose,
}) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const { data: resData, isLoading, error } = useQuery({
    queryKey: ['receipt-detail', grId],
    queryFn: () => receiptApi.getById(grId!),
    enabled: Boolean(open && grId),
  });

  const receipt: ReceiptDetailData | undefined = resData?.data;
  const hasDefects = receipt?.items?.some((i) => i.quantityRejected > 0) || (receipt?.ncrRecords && receipt.ncrRecords.length > 0);

  // Table Columns for Received Items
  const itemColumns: ColumnsType<ReceiptItemData> = [
    {
      title: 'No',
      key: 'no',
      width: 50,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Nama Barang / Jasa',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string | null | undefined, record: ReceiptItemData) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text || 'Item PO'}</Text>
          {record.serialNumbers && record.serialNumbers.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
                <BarcodeOutlined /> Serial Number ({record.serialNumbers.length} unit):
              </Text>
              <Space size={[4, 4]} wrap>
                {record.serialNumbers.map((sn, idx) => (
                  <Tag key={idx} color="cyan" style={{ fontSize: 11, margin: 0 }}>
                    {sn}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'Qty Pesanan PO',
      dataIndex: 'quantityOrdered',
      key: 'quantityOrdered',
      width: 130,
      align: 'right',
      render: (qty: number | null | undefined, record) =>
        qty !== null && qty !== undefined ? (
          <Text>{qty.toLocaleString('id-ID')} {record.uom || 'Unit'}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Qty Diterima Baik (Lolos QC)',
      dataIndex: 'quantityReceived',
      key: 'quantityReceived',
      width: 170,
      align: 'right',
      render: (qty: number, record) => (
        <Tag color="success" style={{ fontWeight: 600, fontSize: 13, padding: '2px 8px' }}>
          <CheckCircleOutlined /> {qty.toLocaleString('id-ID')} {record.uom || 'Unit'}
        </Tag>
      ),
    },
    {
      title: 'Qty Cacat / Ditolak',
      dataIndex: 'quantityRejected',
      key: 'quantityRejected',
      width: 160,
      align: 'right',
      render: (qty: number, record) =>
        qty > 0 ? (
          <Tag color="error" style={{ fontWeight: 600, fontSize: 13, padding: '2px 8px' }}>
            <CloseCircleOutlined /> {qty.toLocaleString('id-ID')} {record.uom || 'Unit'}
          </Tag>
        ) : (
          <Text type="secondary">0</Text>
        ),
    },
    {
      title: 'Keterangan Kerusakan / Catatan Kondisi',
      dataIndex: 'conditionNotes',
      key: 'conditionNotes',
      render: (notes: string | null | undefined, record) =>
        record.quantityRejected > 0 ? (
          <Text type="danger" style={{ fontWeight: 500 }}>
            {notes || 'Barang cacat/rusak saat serah terima fisik'}
          </Text>
        ) : (
          <Text type="secondary">{notes || '-'}</Text>
        ),
    },
  ];

  // Table Columns for NCRs
  const ncrColumns: ColumnsType<ReceiptNcrData> = [
    {
      title: 'Nomor NCR',
      dataIndex: 'ncrNumber',
      key: 'ncrNumber',
      width: 150,
      render: (text: string) => (
        <Text strong style={{ color: token.colorError }}>
          <AlertOutlined /> {text}
        </Text>
      ),
    },
    {
      title: 'Deskripsi Kerusakan / Ketidaksesuaian',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Tindakan yang Diperlukan',
      dataIndex: 'actionRequired',
      key: 'actionRequired',
      render: (text: string) => <Tag color="warning">{text}</Tag>,
    },
    {
      title: 'Status NCR',
      dataIndex: 'isResolved',
      key: 'isResolved',
      width: 140,
      align: 'center',
      render: (isResolved: boolean) =>
        isResolved ? (
          <Tag color="success">SELESAI (RESOLVED)</Tag>
        ) : (
          <Tag color="error">TERBUKA (OPEN)</Tag>
        ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={950}
      title={
        <Space align="center" size="middle">
          <FileDoneOutlined style={{ color: token.colorPrimary, fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>
            Detail Berita Acara Serah Terima: {receipt?.grNumber || 'Memuat...'}
          </Title>
          {receipt && (
            <Tag color={receipt.receiptType === 'WAREHOUSE' ? 'geekblue' : 'purple'}>
              {receipt.receiptType === 'WAREHOUSE' ? 'Gudang (Warehouse)' : 'Direct Requester'}
            </Tag>
          )}
          {hasDefects ? (
            <Tag color="error" icon={<AlertOutlined />}>
              ADA BARANG CACAT (NCR)
            </Tag>
          ) : receipt ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              SEMUA BARANG BAIK
            </Tag>
          ) : null}
        </Space>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {receipt?.poNumber && (
              <Button
                icon={<ShoppingCartOutlined />}
                onClick={() => {
                  onClose();
                  navigate('/po');
                }}
              >
                Buka Dokumen PO ({receipt.poNumber})
              </Button>
            )}
          </div>
          <Button type="primary" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Memuat rincian dokumen BAST..." />
        </div>
      ) : error || !receipt ? (
        <Alert
          type="error"
          showIcon
          message="Gagal Memuat Detail BAST"
          description={(error as Error)?.message || 'Data Berita Acara Serah Terima tidak ditemukan.'}
          style={{ margin: '20px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 12 }}>
          {/* Defect Alert Notice */}
          {hasDefects && (
            <Alert
              type="warning"
              showIcon
              icon={<AlertOutlined />}
              message="Terdapat Barang Rusak / Cacat pada Penerimaan Ini"
              description="Dokumen Non-Conformance Report (NCR) telah diterbitkan otomatis oleh sistem untuk menindaklanjuti retur atau penggantian barang garansi dari pihak vendor."
            />
          )}

          {/* Section 1: Ringkasan Dokumen BAST */}
          <Descriptions
            bordered
            size="small"
            column={{ xxl: 3, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}
          >
            <Descriptions.Item label="Nomor BAST">
              <Text strong style={{ color: token.colorPrimary }}>{receipt.grNumber}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Nomor PO Terkait">
              <Text strong style={{ color: token.colorPrimary }}>{receipt.poNumber || receipt.poId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Vendor Rekanan">
              <Text strong>{receipt.vendorName || '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Nomor Surat Jalan">
              <Tag color="blue">{receipt.deliveryNoteNumber || '-'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Tgl Penerimaan Fisik">
              <Text strong>{formatDate(receipt.receivedDate)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Petugas Penerima">
              <Text>{receipt.receivedByName || receipt.receivedBy || 'Staff Logistik'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Tipe Lokasi">
              {receipt.receiptType === 'WAREHOUSE' ? 'Gudang Utama' : 'Langsung ke Pengaju'}
            </Descriptions.Item>
            <Descriptions.Item label="Waktu Dokumen Dibuat" span={2}>
              {formatDateTime(receipt.createdAt)}
            </Descriptions.Item>
          </Descriptions>

          {/* Section 2: Catatan Kondisi Fisik */}
          <div>
            <Text strong style={{ fontSize: 14 }}>Catatan Pemeriksaan Fisik:</Text>
            <div
              style={{
                backgroundColor: token.colorFillAlter,
                padding: '10px 14px',
                borderRadius: token.borderRadiusSM,
                marginTop: 6,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {receipt.notes || <Text type="secondary">Tidak ada catatan kondisi khusus.</Text>}
              </Paragraph>
            </div>
          </div>

          {/* Section 3: Tabel Rincian Item Fisik yang Diterima */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 14 }}>
                Rincian Barang / Jasa yang Diterima ({receipt.items?.length || 0} Item):
              </Text>
            </div>
            <Table
              columns={itemColumns}
              dataSource={receipt.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              bordered
              summary={(pageData) => {
                const totalGood = pageData.reduce((acc, item) => acc + (Number(item.quantityReceived) || 0), 0);
                const totalRejected = pageData.reduce((acc, item) => acc + (Number(item.quantityRejected) || 0), 0);
                return (
                  <Table.Summary.Row style={{ backgroundColor: token.colorFillAlter }}>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <Text strong>Total Akumulasi Fisik:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: token.colorSuccess }}>
                        {totalGood.toLocaleString('id-ID')} Unit Diterima Baik
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ color: totalRejected > 0 ? token.colorError : undefined }}>
                        {totalRejected.toLocaleString('id-ID')} Unit Ditolak
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} />
                  </Table.Summary.Row>
                );
              }}
            />
          </div>

          {/* Section 4: Laporan NCR Terkait (jika ada barang cacat) */}
          {receipt.ncrRecords && receipt.ncrRecords.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 14, color: token.colorError, marginBottom: 8, display: 'block' }}>
                Laporan Ketidaksesuaian Barang (Non-Conformance Reports - NCR R30):
              </Text>
              <Table
                columns={ncrColumns}
                dataSource={receipt.ncrRecords}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default BastDetailModal;
