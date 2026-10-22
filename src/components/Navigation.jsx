import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutGrid,
  Tv,
  MonitorCheck,
  Volume2,
  VolumeX,
  UserCheck,
  Brain,
  Sparkles,
  LogOut,
  User,
  ShieldCheck
} from 'lucide-react';

// Full tab registry — role filtering applied below
const ALL_TABS = {
  landing: { icon: LayoutGrid, label: 'Directory' },
  display: { icon: Tv, label: 'TV Display' },
  frontdesk: { icon: UserCheck, label: 'Front Desk' },
  staff: { icon: MonitorCheck, label: 'Staff Console' },
  admin: { icon: Brain, label: 'Admin & AI Studio', superLabel: 'Super Admin', superIcon: ShieldCheck },
};

// Which tabs each role may see in the nav bar
const ROLE_NAV_TABS = {
  CUSTOMER: ['landing', 'display'],
  STAFF: ['staff', 'display'],
  FRONT_DESK: ['frontdesk', 'display'],
  ORG_ADMIN: ['admin', 'display'],
  SUPER_ADMIN: ['admin', 'display'],
};

export default function Navigation() {
  const {
    currentView,
    setCurrentView,
    soundEnabled,
    toggleSound,
    sseConnected,
    currentOrg,
    allOrganizations,
    setCurrentOrg
  } = useApp();

  const { authUser, logout, isAuthenticated } = useAuth();

  // Determine which tabs to show
  const role = authUser?.role;
  const allowedTabs = role ? (ROLE_NAV_TABS[role] || []) : [];
  const visibleTabs = allowedTabs.filter(v => ALL_TABS[v]);

  // Show org selector only for roles that need it
  const showOrgSelector = role && ['STAFF', 'FRONT_DESK', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(role);

  const handleLogout = async () => {
    await logout();
    setCurrentView('login-customer');
  };

  // If not authenticated yet, show minimal brand-only header
  const isLoginPage = currentView?.startsWith('login-');

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(255, 255, 255, 0.94)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderBottom: '1px solid #e9d5ff',
      boxShadow: '0 2px 12px rgba(124, 58, 237, 0.05)',
      padding: '0 20px'
    }}>
      <div style={{
        maxWidth: 1440,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 62,
        gap: 12
      }}>

        {/* Brand */}
        <div
          onClick={() => {
            if (!isAuthenticated) return;
            // Navigate to role's home on logo click
            if (role === 'CUSTOMER') setCurrentView('landing');
            else if (role === 'STAFF') setCurrentView('staff');
            else if (role === 'FRONT_DESK') setCurrentView('frontdesk');
            else if (role === 'ORG_ADMIN' || role === 'SUPER_ADMIN') setCurrentView('admin');
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: isAuthenticated ? 'pointer' : 'default',
            userSelect: 'none', flexShrink: 0
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(124, 58, 237, 0.3)'
          }}>
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.03em', lineHeight: 1 }}>
              Queueless
            </div>
            <div style={{ fontSize: '0.675rem', color: '#7c3aed', fontWeight: 700, letterSpacing: '0.04em', marginTop: 2 }}>
              AI RANDOM FOREST QUEUE
            </div>
          </div>
        </div>

        {/* Nav Tabs — only when authenticated */}
        {isAuthenticated && !isLoginPage && (
          <nav style={{ display: 'flex', alignItems: 'stretch', gap: 4, height: '100%', overflowX: 'auto', flex: 1, justifyContent: 'center' }}>
            {visibleTabs.map(view => {
              const cfg = ALL_TABS[view];
              const Icon = (role === 'SUPER_ADMIN' && cfg.superIcon) ? cfg.superIcon : cfg.icon;
              const label = (role === 'SUPER_ADMIN' && cfg.superLabel) ? cfg.superLabel : cfg.label;
              const isActive = currentView === view;
              return (
                <button
                  key={view}
                  onClick={() => setCurrentView(view)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '0 15px',
                    background: isActive ? '#f5f0fd' : 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #7c3aed' : '3px solid transparent',
                    color: isActive ? '#6d28d9' : '#6b6684',
                    fontFamily: 'var(--font-heading)', fontSize: '0.85rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 160ms ease',
                    borderRadius: '8px 8px 0 0',
                  }}
                >
                  <Icon size={15} color={isActive ? '#7c3aed' : '#7c779a'} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

          {/* SSE Live Status Pill — only when authenticated */}
          {isAuthenticated && !isLoginPage && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999,
              background: sseConnected ? '#f3e8ff' : '#fee2e2',
              border: `1px solid ${sseConnected ? '#d8b4fe' : '#fca5a5'}`,
              fontSize: '0.7rem', fontWeight: 800,
              color: sseConnected ? '#6b21a8' : '#991b1b',
              letterSpacing: '0.03em',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sseConnected ? '#7c3aed' : '#ef4444', display: 'block' }} />
              {sseConnected ? 'LIVE AI' : 'OFFLINE'}
            </div>
          )}

          {/* Org Selector — only for staff roles */}
          {isAuthenticated && showOrgSelector && allOrganizations.length > 0 && (
            <select
              value={currentOrg?.id || ''}
              onChange={e => {
                const sel = allOrganizations.find(o => o.id === e.target.value);
                if (sel) setCurrentOrg(sel);
              }}
              className="select"
              style={{
                padding: '6px 12px', fontSize: '0.8rem',
                width: 'auto', minWidth: 155,
                background: '#ffffff', borderColor: '#e9d5ff',
                color: '#3b2063', fontWeight: 600
              }}
            >
              {allOrganizations.map(o => (
                <option key={o.id} value={o.id}>
                  {o.type === 'HOSPITAL' ? '🏥' : o.type === 'BANK' ? '🏦' : '🏢'} {o.name}
                </option>
              ))}
            </select>
          )}

          {/* Sound Toggle — only when authenticated */}
          {isAuthenticated && !isLoginPage && (
            <button
              onClick={toggleSound}
              className="btn btn-outline btn-sm"
              title={soundEnabled ? 'Mute chimes' : 'Enable chimes'}
              style={{ padding: '7px 10px', color: soundEnabled ? '#7c3aed' : '#9ca3af', borderColor: '#e9d5ff' }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}

          {/* User pill + Logout — only when authenticated */}
          {isAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '5px 12px', borderRadius: 999,
                background: '#f5f0fd', border: '1px solid #ddd6fe',
                fontSize: '0.78rem', fontWeight: 700, color: '#581c87'
              }}>
                <User size={13} color="#7c3aed" />
                <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {authUser?.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                id="logout-btn"
                title="Log out"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 8,
                  background: '#fff1f2', border: '1px solid #fecdd3',
                  color: '#be123c', fontFamily: 'var(--font-heading)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.target.style.background = '#ffe4e6'; }}
                onMouseLeave={e => { e.target.style.background = '#fff1f2'; }}
              >
                <LogOut size={13} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
