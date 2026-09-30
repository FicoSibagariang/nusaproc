import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Modal,
  Form,
  Image,
  Typography,
  Descriptions,
  App,
  theme,
  Tabs,
  Breadcrumb,
  Tooltip,
  type TableProps,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CommentOutlined,
  BugOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  PictureOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { formatDate, formatDateTime, formatRelativeTime } from '../../../utils/date';
import {
  feedbackApi,
  type FeedbackItem,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackUrgency,
} from '../../../api/endpoints/feedback';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CATEGORY_TAGS: Record<FeedbackCategory, { color: string; label: string; icon: React.ReactNode }> = {
  BUG: { color: 'error', label: 'Bug / Kendala', icon: <BugOutlined /> },
  FEATURE_REQUEST: { color: 'gold', label: 'Usulan Fitur', icon: <BulbOutlined /> },
  FEEDBACK: { color: 'success', label: 'Masukan Umum', icon: <CommentOutlined /> },
};

const URGENCY_TAGS: Record<FeedbackUrgency, { color: string; label: string }> = {
  LOW: { color: 'default', label: 'Rendah' },
  MEDIUM: { color: 'blue', label: 'Sedang' },
  HIGH: { color: 'orange', label: 'Tinggi' },
  CRITICAL: { color: 'red', label: 'Kritis' },
};

const STATUS_TAGS: Record<FeedbackStatus, { color: string; label: string }> = {
  OPEN: { color: 'cyan', label: 'Terbuka (Open)' },
  IN_PROGRESS: { color: 'processing', label: 'Sedang Diproses' },
  RESOLVED: { color: 'success', label: 'Selesai (Resolved)' },
  CLOSED: { color: 'default', label: 'Ditutup (Closed)' },
};

export const AdminFeedbackPage: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedUrgency, setSelectedUrgency] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail / Action modal
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusForm] = Form.useForm();

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const statusParam = activeTab === 'ALL' ? undefined : (activeTab as FeedbackStatus);
      const res = await feedbackApi.list({
        category: selectedCategory,
        status: statusParam,
        search: searchQuery || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });
      setFeedbacks(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      message.error('Gagal memuat daftar masukan & feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [currentPage, pageSize, activeTab, selectedCategory]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchFeedbacks();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory(undefined);
    setSelectedUrgency(undefined);
    setActiveTab('ALL');
    setCurrentPage(1);
  };

  const handleOpenDetail = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    statusForm.setFieldsValue({
      status: item.status,
      adminNotes: item.adminNotes || '',
    });
    setIsModalOpen(true);
  };

  const handleUpdateStatus = async (values: { status: FeedbackStatus; adminNotes?: string }) => {
    if (!selectedFeedback) return;
    setIsUpdating(true);
    try {
      const res = await feedbackApi.updateStatus(selectedFeedback.id, values);
      message.success('Status masukan berhasil diperbarui!');
      setSelectedFeedback(res.data);
      setIsModalOpen(false);
      fetchFeedbacks();
    } catch (err: unknown) {
      message.error('Gagal memperbarui status masukan');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Waktu', 'Pengirim', 'Email', 'Peran', 'Kategori', 'Urgensi', 'Halaman', 'Judul', 'Deskripsi', 'Status'];
    const rows = feedbacks.map((f) => [
      `"${f.id}"`,
      formatDate(f.createdAt),
      `"${f.userFullName || 'Pengguna'}"`,
      `"${f.userEmail || '-'}"`,
      f.activeRole,
      f.category,
      f.urgency,
      `"${f.pageUrl}"`,
      `"${(f.title || '').replace(/"/g, '""')}"`,
      `"${(f.description || '').replace(/"/g, '""')}"`,
      f.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MASUKAN-FEEDBACK-NUSAPROC-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    message.success('Data masukan berhasil diekspor.');
  };

  const statusTabItems = [
    { key: 'ALL', label: `Semua (${total})` },
    { key: 'OPEN', label: 'Terbuka (Open)' },
    { key: 'IN_PROGRESS', label: 'Sedang Diproses' },
    { key: 'RESOLVED', label: 'Selesai (Resolved)' },
    { key: 'CLOSED', label: 'Ditutup (Closed)' },
  ];

  const columns: TableProps<FeedbackItem>['columns'] = [
    {
      title: 'Waktu',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (val: string) => (
        <Space direction="vertical" size={1}>
          <Text strong style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {formatDate(val)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {formatRelativeTime(val)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Pengirim & Halaman',
      key: 'sender',
      width: 220,
      render: (_, r) => {
        const initials = (r.userFullName || 'U')
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#e6f4ff',
                color: '#0052cc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>

            <div style={{ overflow: 'hidden' }}>
              <Text strong style={{ fontSize: 13, display: 'block', color: '#1f1f1f' }} ellipsis>
                {r.userFullName || 'Pengguna Sistem'}
              </Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }} ellipsis={{ tooltip: r.userEmail }}>
                {r.userEmail || '-'}
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Tag color="purple" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                  {r.activeRole}
                </Tag>
                <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.pageUrl}
                </Tag>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Kategori & Urgensi',
      key: 'category',
      width: 150,
      render: (_, r) => {
        const cat = CATEGORY_TAGS[r.category] || CATEGORY_TAGS.FEEDBACK;
        const urg = URGENCY_TAGS[r.urgency] || URGENCY_TAGS.MEDIUM;
        return (
          <Space direction="vertical" size={2}>
            <Tag color={cat.color} icon={cat.icon} style={{ margin: 0, fontSize: 11 }}>
              {cat.label}
            </Tag>
            {r.category === 'BUG' && (
              <Tag color={urg.color} style={{ fontSize: 10, margin: 0 }}>
                Urgensi: {urg.label}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Deskripsi Masukan & Kendala',
      key: 'description',
      minWidth: 320,
      render: (_, r) => (
        <div>
          {r.title && (
            <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 2, color: '#1f1f1f' }}>
              {r.title}
            </Text>
          )}
          <Paragraph
            ellipsis={{ rows: 2, expandable: true, symbol: 'lihat selengkapnya' }}
            style={{ marginBottom: 0, fontSize: 12, color: '#595959', lineHeight: '1.4' }}
          >
            {r.description}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Layar',
      dataIndex: 'screenshotData',
      key: 'screenshotData',
      width: 75,
      align: 'center',
      render: (val: string | null) =>
        val ? (
          <Image
            src={val}
            alt="Screenshot"
            width={48}
            height={32}
            style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9', cursor: 'pointer' }}
            preview={{
              mask: <PictureOutlined style={{ fontSize: 14 }} />,
            }}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>-</Text>
        ),
    },
    {
      title: 'Status Tiket',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: FeedbackStatus) => {
        const s = STATUS_TAGS[val] || STATUS_TAGS.OPEN;
        return <Tag color={s.color} style={{ fontWeight: 600, fontSize: 11 }}>{s.label}</Tag>;
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 90,
      align: 'center',
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleOpenDetail(r)}
        >
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb Navigation (Figma 12) */}
      <Breadcrumb
        items={[
          { title: <a href="/">Beranda</a> },
          { title: 'Tata Kelola & Sistem' },
          { title: 'Masukan & Laporan Kendala' },
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
            <CommentOutlined style={{ color: '#1677ff', fontSize: 22 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 20 }}>
              Pusat Masukan & Laporan Kendala (Feedback)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Kelola tiket masukan pengguna, laporan kendala teknis (bug report), dan usulan perbaikan sistem NusaProc.
            </Text>
          </div>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchFeedbacks}>
            Muat Ulang
          </Button>
        </Space>
      </div>

      {/* Status Filter Tabs (Figma 12) */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          setCurrentPage(1);
        }}
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
              placeholder="Cari deskripsi, judul, nama pengirim..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 280 }}
              allowClear
            />

            <Select
              placeholder="Filter Kategori"
              allowClear
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                setCurrentPage(1);
              }}
              style={{ width: 170 }}
            >
              <Select.Option value="BUG">🐛 Bug / Kendala</Select.Option>
              <Select.Option value="FEATURE_REQUEST">💡 Usulan Fitur</Select.Option>
              <Select.Option value="FEEDBACK">💬 Masukan Umum</Select.Option>
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

      {/* Main Feedback Table */}
      <Card styles={{ body: { padding: 0 } }} style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        <Table<FeedbackItem>
          rowKey="id"
          columns={columns}
          dataSource={feedbacks}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (totalCount, range) => `Menampilkan ${range[0]} - ${range[1]} dari total ${totalCount} masukan`,
            onChange: (p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            },
          }}
        />
      </Card>

      {/* Detail & Status Update Modal */}
      <Modal
        title={
          <Space>
            <CommentOutlined style={{ color: token.colorPrimary }} />
            <span>Detail Masukan & Laporan Pengguna</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={750}
      >
        {selectedFeedback && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Pengirim">
                {selectedFeedback.userFullName || 'Pengguna'} ({selectedFeedback.userEmail || '-'})
              </Descriptions.Item>
              <Descriptions.Item label="Peran Aktif">
                <Tag color="purple">{selectedFeedback.activeRole}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Kategori">
                <Tag color={CATEGORY_TAGS[selectedFeedback.category]?.color}>
                  {CATEGORY_TAGS[selectedFeedback.category]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Urgensi">
                <Tag color={URGENCY_TAGS[selectedFeedback.urgency]?.color}>
                  {URGENCY_TAGS[selectedFeedback.urgency]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Halaman Pelaporan" span={2}>
                <code>{selectedFeedback.pageUrl}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Waktu Dikirim" span={2}>
                {formatDateTime(selectedFeedback.createdAt)}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {selectedFeedback.title || 'Deskripsi Masukan / Kendala:'}
              </Text>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '10px 14px',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  fontSize: 13,
                }}
              >
                {selectedFeedback.description}
              </div>
            </div>

            {selectedFeedback.screenshotData && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  Tangkapan Layar (Screenshot Browser):
                </Text>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  <Image
                    src={selectedFeedback.screenshotData}
                    alt="Screenshot Lengkap"
                    style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {selectedFeedback.systemInfo && (
              <div style={{ marginBottom: 20 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  Informasi Sistem & Perangkat Klien:
                </Text>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Resolusi Layar">
                    {String(selectedFeedback.systemInfo.screenWidth ?? '-')} × {String(selectedFeedback.systemInfo.screenHeight ?? '-')} px
                  </Descriptions.Item>
                  <Descriptions.Item label="Platform / OS">
                    {String(selectedFeedback.systemInfo.platform ?? '-')}
                  </Descriptions.Item>
                  <Descriptions.Item label="User Agent" span={2}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {String(selectedFeedback.systemInfo.userAgent ?? '-')}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* Admin Triage & Status Update Form */}
            <Card
              size="small"
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: token.colorPrimary }} />
                  <span>Tindak Lanjut & Triage Administrator</span>
                </Space>
              }
              style={{ background: '#f0f5ff', borderColor: '#adc6ff' }}
            >
              <Form
                form={statusForm}
                layout="vertical"
                onFinish={handleUpdateStatus}
                initialValues={{
                  status: selectedFeedback.status,
                  adminNotes: selectedFeedback.adminNotes || '',
                }}
              >
                <Form.Item
                  name="status"
                  label="Perbarui Status Tiket"
                  rules={[{ required: true, message: 'Status wajib dipilih' }]}
                >
                  <Select>
                    <Select.Option value="OPEN">Terbuka (Open)</Select.Option>
                    <Select.Option value="IN_PROGRESS">Sedang Diproses (In Progress)</Select.Option>
                    <Select.Option value="RESOLVED">Selesai Ditangani (Resolved)</Select.Option>
                    <Select.Option value="CLOSED">Ditutup (Closed)</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="adminNotes" label="Catatan Penanganan / Catatan Admin">
                  <TextArea
                    rows={3}
                    placeholder="Tuliskan catatan tindak lanjut, referensi commit bugfix, atau alasan penutupan tiket..."
                  />
                </Form.Item>

                <div style={{ textAlign: 'right' }}>
                  <Space>
                    <Button onClick={() => setIsModalOpen(false)}>Batal</Button>
                    <Button type="primary" htmlType="submit" loading={isUpdating}>
                      Simpan Perubahan Status
                    </Button>
                  </Space>
                </div>
              </Form>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminFeedbackPage;
