/* Dashboard Page */
let _dashCharts = {};
let _dashMap = null;

async function renderDashboard(container) {
  destroyDashboardMap();
  container.innerHTML = `
    <div class="page-header dashboard-heading">
      <div>
        <div class="dashboard-eyebrow">VADODARA MUNICIPAL CORPORATION</div>
        <h2>Road intelligence, at a glance</h2>
        <p>Ward risk, maintenance estimates and field activity in one place.</p>
      </div>
      <button class="btn btn-primary dashboard-map-link" onclick="navigate('map')">
        <span>Explore ward map</span><span aria-hidden="true">→</span>
      </button>
    </div>

    <div class="stats-grid" id="dash-stats">
      ${[0,1,2,3,4,5].map(() => skeleton('96px')).join('')}
    </div>

    <div class="dashboard-map-layout">
      <section class="card dashboard-map-card">
        <div class="card-header">
          <div>
            <div class="card-title">Ward risk overview</div>
            <div class="card-subtitle">Select a ward to see its current risk score</div>
          </div>
          <span class="dashboard-live-label"><span></span> RISK SNAPSHOT</span>
        </div>
        <div id="dashboard-ward-map" class="dashboard-ward-map" role="img" aria-label="Interactive map showing Vadodara ward risk levels"></div>
        <div class="dashboard-map-legend" aria-label="Risk level legend">
          <span><i class="risk-dot critical"></i>Critical</span>
          <span><i class="risk-dot high"></i>High</span>
          <span><i class="risk-dot medium"></i>Medium</span>
          <span><i class="risk-dot low"></i>Low</span>
          <span><i class="risk-dot no-data"></i>No data</span>
        </div>
      </section>

      <section class="card dashboard-risk-card">
        <div class="card-header">
          <div>
            <div class="card-title">Highest-risk wards</div>
            <div class="card-subtitle">Ranked by current risk score</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('planning')">View all</button>
        </div>
        <div id="dashboard-risk-list" class="dashboard-risk-list">
          ${[0,1,2].map(() => skeleton('58px')).join('')}
        </div>
        <button class="dashboard-text-link" onclick="navigate('map')">View all wards on map <span aria-hidden="true">→</span></button>
      </section>
    </div>

    <div class="two-col dashboard-chart-grid">
      <section class="card">
        <div class="card-header">
          <div><div class="card-title">Priority distribution</div><div class="card-subtitle">Wards by risk level</div></div>
        </div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-priority"></canvas></div></div>
      </section>
      <section class="card">
        <div class="card-header">
          <div><div class="card-title">Field report activity</div><div class="card-subtitle">Actual reports submitted in the last 7 days</div></div>
        </div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-activity"></canvas></div></div>
      </section>
    </div>

    <section class="card dashboard-wards-card">
      <div class="card-header">
        <div><div class="card-title">Ward maintenance priorities</div><div class="card-subtitle">Top 5 wards from the current risk dataset</div></div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('planning')">View planning <span aria-hidden="true">→</span></button>
      </div>
      <div class="card-body no-pad table-scroll">
        <table class="data-table">
          <thead><tr><th>#</th><th>Ward</th><th>Risk score</th><th>Detections</th><th>Road (km)</th><th>Priority</th><th>Budget (₹ lakh)</th></tr></thead>
          <tbody id="dash-top-wards"><tr><td colspan="7">${skeleton('40px')}</td></tr></tbody>
        </table>
      </div>
    </section>
  `;

  try {
    const [summary, wardData, reports, geoData] = await Promise.all([
      API.summary(),
      API.wardRisk(),
      API.listReports(),
      API.wardsGeoJSON().catch(error => ({ error })),
    ]);
    const wards = wardData.wards || [];
    renderDashStats(wards, summary);
    renderPriorityChart(getPriorityDistribution(wards));
    renderActivityChart(getReportActivity(reports));
    renderTopWards(wards.slice(0, 5));
    renderDashboardRiskList(wards.slice(0, 3));
    if (geoData.error) {
      showDashboardMapError(geoData.error.message);
    } else {
      renderDashboardMap(geoData, wards);
    }
  } catch (err) {
    document.getElementById('dash-stats').innerHTML =
      `<div class="dashboard-load-error"><p>Could not load ward data: ${err.message}</p><button class="btn btn-ghost btn-sm mt-1" onclick="navigate('map')">Open ward map</button></div>`;
    document.getElementById('dashboard-risk-list').innerHTML =
      `<div class="dashboard-empty">Ward risk data is unavailable.</div>`;
    document.getElementById('dash-top-wards').innerHTML =
      `<tr><td colspan="7" class="dashboard-empty">No ward records are available yet.</td></tr>`;
    showDashboardMapError(err.message);
  }
}

function renderDashStats(wards, summary) {
  const total = (key) => wards.reduce((sum, ward) => sum + (Number(ward[key]) || 0), 0);
  const critical = wards.filter(ward => Number(ward.risk_mean) >= 75).length;
  const cards = [
    { label: 'Wards analyzed', value: fmtNum(wards.length), sub: 'In the current risk dataset', icon: roadIcon(), cls: '' },
    { label: 'Critical wards', value: fmtNum(critical), sub: 'Risk score of 75 or higher', icon: alertIcon(), cls: 'critical' },
    { label: 'Damage detections', value: fmtNum(total('potholes')), sub: 'Across the listed wards', icon: potIcon(), cls: 'warning' },
    { label: 'Estimated budget', value: '₹ ' + fmtNum(total('budget_estimate_lakh'), 1) + ' L', sub: 'Sum of ward estimates', icon: budgetIcon(), cls: '' },
    { label: 'Estimated workforce', value: fmtNum(total('labour_required')), sub: 'Across the listed wards', icon: labourIcon(), cls: '' },
    { label: 'Open field reports', value: fmtNum(summary.open_reports), sub: `${fmtNum(summary.total_reports)} total submitted`, icon: reportIcon(), cls: summary.open_reports > 0 ? 'warning' : 'success' },
  ];
  document.getElementById('dash-stats').innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls}">
      <div class="stat-header"><div class="stat-label">${c.label}</div><div class="stat-icon">${c.icon}</div></div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>`).join('');
}

function getPriorityDistribution(wards) {
  const distribution = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  wards.forEach(ward => {
    const level = ward.priority_level;
    if (Object.prototype.hasOwnProperty.call(distribution, level)) distribution[level]++;
  });
  return distribution;
}

function getReportActivity(reports) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + index);
    return {
      date,
      label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      reports: 0,
    };
  });
  reports.forEach(report => {
    const created = new Date(report.created_at);
    created.setHours(0, 0, 0, 0);
    const day = days.find(item => item.date.getTime() === created.getTime());
    if (day) day.reports++;
  });
  return days;
}

function renderPriorityChart(dist) {
  const canvas = document.getElementById('chart-priority');
  if (!canvas) return;
  if (_dashCharts.priority) _dashCharts.priority.destroy();
  const total = Object.values(dist).reduce((sum, value) => sum + value, 0);
  if (!total) {
    canvas.parentElement.innerHTML = '<div class="chart-empty-state">No ward risk records to summarize.</div>';
    return;
  }
  if (typeof Chart === 'undefined') {
    canvas.parentElement.innerHTML = '<div class="chart-empty-state">Chart library is unavailable.</div>';
    return;
  }
  _dashCharts.priority = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{ data: [dist.Critical, dist.High, dist.Medium, dist.Low],
        backgroundColor: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a'],
        borderWidth: 3, borderColor: '#fff', hoverOffset: 5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 11, family: 'Inter' }, boxWidth: 9, padding: 14 } } }
    }
  });
}

function renderActivityChart(activity) {
  const canvas = document.getElementById('chart-activity');
  if (!canvas) return;
  if (_dashCharts.activity) _dashCharts.activity.destroy();
  if (!activity.some(day => day.reports > 0)) {
    canvas.parentElement.innerHTML = '<div class="chart-empty-state">No field reports submitted in the last 7 days.</div>';
    return;
  }
  if (typeof Chart === 'undefined') {
    canvas.parentElement.innerHTML = '<div class="chart-empty-state">Chart library is unavailable.</div>';
    return;
  }
  _dashCharts.activity = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: activity.map(day => day.label),
      datasets: [{ label: 'Reports', data: activity.map(day => day.reports),
        backgroundColor: '#1e6fa8', hoverBackgroundColor: '#0f4e7c', borderRadius: 5, maxBarThickness: 32 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, border: { display: false }, ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#f1f5f9' } }
      }
    }
  });
}

function renderDashboardMap(geoData, wards) {
  const mapElement = document.getElementById('dashboard-ward-map');
  if (!mapElement || typeof L === 'undefined') {
    showDashboardMapError('Map library is unavailable.');
    return;
  }
  _dashMap = L.map(mapElement, { zoomControl: false, scrollWheelZoom: false, dragging: true, tap: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  }).addTo(_dashMap);

  const riskByWard = new Map();
  wards.forEach(ward => {
    riskByWard.set(String(ward.ward_no), ward);
    riskByWard.set(String(ward.ward || '').toLowerCase().trim(), ward);
  });
  const colors = { Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' };
  const layer = L.geoJSON(geoData, {
    style: feature => {
      const props = feature.properties || {};
      const ward = riskByWard.get(String(props.ward_no || '')) ||
        riskByWard.get(String(props.ward_name || '').toLowerCase().trim());
      const color = colors[ward && ward.priority_level] || '#94a3b8';
      return { color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.68 };
    },
    onEachFeature: (feature, wardLayer) => {
      const props = feature.properties || {};
      const ward = riskByWard.get(String(props.ward_no || '')) ||
        riskByWard.get(String(props.ward_name || '').toLowerCase().trim());
      const name = props.ward_name || `Ward ${props.ward_no || ''}`;
      const details = ward
        ? `${name} · Risk ${fmtNum(ward.risk_mean, 1)}/100 · ${ward.priority_level}`
        : `${name} · No risk data`;
      wardLayer.bindTooltip(details, { sticky: true });
      wardLayer.on('click', () => wardLayer.openTooltip());
    }
  }).addTo(_dashMap);
  if (layer.getBounds().isValid()) _dashMap.fitBounds(layer.getBounds(), { padding: [12, 12] });
  requestAnimationFrame(() => _dashMap && _dashMap.invalidateSize());
}

function showDashboardMapError(message) {
  const mapElement = document.getElementById('dashboard-ward-map');
  if (mapElement) {
    mapElement.innerHTML = `<div class="dashboard-map-error">${emptyState('Map preview unavailable', message || 'Ward boundaries could not be loaded.')}</div>`;
  }
}

function destroyDashboardMap() {
  if (_dashMap) {
    _dashMap.remove();
    _dashMap = null;
  }
}

function renderDashboardRiskList(wards) {
  const list = document.getElementById('dashboard-risk-list');
  if (!wards.length) {
    list.innerHTML = '<div class="dashboard-empty">No ward risk records are available.</div>';
    return;
  }
  list.innerHTML = wards.map((ward, index) => `
    <button class="dashboard-risk-row" onclick="navigate('map')" aria-label="Open ward risk map for ${ward.ward}">
      <span class="dashboard-risk-rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="dashboard-risk-name"><strong>${ward.ward}</strong><small>Ward ${ward.ward_no}</small></span>
      <span class="dashboard-risk-score" style="color:${riskColor(ward.risk_mean)}">${fmtNum(ward.risk_mean, 1)}<small>/100</small></span>
    </button>`).join('');
}

function renderTopWards(wards) {
  const body = document.getElementById('dash-top-wards');
  if (!wards.length) {
    body.innerHTML = '<tr><td colspan="7" class="dashboard-empty">No ward records are available.</td></tr>';
    return;
  }
  body.innerHTML = wards.map((ward, index) => `
    <tr>
      <td class="rank">${ward.priority_rank || index + 1}</td>
      <td><strong>${ward.ward}</strong><br><span class="text-xs text-muted">Ward ${ward.ward_no}</span></td>
      <td>
        <div class="dashboard-score-cell">
          <span style="font-weight:600;color:${riskColor(ward.risk_mean)}">${fmtNum(ward.risk_mean, 1)}</span>
          ${riskBar(ward.risk_mean)}
        </div>
      </td>
      <td>${fmtNum(ward.potholes)}</td>
      <td>${fmtNum(ward.km, 2)}</td>
      <td>${priorityBadge(ward.priority_level)}</td>
      <td>₹ ${fmtNum(ward.budget_estimate_lakh, 1)} L</td>
    </tr>`).join('');
}

// Icons
const roadIcon   = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18M3 4h18M8 4l-2 16M16 4l2 16"/></svg>`;
const alertIcon  = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const potIcon    = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M8 14l-4 8h16l-4-8"/></svg>`;
const budgetIcon = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`;
const labourIcon = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;
const reportIcon = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
