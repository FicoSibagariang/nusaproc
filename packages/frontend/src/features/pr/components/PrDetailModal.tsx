import React, { useState } from 'react';
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
  Input,
  Tooltip,
  theme,
  App,
  Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileTextOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ShoppingCartOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  prApi,
  type PrDetailData,
  type PrItemDetail,
  type PrApprovalInstance,
} from '../../../api/endpoints/pr';
import { StatusTag } from '../../../components/common/StatusTag';
import { formatRupiah } from '../../../utils/currency';
import { formatDate, formatDateTime } from '../../../utils/date';
import { useAuthStore } from '../../../stores/useAuthStore';

const { Text, Title, Paragraph } = Typography;

export interface PrDetailModalProps {
  open: boolean;
  prId: string | null;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const PrDetailModal: React.FC<PrDetailModalProps> = ({
  open,
  prId,
  onClose,
  onStatusUpdated,
}) => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: resData, isLoading, error } = useQuery({
    queryKey: ['purchase-request-detail', prId],
    queryFn: () => prApi.getById(prId!),
    enabled: Boolean(open && prId),
  });

  const pr: PrDetailData | undefined = resData?.data;

  // Submit PR mutation
  const submitMutation = useMutation({
    mutationFn: (id: string) => prApi.submit(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Request berhasil diajukan untuk persetujuan (R9).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-request-detail', prId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      onStatusUpdated?.();
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal mengajukan PR', description: err.message });
    },
  });

  // Decide PR mutation (Approve/Reject)
  const decideMutation = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
    }) =>
      prApi.decide(id, {
        decision,
        rejectionReason: reason,
        approverMaxLimit: user?.activeRole === 'ADMIN' ? 999_999_999_999 : 100_000_000,
        approverDivisionId: user?.activeRole === 'ADMIN' ? undefined : user?.divisionId,
      }),
    onSuccess: (_, variables) => {
      notification.success({
        message: variables.decision === 'APPROVED' ? 'PR Disetujui (R13).' : 'PR Ditolak.',
      });
      setRejectMode(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['purchase-request-detail', prId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      onStatusUpdated?.();
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.detail || err?.message || 'Gagal memproses persetujuan PR';
      notification.error({ message: 'Persetujuan PR Ditolak Sistem', description: errMsg });
    },
  });

  const handleModalClose = () => {
    setRejectMode(false);
    setRejectionReason('');
    onClose();
  };

  const isSelfRequester = Boolean(pr?.requesterId && user?.id && pr.requesterId === user.id);

  // Table Columns for PR Items
  const itemColumns: ColumnsType<PrItemDetail> = [
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
      title: 'Spesifikasi Teknis',
      dataIndex: 'specification',
      key: 'specification',
      render: (spec?: string | null) => spec || <Text type="secondary">-</Text>,
    },
    {
      title: 'Diminta',
      dataIndex: 'quantityRequested',
      key: 'quantityRequested',
      width: 90,
      align: 'right',
      render: (qty: number) => qty.toLocaleString('id-ID'),
    },
    {
      title: 'Dipesan',
      dataIndex: 'quantityOrdered',
      key: 'quantityOrdered',
      width: 90,
      align: 'right',
      render: (ordered: number) => (ordered || 0).toLocaleString('id-ID'),
    },
    {
      title: 'Sisa',
      key: 'remaining',
      width: 80,
      align: 'right',
      render: (_, record) => {
        const remaining = Math.max(0, record.quantityRequested - (record.quantityOrdered || 0));
        return (
          <Text strong style={{ color: remaining > 0 ? token.colorSuccess : token.colorTextSecondary }}>
            {remaining.toLocaleString('id-ID')}
          </Text>
        );
      },
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
      title: 'Est. Harga Satuan',
      dataIndex: 'estimatedUnitPrice',
      key: 'estimatedUnitPrice',
      width: 140,
      align: 'right',
      render: (price: number) => formatRupiah(price),
    },
    {
      title: 'Subtotal Estimasi',
      key: 'subtotal',
      width: 150,
      align: 'right',
      render: (_, record) => {
        const total = record.subtotal || record.quantityRequested * record.estimatedUnitPrice;
        return <Text strong>{formatRupiah(total)}</Text>;
      },
    },
  ];

  // Table Columns for Approval Instances
  const approvalColumns: ColumnsType<PrApprovalInstance> = [
    {
      title: 'Tahap',
      dataIndex: 'stepOrder',
      key: 'stepOrder',
      width: 70,
      align: 'center',
      render: (val: number) => `Tahap ${val}`,
    },
    {
      title: 'Role Approver',
      dataIndex: 'assignedRole',
      key: 'assignedRole',
      render: (role: string) => <Tag color="geekblue">{role}</Tag>,
    },
    {
      title: 'Keputusan',
      dataIndex: 'decision',
      key: 'decision',
      render: (decision: string) => {
        if (decision === 'APPROVED') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>DISETUJUI</Tag>;
        }
        if (decision === 'REJECTED') {
          return <Tag color="error" icon={<CloseCircleOutlined />}>DITOLAK</Tag>;
        }
        return <Tag color="processing" icon={<ClockCircleOutlined />}>MENUNGGU</Tag>;
      },
    },
    {
      title: 'Diputuskan Oleh',
      dataIndex: 'decisionBy',
      key: 'decisionBy',
      render: (by?: string | null) => by || <Text type="secondary">-</Text>,
    },
    {
      title: 'Waktu Keputusan',
      dataIndex: 'decisionAt',
      key: 'decisionAt',
      render: (time?: string | null) => (time ? formatDateTime(time) : <Text type="secondary">-</Text>),
    },
    {
      title: 'Catatan / Alasan Penolakan',
      dataIndex: 'rejectionReason',
      key: 'rejectionReason',
      render: (reason?: string | null) =>
        reason ? (
          <Text type="danger" style={{ fontWeight: 500 }}>
            {reason}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={handleModalClose}
      width={1000}
      title={
        <Space align="center" size="middle">
          <FileTextOutlined style={{ color: token.colorPrimary, fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>
            Detail Purchase Request: {pr?.prNumber || 'Memuat...'}
          </Title>
          {pr && <StatusTag status={pr.status} category="pr" />}
          {pr?.isEmergency && (
            <Tag color="error" icon={<AlertOutlined />}>
              DARURAT (EMERGENCY)
            </Tag>
          )}
        </Space>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {pr?.status === 'SUBMITTED' && isSelfRequester && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                ℹ️ Segregation of Duties (R15): Anda pembuat PR ini, persetujuan dilakukan approver lain.
              </Text>
            )}
          </div>
          <Space>
            {/* Action buttons depending on PR status */}
            {pr?.status === 'DRAFT' && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate(pr.id)}
              >
                Ajukan PR
              </Button>
            )}

            {pr?.status === 'SUBMITTED' && !rejectMode && (
              <>
                {isSelfRequester ? (
                  <Tooltip title="Pelanggaran SoD (R15): Anda adalah pembuat PR ini. Persetujuan harus dilakukan oleh akun Approver lain.">
                    <Button type="primary" disabled icon={<CheckCircleOutlined />}>
                      Setujui
                    </Button>
                  </Tooltip>
                ) : (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={decideMutation.isPending}
                    onClick={() => decideMutation.mutate({ id: pr.id, decision: 'APPROVED' })}
                  >
                    Setujui
                  </Button>
                )}
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setRejectMode(true)}
                >
                  Tolak
                </Button>
              </>
            )}

            {pr?.status === 'APPROVED' && (
              pr.remainingQuantity !== undefined && pr.remainingQuantity <= 0 ? (
                <Tag color="cyan" style={{ fontSize: 13, padding: '4px 10px' }}>
                  Selesai (PO Terpenuhi)
                </Tag>
              ) : (
                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  onClick={() => {
                    handleModalClose();
                    navigate(`/po/create?prId=${pr.id}`);
                  }}
                >
                  {pr.relatedPos && pr.relatedPos.length > 0 ? 'Terbitkan Sisa PO' : 'Terbitkan PO'}
                </Button>
              )
            )}

            <Button onClick={handleModalClose}>Tutup</Button>
          </Space>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Memuat rincian dokumen Purchase Request..." />
        </div>
      ) : error || !pr ? (
        <Alert
          type="error"
          showIcon
          message="Gagal Memuat Detail PR"
          description={(error as Error)?.message || 'Data Purchase Request tidak ditemukan.'}
          style={{ margin: '20px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 12 }}>
          {/* Emergency Alert if applicable */}
          {pr.isEmergency && (
            <Alert
              type="error"
              showIcon
              icon={<AlertOutlined />}
              message="Pengadaan Darurat (Emergency Justification)"
              description={
                pr.emergencyJustification ||
                'Dokumen ini ditandai sebagai pengadaan darurat yang membutuhkan penanganan prioritas.'
              }
            />
          )}

          {/* Inline Rejection Panel */}
          {rejectMode && (
            <Card
              size="small"
              style={{
                borderColor: token.colorErrorBorder,
                backgroundColor: token.colorErrorBg,
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Text strong style={{ color: token.colorErrorText }}>
                  Konfirmasi Penolakan Purchase Request
                </Text>
                <Text type="secondary">
                  Mohon masukkan alasan penolakan secara terperinci untuk dicatat pada log audit dan diinformasikan ke pemohon:
                </Text>
                <Input.TextArea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Estimasi anggaran melebihi batas alokasi CAPEX triwulan ini."
                />
                <Space>
                  <Button
                    danger
                    type="primary"
                    disabled={!rejectionReason.trim()}
                    loading={decideMutation.isPending}
                    onClick={() =>
                      decideMutation.mutate({
                        id: pr.id,
                        decision: 'REJECTED',
                        reason: rejectionReason.trim(),
                      })
                    }
                  >
                    Konfirmasi Tolak PR
                  </Button>
                  <Button onClick={() => setRejectMode(false)}>Batal</Button>
                </Space>
              </Space>
            </Card>
          )}

          {/* Section 1: Ringkasan Informasi Pengajuan */}
          <Descriptions
            bordered
            size="small"
            column={{ xxl: 3, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}
          >
            <Descriptions.Item label="Nomor PR">
              <Text strong style={{ color: token.colorPrimary }}>{pr.prNumber}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Pemohon">
              <Space direction="vertical" size={0}>
                <Text strong>{pr.requesterName || pr.requesterEmail || 'Requester'}</Text>
                {pr.requesterEmail && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {pr.requesterEmail}
                  </Text>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Divisi / Unit Kerja">
              <Text strong>{pr.divisionName || pr.divisionId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Cost Center">
              <Text code>{pr.costCenter || '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Cabang (Branch)">
              <Text>{pr.branchName || pr.branchId || '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Termin Pembayaran">
              <Tag color={pr.paymentTermType === 'PAY_AFTER_RECEIPT' ? 'blue' : 'orange'}>
                {pr.paymentTermType === 'PAY_AFTER_RECEIPT'
                  ? 'Pay After Receipt (Setelah BAST)'
                  : 'Advance / COD (Uang Muka)'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Tgl Pengajuan">
              {formatDateTime(pr.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Tgl Dibutuhkan">
              <Text strong>{formatDate(pr.requiredDate)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Total Estimasi Nilai">
              <Text strong style={{ fontSize: 16, color: token.colorPrimary }}>
                {formatRupiah(Number(pr.totalEstimatedAmount) || 0)}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          {/* Section 2: Justifikasi Bisnis */}
          <div>
            <Text strong style={{ fontSize: 14 }}>Justifikasi Bisnis (Alasan Kebutuhan Pengadaan):</Text>
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
                {pr.businessJustification || <Text type="secondary">Tidak ada catatan justifikasi bisnis.</Text>}
              </Paragraph>
            </div>
          </div>

          {/* Section 3: Rincian Barang / Jasa (Items) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 14 }}>
                Rincian Barang / Jasa yang Diminta ({pr.items?.length || 0} Item):
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Sisa kuantitas belum diterbitkan PO: {pr.remainingQuantity ?? '-'} unit
              </Text>
            </div>
            <Table
              columns={itemColumns}
              dataSource={pr.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              bordered
              summary={(pageData) => {
                const totalAmount = pageData.reduce(
                  (acc, item) => acc + (item.subtotal || item.quantityRequested * item.estimatedUnitPrice),
                  0
                );
                return (
                  <Table.Summary.Row style={{ backgroundColor: token.colorFillAlter }}>
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong>Total Estimasi Nilai Pengadaan:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: token.colorPrimary, fontSize: 14 }}>
                        {formatRupiah(totalAmount || pr.totalEstimatedAmount)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </div>

          {/* Section 4: PO Terkait (jika ada) */}
          {pr.relatedPos && pr.relatedPos.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
                Purchase Order (PO) Terkait:
              </Text>
              <Space wrap size="small">
                {pr.relatedPos.map((po) => {
                  const tagColor =
                    po.status === 'ISSUED'
                      ? 'success'
                      : po.status === 'APPROVED'
                      ? 'processing'
                      : po.status === 'COMPLETED'
                      ? 'cyan'
                      : 'default';
                  return (
                    <Card key={po.id} size="small" style={{ width: 280 }}>
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong>{po.poNumber}</Text>
                          <Tag color={tagColor}>{po.status}</Tag>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Vendor: {po.vendorName || '-'}
                        </Text>
                        {po.grandTotalAmount !== undefined && (
                          <Text style={{ fontSize: 12 }}>
                            Nilai: {formatRupiah(po.grandTotalAmount)}
                          </Text>
                        )}
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto', marginTop: 4 }}
                          onClick={() => {
                            handleModalClose();
                            navigate(`/po?poId=${po.id}`);
                          }}
                        >
                          Buka Dokumen PO ({po.poNumber}) →
                        </Button>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            </div>
          )}

          {/* Section 5: Riwayat Persetujuan / Approval Trail */}
          {pr.approvalInstances && pr.approvalInstances.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
                Riwayat & Alur Persetujuan (Approval Trail):
              </Text>
              <Table
                columns={approvalColumns}
                dataSource={pr.approvalInstances}
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

export default PrDetailModal;
