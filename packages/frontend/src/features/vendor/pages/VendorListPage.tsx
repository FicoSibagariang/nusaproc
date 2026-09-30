import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Card,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  App,
  theme,
  Alert,
  Popconfirm,
  Tooltip,
  Tabs,
  Breadcrumb,
  Popover,
  type TableProps,
} from 'antd';
import {
  ShopOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  BankOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vendorApi, type CreateVendorPayload, type CreateBankAccountPayload } from '../../../api/endpoints/vendor';
import { useAuthStore } from '../../../stores/useAuthStore';
import { maskNpwp, validateNpwp } from '../../../utils/tax';

const { Text, Title } = Typography;

export interface VendorDisplayItem {
  id: string;
  vendorCode: string;
  name: string;
  taxIdentificationNumber: string;
  isPkp: boolean;
  status: 'PROSPECTIVE' | 'APPROVED' | 'SUSPENDED' | 'BLACKLISTED';
  bankAccounts?: Array<{
    id: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolderName: string;
    status: 'PENDING_STAGE_1' | 'PENDING_STAGE_2' | 'ACTIVE' | 'REJECTED';
    approvedBy1?: string | null;
    approvedBy2?: string | null;
  }>;
}

const DEFAULT_VENDORS: VendorDisplayItem[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    vendorCode: 'VEND-FIBER-001',
    name: 'PT Fiber Optik Nusantara',
    taxIdentificationNumber: '01.234.567.8-012.000',
    isPkp: true,
    status: 'APPROVED',
    bankAccounts: [
      {
        id: '30000000-0000-0000-0000-000000000001',
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '••••••••890',
        accountHolderName: 'PT Fiber Optik Nusantara',
        status: 'ACTIVE',
        approvedBy1: 'AP Maker',
        approvedBy2: 'Head of AP',
      },
    ],
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    vendorCode: 'VEND-MITRA-002',
    name: 'PT Mitra Solusi Jaringan',
    taxIdentificationNumber: '02.345.678.9-013.000',
    isPkp: true,
    status: 'APPROVED',
    bankAccounts: [
      {
        id: '30000000-0000-0000-0000-000000000002',
        bankName: 'Mandiri',
        bankCode: '008',
        accountNumber: '••••••••040',
        accountHolderName: 'PT Mitra Solusi Jaringan',
        status: 'ACTIVE',
        approvedBy1: 'AP Maker',
        approvedBy2: 'Head of AP',
      },
    ],
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    vendorCode: 'VEND-MTWS1PBX-5663',
    name: 'KOPNUTERA',
    taxIdentificationNumber: '017907312123000',
    isPkp: false,
    status: 'PROSPECTIVE',
    bankAccounts: [
      {
        id: '30000000-0000-0000-0000-000000000003',
        bankName: 'Mandiri',
        bankCode: '008',
        accountNumber: '••••••••4321',
        accountHolderName: 'Koperasi KOPNUTERA',
        status: 'PENDING_STAGE_1',
      },
      {
        id: '30000000-0000-0000-0000-000000000004',
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '••••••••7890',
        accountHolderName: 'Koperasi KOPNUTERA',
        status: 'PENDING_STAGE_1',
      },
    ],
  },
];

export const VendorListPage: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pkpFilter, setPkpFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [revealedBankIds, setRevealedBankIds] = useState<Set<string>>(new Set());

  // Modals
  const [isCreateVendorOpen, setIsCreateVendorOpen] = useState(false);
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [isVerifyBankOpen, setIsVerifyBankOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorDisplayItem | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const [createVendorForm] = Form.useForm<CreateVendorPayload>();
  const [addBankForm] = Form.useForm<CreateBankAccountPayload>();
  const [verifyBankForm] = Form.useForm<{ action: 'VERIFY_STAGE_1' | 'VERIFY_STAGE_2' | 'REJECT'; rejectionReason?: string }>();
  const [statusForm] = Form.useForm<{ status: 'PROSPECTIVE' | 'APPROVED' | 'SUSPENDED' | 'BLACKLISTED'; reason?: string }>();
  const watchedAction = Form.useWatch('action', verifyBankForm);

  const { data: serverVendorsRes } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.list(),
  });

  const [vendors, setVendors] = useState<VendorDisplayItem[]>(DEFAULT_VENDORS);

  useEffect(() => {
    if (serverVendorsRes?.data && Array.isArray(serverVendorsRes.data) && serverVendorsRes.data.length > 0) {
      setVendors(
        serverVendorsRes.data.map((v: any) => ({
          id: v.id,
          vendorCode: v.vendorCode,
          name: v.name,
          taxIdentificationNumber: v.taxIdentificationNumber,
          isPkp: v.isPkp,
          status: v.status,
          bankAccounts: (v.bankAccounts || []).map((b: any) => ({
            id: b.id,
            bankName: b.bankName,
            bankCode: b.bankCode,
            accountNumber: b.accountNumberMasked || b.accountNumber,
            accountHolderName: b.accountHolderName,
            status:
              b.status === 'VERIFIED'
                ? 'ACTIVE'
                : b.status === 'INACTIVE'
                ? 'REJECTED'
                : b.verifiedBy1
                ? 'PENDING_STAGE_2'
                : 'PENDING_STAGE_1',
            approvedBy1: b.verifiedBy1Name || b.verifiedBy1 || (b.verifiedBy1 ? 'AP Maker' : null),
            approvedBy2: b.verifiedBy2Name || b.verifiedBy2 || (b.verifiedBy2 ? 'Head of AP' : null),
          })),
        }))
      );
    }
  }, [serverVendorsRes]);

  const selectedBankAccount = selectedVendor?.bankAccounts?.find((b) => b.id === selectedBankId);
  const currentBankStatus = selectedBankAccount?.status;
  const verifier1 = selectedBankAccount?.approvedBy1;

  // 4-Eyes Principle check (R18): Stage 2 verifier must NOT be the same user who performed Stage 1
  const isSameVerifierAsStage1 = Boolean(
    currentBankStatus === 'PENDING_STAGE_2' &&
      user &&
      verifier1 &&
      (
        (user.fullName && user.fullName.trim().toLowerCase() === verifier1.trim().toLowerCase()) ||
        (user.id && user.id === verifier1) ||
        (user.email && user.email.trim().toLowerCase() === verifier1.trim().toLowerCase())
      )
  );

  const handleToggleReveal = (bankId: string) => {
    setRevealedBankIds((prev) => {
      const next = new Set(prev);
      if (next.has(bankId)) {
        next.delete(bankId);
      } else {
        next.add(bankId);
        message.info('Nomor rekening ditampilkan. Akses ini dicatat di Audit Trail.');
      }
      return next;
    });
  };

  const handleCopyNpwp = (npwp: string) => {
    navigator.clipboard?.writeText(npwp);
    message.success('Nomor NPWP berhasil disalin ke clipboard.');
  };

  const createVendorMutation = useMutation({
    mutationFn: (payload: CreateVendorPayload) => vendorApi.create(payload),
    onSuccess: (res, variables) => {
      message.success('Master Vendor baru berhasil didaftarkan.');
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setVendors((prev) => [
        {
          id: res?.data?.id || crypto.randomUUID(),
          vendorCode: variables.vendorCode || `VEND-${Date.now().toString().slice(-4)}`,
          name: variables.name,
          taxIdentificationNumber: variables.taxIdentificationNumber,
          isPkp: !!variables.isPkp,
          status: 'APPROVED',
          bankAccounts: [],
        },
        ...prev,
      ]);
      setIsCreateVendorOpen(false);
      createVendorForm.resetFields();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mendaftarkan vendor');
    },
  });

  const addBankMutation = useMutation({
    mutationFn: ({ vendorId, payload }: { vendorId: string; payload: CreateBankAccountPayload }) =>
      vendorApi.createBankAccount(vendorId, payload),
    onSuccess: (res, { vendorId, payload }) => {
      message.success('Rekening bank vendor berhasil ditambahkan dan masuk antrean verifikasi Stage 1.');
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setVendors((prev) =>
        prev.map((v) => {
          if (v.id === vendorId) {
            const accounts = v.bankAccounts || [];
            return {
              ...v,
              bankAccounts: [
                ...accounts,
                {
                  id: res?.data?.id || crypto.randomUUID(),
                  bankName: payload.bankName,
                  bankCode: payload.bankCode || '000',
                  accountNumber: `••••••••${payload.accountNumber.slice(-4)}`,
                  accountHolderName: payload.accountHolderName,
                  status: 'PENDING_STAGE_1',
                },
              ],
            };
          }
          return v;
        })
      );
      setIsAddBankOpen(false);
      addBankForm.resetFields();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal menambahkan rekening');
    },
  });

  const verifyBankMutation = useMutation({
    mutationFn: ({
      vendorId,
      bankId,
      payload,
    }: {
      vendorId: string;
      bankId: string;
      payload: { action: 'VERIFY_STAGE_1' | 'VERIFY_STAGE_2' | 'REJECT'; rejectionReason?: string };
    }) => vendorApi.verifyBankAccount(vendorId, bankId, payload),
    onSuccess: (_, { vendorId, bankId, payload }) => {
      message.success(`Verifikasi rekening 4-Eyes (${payload.action}) berhasil dicatat.`);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setVendors((prev) =>
        prev.map((v) => {
          if (v.id === vendorId) {
            return {
              ...v,
              bankAccounts: (v.bankAccounts || []).map((b) => {
                if (b.id === bankId) {
                  const nextStatus =
                    payload.action === 'VERIFY_STAGE_1'
                      ? 'PENDING_STAGE_2'
                      : payload.action === 'VERIFY_STAGE_2'
                      ? 'ACTIVE'
                      : 'REJECTED';
                  return {
                    ...b,
                    status: nextStatus as any,
                    approvedBy1: payload.action === 'VERIFY_STAGE_1' ? user?.fullName || 'Verifier 1' : b.approvedBy1,
                    approvedBy2: payload.action === 'VERIFY_STAGE_2' ? user?.fullName || 'Verifier 2' : b.approvedBy2,
                  };
                }
                return b;
              }),
            };
          }
          return v;
        })
      );
      setIsVerifyBankOpen(false);
      verifyBankForm.resetFields();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memverifikasi rekening');
    },
  });

  const updateVendorStatusMutation = useMutation({
    mutationFn: ({
      vendorId,
      status,
      reason,
    }: {
      vendorId: string;
      status: 'PROSPECTIVE' | 'APPROVED' | 'SUSPENDED' | 'BLACKLISTED';
      reason?: string;
    }) => vendorApi.updateStatus(vendorId, { status, reason }),
    onSuccess: (_, { vendorId, status }) => {
      message.success(`Status vendor berhasil diubah menjadi ${status}.`);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, status } : v))
      );
      setIsStatusModalOpen(false);
      statusForm.resetFields();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memperbarui status vendor');
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (vendorId: string) => vendorApi.delete(vendorId),
    onSuccess: (_, vendorId) => {
      message.success('Vendor berhasil dihapus.');
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal menghapus vendor');
    },
  });

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      // Tab filter
      if (activeTab === 'APPROVED' && v.status !== 'APPROVED') return false;
      if (activeTab === 'PROSPECTIVE' && v.status !== 'PROSPECTIVE') return false;
      if (activeTab === 'SUSPENDED' && v.status !== 'SUSPENDED') return false;
      if (activeTab === 'BLACKLISTED' && v.status !== 'BLACKLISTED') return false;

      // Status dropdown filter
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;

      // PKP filter
      if (pkpFilter === 'PKP' && !v.isPkp) return false;
      if (pkpFilter === 'NON_PKP' && v.isPkp) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        if (
          !v.name.toLowerCase().includes(term) &&
          !v.vendorCode.toLowerCase().includes(term) &&
          !v.taxIdentificationNumber.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [vendors, activeTab, statusFilter, pkpFilter, searchTerm]);

  const approvedCount = vendors.filter((v) => v.status === 'APPROVED').length;
  const prospectiveCount = vendors.filter((v) => v.status === 'PROSPECTIVE').length;

  const statusTabItems = [
    {
      key: 'ALL',
      label: (
        <Space size={6}>
          <span>Semua</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'ALL' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'ALL' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {vendors.length}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'APPROVED',
      label: (
        <Space size={6}>
          <span>Disetujui</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'APPROVED' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'APPROVED' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {approvedCount}
          </Tag>
        </Space>
      ),
    },
    {
      key: 'PROSPECTIVE',
      label: (
        <Space size={6}>
          <span>Prospek</span>
          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 11, padding: '0 6px', background: activeTab === 'PROSPECTIVE' ? '#e6f4ff' : '#f5f5f5', color: activeTab === 'PROSPECTIVE' ? '#0958d9' : '#8c8c8c', border: 'none' }}>
            {prospectiveCount}
          </Tag>
        </Space>
      ),
    },
  ];

  // Bank popover content (Figma 04b)
  const renderBankPopoverContent = (record: VendorDisplayItem) => {
    const accounts = record.bankAccounts || [];
    return (
      <div style={{ width: 330, padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <Text strong style={{ fontSize: 14, color: '#1f1f1f', display: 'block' }}>
              Rekening bank
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.name} · {accounts.length} rekening
            </Text>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
          {accounts.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12, padding: '8px 0' }}>
              Belum ada rekening bank yang didaftarkan.
            </Text>
          ) : (
            accounts.map((b) => (
              <div
                key={b.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: '#fafafa',
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text strong style={{ fontSize: 13 }}>{b.bankName}</Text>
                  <Tag
                    color={b.status === 'ACTIVE' ? 'success' : b.status === 'REJECTED' ? 'error' : 'warning'}
                    style={{ fontSize: 11, borderRadius: 4, margin: 0 }}
                  >
                    {b.status === 'ACTIVE'
                      ? 'Terverifikasi'
                      : b.status === 'PENDING_STAGE_1'
                      ? 'Menunggu verifikasi 1'
                      : b.status === 'PENDING_STAGE_2'
                      ? 'Menunggu verifikasi 2'
                      : 'Ditolak'}
                  </Tag>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {revealedBankIds.has(b.id) ? b.accountNumber : `•••• •••• ${b.accountNumber.slice(-4)}`}
                  </Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    style={{ padding: 0, height: 'auto', fontSize: 11 }}
                    onClick={() => handleToggleReveal(b.id)}
                  >
                    {revealedBankIds.has(b.id) ? 'Sembunyikan' : 'Tampilkan'}
                  </Button>
                </div>

                {b.status.startsWith('PENDING') && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<SafetyCertificateOutlined />}
                    style={{ width: '100%', fontSize: 12, borderRadius: 6, background: '#1677ff' }}
                    onClick={() => {
                      setSelectedVendor(record);
                      setSelectedBankId(b.id);
                      verifyBankForm.setFieldsValue({
                        action: b.status === 'PENDING_STAGE_1' ? 'VERIFY_STAGE_1' : 'VERIFY_STAGE_2',
                        rejectionReason: '',
                      });
                      setIsVerifyBankOpen(true);
                    }}
                  >
                    Verifikasi 4-Eyes
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 12 }}>
            <SafetyCertificateOutlined style={{ color: '#8c8c8c', marginTop: 2, fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3 }}>
              Nomor lengkap hanya tampil setelah verifikasi ulang identitas dan setiap aksesnya tercatat di Audit Trail.
            </Text>
          </div>
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            style={{ borderRadius: 6 }}
            onClick={() => {
              setSelectedVendor(record);
              setIsAddBankOpen(true);
            }}
          >
            + Tambah rekening
          </Button>
        </div>
      </div>
    );
  };

  const columns: TableProps<VendorDisplayItem>['columns'] = [
    {
      title: 'Vendor',
      key: 'vendor',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', color: '#1f1f1f' }}>
            {r.name}
          </Text>
          <div style={{ marginTop: 3 }}>
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
              }}
            >
              <FileTextOutlined style={{ color: '#8c8c8c' }} />
              <span>{r.vendorCode}</span>
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'NPWP',
      dataIndex: 'taxIdentificationNumber',
      key: 'taxIdentificationNumber',
      render: (npwp: string) => (
        <Space size={6}>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {maskNpwp(npwp)}
          </Text>
          <Tooltip title="Salin NPWP">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />}
              onClick={() => handleCopyNpwp(npwp)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'PKP',
      dataIndex: 'isPkp',
      key: 'isPkp',
      width: 100,
      render: (isPkp: boolean) => (
        <Tag
          style={{
            borderRadius: 4,
            fontSize: 11,
            background: isPkp ? '#e6f4ff' : '#f5f5f5',
            border: isPkp ? '1px solid #91caff' : '1px solid #d9d9d9',
            color: isPkp ? '#0958d9' : '#8c8c8c',
          }}
        >
          {isPkp ? 'PKP' : 'Non-PKP'}
        </Tag>
      ),
    },
    {
      title: 'Status vendor',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (st: string) => {
        if (st === 'APPROVED') {
          return (
            <Tag color="success" style={{ borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleOutlined /> Disetujui
            </Tag>
          );
        }
        if (st === 'PROSPECTIVE') {
          return (
            <Tag style={{ borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined /> Prospek
            </Tag>
          );
        }
        if (st === 'SUSPENDED') {
          return <Tag color="warning" style={{ borderRadius: 4 }}>Ditangguhkan</Tag>;
        }
        return <Tag color="error" style={{ borderRadius: 4 }}>Daftar Hitam</Tag>;
      },
    },
    {
      title: 'Rekening bank',
      key: 'bankAccounts',
      render: (_, r) => {
        const accounts = r.bankAccounts || [];
        const hasPending = accounts.some((b) => b.status.startsWith('PENDING'));
        const activeCount = accounts.filter((b) => b.status === 'ACTIVE').length;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>
              {accounts.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>Belum ada rekening</Text>
              ) : hasPending ? (
                <Tag color="warning" style={{ borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, margin: 0 }}>
                  <ClockCircleOutlined /> Menunggu verifikasi
                </Tag>
              ) : (
                <Tag color="success" style={{ borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, margin: 0 }}>
                  <CheckCircleOutlined /> Terverifikasi
                </Tag>
              )}
              <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                {accounts.length} rekening{hasPending ? ` · ${activeCount} dari ${accounts.length} terverifikasi` : ''}
              </div>
            </div>

            <Popover
              content={renderBankPopoverContent(r)}
              trigger="click"
              placement="bottomRight"
            >
              <Tooltip title="Buka detail rekening bank & verifikasi 4-Eyes">
                <Button
                  type="text"
                  size="small"
                  icon={<InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 15 }} />}
                />
              </Tooltip>
            </Popover>
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Ubah Status Vendor (R65)">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedVendor(r);
                statusForm.setFieldsValue({
                  status: r.status,
                  reason: '',
                });
                setIsStatusModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Tambah Rekening Baru">
            <Button
              size="small"
              icon={<BankOutlined />}
              onClick={() => {
                setSelectedVendor(r);
                setIsAddBankOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Hapus Vendor?"
            description={
              <div style={{ maxWidth: 260 }}>
                Vendor hanya dapat dihapus jika <b>belum memiliki riwayat transaksi</b> (PO / Invoice). Lanjutkan?
              </div>
            }
            onConfirm={() => deleteVendorMutation.mutate(r.id)}
            okText="Ya, Hapus"
            cancelText="Batal"
            okButtonProps={{ danger: true, loading: deleteVendorMutation.isPending }}
          >
            <Tooltip title="Hapus Vendor">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section (Figma 04 Vendor & Rekening) */}
      <div>
        <Breadcrumb
          items={[{ title: 'Pengadaan' }, { title: 'Vendor & Rekening' }]}
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
              <BankOutlined style={{ color: '#1677ff', fontSize: 22 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
                Vendor & Rekening Bank
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Katalog vendor resmi, status PKP, dan verifikasi rekening ganda (4-Eyes Principle) untuk mencegah perubahan rekening yang tidak sah.
              </Text>
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateVendorOpen(true)}
          >
            Tambah Vendor Baru
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs (Figma 04) */}
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
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Semua status vendor' },
                { value: 'APPROVED', label: 'Disetujui' },
                { value: 'PROSPECTIVE', label: 'Prospek' },
                { value: 'SUSPENDED', label: 'Ditangguhkan' },
                { value: 'BLACKLISTED', label: 'Daftar Hitam' },
              ]}
            />
            <Select
              value={pkpFilter}
              onChange={setPkpFilter}
              style={{ width: 160 }}
              options={[
                { value: 'ALL', label: 'Semua status PKP' },
                { value: 'PKP', label: 'PKP' },
                { value: 'NON_PKP', label: 'Non-PKP' },
              ]}
            />
          </Space>

          <Input
            placeholder="Cari kode, nama vendor, atau NPWP..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredVendors}
          rowKey="id"
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total} vendor`,
          }}
        />
      </Card>

      {/* Modal: Tambah Vendor Baru */}
      <Modal
        title="Daftarkan Rekanan Vendor Baru"
        open={isCreateVendorOpen}
        onCancel={() => {
          setIsCreateVendorOpen(false);
          createVendorForm.resetFields();
        }}
        onOk={() => createVendorForm.submit()}
        confirmLoading={createVendorMutation.isPending}
        okText="Simpan Vendor"
        cancelText="Batal"
      >
        <Form
          form={createVendorForm}
          layout="vertical"
          onFinish={(val) => createVendorMutation.mutate(val)}
          initialValues={{ isPkp: true }}
        >
          <Form.Item
            name="name"
            label="Nama Perusahaan Vendor"
            rules={[{ required: true, message: 'Nama perusahaan vendor wajib diisi' }]}
          >
            <Input placeholder="Contoh: PT Solusi Jaringan Global" />
          </Form.Item>

          <Form.Item
            name="vendorCode"
            label="Kode Vendor (Opsional)"
          >
            <Input placeholder="Contoh: VEND-SOLUSI-001" />
          </Form.Item>

          <Form.Item
            name="taxIdentificationNumber"
            label="Nomor Pokok Wajib Pajak (NPWP 16 Digit / Coretax Format)"
            rules={[
              { required: true, message: 'NPWP wajib diisi' },
              {
                validator: async (_, value) => {
                  if (value && !validateNpwp(value)) {
                    throw new Error('NPWP tidak valid. Format harus 16 digit angka (Coretax) atau 15 digit legacy.');
                  }
                },
              },
            ]}
          >
            <Input placeholder="Contoh: 01.234.567.8-012.000 atau 16 digit" />
          </Form.Item>

          <Form.Item
            name="isPkp"
            label="Status Pengusaha Kena Pajak (PKP)"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={true}>PKP (Wajib terbitkan Faktur Pajak elektronik)</Select.Option>
              <Select.Option value={false}>Non-PKP (Bebas PPN / Usaha Mikro)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Tambah Rekening Bank */}
      <Modal
        title={`Tambah Rekening Bank: ${selectedVendor?.name || ''}`}
        open={isAddBankOpen}
        onCancel={() => {
          setIsAddBankOpen(false);
          addBankForm.resetFields();
        }}
        onOk={() => addBankForm.submit()}
        confirmLoading={addBankMutation.isPending}
        okText="Ajukan Rekening"
        cancelText="Batal"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Prinsip 4-Eyes Check (R18)"
          description="Rekening baru akan berstatus PENDING_STAGE_1. Diperlukan 2 orang berbeda (Staff AP dan Head of AP) untuk memverifikasi sebelum rekening aktif digunakan untuk transaksi."
        />
        <Form
          form={addBankForm}
          layout="vertical"
          onFinish={(val) => {
            if (selectedVendor) {
              addBankMutation.mutate({ vendorId: selectedVendor.id, payload: val });
            }
          }}
        >
          <Form.Item
            name="bankName"
            label="Nama Bank"
            rules={[{ required: true, message: 'Nama bank wajib dipilih' }]}
          >
            <Select placeholder="Pilih Bank">
              <Select.Option value="BCA">Bank Central Asia (BCA)</Select.Option>
              <Select.Option value="Mandiri">Bank Mandiri</Select.Option>
              <Select.Option value="BRI">Bank Rakyat Indonesia (BRI)</Select.Option>
              <Select.Option value="BNI">Bank Negara Indonesia (BNI)</Select.Option>
              <Select.Option value="CIMB">CIMB Niaga</Select.Option>
              <Select.Option value="Permata">Bank Permata</Select.Option>
              <Select.Option value="Danamon">Bank Danamon</Select.Option>
              <Select.Option value="BSI">Bank Syariah Indonesia (BSI)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="accountNumber"
            label="Nomor Rekening"
            rules={[{ required: true, message: 'Nomor rekening wajib diisi' }]}
          >
            <Input placeholder="Contoh: 1234567890" />
          </Form.Item>

          <Form.Item
            name="accountHolderName"
            label="Nama Pemilik Rekening (Sesuai Buku Tabungan)"
            rules={[{ required: true, message: 'Nama pemilik rekening wajib diisi' }]}
          >
            <Input placeholder="Contoh: PT Solusi Jaringan Global" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Verifikasi Rekening 4-Eyes (R18) */}
      <Modal
        title="Verifikasi Rekening Bank (4-Eyes Principle - R18)"
        open={isVerifyBankOpen}
        onCancel={() => {
          setIsVerifyBankOpen(false);
          verifyBankForm.resetFields();
        }}
        onOk={() => verifyBankForm.submit()}
        confirmLoading={verifyBankMutation.isPending}
        okText="Konfirmasi Verifikasi"
        cancelText="Batal"
        okButtonProps={{
          disabled: isSameVerifierAsStage1 && watchedAction === 'VERIFY_STAGE_2',
        }}
      >
        <Form
          form={verifyBankForm}
          layout="vertical"
          onFinish={(val) => {
            if (val.action === 'VERIFY_STAGE_2' && isSameVerifierAsStage1) {
              message.error('Pelanggaran 4-Eyes Principle (R18): Verifikator Tahap 2 wajib orang yang berbeda dari Verifikator Tahap 1.');
              return;
            }
            if (selectedVendor && selectedBankId) {
              verifyBankMutation.mutate({
                vendorId: selectedVendor.id,
                bankId: selectedBankId,
                payload: val,
              });
            }
          }}
        >
          {selectedBankAccount && (
            <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
              <Space direction="vertical" size={2} style={{ width: '100%', fontSize: 13 }}>
                <div>
                  <Text type="secondary">Vendor:</Text> <Text strong>{selectedVendor?.name}</Text>
                </div>
                <div>
                  <Text type="secondary">Rekening:</Text> <Text strong>{selectedBankAccount.bankName} - {selectedBankAccount.accountNumber}</Text> ({selectedBankAccount.accountHolderName})
                </div>
              </Space>
            </div>
          )}

          {currentBankStatus === 'PENDING_STAGE_1' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Verifikasi Tahap 1 (AP Staff)"
              description="Verifikasi Tahap 1 wajib dilakukan oleh Staf AP setelah memeriksa kesesuaian fisik buku tabungan atau rekening koran resmi vendor."
            />
          )}

          {currentBankStatus === 'PENDING_STAGE_2' && !isSameVerifierAsStage1 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Verifikasi Tahap 1 Selesai"
              description={
                <div>
                  <div>
                    Tahap 1 telah diverifikasi oleh: <strong>{verifier1 || 'AP Staff'}</strong>.
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    Lakukan konfirmasi independen ke pihak bank atau vendor sebelum melakukan verifikasi final Tahap 2.
                  </div>
                </div>
              }
            />
          )}

          {currentBankStatus === 'PENDING_STAGE_2' && isSameVerifierAsStage1 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Peringatan 4-Eyes Principle (R18)"
              description={
                <div>
                  <div>
                    Anda tercatat sebagai pemverifikasi Tahap 1 (<strong>{verifier1}</strong>).
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    Sesuai aturan pemisahan tugas (<em>Segregation of Duties</em>), verifikasi Tahap 2 wajib disahkan oleh pengguna/pejabat lain yang independen. Anda tidak dapat menyetujui Tahap 2 ini.
                  </div>
                </div>
              }
            />
          )}

          <Form.Item
            name="action"
            label="Tindakan Verifikasi"
            rules={[{ required: true, message: 'Pilih tindakan verifikasi' }]}
          >
            <Select>
              {currentBankStatus === 'PENDING_STAGE_1' && (
                <Select.Option value="VERIFY_STAGE_1">Verifikasi Tahap 1 (AP Staff)</Select.Option>
              )}
              {currentBankStatus === 'PENDING_STAGE_2' && (
                <Select.Option value="VERIFY_STAGE_2" disabled={isSameVerifierAsStage1}>
                  Verifikasi Tahap 2 (Head of AP - Final Rilis){isSameVerifierAsStage1 ? ' (Ditolak: Verifikator Sama)' : ''}
                </Select.Option>
              )}
              {currentBankStatus !== 'PENDING_STAGE_1' && currentBankStatus !== 'PENDING_STAGE_2' && (
                <>
                  <Select.Option value="VERIFY_STAGE_1">Verifikasi Tahap 1 (AP Staff)</Select.Option>
                  <Select.Option value="VERIFY_STAGE_2">Verifikasi Tahap 2 (Head of AP - Final Rilis)</Select.Option>
                </>
              )}
              <Select.Option value="REJECT">Tolak Rekening</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="rejectionReason"
            label="Catatan / Alasan Penolakan (Wajib jika ditolak)"
            rules={[
              {
                validator: async (_, value) => {
                  if (watchedAction === 'REJECT' && (!value || !value.trim())) {
                    throw new Error('Alasan penolakan wajib diisi jika menolak rekening');
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={3} placeholder="Contoh: Nama di rekening tidak cocok dengan NPWP" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Ubah Status Vendor (Option 2 - R65 Blacklist / Suspend) */}
      <Modal
        title={`Ubah Status Vendor: ${selectedVendor?.name || ''}`}
        open={isStatusModalOpen}
        onCancel={() => {
          setIsStatusModalOpen(false);
          statusForm.resetFields();
        }}
        onOk={() => {
          statusForm.validateFields().then((values) => {
            if (selectedVendor) {
              updateVendorStatusMutation.mutate({
                vendorId: selectedVendor.id,
                status: values.status,
                reason: values.reason,
              });
            }
          });
        }}
        confirmLoading={updateVendorStatusMutation.isPending}
        okText="Perbarui Status"
        cancelText="Batal"
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="status"
            label="Status Operasional Vendor"
            rules={[{ required: true, message: 'Status vendor wajib dipilih' }]}
          >
            <Select>
              <Select.Option value="APPROVED">Disetujui (Approved) - Aktif untuk PO</Select.Option>
              <Select.Option value="PROSPECTIVE">Prospektif (Belum Aktif Transaksi)</Select.Option>
              <Select.Option value="SUSPENDED">Ditangguhkan (Suspended) - Tahan PO Baru</Select.Option>
              <Select.Option value="BLACKLISTED">Daftar Hitam (Blacklisted) - Blokir Total</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="Alasan Perubahan Status (Audit Trail)"
            rules={[{ required: true, message: 'Alasan perubahan status wajib diisi' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Contoh: Penangguhan sementara karena audit kualitas BAST menemukan ketidaksesuaian berulang."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VendorListPage;
