const BASE_URL = '/api';

// ─── Token storage ────────────────────────────────────────────────────────────
// Store token in sessionStorage so it's cleared when the browser tab closes,
// or in localStorage if "remember me" is selected.
export const tokenStore = {
  get: () => localStorage.getItem('ql_token') || sessionStorage.getItem('ql_token'),
  set: (token, persist = false) => {
    if (persist) {
      localStorage.setItem('ql_token', token);
    } else {
      sessionStorage.setItem('ql_token', token);
    }
  },
  clear: () => {
    localStorage.removeItem('ql_token');
    sessionStorage.removeItem('ql_token');
  }
};

export async function fetchJson(endpoint, options = {}) {
  const token = tokenStore.get();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => fetchJson('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  me: () => fetchJson('/auth/me'),
  logout: () => fetchJson('/auth/logout', { method: 'POST' }),

  // Public
  getSectors: () => fetchJson('/public/sectors'),
  getOrgDetails: (orgId) => fetchJson(`/public/org/${orgId}`),
  joinQueue: (data) => fetchJson('/public/join', { method: 'POST', body: JSON.stringify(data) }),
  getTracking: (code) => fetchJson(`/public/track/${code}`),
  cancelTracking: (code) => fetchJson(`/public/track/${code}/cancel`, { method: 'POST' }),
  getDisplayBoard: (serviceId) => fetchJson(`/public/display/${serviceId}`),

  // Staff
  getQueues: (orgId, serviceId, staffHeaders = {}) => {
    let url = `/staff/queues?organizationId=${orgId}`;
    if (serviceId) url += `&serviceId=${serviceId}`;
    return fetchJson(url, { headers: { 'x-organization-id': orgId, ...staffHeaders } });
  },
  callNext: (orgId, serviceId, counterId, staffHeaders = {}) => 
    fetchJson('/staff/call-next', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ serviceId, counterId })
    }),
  recall: (orgId, entryId, staffHeaders = {}) =>
    fetchJson('/staff/recall', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ entryId })
    }),
  startService: (orgId, entryId, staffHeaders = {}) =>
    fetchJson('/staff/start-service', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ entryId })
    }),
  complete: (orgId, entryId, staffHeaders = {}) =>
    fetchJson('/staff/complete', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ entryId })
    }),
  skip: (orgId, entryId, staffHeaders = {}) =>
    fetchJson('/staff/skip', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ entryId })
    }),
  noShow: (orgId, entryId, staffHeaders = {}) =>
    fetchJson('/staff/no-show', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ entryId })
    }),
  requeue: (orgId, entryId, staffHeaders = {}) =>
    fetchJson('/staff/requeue', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ entryId })
    }),
  changePriority: (orgId, entryId, newPriorityLevel, reason, staffHeaders = {}) =>
    fetchJson('/staff/change-priority', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify({ entryId, newPriorityLevel, reason })
    }),
  registerWalkin: (orgId, data, staffHeaders = {}) =>
    fetchJson('/staff/walkin', {
      method: 'POST',
      headers: { 'x-organization-id': orgId, ...staffHeaders },
      body: JSON.stringify(data)
    }),

  // Admin
  getAuditLogs: (orgId) => fetchJson(`/admin/audit-logs?organizationId=${orgId}`),
  getCounters: (orgId) => fetchJson(`/admin/counters?organizationId=${orgId}`),
  createCounter: (orgId, data) => fetchJson('/admin/counters', {
    method: 'POST',
    headers: { 'x-organization-id': orgId },
    body: JSON.stringify(data)
  }),
  getServices: (orgId) => fetchJson(`/admin/services?organizationId=${orgId}`),
  updateService: (orgId, serviceId, data) => fetchJson(`/admin/services/${serviceId}`, {
    method: 'PUT',
    headers: { 'x-organization-id': orgId },
    body: JSON.stringify(data)
  }),
  getAnalytics: (orgId) => fetchJson(`/admin/analytics?organizationId=${orgId}`),
  getStaffUsers: (orgId) => fetchJson(`/admin/staff?organizationId=${orgId}`),

  // Super Admin & AIML
  getSuperAdminOrgs: () => fetchJson('/superadmin/organizations'),
  createOrg: (data) => fetchJson('/superadmin/organizations', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  resetDemoDatabase: () => fetchJson('/superadmin/reset-demo', { method: 'POST' }),
  toggleMLService: (available) => fetchJson('/superadmin/toggle-ml', {
    method: 'POST',
    body: JSON.stringify({ available })
  }),
  getMLStatus: () => fetchJson('/ml/status'),
  simulateML: (data) => fetchJson('/ml/simulate', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  retrainML: () => fetchJson('/ml/retrain', { method: 'POST' })
};
