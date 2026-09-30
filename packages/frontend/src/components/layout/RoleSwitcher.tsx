import React, { useState } from 'react';
import {
  Dropdown,
  Space,
  Avatar,
  Typography,
  Modal,
  Button,
  Divider,
  theme,
  App,
} from 'antd';
import {
  DownOutlined,
  CheckOutlined,
  LogoutOutlined,
  SwapOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  BankOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { switchRole } from '../../api/endpoints/auth';
import type { AppRole } from '@nusaproc/shared';

const { Text, Title } = Typography;

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Administrator Sistem',
  AUDITOR: 'Auditor Internal',
  REQUESTER: 'Pemohon',
  APPROVER: 'Approver / Penyetuju',
  ACCOUNT_PAYABLE: 'Account Payable',
  WAREHOUSE: 'Staf Gudang',
  FINANCE: 'Finance & Keuangan',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  ADMIN: 'Kelola pengguna, cabang, dan sistem',
  AUDITOR: 'Lihat dan unduh catatan audit',
  REQUESTER: 'Ajukan permintaan pembelian (PR)',
  APPROVER: 'Tinjau & setujui pengajuan PR dan PO',
  ACCOUNT_PAYABLE: 'Verifikasi tagihan & kelola matching',
  WAREHOUSE: 'Penerimaan fisik barang & BAST di gudang',
  FINANCE: 'Pemeriksaan & persetujuan pembayaran',
};

const getRoleIcon = (role: AppRole) => {
  switch (role) {
    case 'ADMIN':
      return <SafetyCertificateOutlined style={{ fontSize: 16, color: '#1677ff' }} />;
    case 'AUDITOR':
      return <AuditOutlined style={{ fontSize: 16, color: '#722ed1' }} />;
    case 'REQUESTER':
      return <FileTextOutlined style={{ fontSize: 16, color: '#52c41a' }} />;
    case 'APPROVER':
      return <CheckCircleOutlined style={{ fontSize: 16, color: '#13c2c2' }} />;
    case 'ACCOUNT_PAYABLE':
      return <DollarOutlined style={{ fontSize: 16, color: '#fa8c16' }} />;
    case 'WAREHOUSE':
      return <InboxOutlined style={{ fontSize: 16, color: '#faad14' }} />;
    case 'FINANCE':
      return <BankOutlined style={{ fontSize: 16, color: '#2f54eb' }} />;
    default:
      return <SafetyCertificateOutlined style={{ fontSize: 16, color: '#1677ff' }} />;
  }
};

const getInitials = (name?: string): string => {
  if (!name) return 'NP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const RoleSwitcher: React.FC = () => {
  const { token } = theme.useToken();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const { user, setActiveRole, setToken, logout } = useAuthStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [pendingTargetRole, setPendingTargetRole] = useState<AppRole | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const userRoles = (user?.roles || ['REQUESTER']) as AppRole[];
  const activeRole = (user?.activeRole || 'REQUESTER') as AppRole;

  const initials = getInitials(user?.fullName);

  const handleRoleItemClick = (role: AppRole) => {
    if (role === activeRole) {
      setDropdownOpen(false);
      return;
    }
    setPendingTargetRole(role);
    setDropdownOpen(false);
    setRoleModalOpen(true);
  };

  const handleConfirmRoleSwitch = async () => {
    if (!pendingTargetRole) return;
    setSwitchingRole(true);
    try {
      setActiveRole(pendingTargetRole);
      const res = await switchRole(pendingTargetRole);
      if (res.token) {
        setToken(res.token);
      }
      notification.success({
        message: 'Peran Berhasil Dialihkan',
        description: `Anda sekarang bertindak sebagai ${ROLE_LABELS[pendingTargetRole] || pendingTargetRole}.`,
      });
      setRoleModalOpen(false);
      setPendingTargetRole(null);
      navigate('/dashboard');
    } catch (err: any) {
      console.warn('Failed to switch role token on server:', err);
      // Still allow local switch in case of network issue
      setRoleModalOpen(false);
      setPendingTargetRole(null);
      navigate('/dashboard');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleConfirmLogout = () => {
    setLogoutModalOpen(false);
    logout();
    navigate('/login');
  };

  // Custom Dropdown Content matching Figma 01c
  const menuContent = (
    <div
      style={{
        width: 320,
        backgroundColor: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        padding: '16px 12px 12px',
      }}
    >
      {/* User Header Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 12px' }}>
        <Avatar
          size={42}
          style={{
            backgroundColor: token.colorPrimary,
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {initials}
        </Avatar>
        <div style={{ overflow: 'hidden' }}>
          <Text strong style={{ fontSize: 14, display: 'block', lineHeight: 1.3 }} ellipsis>
            {user?.fullName || 'Pengguna NusaProc'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }} ellipsis>
            {user?.email || 'user@nusa.id'}
          </Text>
        </div>
      </div>

      <Divider style={{ margin: '4px 0 8px' }} />

      {/* Role Selection Section Header */}
      <div
        style={{
          padding: '6px 8px',
          fontSize: 11,
          fontWeight: 700,
          color: token.colorTextSecondary,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        Masuk Sebagai
      </div>

      {/* List of Roles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {userRoles.map((role) => {
          const isActive = role === activeRole;
          return (
            <div
              key={role}
              onClick={() => handleRoleItemClick(role)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                background: isActive ? '#f0f7ff' : 'transparent',
                transition: 'all 0.15s ease-in-out',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: isActive ? '#e6f4ff' : '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {getRoleIcon(role)}
                </div>
                <div>
                  <Text strong style={{ fontSize: 13, color: isActive ? token.colorPrimary : '#262626', display: 'block' }}>
                    {ROLE_LABELS[role] || role}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {ROLE_DESCRIPTIONS[role] || 'Akses peran NusaProc'}
                  </Text>
                </div>
              </div>
              {isActive && <CheckOutlined style={{ color: token.colorPrimary, fontSize: 15 }} />}
            </div>
          );
        })}
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* Logout Action */}
      <div
        onClick={() => {
          setDropdownOpen(false);
          setLogoutModalOpen(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 8,
          cursor: 'pointer',
          color: token.colorError,
          transition: 'all 0.15s ease-in-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#fff1f0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <LogoutOutlined style={{ fontSize: 16 }} />
        <Text strong style={{ color: token.colorError, fontSize: 13 }}>
          Keluar
        </Text>
      </div>
    </div>
  );

  return (
    <>
      {/* Top Navbar Profile Chip Trigger */}
      <Dropdown
        dropdownRender={() => menuContent}
        trigger={['click']}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        placement="bottomRight"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.12)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
          }}
        >
          <Avatar
            size={34}
            style={{
              backgroundColor: '#fff',
              color: token.colorPrimary,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {initials}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {user?.fullName || 'Pengguna NusaProc'}
            </Text>
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 11 }}>
              {ROLE_LABELS[activeRole] || activeRole}
            </Text>
          </div>
          <DownOutlined style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 10, marginLeft: 2 }} />
        </div>
      </Dropdown>

      {/* Confirmation Modal: Ganti Peran (Figma 01d) */}
      <Modal
        open={roleModalOpen}
        onCancel={() => {
          setRoleModalOpen(false);
          setPendingTargetRole(null);
        }}
        footer={null}
        width={420}
        destroyOnClose
        centered
      >
        <div style={{ textAlign: 'left', padding: '8px 4px 4px' }}>
          {/* Blue Circular Swap Icon */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <SwapOutlined style={{ color: token.colorPrimary, fontSize: 20 }} />
          </div>

          <Title level={4} style={{ margin: '0 0 8px', fontSize: 18 }}>
            Ganti peran ke {pendingTargetRole ? ROLE_LABELS[pendingTargetRole] : ''}?
          </Title>

          <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5, display: 'block', marginBottom: 20 }}>
            Menu dan data yang tampil akan menyesuaikan akses {pendingTargetRole ? ROLE_LABELS[pendingTargetRole] : ''}. Pekerjaan yang belum disimpan di halaman ini akan hilang.
          </Text>

          {/* Comparison Card (Figma 01d) */}
          <div
            style={{
              backgroundColor: '#f5f7fa',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}
          >
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
                Peran saat ini
              </Text>
              <Text strong style={{ fontSize: 13 }}>
                {ROLE_LABELS[activeRole] || activeRole}
              </Text>
            </div>
            <ArrowRightOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
                Peran baru
              </Text>
              <Text strong style={{ fontSize: 13, color: token.colorPrimary }}>
                {pendingTargetRole ? ROLE_LABELS[pendingTargetRole] : ''}
              </Text>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              onClick={() => {
                setRoleModalOpen(false);
                setPendingTargetRole(null);
              }}
            >
              Batal
            </Button>
            <Button
              type="primary"
              loading={switchingRole}
              onClick={handleConfirmRoleSwitch}
            >
              Ganti peran
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal: Keluar / Logout (Figma 01e) */}
      <Modal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        footer={null}
        width={420}
        destroyOnClose
        centered
      >
        <div style={{ textAlign: 'left', padding: '8px 4px 4px' }}>
          {/* Red Circular Logout Icon */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: '#fff1f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <LogoutOutlined style={{ color: token.colorError, fontSize: 20 }} />
          </div>

          <Title level={4} style={{ margin: '0 0 8px', fontSize: 18 }}>
            Keluar dari NusaProc?
          </Title>

          <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5, display: 'block', marginBottom: 24 }}>
            Anda perlu masuk kembali dengan Google SSO atau kata sandi untuk melanjutkan. Pastikan pekerjaan sudah disimpan sebelum keluar.
          </Text>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setLogoutModalOpen(false)}>
              Batal
            </Button>
            <Button
              danger
              type="primary"
              onClick={handleConfirmLogout}
            >
              Keluar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
