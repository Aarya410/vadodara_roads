/* Budget & Labour Planning Page */
let _budgetChart = null;
window._scrollToWard = null;

async function renderBudget(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Budget & Labour Planning</h2>
      <p>Detailed cost and workforce estimates for each ward — based on MoRTH / Gujarat PWD Schedule of Rates</p>
    </div>
    <div id="budget-content">${skeleton('500px')}</div>
  `;

  try {
    const data = await API.wardRisk();
    renderBudgetContent(data);
  } catch (err) {
    document.getElementById('budget-content').innerHTML =
      `<div class="card"><div class="card-body">${emptyState('No data', err.message)}</div></div>`;
  }
}

function renderBudgetContent(data) {
  const totalBudget = data.total_budget_lakh;
  const totalLabour = data.wards.reduce((s, w) => s + w.labour_required, 0);
  const totalDays   = data.wards.length > 0 ? Math.max(...data.wards.map(w => w.estimated_days)) : 0;

  const summaryHTML = `
    <div class="stats-grid" style="margin-bottom:1.25rem">
      <div class="stat-card">
        <div class="stat-header"><div class="stat-label">Total Budget Required</div></div>
        <div class="stat-value" style="font-size:1.5rem">₹ ${fmtNum(totalBudget,1)}</div>
        <div class="stat-sub">Lakh (estimated)</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-header"><div class="stat-label">Total Workforce</div></div>
        <div class="stat-value">${fmtNum(totalLabour)}</div>
        <div class="stat-sub">Persons across all wards</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><div class="stat-label">Max Completion Time</div></div>
        <div class="stat-value">${totalDays}</div>
        <div class="stat-sub">Days (critical ward)</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><div class="stat-label">Cost Basis</div></div>
        <div class="stat-value" style="font-size:.9rem">MoRTH SoR</div>
        <div class="stat-sub">Gujarat PWD 2024 rates</div>
      </div>
    </div>`;

  const chartSection = `
    <div class="card" style="margin-bottom:1rem">
      <div class="card-header">
        <div class="card-title">Budget Breakdown by Ward</div>
        <button class="btn btn-ghost btn-sm" onclick="exportBudgetCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
      </div>
      <div class="card-body"><div class="chart-wrap" style="height:260px"><canvas id="chart-budget"></canvas></div></div>
    </div>`;

  const wardCards = data.wards.map(w => {
    const pct = totalBudget > 0 ? (w.budget_estimate_lakh / totalBudget * 100) : 0;
    const rateNote = w.priority_level === 'Critical'
      ? '₹45L/km — Full overlay + base repair'
      : w.priority_level === 'High'
      ? '₹28L/km — Intensive patching'
      : w.priority_level === 'Medium'
      ? '₹12L/km — Moderate patching'
      : '₹4L/km — Preventive maintenance';

    return `
    <div class="budget-ward-card" id="ward-card-${w.ward_no}">
      <div class="budget-ward-header">
        <div>
          <div style="font-weight:700;font-size:.95rem">${w.ward} <span class="text-muted text-xs">(Ward ${w.ward_no})</span></div>
          <div class="text-xs text-muted mt-1">${rateNote}</div>
        </div>
        ${priorityBadge(w.priority_level)}
      </div>
      <div class="budget-metrics-grid" style="margin-bottom:.875rem">
        ${budgetMetric('Budget', '₹ ' + fmtNum(w.budget_estimate_lakh,1), 'Lakh')}
        ${budgetMetric('Workforce', fmtNum(w.labour_required), 'Persons')}
        ${budgetMetric('Duration', w.estimated_days, 'Days')}
        ${budgetMetric('Road Length', fmtNum(w.km,2), 'km')}
      </div>
      <div style="display:flex;align-items:center;gap:.75rem">
        <div class="progress-bar" style="flex:1;height:8px">
          <div class="progress-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${riskColor(w.risk_mean)}"></div>
        </div>
        <span class="text-xs text-muted">${pct.toFixed(1)}% of total</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById('budget-content').innerHTML = summaryHTML + chartSection + `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem" id="budget-ward-grid">
      ${wardCards}
    </div>`;

  window._budgetData = data;
  renderBudgetChart(data.wards);

  // Handle cross-page scroll request from planning page
  if (_navState.scrollWard) {
    const wn = _navState.scrollWard;
    _navState.scrollWard = null;
    scrollToWard(wn);
  }
}

function budgetMetric(label, value, unit) {
  return `<div class="budget-metric">
    <div class="budget-metric-label">${label}</div>
    <div class="budget-metric-value">${value}</div>
    <div class="budget-metric-unit">${unit}</div>
  </div>`;
}

function renderBudgetChart(wards) {
  const ctx = document.getElementById('chart-budget');
  if (!ctx) return;
  if (_budgetChart) _budgetChart.destroy();
  const sorted = [...wards].sort((a,b) => b.budget_estimate_lakh - a.budget_estimate_lakh);
  _budgetChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(w => w.ward),
      datasets: [
        { label: 'Budget (₹ Lakh)', data: sorted.map(w => w.budget_estimate_lakh), backgroundColor: sorted.map(w => riskColor(w.risk_mean) + 'cc'), borderRadius: 5 },
        { label: 'Labour (persons)', data: sorted.map(w => w.labour_required), type: 'line', borderColor: '#1e6fa8', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1', pointRadius: 4, pointBackgroundColor: '#1e6fa8' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 35 } },
        y: { beginAtZero: true, title: { display: true, text: '₹ Lakh', font: { size: 10 } }, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
        y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'Persons', font: { size: 10 } }, grid: { display: false }, ticks: { font: { size: 10 } } },
      }
    }
  });
}

function scrollToWard(wardNo) {
  setTimeout(() => {
    const el = document.getElementById(`ward-card-${wardNo}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

function exportBudgetCSV() {
  if (!window._budgetData) return;
  const h = ['Rank','Ward','Ward No','Priority','Road km','Critical km','Potholes','Labour (persons)','Budget (₹ Lakh)','Est. Days'];
  const rows = window._budgetData.wards.map(w => [
    w.priority_rank, w.ward, w.ward_no, w.priority_level,
    w.km.toFixed(2), w.critical_km.toFixed(2), w.potholes,
    w.labour_required, w.budget_estimate_lakh.toFixed(1), w.estimated_days
  ]);
  const csv = [h, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `VMC_Budget_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('Budget report exported', 'success');
}
