import React, { useState } from 'react';
import { Layout, Menu, Typography, Grid, theme, Drawer, Button, Input, Tooltip, Badge } from 'antd';
import {
  MenuOutlined,
  SearchOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { RoleSwitcher } from './RoleSwitcher';
import { getNavigationMenuItemsForRole, getGroupedNavigationMenuItems } from './navigation';
import { FeedbackWidget } from '../feedback/FeedbackWidget';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { AuditorWatermark } from '../security/AuditorWatermark';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export const AppLayout: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const { user, isAuthenticated } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // If user is not authenticated and not present in store, redirect to /login
  if (!isAuthenticated && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const activeRole = user?.activeRole || 'REQUESTER';
  const menuItems = getNavigationMenuItemsForRole(activeRole);
  const groupedMenuItems = getGroupedNavigationMenuItems(activeRole);

  const isMobile = !screens.md;

  const getSelectedMenuKeys = (pathname: string): string[] => {
    // 1. Exact match in current role's menu items
    if (menuItems.some((item) => item?.key === pathname)) {
      return [pathname];
    }
    // 2. Hierarchical prefix matches for sub-routes
    if (pathname.startsWith('/approvals/pr')) return ['/approvals/pr'];
    if (pathname.startsWith('/approvals/po')) return ['/approvals/po'];
    if (pathname.startsWith('/pr')) return ['/pr'];
    if (pathname.startsWith('/po')) return ['/po'];
    if (pathname.startsWith('/vendors')) return ['/vendors'];
    if (pathname.startsWith('/receipts')) return ['/receipts'];
    if (pathname.startsWith('/invoices')) return ['/invoices'];
    if (pathname.startsWith('/ncr')) return ['/ncr'];
    if (pathname.startsWith('/payments')) return ['/payments'];
    if (pathname.startsWith('/audit')) return ['/audit'];
    if (pathname.startsWith('/admin/users')) return ['/admin/users'];
    if (pathname.startsWith('/admin/organization')) return ['/admin/organization'];
    if (pathname.startsWith('/admin/feedback')) return ['/admin/feedback'];

    return [pathname];
  };

  const handleGlobalSearch = () => {
    const q = globalSearch.trim().toUpperCase();
    if (!q) return;

    if (q.startsWith('PO-') || q.includes('PO')) {
      navigate(`/po?search=${encodeURIComponent(globalSearch.trim())}`);
    } else if (q.startsWith('PR-') || q.includes('PR')) {
      navigate(`/pr?search=${encodeURIComponent(globalSearch.trim())}`);
    } else if (q.startsWith('BAST-') || q.startsWith('GR-')) {
      navigate(`/receipts?search=${encodeURIComponent(globalSearch.trim())}`);
    } else if (q.startsWith('NCR-')) {
      navigate(`/ncr?search=${encodeURIComponent(globalSearch.trim())}`);
    } else if (q.startsWith('INV-')) {
      navigate(`/invoices?search=${encodeURIComponent(globalSearch.trim())}`);
    } else {
      navigate(`/po?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Top Navbar Header matching Figma 01 Dashboard */}
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
          background: '#0052cc', // Figma primary deep blue
          height: 64,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
        }}
      >
        {/* Left: Hamburger (mobile) & Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <Button
              type="text"
              aria-label="Buka Menu Navigasi"
              icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
              onClick={() => setMobileDrawerOpen(true)}
              style={{ padding: 4 }}
            />
          )}
          <div
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {/* Dot / Circuit Logo Icon */}
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                border: '3px solid #fff',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                }}
              />
            </div>
            <Title
              level={4}
              style={{
                color: '#fff',
                margin: 0,
                letterSpacing: -0.5,
                fontWeight: 700,
                fontSize: isMobile ? 18 : 21,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              nusaproc
            </Title>
          </div>
        </div>

        {/* Center: Global Search Bar (Figma 01 Dashboard) */}
        {!isMobile && (
          <div style={{ flex: 1, maxWidth: 440, margin: '0 24px' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#8c8c8c', marginRight: 6 }} />}
              placeholder="Cari nomor PR, PO, vendor, atau BAST..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onPressEnter={handleGlobalSearch}
              style={{
                borderRadius: 8,
                background: '#f5f7fa',
                border: 'none',
                height: 38,
                fontSize: 13,
              }}
              allowClear
            />
          </div>
        )}

        {/* Right: Notifications & User Profile Menu Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tooltip title="Notifikasi & Peringatan SLA">
            <Badge dot={false}>
              <Button
                type="text"
                shape="circle"
                icon={<BellOutlined style={{ color: '#fff', fontSize: 18 }} />}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                }}
              />
            </Badge>
          </Tooltip>

          <RoleSwitcher />
        </div>
      </Header>

      <Layout>
        {/* Desktop Sidebar Sider (Figma 01 & 01b) */}
        {!isMobile && (
          <Sider
            width={240}
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
            theme="light"
            breakpoint="lg"
            collapsedWidth={72}
            trigger={null} // custom toggle footer
            style={{
              overflow: 'hidden',
              height: 'calc(100vh - 64px)',
              position: 'sticky',
              top: 64,
              left: 0,
              borderRight: '1px solid #e8e8e8',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#fff',
            }}
          >
            {/* Scrollable Menu Items */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
              <Menu
                mode="inline"
                selectedKeys={getSelectedMenuKeys(location.pathname)}
                items={groupedMenuItems}
                onClick={({ key }) => navigate(key)}
                style={{ borderRight: 0, paddingTop: 8 }}
              />
            </div>

            {/* Custom Sider Footer: Ciutkan Menu (Figma 01 & 01b) */}
            <div
              style={{
                borderTop: '1px solid #f0f0f0',
                padding: '10px 12px',
                backgroundColor: '#fff',
              }}
            >
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  width: '100%',
                  textAlign: collapsed ? 'center' : 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: token.colorTextSecondary,
                }}
              >
                {!collapsed && <span>Ciutkan menu</span>}
              </Button>
            </div>
          </Sider>
        )}

        {/* Content Area */}
        <Layout style={{ padding: isMobile ? '12px' : '20px 24px', backgroundColor: '#f5f7fa' }}>
          <Content
            style={{
              background: '#fff',
              padding: isMobile ? 16 : 24,
              margin: 0,
              minHeight: 280,
              borderRadius: 10,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <AuditorWatermark>
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </AuditorWatermark>
          </Content>
        </Layout>
      </Layout>

      {/* Drawer Menu Navigasi Mobile (R56, Resolusi Ponsel >= 360px) */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: `2px solid ${token.colorPrimary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: token.colorPrimary,
                }}
              />
            </div>
            <Title level={4} style={{ margin: 0, color: token.colorPrimary }}>
              {import.meta.env.VITE_APP_NAME || 'NusaProc'}
            </Title>
          </div>
        }
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        bodyStyle={{ padding: 0 }}
        width={280}
      >
        <Menu
          mode="inline"
          selectedKeys={getSelectedMenuKeys(location.pathname)}
          items={groupedMenuItems}
          onClick={({ key }) => {
            navigate(key);
            setMobileDrawerOpen(false);
          }}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Drawer>

      {/* Floating Feedback Action Button */}
      <FeedbackWidget />
    </Layout>
  );
};

export default AppLayout;
