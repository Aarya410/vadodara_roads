/* ============================================================
   API Client — all HTTP calls to the FastAPI backend
   ============================================================ */

const API_BASE = '';   // same-origin when served by FastAPI

function getToken() { return localStorage.getItem('vmc_token'); }
function setToken(t) { localStorage.setItem('vmc_token', t); }
function clearToken() { localStorage.removeItem('vmc_token'); localStorage.removeItem('vmc_user'); }

function getUser() {
  try { return JSON.parse(localStorage.getItem('vmc_user') || 'null'); } catch { return null; }
}
function setUser(u) { localStorage.setItem('vmc_user', JSON.stringify(u)); }

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  console.log('API Request:', { path, method: opts.method, body: opts.body });
  const res = await fetch(API_BASE + path, { ...opts, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  let body;
  try { body = await res.json(); } catch { body = {}; }

  if (!res.ok) {
    const msg = body.detail || body.message || `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

const API = {
  // Auth
  login:         (email, password) => apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register:      (data) => apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me:            () => apiFetch('/api/auth/me'),
  updateProfile: (data) => apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  users:         () => apiFetch('/api/auth/users'),

  // Wards
  wardRisk:     () => apiFetch('/api/wards/risk'),
  wardRiskConstrained: () => apiFetch('/api/wards/risk/constrained'),
  wardDetail:   (no) => apiFetch(`/api/wards/risk/${no}`),
  wardsGeoJSON: () => apiFetch('/api/wards/geojson/wards'),
  roadsGeoJSON: () => apiFetch('/api/wards/geojson/roads'),
  hotspotsGeoJSON: () => apiFetch('/api/wards/geojson/hotspots'),

  // Reports
  listReports:  (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v !== null && v !== undefined)));
    return apiFetch(`/api/reports/?${q}`);
  },
  createReport: (data) => apiFetch('/api/reports/', { method: 'POST', body: JSON.stringify(data) }),
  updateReportStatus: (id, status) => apiFetch(`/api/reports/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' }),
  deleteReport: (id) => apiFetch(`/api/reports/${id}`, { method: 'DELETE' }),

  // Pipeline
  triggerPipeline: () => apiFetch('/api/pipeline/run', { method: 'POST' }),
  pipelineRuns:    () => apiFetch('/api/pipeline/runs'),
  pipelineRun:     (id) => apiFetch(`/api/pipeline/runs/${id}`),

  // Analytics
  summary: () => apiFetch('/api/analytics/summary'),

  // Resource Constraints (admin only)
  getResourceConstraints: () => apiFetch('/api/analytics/resource-constraints'),
  updateResourceConstraints: (data) => apiFetch('/api/analytics/resource-constraints', { method: 'POST', body: JSON.stringify(data) }),
};
