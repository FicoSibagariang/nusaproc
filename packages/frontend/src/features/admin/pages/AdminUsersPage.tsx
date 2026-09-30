import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Checkbox,
  Switch,
  App,
  theme,
  Popconfirm,
  Typography,
  Card,
  Row,
  Col,
  Tabs,
  Breadcrumb,
  Tooltip,
} from 'antd';
import {
  UserAddOutlined,
  SearchOutlined,
  EditOutlined,
  CheckCircleOutlined,
  StopOutlined,
  KeyOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
  MailOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUsers,
  createUser,
  updateUserRoles,
  updateUserStatus,
  branchesApi,
  divisionsApi,
  type UserItem,
  type CreateUserPayload,
} from '../../../api';
import type { AppRole } from '@nusaproc/shared';
import { RoleTag, StatusTag, ROLE_COLORS, ROLE_LABELS } from '../../../components/common/StatusTag';

const { Title, Text } = Typography;

const ALL_ROLES: { label: string; value: AppRole; color: string }[] = (
  ['REQUESTER', 'APPROVER', 'ACCOUNT_PAYABLE', 'WAREHOUSE', 'FINANCE', 'AUDITOR', 'ADMIN'] as AppRole[]
).map((r) => ({
  value: r,
  label: ROLE_LABELS[r] || r,
  color: ROLE_COLORS[r] || 'blue',
}));

export const AdminUsersPage: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [divisionFilter, setDivisionFilter] = useState<string | undefined>(undefined);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditRolesModalOpen, setIsEditRolesModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  const [createForm] = Form.useForm();
  const [editRolesForm] = Form.useForm();

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['users', searchTerm, divisionFilter, roleFilter],
    queryKeyHashFn: (queryKey) => JSON.stringify(queryKey),
    queryFn: () =>
      fetchUsers({
        search: searchTerm || undefined,
        divisionId: divisionFilter || undefined,
        role: roleFilter || undefined,
      }),
  });

  const { data: branchesData } = useQuery({
    queryKey: ['branches', true],
    queryFn: () => branchesApi.list({ isActive: true }),
  });

  const { data: divisionsData } = useQuery({
    queryKey: ['divisions', true],
    queryFn: () => divisionsApi.list({ isActive: true }),
  });

  const activeBranches = branchesData?.data || [];
  const activeDivisions = divisionsData?.data || [];

  const branchMap = useMemo(() => {
    const map = new Map<string, string>();
    activeBranches.forEach((b) => map.set(b.code, b.name));
    return map;
  }, [activeBranches]);

  const divisionMap = useMemo(() => {
    const map = new Map<string, string>();
    activeDivisions.forEach((d) => map.set(d.code, d.name));
    return map;
  }, [activeDivisions]);

  const rawUsers: UserItem[] = data?.data || [];

  // Filtered by status tab
  const filteredUsers = useMemo(() => {
    if (activeTab === 'ACTIVE') return rawUsers.filter((u) => u.isActive);
    if (activeTab === 'INACTIVE') return rawUsers.filter((u) => !u.isActive);
    return rawUsers;
  }, [rawUsers, activeTab]);

  const tabCounts = useMemo(() => {
    return {
      ALL: rawUsers.length,
      ACTIVE: rawUsers.filter((u) => u.isActive).length,
      INACTIVE: rawUsers.filter((u) => !u.isActive).length,
    };
  }, [rawUsers]);

  const statusTabItems = [
    { key: 'ALL', label: `Semua Pengguna (${tabCounts.ALL})` },
    { key: 'ACTIVE', label: `Aktif (${tabCounts.ACTIVE})` },
    { key: 'INACTIVE', label: `Nonaktif (${tabCounts.INACTIVE})` },
  ];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      message.success('Pengguna baru berhasil didaftarkan.');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mendaftarkan pengguna.');
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({
      userId,
      roles,
    }: {
      userId: string;
      roles: Array<{ role: AppRole; isTaxSpecialist?: boolean; validFrom?: string; validUntil?: string | null }>;
    }) => updateUserRoles(userId, roles),
    onSuccess: () => {
      message.success('Hak akses peran berhasil diperbarui.');
      setIsEditRolesModalOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memperbarui peran.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserStatus(userId, isActive),
    onSuccess: (_, variables) => {
      message.success(
        variables.isActive
          ? 'Akun pengguna berhasil diaktifkan kembali.'
          : 'Akun pengguna berhasil dinonaktifkan. Seluruh delegasi terkait dibatalkan (R64).'
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mengubah status pengguna.');
    },
  });

  const handleOpenEditRoles = (user: UserItem) => {
    setSelectedUser(user);
    const assignedRoleKeys = user.roles.map((r) => r.role);
    const hasTax = user.roles.some((r) => r.isTaxSpecialist);
    editRolesForm.setFieldsValue({
      roles: assignedRoleKeys,
      isTaxSpecialist: hasTax,
    });
    setIsEditRolesModalOpen(true);
  };

  const handleCreateSubmit = (values: {
    email: string;
    fullName: string;
    employeeId: string;
    divisionId: string;
    branchId: string;
    initialPassword?: string;
    roles: AppRole[];
    isTaxSpecialist?: boolean;
  }) => {
    const rolesPayload = values.roles.map((r: AppRole) => ({
      role: r,
      isTaxSpecialist: values.isTaxSpecialist && r === 'ACCOUNT_PAYABLE',
    }));

    createMutation.mutate({
      email: values.email,
      fullName: values.fullName,
      employeeId: values.employeeId,
      divisionId: values.divisionId,
      branchId: values.branchId,
      initialPassword: values.initialPassword || 'Password123!',
      isLocalFallback: true,
      roles: rolesPayload,
    });
  };

  const handleEditRolesSubmit = (values: {
    roles: AppRole[];
    isTaxSpecialist?: boolean;
  }) => {
    if (!selectedUser) return;
    const rolesPayload = values.roles.map((r: AppRole) => ({
      role: r,
      isTaxSpecialist: values.isTaxSpecialist && r === 'ACCOUNT_PAYABLE',
    }));

    updateRolesMutation.mutate({
      userId: selectedUser.id,
      roles: rolesPayload,
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setDivisionFilter(undefined);
    setRoleFilter(undefined);
    setActiveTab('ALL');
  };

  const handleExportCsv = () => {
    const headers = ['NIP', 'Nama Lengkap', 'Email', 'Divisi', 'Cabang', 'Peran', 'Tax Specialist', 'Status'];
    const rows = filteredUsers.map((u) => [
      `"${u.employeeId}"`,
      `"${u.fullName}"`,
      `"${u.email}"`,
      `"${u.divisionName || divisionMap.get(u.divisionId) || u.divisionId}"`,
      `"${u.branchName || branchMap.get(u.branchId) || u.branchId}"`,
      `"${u.roles.map((r) => r.role).join(', ')}"`,
      u.roles.some((r) => r.isTaxSpecialist) ? 'YA' : 'TIDAK',
      u.isActive ? 'AKTIF' : 'NONAKTIF',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DATA-PENGGUNA-NUSAPROC-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    message.success('Data pengguna berhasil diekspor ke format CSV.');
  };

  // Columns definition (Figma 10)
  const columns = [
    {
      title: 'Karyawan & Profil',
      key: 'employee',
      width: 260,
      render: (_: unknown, record: UserItem) => {
        const initials = record.fullName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* User Avatar Initial (Figma 8:197 User Cell) */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#e6f4ff',
                color: '#0052cc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>

            <div style={{ overflow: 'hidden' }}>
              <Text strong style={{ fontSize: 13, display: 'block', color: '#1f1f1f' }}>
                {record.fullName}
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Tag color="default" style={{ fontSize: 10, padding: '0 4px', margin: 0, fontFamily: 'monospace' }}>
                  <IdcardOutlined style={{ marginRight: 3 }} />
                  {record.employeeId}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }} ellipsis={{ tooltip: record.email }}>
                  {record.email}
                </Text>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Divisi & Kantor Cabang',
      key: 'org',
      width: 220,
      render: (_: unknown, record: UserItem) => {
        const divName = record.divisionName || divisionMap.get(record.divisionId) || record.divisionId;
        const brName = record.branchName || branchMap.get(record.branchId) || record.branchId;
        return (
          <Space direction="vertical" size={2}>
            <Tag color="geekblue" style={{ margin: 0, fontSize: 11 }}>
              {divName}
            </Tag>
            <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
              {brName}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Peran & Hak Akses (RBAC)',
      key: 'roles',
      width: 240,
      render: (_: unknown, record: UserItem) => (
        <Space wrap size={[4, 4]}>
          {record.roles.map((r) => (
            <RoleTag key={r.role} role={r.role} isTaxSpecialist={r.isTaxSpecialist} />
          ))}
        </Space>
      ),
    },
    {
      title: 'Metode Autentikasi',
      key: 'auth',
      width: 170,
      render: (_: unknown, record: UserItem) => (
        <Space direction="vertical" size={2}>
          {record.isLocalFallback && (
            <Tag icon={<KeyOutlined />} color="purple" style={{ fontSize: 11 }}>
              Password Fallback
            </Tag>
          )}
          <Tag icon={<SafetyCertificateOutlined />} color="blue" style={{ fontSize: 11 }}>
            Google SSO
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Status Akun',
      dataIndex: 'isActive',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (isActive: boolean) => <StatusTag status={isActive} />,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: UserItem) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditRoles(record)}
          >
            Edit Peran
          </Button>
          {record.isActive ? (
            <Popconfirm
              title="Nonaktifkan Pengguna?"
              description="Perhatian (R64): Menonaktifkan akun akan membatalkan seluruh delegasi aktif pengguna ini."
              okText="Ya, Nonaktifkan"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                statusMutation.mutate({ userId: record.id, isActive: false })
              }
            >
              <Button size="small" danger icon={<StopOutlined />}>
                Nonaktifkan
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CheckCircleOutlined />}
              onClick={() =>
                statusMutation.mutate({ userId: record.id, isActive: true })
              }
            >
              Aktifkan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb Navigation (Figma 10) */}
      <Breadcrumb
        items={[
          { title: <a href="/">Beranda</a> },
          { title: 'Tata Kelola & Sistem' },
          { title: 'Manajemen Pengguna' },
        ]}
        style={{ marginBottom: 4 }}
      />

      {/* Header Row */}
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
              flexShrink: 0,
            }}
          >
            <TeamOutlined style={{ color: '#1677ff', fontSize: 22 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
              Manajemen Pengguna & Hak Akses (US12)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Kelola akun karyawan, hak akses multi-peran (RBAC), spesialisasi pajak, dan status aktivasi pengguna PT Nusanet.
            </Text>
          </div>
        </div>

        <Space wrap>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Tambah Pengguna Baru
          </Button>
        </Space>
      </div>

      {/* Status Filter Tabs (Figma 10) */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={statusTabItems}
        style={{ marginBottom: -8 }}
      />

      {/* Filter & Search Bar */}
      <Card styles={{ body: { padding: '12px 16px' } }} style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space wrap size="middle">
            <Input
              placeholder="Cari nama, email, NIP..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 260 }}
            />

            <Select
              placeholder="Filter Divisi"
              style={{ width: 180 }}
              allowClear
              showSearch
              optionFilterProp="children"
              value={divisionFilter}
              onChange={setDivisionFilter}
            >
              {activeDivisions.map((d) => (
                <Select.Option key={d.code} value={d.code}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>

            <Select
              placeholder="Filter Peran"
              style={{ width: 170 }}
              allowClear
              value={roleFilter}
              onChange={setRoleFilter}
            >
              {ALL_ROLES.map((r) => (
                <Select.Option key={r.value} value={r.value}>
                  {r.label}
                </Select.Option>
              ))}
            </Select>

            <Button onClick={handleResetFilters}>Reset</Button>
          </Space>

          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              Ekspor CSV
            </Button>
          </Space>
        </div>
      </Card>

      {/* Main Users Table */}
      <Card styles={{ body: { padding: 0 } }} style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        <Table<UserItem>
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1050 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `Menampilkan ${range[0]} - ${range[1]} dari total ${total} pengguna`,
          }}
        />
      </Card>

      {/* Modal Tambah Pengguna Baru */}
      <Modal
        title="Pendaftaran Pengguna Baru (US12)"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={560}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
          initialValues={{
            branchId: 'HQ_MEDAN',
            divisionId: 'DIV-IT',
            initialPassword: 'Password123!',
            roles: ['REQUESTER'],
            isTaxSpecialist: false,
          }}
        >
          <Form.Item
            name="email"
            label="Alamat Email Karyawan"
            rules={[
              { required: true, message: 'Email wajib diisi' },
              { type: 'email', message: 'Format email tidak valid' },
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="contoh@nusanet.net.id" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="fullName"
                label="Nama Lengkap"
                rules={[{ required: true, message: 'Nama lengkap wajib diisi' }]}
              >
                <Input placeholder="Nama Lengkap Karyawan" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="employeeId"
                label="NIP / Employee ID"
                rules={[{ required: true, message: 'NIP wajib diisi' }]}
              >
                <Input placeholder="EMP-XXXX" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="divisionId"
                label="Divisi"
                rules={[{ required: true, message: 'Divisi wajib dipilih' }]}
              >
                <Select placeholder="Pilih Divisi" showSearch optionFilterProp="children">
                  {activeDivisions.map((d) => (
                    <Select.Option key={d.code} value={d.code}>
                      {d.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="branchId"
                label="Cabang Kantor"
                rules={[{ required: true, message: 'Cabang wajib dipilih' }]}
              >
                <Select placeholder="Pilih Cabang" showSearch optionFilterProp="children">
                  {activeBranches.map((b) => (
                    <Select.Option key={b.code} value={b.code}>
                      {b.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="initialPassword"
            label="Kata Sandi Awal (Fallback Login)"
            rules={[{ min: 6, message: 'Kata sandi minimal 6 karakter' }]}
          >
            <Input.Password placeholder="Password123!" />
          </Form.Item>

          <Form.Item
            name="roles"
            label="Penetapan Peran (Multi-Role RBAC)"
            rules={[{ required: true, message: 'Minimal pilih 1 peran' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {ALL_ROLES.map((r) => (
                  <Col span={12} key={r.value}>
                    <Checkbox value={r.value}>
                      <Tag color={r.color}>{r.value}</Tag>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            name="isTaxSpecialist"
            label="Spesialisasi Pajak (PPN/PPh Validator)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsCreateModalOpen(false)}>Batal</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
                Simpan & Daftarkan Pengguna
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Modal Edit Hak Akses & Peran */}
      <Modal
        title={`Edit Peran & Hak Akses: ${selectedUser?.fullName || ''}`}
        open={isEditRolesModalOpen}
        onCancel={() => {
          setIsEditRolesModalOpen(false);
          setSelectedUser(null);
        }}
        footer={null}
        width={500}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form form={editRolesForm} layout="vertical" onFinish={handleEditRolesSubmit}>
          <Form.Item
            name="roles"
            label="Daftar Peran Aktif"
            rules={[{ required: true, message: 'Minimal pilih 1 peran' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 12]}>
                {ALL_ROLES.map((r) => (
                  <Col span={12} key={r.value}>
                    <Checkbox value={r.value}>
                      <Tag color={r.color}>{r.value}</Tag>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            name="isTaxSpecialist"
            label="Hak Akses Khusus Tax Specialist (PPN 12% & Coretax)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button
                onClick={() => {
                  setIsEditRolesModalOpen(false);
                  setSelectedUser(null);
                }}
              >
                Batal
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateRolesMutation.isPending}
              >
                Perbarui Hak Akses
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
