/* Priority Planning Page */

async function renderPlanning(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Maintenance Priority Planning</h2>
      <p>AI-ranked ward order for road maintenance works — sorted by composite risk score</p>
    </div>
    <div id="planning-content">${skeleton('400px')}</div>
  `;

  try {
    const user = getUser();
    const isAdmin = user && user.role === 'admin';

    // Try to get constrained data first
    let data = null;
    let useConstraints = false;

    try {
      data = await API.wardRiskConstrained();
      useConstraints = true;
    } catch (e) {
      // Fallback to unconstrained if no constraints set
      data = await API.wardRisk();
      useConstraints = false;
    }

    renderPlanningTable(data, container, useConstraints, isAdmin);
  } catch (err) {
    document.getElementById('planning-content').innerHTML =
      `<div class="card"><div class="card-body">${emptyState('No data available', 'Run the AI pipeline to generate ward rankings. ' + err.message)}
        <button class="btn btn-primary btn-sm mt-1" onclick="navigate('pipeline')">Go to Pipeline →</button></div></div>`;
  }
}

function renderPlanningTable(data, container, useConstraints = false, isAdmin = false) {
  const constraintBadge = useConstraints
    ? `<span class="badge badge-high" style="margin-left:.5rem">Resource-Constrained Plan</span>`
    : `<span class="badge badge-low" style="margin-left:.5rem">Unconstrained Plan</span>`;

  const toggleBtn = isAdmin
    ? `<button class="btn btn-ghost btn-sm" onclick="toggleConstraints()">
        ${useConstraints ? 'Show Unconstrained' : 'Apply Constraints'}
       </button>`
    : '';

  const summaryHTML = `
    <div class="stats-grid" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-header"><div class="stat-label">Total Wards</div></div><div class="stat-value">${data.wards.length}</div></div>
      <div class="stat-card critical"><div class="stat-header"><div class="stat-label">Critical Priority</div></div><div class="stat-value">${data.wards.filter(w=>w.priority_level==='Critical').length}</div></div>
      <div class="stat-card warning"><div class="stat-header"><div class="stat-label">High Priority</div></div><div class="stat-value">${data.wards.filter(w=>w.priority_level==='High').length}</div></div>
      <div class="stat-card"><div class="stat-header"><div class="stat-label">Total Budget</div></div><div class="stat-value">₹ ${fmtNum(data.total_budget_lakh, 1)} L</div></div>
    </div>`;

  const tableRows = data.wards.map((w, i) => {
    const schedPhase = i < 3 ? 'Phase 1 — Immediate' : i < 6 ? 'Phase 2 — Short-term' : i < 9 ? 'Phase 3 — Mid-term' : 'Phase 4 — Routine';
    const phaseColor = i < 3 ? 'var(--critical)' : i < 6 ? 'var(--high)' : i < 9 ? 'var(--medium)' : 'var(--low)';
    return `<tr>
      <td class="rank">${w.priority_rank}</td>
      <td>
        <strong>${w.ward}</strong>
        <div class="text-xs text-muted">Ward No. ${w.ward_no}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:.625rem">
          <strong style="color:${riskColor(w.risk_mean)};font-size:1.1rem">${fmtNum(w.risk_mean,1)}</strong>
          ${riskBar(w.risk_mean)}
        </div>
      </td>
      <td>${priorityBadge(w.priority_level)}</td>
      <td>${fmtNum(w.potholes)}</td>
      <td>${fmtNum(w.km,2)}</td>
      <td>${fmtNum(w.critical_km,2)}</td>
      <td><span style="font-size:.75rem;color:${phaseColor};font-weight:600">${schedPhase}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="_navState.scrollWard=${w.ward_no};navigate('budget')">
          View Plan
        </button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('planning-content').innerHTML = summaryHTML + `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Maintenance Schedule — All Wards ${constraintBadge}</div>
          <div class="card-subtitle">Ranked by risk · Phased execution plan</div>
        </div>
        <div style="display:flex;gap:.5rem">
          ${toggleBtn}
          <button class="btn btn-ghost btn-sm" onclick="exportPlanningCSV()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>
      <div class="card-body no-pad" style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th><th>Ward</th><th>Risk Score</th><th>Priority</th>
              <th>Potholes</th><th>Road (km)</th><th>Critical (km)</th><th>Execution Phase</th><th></th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;

  window._planningData = data;
  window._useConstraints = useConstraints;
}

async function toggleConstraints() {
  const container = document.getElementById('planning-content');
  container.innerHTML = skeleton('400px');

  try {
    if (window._useConstraints) {
      // Switch to unconstrained
      const data = await API.wardRisk();
      renderPlanningTable(data, document.getElementById('page-planning'), false, getUser().role === 'admin');
    } else {
      // Switch to constrained - apply filtering on frontend
      const data = await API.wardRisk();
      const constraints = JSON.parse(localStorage.getItem('resource_constraints') || '{}');
      const budgetLimit = constraints.budget_lakh;
      const labourLimit = constraints.labour_persons;
      const daysLimit = constraints.days_available;

      console.log('Constraints:', constraints);
      console.log('Data wards:', data.wards);

      if (!budgetLimit && !labourLimit && !daysLimit) {
        showToast('No constraints set. Please set them in Settings first.', 'error');
        const data = await API.wardRisk();
        renderPlanningTable(data, document.getElementById('page-planning'), false, getUser().role === 'admin');
        return;
      }

      // Apply constraints: select wards in priority order until resources exhausted
      const constrainedWards = [];
      let remainingBudget = budgetLimit || Infinity;
      let remainingLabour = labourLimit || Infinity;
      let remainingDays = daysLimit || Infinity;

      for (const ward of data.wards) {
        const wardBudget = ward.budget_estimate_lakh || 0;
        const wardLabour = ward.labour_required || 0;
        const wardDays = ward.estimated_days || 0;

        console.log(`Ward ${ward.ward}: budget=${wardBudget}, labour=${wardLabour}, days=${wardDays}, remaining: budget=${remainingBudget}, labour=${remainingLabour}, days=${remainingDays}`);

        if (remainingBudget >= wardBudget && remainingLabour >= wardLabour && remainingDays >= wardDays) {
          constrainedWards.push(ward);
          remainingBudget -= wardBudget;
          remainingLabour -= wardLabour;
          remainingDays -= wardDays;
        } else {
          break;
        }
      }

      console.log('Constrained wards:', constrainedWards.length);

      if (constrainedWards.length === 0) {
        showToast('No wards fit within the given constraints. Try increasing budget, labour, or days.', 'error');
        const data = await API.wardRisk();
        renderPlanningTable(data, document.getElementById('page-planning'), false, getUser().role === 'admin');
        return;
      }

      const constrainedData = {
        ...data,
        wards: constrainedWards,
        total_budget_lakh: constrainedWards.reduce((sum, w) => sum + (w.budget_estimate_lakh || 0), 0),
        total_potholes: constrainedWards.reduce((sum, w) => sum + w.potholes, 0)
      };

      renderPlanningTable(constrainedData, document.getElementById('page-planning'), true, getUser().role === 'admin');
    }
  } catch (err) {
    console.error('Error in toggleConstraints:', err);
    showToast(err.message, 'error');
  }
}

function exportPlanningCSV() {
  if (!window._planningData) return;
  const headers = ['Rank','Ward','Ward No','Risk Score','Priority','Potholes','Road km','Critical km','Labour','Budget (Lakh)','Est. Days'];
  const rows = window._planningData.wards.map(w => [
    w.priority_rank, w.ward, w.ward_no, w.risk_mean.toFixed(1), w.priority_level,
    w.potholes, w.km.toFixed(2), w.critical_km.toFixed(2),
    w.labour_required, w.budget_estimate_lakh.toFixed(1), w.estimated_days
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `VMC_Ward_Planning_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('Planning data exported as CSV', 'success');
}
