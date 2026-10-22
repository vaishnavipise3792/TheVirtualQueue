import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { AuthProvider, useAuth, ROLE_DEFAULT_VIEW, ROLE_ALLOWED_VIEWS } from './context/AuthContext.jsx';
import Navigation from './components/Navigation.jsx';
import NotificationToast from './components/NotificationToast.jsx';
import JoinQueueModal from './components/JoinQueueModal.jsx';
import TokenSlipModal from './components/TokenSlipModal.jsx';

// Views — existing (unchanged)
import CustomerHomeView from './views/CustomerHomeView.jsx';
import CustomerTrackView from './views/CustomerTrackView.jsx';
import DisplayBoardView from './views/DisplayBoardView.jsx';
import FrontDeskView from './views/FrontDeskView.jsx';
import StaffConsoleView from './views/StaffConsoleView.jsx';
import OrgAdminView from './views/OrgAdminView.jsx';
import AcceptanceTestView from './views/AcceptanceTestView.jsx';

// Login views — new
import CustomerLoginView from './views/CustomerLoginView.jsx';
import StaffLoginView from './views/StaffLoginView.jsx';
import FrontDeskLoginView from './views/FrontDeskLoginView.jsx';
import OrgAdminLoginView from './views/OrgAdminLoginView.jsx';
import SuperAdminLoginView from './views/SuperAdminLoginView.jsx';

// Login view registry
const LOGIN_VIEWS = {
  'login-customer':   CustomerLoginView,
  'login-staff':      StaffLoginView,
  'login-frontdesk':  FrontDeskLoginView,
  'login-orgadmin':   OrgAdminLoginView,
  'login-superadmin': SuperAdminLoginView,
};

// Default login page per role (for "wrong route" redirects)
const ROLE_LOGIN_VIEW = {
  CUSTOMER:    'login-customer',
  STAFF:       'login-staff',
  FRONT_DESK:  'login-frontdesk',
  ORG_ADMIN:   'login-orgadmin',
  SUPER_ADMIN: 'login-superadmin',
};

function MainRouter() {
  const { currentView, setCurrentView, setCurrentUser } = useApp();
  const { authUser, authLoading, isAuthenticated } = useAuth();

  // Sync authUser → currentUser in AppContext so existing views keep working
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
    } else {
      setCurrentUser(null);
    }
  }, [authUser, setCurrentUser]);

  // Route protection: redirect unauthenticated users hitting protected views
  useEffect(() => {
    if (authLoading) return; // wait for session restore

    const isLoginView = Object.keys(LOGIN_VIEWS).includes(currentView);

    if (!isAuthenticated && !isLoginView) {
      // Not logged in, redirect to the corresponding login page based on attempted view
      const viewToLogin = {
        staff: 'login-staff',
        frontdesk: 'login-frontdesk',
        admin: 'login-orgadmin',
        landing: 'login-customer',
        track: 'login-customer',
      };
      setCurrentView(viewToLogin[currentView] || 'login-customer');
      return;
    }

    if (isAuthenticated) {
      const role = authUser.role;
      const allowed = ROLE_ALLOWED_VIEWS[role] || [];

      if (isLoginView) {
        // Already logged in, redirect to role's dashboard
        setCurrentView(ROLE_DEFAULT_VIEW[role] || 'landing');
        return;
      }

      // Check if current view is allowed for this role
      if (!allowed.includes(currentView)) {
        // Not allowed → redirect to role's default view
        setCurrentView(ROLE_DEFAULT_VIEW[role] || 'landing');
      }
    }
  }, [authLoading, isAuthenticated, currentView, authUser]);

  // While restoring session, show a minimal loading state (matching the existing design)
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
        fontFamily: 'var(--font-heading)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 6px 20px rgba(124,58,237,0.35)',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            <span style={{ color: '#fff', fontSize: 22 }}>✦</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e1b4b' }}>Queueless</div>
          <div style={{ fontSize: '0.8rem', color: '#7c3aed', marginTop: 4 }}>Restoring session…</div>
        </div>
      </div>
    );
  }

  // Render the active login view (no nav chrome)
  if (LOGIN_VIEWS[currentView]) {
    const LoginView = LOGIN_VIEWS[currentView];
    return (
      <>
        <Navigation />
        <LoginView />
      </>
    );
  }

  // Render the authenticated app shell
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />

      <main style={{ flex: 1 }}>
        {currentView === 'landing'    && <CustomerHomeView />}
        {currentView === 'track'      && <CustomerTrackView />}
        {currentView === 'display'    && <DisplayBoardView />}
        {currentView === 'frontdesk'  && <FrontDeskView />}
        {currentView === 'staff'      && <StaffConsoleView />}
        {currentView === 'admin'      && <OrgAdminView />}
        {currentView === 'acceptance-suite' && <AcceptanceTestView />}
      </main>

      {/* Global Modals & Notifications */}
      <JoinQueueModal />
      <TokenSlipModal />
      <NotificationToast />

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '24px 20px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        background: 'rgba(9, 13, 22, 0.95)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong>Queueless</strong> · Multi-sector Virtual Queue Platform (Hospital, Bank, Citizen Service Centre)
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>One Generic Queue Engine</span>
            <span>·</span>
            <span>Multi-Tenant Scoped</span>
            <span>·</span>
            <span>Atomic Token Locking</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainRouter />
      </AppProvider>
    </AuthProvider>
  );
}
