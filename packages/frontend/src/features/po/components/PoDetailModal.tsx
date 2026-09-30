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
  Divider,
  Tooltip,
  theme,
  App,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileTextOutlined,
  FilePdfOutlined,
  CheckOutlined,
  SendOutlined,
  InboxOutlined,
  BankOutlined,
  UserOutlined,
  CalendarOutlined,
  HistoryOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  poApi,
  type PoDetailData,
  type PoItemDetail,
  type PoAmendmentDetail,
} from '../../../api/endpoints/po';
import { StatusTag } from '../../../components/common/StatusTag';
import { formatRupiah } from '../../../utils/currency';
import { formatDate, formatDateTime } from '../../../utils/date';
import { useAuthStore } from '../../../stores/useAuthStore';

const { Text, Title } = Typography;

export interface PoDetailModalProps {
  open: boolean;
  poId: string | null;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const PoDetailModal: React.FC<PoDetailModalProps> = ({
  open,
  poId,
  onClose,
  onStatusUpdated,
}) => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: resData, isLoading, error } = useQuery({
    queryKey: ['purchase-order-detail', poId],
    queryFn: () => poApi.getById(poId!),
    enabled: Boolean(open && poId),
  });

  const po: PoDetailData | undefined = resData?.data;

  // Approve PO mutation (R25)
  const approveMutation = useMutation({
    mutationFn: (id: string) => poApi.approve(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Order berhasil disetujui (R25).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onStatusUpdated?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal menyetujui PO';
      notification.error({ message: 'Persetujuan PO Ditolak Sistem', description: msg });
    },
  });

  // Issue PO mutation (R24)
  const issueMutation = useMutation({
    mutationFn: (id: string) => poApi.issue(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Order berhasil diterbitkan resmi (R24).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onStatusUpdated?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal menerbitkan PO';
      notification.error({ message: 'Penerbitan PO Gagal', description: msg });
    },
  });

  const handleDownloadPdf = async () => {
    if (!po) return;
    try {
      const blob = await poApi.downloadPdf(po.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${po.poNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notification.success({ message: `Dokumen PDF PO ${po.poNumber} berhasil diunduh.` });
    } catch (err: unknown) {
      notification.error({ message: 'Gagal mengunduh PDF', description: (err as Error).message });
    }
  };

  const isSelfCreator = Boolean(po?.createdBy && user?.id && po.createdBy === user.id);

  // Table Columns for PO Items
  const itemColumns: ColumnsType<PoItemDetail> = [
    {
      title: 'No',
      dataIndex: 'lineNumber',
      key: 'lineNumber',
      width: 50,
      align: 'center',
      render: (val: number, _, index: number) => val || index + 1,
    },
    {
      title: 'Nama Barang / Jasa',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Satuan',
      dataIndex: 'uom',
      key: 'uom',
      width: 80,
      align: 'center',
      render: (uom: string) => <Tag color="blue">{uom}</Tag>,
    },
    {
      title: 'Qty Dipesan',
      dataIndex: 'quantityOrdered',
      key: 'quantityOrdered',
      width: 100,
      align: 'right',
      render: (qty: number) => (qty || 0).toLocaleString('id-ID'),
    },
    {
      title: 'Qty Diterima (BAST)',
      dataIndex: 'quantityReceived',
      key: 'quantityReceived',
      width: 130,
      align: 'right',
      render: (received: number = 0, record) => {
        const ordered = record.quantityOrdered || 0;
        const color = received >= ordered && ordered > 0 ? token.colorSuccess : received > 0 ? token.colorWarning : token.colorTextSecondary;
        return (
          <Space size={4}>
            <Text strong style={{ color }}>
              {received.toLocaleString('id-ID')}
            </Text>
            {received >= ordered && ordered > 0 && <Tag color="success" style={{ margin: 0, fontSize: 10 }}>Lengkap</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Qty Ditagihkan',
      dataIndex: 'quantityInvoiced',
      key: 'quantityInvoiced',
      width: 120,
      align: 'right',
      render: (invoiced: number = 0) => (
        <Text type={invoiced > 0 ? undefined : 'secondary'}>
          {invoiced.toLocaleString('id-ID')}
        </Text>
      ),
    },
    {
      title: 'Harga Satuan',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 140,
      align: 'right',
      render: (price: number) => formatRupiah(price),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 150,
      align: 'right',
      render: (val: number, record) => {
        const total = val || (record.quantityOrdered || 0) * (record.unitPrice || 0);
        return <Text strong>{formatRupiah(total)}</Text>;
      },
    },
  ];

  // Table Columns for Amendments
  const amendmentColumns: ColumnsType<PoAmendmentDetail> = [
    {
      title: 'Versi Amendemen',
      dataIndex: 'amendmentNumber',
      key: 'amendmentNumber',
      width: 130,
      align: 'center',
      render: (num: number) => <Tag color="purple">Amendemen Ke-{num}</Tag>,
    },
    {
      title: 'Waktu Pengubahan',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: 'Diajukan / Diotorisasi Oleh',
      key: 'authorized',
      width: 180,
      render: (_, r) => r.approvedBy || r.requestedBy || '-',
    },
    {
      title: 'Ringkasan / Alasan Perubahan',
      dataIndex: 'changeSummary',
      key: 'changeSummary',
      render: (text: string) => <Text>{text}</Text>,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1000}
      title={
        <Space align="center" size="middle">
          <FileTextOutlined style={{ color: token.colorPrimary, fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>
            Detail Purchase Order: {po?.poNumber || 'Memuat...'}
          </Title>
          {po && <StatusTag status={po.status} category="po" />}
          {po?.versionNumber && po.versionNumber > 1 && (
            <Tag color="geekblue">Versi {po.versionNumber}</Tag>
          )}
        </Space>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {po?.status === 'DRAFT' && !po?.approvedBy && isSelfCreator && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                ℹ️ Segregation of Duties (R25): Anda pembuat PO ini, persetujuan harus dilakukan akun Approver lain.
              </Text>
            )}
          </div>
          <Space>
            {/* Download PDF button (R27) */}
            {po && (
              <Button
                icon={<FilePdfOutlined />}
                style={{ color: token.colorError, borderColor: token.colorError }}
                onClick={handleDownloadPdf}
              >
                Unduh PDF (R27)
              </Button>
            )}

            {/* Action buttons depending on PO status */}
            {po?.status === 'DRAFT' && !po?.approvedBy && (
              isSelfCreator ? (
                <Tooltip title="Pelanggaran SoD (R25): Anda adalah pembuat PO ini. Persetujuan harus dilakukan oleh akun Approver lain.">
                  <Button type="primary" disabled icon={<CheckOutlined />}>
                    Setujui (R25)
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(po.id)}
                >
                  Setujui (R25)
                </Button>
              )
            )}

            {((po?.status === 'DRAFT' && po?.approvedBy) || po?.status === 'APPROVED') && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                loading={issueMutation.isPending}
                onClick={() => issueMutation.mutate(po.id)}
              >
                Terbitkan (R24)
              </Button>
            )}

            {(po?.status === 'ISSUED' || po?.status === 'AMENDED') && (
              <Button
                type="primary"
                icon={<InboxOutlined />}
                onClick={() => {
                  onClose();
                  navigate(`/receipts/create?poId=${po.id}`);
                }}
              >
                Terima Barang (BAST)
              </Button>
            )}

            <Button onClick={onClose}>Tutup</Button>
          </Space>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Memuat rincian dokumen Purchase Order..." />
        </div>
      ) : error || !po ? (
        <Alert
          type="error"
          showIcon
          message="Gagal Memuat Detail PO"
          description={(error as Error)?.message || 'Data Purchase Order tidak ditemukan.'}
          style={{ margin: '20px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 12 }}>
          {/* Section 1: Financial & Valuation Summary */}
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: token.colorFillAlter, borderColor: token.colorBorderSecondary }}>
                <Statistic
                  title={<Text type="secondary">Subtotal Nilai DPP</Text>}
                  value={formatRupiah(po.subtotalAmount || 0)}
                  valueStyle={{ fontSize: 18, fontWeight: 600, color: token.colorTextHeading }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: token.colorFillAlter, borderColor: token.colorBorderSecondary }}>
                <Statistic
                  title={<Text type="secondary">Pajak (PPN Terhitung)</Text>}
                  value={formatRupiah(po.taxAmount || 0)}
                  valueStyle={{ fontSize: 18, fontWeight: 600, color: token.colorPrimary }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: token.colorFillAlter, borderColor: token.colorPrimaryBorder }}>
                <Statistic
                  title={<Text strong style={{ color: token.colorPrimary }}>Grand Total Pemesanan</Text>}
                  value={formatRupiah(po.grandTotalAmount || 0)}
                  valueStyle={{ fontSize: 20, fontWeight: 700, color: token.colorSuccess }}
                />
              </Card>
            </Col>
          </Row>

          {/* Section 2: Header Descriptions */}
          <Descriptions
            bordered
            size="small"
            column={{ xxl: 3, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}
          >
            <Descriptions.Item label="Nomor PO">
              <Text strong style={{ color: token.colorPrimary }}>{po.poNumber}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Vendor Terpilih">
              <Text strong>{po.vendorName || 'PT Fiber Optik Nusantara'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Termin Pembayaran">
              <Tag color={po.paymentTermType === 'PAY_AFTER_RECEIPT' ? 'blue' : 'orange'}>
                {po.paymentTermType === 'PAY_AFTER_RECEIPT' ? 'Pay After Receipt' : 'Advance / COD'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Rekening Bank Vendor (4-Eyes Check)">
              <Space>
                <BankOutlined style={{ color: token.colorSuccess }} />
                <span>
                  {po.bankName && po.accountNumber
                    ? `${po.bankName} - ${po.accountNumber} (${po.accountHolderName || 'Verified'})`
                    : 'BCA ••••••••890 (Active)'}
                </span>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Pembuat PO">
              <Space>
                <UserOutlined />
                <Text strong>{po.requesterName || po.createdBy || 'Admin'}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Tgl Pembuatan">
              <Space>
                <CalendarOutlined />
                <span>{formatDate(po.createdAt)}</span>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Persetujuan (R25)">
              {po.approvedBy ? (
                <Space>
                  <Tag color="success">Disetujui</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    oleh {po.approvedBy} {po.approvedAt ? `(${formatDate(po.approvedAt)})` : ''}
                  </Text>
                </Space>
              ) : (
                <Tag color="warning">Menunggu Persetujuan</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Penerbitan Resmi (R24)" span={2}>
              {po.issuedAt ? (
                <Space>
                  <Tag color="cyan">Diterbitkan Resmi</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDateTime(po.issuedAt)}
                  </Text>
                </Space>
              ) : (
                <Text type="secondary">Belum diterbitkan</Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          {/* Section 3: Rincian Item PO */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Space align="center">
                <Title level={5} style={{ margin: 0 }}>
                  Rincian Barang / Jasa Dipesan
                </Title>
                <Tag color="blue">{po.items?.length || 0} Item</Tag>
              </Space>
            </div>
            <Table
              dataSource={po.items || []}
              columns={itemColumns}
              rowKey="id"
              pagination={false}
              size="small"
              bordered
              scroll={{ x: 700 }}
            />
          </div>

          {/* Section 4: Syarat & Ketentuan Pengadaan */}
          {po.termsAndConditions && (
            <Card
              size="small"
              title={
                <Space>
                  <AuditOutlined style={{ color: token.colorPrimary }} />
                  <span>Syarat & Ketentuan Pesanan (Terms & Conditions)</span>
                </Space>
              }
              style={{ background: token.colorFillAlter }}
            >
              <Text style={{ whiteSpace: 'pre-line' }}>{po.termsAndConditions}</Text>
            </Card>
          )}

          {/* Section 5: Riwayat Amendemen (jika ada) */}
          {po.amendments && po.amendments.length > 0 && (
            <div>
              <Divider orientation="left" style={{ margin: '12px 0' }}>
                <Space>
                  <HistoryOutlined style={{ color: token.colorWarning }} />
                  <span>Riwayat Amendemen PO (R26 Audit Trail)</span>
                </Space>
              </Divider>
              <Table
                dataSource={po.amendments}
                columns={amendmentColumns}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 600 }}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
