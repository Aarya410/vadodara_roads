/* ============================================================
   Main App Controller — routing, init, utilities
   ============================================================ */

let _currentPage = 'dashboard';
let _clockTimer  = null;
let _navState    = {};   // cross-page state (e.g., scrollToWard)

/* ── Initialisation ──────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  const user  = getUser();
  if (token && user) {
    initApp(user);
  } else {
    document.getElementById('auth-overlay').classList.remove('hidden');
  }
});

function initApp(user) {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  setUserUI(user);
  startClock();
  createToastContainer();
  navigate('dashboard');
  fetchBadge();
}

/* ── User UI ─────────────────────────────────────────────── */
function setUserUI(user) {
  const initials = (user.name || '?').split(' ').map(p => p[0]).join('').substring(0,2).toUpperCase();
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarRole = document.getElementById('sidebar-user-role');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarRole) sidebarRole.textContent = user.role;
  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  document.getElementById('topbar-user-name').textContent  = user.name;
  document.getElementById('topbar-avatar').textContent     = initials;

  // Hide pipeline trigger for viewers
  if (user.role === 'viewer') {
    document.querySelectorAll('[data-engineer-only]').forEach(el => el.remove());
  }
}

async function fetchBadge() {
  try {
    const summary = await API.summary();
    const badge = document.getElementById('open-badge');
    if (badge && summary.open_reports > 0) {
      badge.textContent = summary.open_reports;
    }
  } catch (_) {}
}

/* ── Clock ───────────────────────────────────────────────── */
function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById('topbar-time').textContent =
      now.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' });
  }
  tick();
  _clockTimer = setInterval(tick, 1000);
}

/* ── Sidebar toggle ──────────────────────────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

/* ── Navigation / Routing ────────────────────────────────── */
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  map:       'Ward Risk Map',
  planning:  'Priority Planning',
  budget:    'Budget & Labour',
  reports:   'Field Reports',
  settings:  'Settings',
};

const PAGE_RENDERERS = {
  dashboard: renderDashboard,
  map:       renderMap,
  planning:  renderPlanning,
  budget:    renderBudget,
  reports:   renderReports,
  settings:  renderSettings,
};

async function navigate(page) {
  _currentPage = page;
  if (page !== 'dashboard' && typeof destroyDashboardMap === 'function') {
    destroyDashboardMap();
  }

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;

  // Render page
  const container = document.getElementById('page-container');
  container.innerHTML = '';   // clear
  const div = document.createElement('div');
  div.id = `page-${page}`;
  div.className = 'page active';
  container.appendChild(div);

  const renderer = PAGE_RENDERERS[page];
  if (renderer) await renderer(div);

  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('mobile-open');
  }
}

/* ── Toast system ────────────────────────────────────────── */
function createToastContainer() {
  if (document.getElementById('toast-container')) return;
  const el = document.createElement('div');
  el.id = 'toast-container';
  document.body.appendChild(el);
}

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = (icons[type] || '') + `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = 'all .3s'; setTimeout(() => toast.remove(), 350); }, duration);
}

/* ── Helpers ─────────────────────────────────────────────── */
function priorityBadge(level) {
  const cls = (level || '').toLowerCase();
  return `<span class="badge badge-${cls}"><span class="badge-dot"></span>${level}</span>`;
}

function statusPill(status) {
  return `<span class="status-pill status-${(status||'').replace(' ','_')}">${status}</span>`;
}

function fmtNum(n, decimals = 0) {
  if (n == null) return '–';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function fmtDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function riskColor(risk) {
  if (risk >= 75) return '#dc2626';
  if (risk >= 50) return '#ea580c';
  if (risk >= 25) return '#ca8a04';
  return '#16a34a';
}

function riskBar(risk) {
  const color = riskColor(risk);
  return `<div class="progress-bar" style="width:120px"><div class="progress-fill" style="width:${risk}%;background:${color}"></div></div>`;
}

function skeleton(h = '180px') {
  return `<div class="skeleton" style="height:${h}"></div>`;
}

function emptyState(title, msg) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H5a2 2 0 00-2 2v2h18v-2a2 2 0 00-2-2h-4M12 3v10m0 0l-3-3m3 3l3-3"/></svg>
    <h3>${title}</h3><p>${msg}</p></div>`;
}
