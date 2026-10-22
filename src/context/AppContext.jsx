import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api.js';
import { soundService } from '../utils/audio.js';

const AppContext = createContext(null);

function parseLocation() {
  const pathname = (window.location.pathname || '').replace(/\/+$/, '') || '/';
  const hash = (window.location.hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
  const target = hash || pathname;

  if (target === '/login/super-admin' || target === 'login/super-admin' || target === 'login-superadmin') {
    return { view: 'login-superadmin' };
  }
  if (target === '/login/org-admin' || target === 'login/org-admin' || target === 'login-orgadmin') {
    return { view: 'login-orgadmin' };
  }
  if (target === '/login/front-desk' || target === 'login/front-desk' || target === 'login-frontdesk') {
    return { view: 'login-frontdesk' };
  }
  if (target === '/login/staff' || target === 'login/staff' || target === 'login-staff') {
    return { view: 'login-staff' };
  }
  if (target === '/login/customer' || target === 'login/customer' || target === 'login-customer') {
    return { view: 'login-customer' };
  }
  if (target.startsWith('track/') || target.startsWith('/track/')) {
    const code = target.replace(/^\/?track\//, '');
    return { view: 'track', trackingCode: code };
  }
  if (target.startsWith('display/') || target.startsWith('/display/')) {
    const sId = target.replace(/^\/?display\//, '');
    return { view: 'display', displayServiceId: sId };
  }
  if (target === '/staff' || target === 'staff') {
    return { view: 'staff' };
  }
  if (target === '/front-desk' || target === 'front-desk' || target === '/frontdesk' || target === 'frontdesk') {
    return { view: 'frontdesk' };
  }
  if (target === '/admin' || target === 'admin') {
    return { view: 'admin' };
  }
  if (target === '/display' || target === 'display') {
    return { view: 'display' };
  }
  if (target === '/acceptance-suite' || target === 'acceptance-suite') {
    return { view: 'acceptance-suite' };
  }
  if (target === '/customer' || target === 'customer') {
    return { view: 'landing' };
  }

  return { view: 'login-customer' };
}

function getPathForView(view, trackingCode, displayServiceId) {
  switch (view) {
    case 'login-customer':   return '/login/customer';
    case 'login-staff':      return '/login/staff';
    case 'login-frontdesk':  return '/login/front-desk';
    case 'login-orgadmin':   return '/login/org-admin';
    case 'login-superadmin': return '/login/super-admin';
    case 'staff':            return '/staff';
    case 'frontdesk':        return '/front-desk';
    case 'admin':            return '/admin';
    case 'display':          return displayServiceId ? `/display/${displayServiceId}` : '/display';
    case 'track':            return trackingCode ? `/track/${trackingCode}` : '/track';
    case 'acceptance-suite': return '/acceptance-suite';
    case 'landing':          return '/';
    default:                 return '/';
  }
}

export function AppProvider({ children }) {
  const initial = parseLocation();
  // Navigation & Routing State
  const [currentView, setCurrentView] = useState(initial.view);
  const [trackingCode, setTrackingCode] = useState(initial.trackingCode || '');
  const [activeDisplayServiceId, setActiveDisplayServiceId] = useState(initial.displayServiceId || '');

  // Organization & Sector Data
  const [sectors, setSectors] = useState({});
  const [allOrganizations, setAllOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [currentSector, setCurrentSector] = useState('ALL');

  // ── currentUser is now driven by AuthContext (set via setCurrentUser after login)
  // We keep a local state here so existing views (StaffConsoleView, FrontDeskView, etc.)
  // that call useApp().currentUser continue to work without modification.
  const [currentUser, setCurrentUser] = useState(null);

  // Audio & Real-time State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [liveEventCounter, setLiveEventCounter] = useState(0);

  // Modals
  const [joinModalService, setJoinModalService] = useState(null);
  const [tokenSlipData, setTokenSlipData] = useState(null);

  // Toast Notification System
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString();
    const newToast = { id, ...toast };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 4500);
  }, []);

  // Fetch initial sectors and organizations
  const loadSectors = useCallback(async () => {
    try {
      const data = await api.getSectors();
      setSectors(data.sectors || {});
      setAllOrganizations(data.allOrganizations || []);
      if (!currentOrg && data.allOrganizations?.length > 0) {
        setCurrentOrg(data.allOrganizations[0]);
      }
    } catch (err) {
      console.error('Failed to load sectors:', err);
    }
  }, [currentOrg]);

  useEffect(() => {
    loadSectors();
  }, [loadSectors]);

  // Keep browser URL synchronized with current view
  useEffect(() => {
    const targetPath = getPathForView(currentView, trackingCode, activeDisplayServiceId);
    if (window.location.pathname !== targetPath && !window.location.hash) {
      window.history.pushState({ view: currentView }, '', targetPath);
    }
  }, [currentView, trackingCode, activeDisplayServiceId]);

  // Handle browser back/forward and hash navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const loc = parseLocation();
      if (loc.view) setCurrentView(loc.view);
      if (loc.trackingCode) setTrackingCode(loc.trackingCode);
      if (loc.displayServiceId) setActiveDisplayServiceId(loc.displayServiceId);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Set up Server-Sent Events (SSE) for Real-Time < 2s updates
  useEffect(() => {
    let evtSource = null;
    try {
      evtSource = new EventSource('/api/events');
      evtSource.onopen = () => {
        setSseConnected(true);
      };
      evtSource.addEventListener('queue-update', (event) => {
        setLiveEventCounter((c) => c + 1);
        try {
          const payload = JSON.parse(event.data);
          if (payload.action === 'CALLED_NEXT' || payload.action === 'RECALL') {
            soundService.playChime();
          }
        } catch (_) {}
      });
      evtSource.onerror = () => {
        setSseConnected(false);
      };
    } catch (err) {
      console.warn('SSE connection error:', err);
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, []);

  const toggleSound = () => {
    const next = soundService.toggleSound();
    setSoundEnabled(next);
    addToast({
      type: 'info',
      title: next ? 'Audio Sound On' : 'Audio Muted',
      message: next ? 'Chimes and voice announcements are active.' : 'Chimes and announcements are muted.'
    });
  };

  const navigateToTrack = (code) => {
    setTrackingCode(code);
    setCurrentView('track');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToDisplay = (serviceId) => {
    setActiveDisplayServiceId(serviceId);
    setCurrentView('display');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const value = {
    currentView,
    setCurrentView,
    trackingCode,
    setTrackingCode,
    navigateToTrack,
    activeDisplayServiceId,
    setActiveDisplayServiceId,
    navigateToDisplay,

    sectors,
    allOrganizations,
    currentOrg,
    setCurrentOrg,
    currentSector,
    setCurrentSector,
    loadSectors,

    // currentUser is kept for backward-compat with existing views
    currentUser,
    setCurrentUser,

    soundEnabled,
    toggleSound,
    sseConnected,
    liveEventCounter,

    joinModalService,
    openJoinModal: (service) => setJoinModalService(service),
    closeJoinModal: () => setJoinModalService(null),

    tokenSlipData,
    openTokenSlip: (slip) => setTokenSlipData(slip),
    closeTokenSlip: () => setTokenSlipData(null),

    toasts,
    addToast
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
