import React, { useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Card,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  App,
  theme,
  Tabs,
  Popconfirm,
  Breadcrumb,
  Tooltip,
} from 'antd';
import {
  BankOutlined,
  ApartmentOutlined,
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  branchesApi,
  divisionsApi,
  type BranchItem,
  type DivisionItem,
  type CreateBranchPayload,
  type UpdateBranchPayload,
  type CreateDivisionPayload,
  type UpdateDivisionPayload,
} from '../../../api';
import { StatusTag } from '../../../components/common/StatusTag';

const { Title, Text, Paragraph } = Typography;

export const AdminOrganizationPage: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'branches' | 'divisions'>('branches');

  // Branch states
  const [branchSearch, setBranchSearch] = useState('');
  const [branchStatusFilter, setBranchStatusFilter] = useState<boolean | undefined>(undefined);
  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [createBranchForm] = Form.useForm<CreateBranchPayload>();
  const [editBranchForm] = Form.useForm<UpdateBranchPayload>();

  // Division states
  const [divisionSearch, setDivisionSearch] = useState('');
  const [divisionStatusFilter, setDivisionStatusFilter] = useState<boolean | undefined>(undefined);
  const [isCreateDivisionModalOpen, setIsCreateDivisionModalOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<DivisionItem | null>(null);
  const [createDivisionForm] = Form.useForm<CreateDivisionPayload>();
  const [editDivisionForm] = Form.useForm<UpdateDivisionPayload>();

  // Queries
  const { data: branchesData, isLoading: isBranchesLoading } = useQuery({
    queryKey: ['branches', branchStatusFilter, branchSearch],
    queryFn: () => branchesApi.list({ isActive: branchStatusFilter, search: branchSearch }),
  });

  const { data: divisionsData, isLoading: isDivisionsLoading } = useQuery({
    queryKey: ['divisions', divisionStatusFilter, divisionSearch],
    queryFn: () => divisionsApi.list({ isActive: divisionStatusFilter, search: divisionSearch }),
  });

  const branches = branchesData?.data || [];
  const divisions = divisionsData?.data || [];

  // Branch Mutations
  const createBranchMutation = useMutation({
    mutationFn: (payload: CreateBranchPayload) => branchesApi.create(payload),
    onSuccess: () => {
      message.success('Kantor cabang baru berhasil ditambahkan.');
      setIsCreateBranchModalOpen(false);
      createBranchForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal menambahkan kantor cabang.');
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBranchPayload }) =>
      branchesApi.update(id, payload),
    onSuccess: () => {
      message.success('Data kantor cabang berhasil diperbarui.');
      setEditingBranch(null);
      editBranchForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memperbarui kantor cabang.');
    },
  });

  const toggleBranchStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      branchesApi.toggleStatus(id, isActive),
    onSuccess: (_, variables) => {
      message.success(
        variables.isActive
          ? 'Kantor cabang berhasil diaktifkan kembali.'
          : 'Kantor cabang berhasil dinonaktifkan.'
      );
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mengubah status cabang.');
    },
  });

  // Division Mutations
  const createDivisionMutation = useMutation({
    mutationFn: (payload: CreateDivisionPayload) => divisionsApi.create(payload),
    onSuccess: () => {
      message.success('Divisi baru berhasil ditambahkan.');
      setIsCreateDivisionModalOpen(false);
      createDivisionForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal menambahkan divisi.');
    },
  });

  const updateDivisionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDivisionPayload }) =>
      divisionsApi.update(id, payload),
    onSuccess: () => {
      message.success('Data divisi berhasil diperbarui.');
      setEditingDivision(null);
      editDivisionForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memperbarui divisi.');
    },
  });

  const toggleDivisionStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      divisionsApi.toggleStatus(id, isActive),
    onSuccess: (_, variables) => {
      message.success(
        variables.isActive
          ? 'Divisi berhasil diaktifkan kembali.'
          : 'Divisi berhasil dinonaktifkan.'
      );
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mengubah status divisi.');
    },
  });

  // Open Edit Branch Modal
  const handleOpenEditBranch = (branch: BranchItem) => {
    setEditingBranch(branch);
    editBranchForm.setFieldsValue({
      code: branch.code,
      name: branch.name,
      city: branch.city,
      address: branch.address,
      isActive: branch.isActive,
    });
  };

  // Open Edit Division Modal
  const handleOpenEditDivision = (division: DivisionItem) => {
    setEditingDivision(division);
    editDivisionForm.setFieldsValue({
      code: division.code,
      name: division.name,
      description: division.description,
      isActive: division.isActive,
    });
  };

  const handleExportCsv = () => {
    if (activeTab === 'branches') {
      const headers = ['Kode Cabang', 'Nama Cabang', 'Kota', 'Alamat', 'Status'];
      const rows = branches.map((b) => [
        `"${b.code}"`,
        `"${b.name}"`,
        `"${b.city}"`,
        `"${(b.address || '').replace(/"/g, '""')}"`,
        b.isActive ? 'AKTIF' : 'NONAKTIF',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `DATA-CABANG-NUSAPROC-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('Data cabang berhasil diekspor.');
    } else {
      const headers = ['Kode Divisi', 'Nama Divisi', 'Deskripsi Tanggung Jawab', 'Status'];
      const rows = divisions.map((d) => [
        `"${d.code}"`,
        `"${d.name}"`,
        `"${(d.description || '').replace(/"/g, '""')}"`,
        d.isActive ? 'AKTIF' : 'NONAKTIF',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `DATA-DIVISI-NUSAPROC-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('Data divisi berhasil diekspor.');
    }
  };

  // Branch Table Columns
  const branchColumns = [
    {
      title: 'Kode Cabang',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => (
        <Tag color="geekblue" style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'Nama Kantor Cabang',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string) => <Text strong style={{ fontSize: 13, color: '#1f1f1f' }}>{name}</Text>,
    },
    {
      title: 'Kota / Wilayah',
      dataIndex: 'city',
      key: 'city',
      width: 160,
      render: (city: string) => (
        <Tag icon={<EnvironmentOutlined />} color="cyan" style={{ fontSize: 11 }}>
          {city}
        </Tag>
      ),
    },
    {
      title: 'Alamat Lengkap',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (address: string | null) => (
        <Paragraph style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 2, tooltip: address || '-' }}>
          {address || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      align: 'center' as const,
      render: (isActive: boolean) => <StatusTag status={isActive} />,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      render: (_: unknown, record: BranchItem) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditBranch(record)}
          >
            Edit
          </Button>
          {record.isActive ? (
            <Popconfirm
              title="Nonaktifkan Cabang?"
              description="Cabang non-aktif tidak akan muncul di formulir pengajuan baru."
              okText="Ya, Nonaktifkan"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                toggleBranchStatusMutation.mutate({ id: record.id, isActive: false })
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
                toggleBranchStatusMutation.mutate({ id: record.id, isActive: true })
              }
            >
              Aktifkan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Division Table Columns
  const divisionColumns = [
    {
      title: 'Kode Divisi',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => (
        <Tag color="purple" style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'Nama Unit Divisi',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (name: string) => <Text strong style={{ fontSize: 13, color: '#1f1f1f' }}>{name}</Text>,
    },
    {
      title: 'Deskripsi Tanggung Jawab',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => (
        <Paragraph style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 2, tooltip: desc || '-' }}>
          {desc || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      align: 'center' as const,
      render: (isActive: boolean) => <StatusTag status={isActive} />,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      render: (_: unknown, record: DivisionItem) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditDivision(record)}
          >
            Edit
          </Button>
          {record.isActive ? (
            <Popconfirm
              title="Nonaktifkan Divisi?"
              description="Divisi non-aktif tidak akan muncul di formulir pengajuan baru."
              okText="Ya, Nonaktifkan"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                toggleDivisionStatusMutation.mutate({ id: record.id, isActive: false })
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
                toggleDivisionStatusMutation.mutate({ id: record.id, isActive: true })
              }
            >
              Aktifkan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const mainTabItems = [
    {
      key: 'branches',
      label: (
        <span>
          <BankOutlined style={{ marginRight: 6 }} />
          Kantor Cabang ({branches.length})
        </span>
      ),
    },
    {
      key: 'divisions',
      label: (
        <span>
          <ApartmentOutlined style={{ marginRight: 6 }} />
          Unit Divisi ({divisions.length})
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb Navigation (Figma 11) */}
      <Breadcrumb
        items={[
          { title: <a href="/">Beranda</a> },
          { title: 'Master Data' },
          { title: 'Kantor Cabang & Divisi' },
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
            <BankOutlined style={{ color: '#1677ff', fontSize: 22 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
              Master Organisasi: Cabang & Divisi
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Kelola struktur kantor cabang dan unit divisi internal PT Nusanet secara terpusat untuk alur pengadaan & alokasi anggaran.
            </Text>
          </div>
        </div>

        <Space wrap>
          {activeTab === 'branches' ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateBranchModalOpen(true)}
            >
              Tambah Kantor Cabang
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateDivisionModalOpen(true)}
            >
              Tambah Divisi Perusahaan
            </Button>
          )}
        </Space>
      </div>

      {/* Main Tabs (Figma 11) */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'branches' | 'divisions')}
        items={mainTabItems}
        style={{ marginBottom: -8 }}
      />

      {/* Filter & Action Card */}
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
          {activeTab === 'branches' ? (
            <Space wrap size="middle">
              <Input
                placeholder="Cari kode, nama, kota cabang..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                allowClear
                style={{ width: 260 }}
              />
              <Select
                placeholder="Status Cabang"
                style={{ width: 160 }}
                allowClear
                value={branchStatusFilter}
                onChange={setBranchStatusFilter}
              >
                <Select.Option value={true}>Hanya Aktif</Select.Option>
                <Select.Option value={false}>Hanya Nonaktif</Select.Option>
              </Select>
              <Button
                onClick={() => {
                  setBranchSearch('');
                  setBranchStatusFilter(undefined);
                }}
              >
                Reset
              </Button>
            </Space>
          ) : (
            <Space wrap size="middle">
              <Input
                placeholder="Cari kode, nama divisi..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={divisionSearch}
                onChange={(e) => setDivisionSearch(e.target.value)}
                allowClear
                style={{ width: 260 }}
              />
              <Select
                placeholder="Status Divisi"
                style={{ width: 160 }}
                allowClear
                value={divisionStatusFilter}
                onChange={setDivisionStatusFilter}
              >
                <Select.Option value={true}>Hanya Aktif</Select.Option>
                <Select.Option value={false}>Hanya Nonaktif</Select.Option>
              </Select>
              <Button
                onClick={() => {
                  setDivisionSearch('');
                  setDivisionStatusFilter(undefined);
                }}
              >
                Reset
              </Button>
            </Space>
          )}

          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              Ekspor CSV
            </Button>
          </Space>
        </div>
      </Card>

      {/* Table Content */}
      <Card styles={{ body: { padding: 0 } }} style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        {activeTab === 'branches' ? (
          <Table<BranchItem>
            columns={branchColumns}
            dataSource={branches}
            rowKey="id"
            loading={isBranchesLoading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `Menampilkan ${range[0]} - ${range[1]} dari total ${total} kantor cabang`,
            }}
          />
        ) : (
          <Table<DivisionItem>
            columns={divisionColumns}
            dataSource={divisions}
            rowKey="id"
            loading={isDivisionsLoading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `Menampilkan ${range[0]} - ${range[1]} dari total ${total} unit divisi`,
            }}
          />
        )}
      </Card>

      {/* Modal Tambah Cabang */}
      <Modal
        title="Tambah Kantor Cabang Baru"
        open={isCreateBranchModalOpen}
        onCancel={() => setIsCreateBranchModalOpen(false)}
        footer={null}
        width={500}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form
          form={createBranchForm}
          layout="vertical"
          onFinish={(values) => createBranchMutation.mutate(values)}
          initialValues={{ isActive: true }}
        >
          <Form.Item
            name="code"
            label="Kode Cabang"
            rules={[
              { required: true, message: 'Kode cabang wajib diisi' },
              { max: 20, message: 'Maksimal 20 karakter' },
            ]}
          >
            <Input placeholder="Contoh: MEDAN, JAKARTA, BALI" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Kantor Cabang"
            rules={[{ required: true, message: 'Nama kantor cabang wajib diisi' }]}
          >
            <Input placeholder="Contoh: Kantor Cabang Medan" />
          </Form.Item>

          <Form.Item
            name="city"
            label="Kota"
            rules={[{ required: true, message: 'Kota wajib diisi' }]}
          >
            <Input placeholder="Contoh: Medan" />
          </Form.Item>

          <Form.Item name="address" label="Alamat Lengkap">
            <Input.TextArea rows={3} placeholder="Alamat fisik kantor cabang" />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsCreateBranchModalOpen(false)}>Batal</Button>
              <Button type="primary" htmlType="submit" loading={createBranchMutation.isPending}>
                Simpan Cabang
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Modal Edit Cabang */}
      <Modal
        title={`Edit Kantor Cabang: ${editingBranch?.name || ''}`}
        open={!!editingBranch}
        onCancel={() => setEditingBranch(null)}
        footer={null}
        width={500}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form
          form={editBranchForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingBranch) {
              updateBranchMutation.mutate({ id: editingBranch.id, payload: values });
            }
          }}
        >
          <Form.Item name="code" label="Kode Cabang">
            <Input disabled style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Kantor Cabang"
            rules={[{ required: true, message: 'Nama kantor cabang wajib diisi' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="city"
            label="Kota"
            rules={[{ required: true, message: 'Kota wajib diisi' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="address" label="Alamat Lengkap">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="isActive" label="Status Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setEditingBranch(null)}>Batal</Button>
              <Button type="primary" htmlType="submit" loading={updateBranchMutation.isPending}>
                Perbarui Cabang
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Modal Tambah Divisi */}
      <Modal
        title="Tambah Unit Divisi Baru"
        open={isCreateDivisionModalOpen}
        onCancel={() => setIsCreateDivisionModalOpen(false)}
        footer={null}
        width={500}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form
          form={createDivisionForm}
          layout="vertical"
          onFinish={(values) => createDivisionMutation.mutate(values)}
          initialValues={{ isActive: true }}
        >
          <Form.Item
            name="code"
            label="Kode Divisi"
            rules={[
              { required: true, message: 'Kode divisi wajib diisi' },
              { max: 20, message: 'Maksimal 20 karakter' },
            ]}
          >
            <Input placeholder="Contoh: DIV-IT, DIV-FIN, DIV-HR" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Unit Divisi"
            rules={[{ required: true, message: 'Nama divisi wajib diisi' }]}
          >
            <Input placeholder="Contoh: Divisi Teknologi Informasi" />
          </Form.Item>

          <Form.Item name="description" label="Deskripsi Tanggung Jawab">
            <Input.TextArea rows={3} placeholder="Ruang lingkup tanggung jawab divisi" />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsCreateDivisionModalOpen(false)}>Batal</Button>
              <Button type="primary" htmlType="submit" loading={createDivisionMutation.isPending}>
                Simpan Divisi
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Modal Edit Divisi */}
      <Modal
        title={`Edit Unit Divisi: ${editingDivision?.name || ''}`}
        open={!!editingDivision}
        onCancel={() => setEditingDivision(null)}
        footer={null}
        width={500}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form
          form={editDivisionForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingDivision) {
              updateDivisionMutation.mutate({ id: editingDivision.id, payload: values });
            }
          }}
        >
          <Form.Item name="code" label="Kode Divisi">
            <Input disabled style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Unit Divisi"
            rules={[{ required: true, message: 'Nama divisi wajib diisi' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Deskripsi Tanggung Jawab">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="isActive" label="Status Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setEditingDivision(null)}>Batal</Button>
              <Button type="primary" htmlType="submit" loading={updateDivisionMutation.isPending}>
                Perbarui Divisi
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminOrganizationPage;
