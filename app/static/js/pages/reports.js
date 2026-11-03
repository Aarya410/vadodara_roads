/* Field Reports Page */
let _reportsFilter = { ward_no: null, severity: null, status: null };

async function renderReports(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Field Reports</h2>
      <p>Submit and manage on-ground maintenance reports from field engineers</p>
    </div>
    <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center">
      <select class="control-input control-select" id="filter-ward" style="width:170px" onchange="applyReportFilter()">
        <option value="">All Wards</option>
        ${Array.from({length:12},(_,i)=>`<option value="${i+1}">Ward ${i+1}</option>`).join('')}
      </select>
      <select class="control-input control-select" id="filter-severity" style="width:150px" onchange="applyReportFilter()">
        <option value="">All Severities</option>
        <option value="Critical">Critical</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
      <select class="control-input control-select" id="filter-status" style="width:150px" onchange="applyReportFilter()">
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="resolved">Resolved</option>
      </select>
      <button class="btn btn-ghost btn-sm" onclick="applyReportFilter()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Refresh
      </button>
      <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openReportModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Report
      </button>
    </div>
    <div class="card">
      <div class="card-body no-pad">
        <div id="reports-table-wrap">
          <div style="padding:2rem;text-align:center">${skeleton('200px')}</div>
        </div>
      </div>
    </div>
    <div id="report-modal-placeholder"></div>
  `;

  loadReports();
}

async function loadReports() {
  const params = {};
  const ward = document.getElementById('filter-ward')?.value;
  const sev  = document.getElementById('filter-severity')?.value;
  const stat = document.getElementById('filter-status')?.value;
  if (ward) params.ward_no = ward;
  if (sev)  params.severity = sev;
  if (stat) params.status = stat;

  try {
    const reports = await API.listReports(params);
    renderReportsTable(reports);
  } catch (err) {
    document.getElementById('reports-table-wrap').innerHTML =
      `<div class="card-body">${emptyState('Could not load reports', err.message)}</div>`;
  }
}

function applyReportFilter() { loadReports(); }

function renderReportsTable(reports) {
  if (!reports.length) {
    document.getElementById('reports-table-wrap').innerHTML =
      `<div class="card-body">${emptyState('No reports found', 'Submit a new field report using the button above')}</div>`;
    return;
  }

  document.getElementById('reports-table-wrap').innerHTML = `
    <div style="overflow-x:auto">
    <table class="data-table">
      <thead>
        <tr>
          <th>Ward</th><th>Issue Type</th><th>Road</th><th>Severity</th>
          <th>Status</th><th>Date</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map(r => `<tr>
          <td><strong>Ward ${r.ward_no}</strong><br><span class="text-xs text-muted">${r.ward}</span></td>
          <td>${r.issue_type}</td>
          <td>${r.road_name || '–'}</td>
          <td>${priorityBadge(r.severity)}</td>
          <td>${statusPill(r.status)}</td>
          <td><span class="text-xs">${fmtDate(r.created_at)}</span></td>
          <td>
            <div style="display:flex;gap:.375rem">
              ${r.status !== 'resolved' ? `<button class="btn btn-ghost btn-sm" onclick="changeReportStatus('${r.id}','${r.status === 'open' ? 'in_progress' : 'resolved'}')">
                ${r.status === 'open' ? 'Start' : 'Resolve'}</button>` : ''}
              <button class="btn btn-ghost btn-sm" style="color:var(--critical)" onclick="deleteReport('${r.id}')">✕</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}

async function changeReportStatus(id, status) {
  try {
    await API.updateReportStatus(id, status);
    showToast(`Report marked as "${status}"`, 'success');
    loadReports();
    fetchBadge();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteReport(id) {
  if (!confirm('Delete this report?')) return;
  try {
    await API.deleteReport(id);
    showToast('Report deleted', 'success');
    loadReports();
    fetchBadge();
  } catch (err) { showToast(err.message, 'error'); }
}

function openReportModal() {
  const WARD_NAMES = ['Nyay Mandir','Harni','Waghodia','Pratap Nagar','Raopura','Akota','Fatehgunj','Tin Rasta','Ajwa','Subhanpura','Vasna','Makarpura'];
  const wardOpts = WARD_NAMES.map((n,i) => `<option value="${i+1}" data-name="${n}">Ward ${i+1} — ${n}</option>`).join('');

  const html = `
    <div class="modal-overlay" id="report-modal" onclick="closeModalBg(event)">
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">New Field Report</span>
          <button class="modal-close" onclick="closeModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onsubmit="submitReport(event)" style="display:flex;flex-direction:column;gap:.875rem">
          <div class="form-row">
            <div class="control-group">
              <label>Ward *</label>
              <select class="control-input control-select" id="r-ward" required onchange="setWardName()">${wardOpts}</select>
            </div>
            <div class="control-group">
              <label>Severity *</label>
              <select class="control-input control-select" id="r-severity" required>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium" selected>Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="control-group">
              <label>Issue Type *</label>
              <select class="control-input control-select" id="r-issue" required>
                <option>Pothole</option><option>Road Cracking</option><option>Waterlogging</option>
                <option>Damaged Curb</option><option>Missing Signage</option><option>Other</option>
              </select>
            </div>
            <div class="control-group">
              <label>Road / Area Name</label>
              <input class="control-input" type="text" id="r-road" placeholder="e.g. Waghodia Road" />
            </div>
          </div>
          <div class="control-group">
            <label>Description *</label>
            <textarea class="control-input" id="r-desc" placeholder="Describe the issue in detail…" required></textarea>
          </div>
          <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:.25rem">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="submit-report-btn">Submit Report</button>
          </div>
        </form>
      </div>
    </div>`;

  document.getElementById('report-modal-placeholder').innerHTML = html;
}

const WARD_NAMES_LIST = ['Nyay Mandir','Harni','Waghodia','Pratap Nagar','Raopura','Akota','Fatehgunj','Tin Rasta','Ajwa','Subhanpura','Vasna','Makarpura'];

function setWardName() {}

async function submitReport(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-report-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';
  const wardNo = parseInt(document.getElementById('r-ward').value);
  try {
    await API.createReport({
      ward: WARD_NAMES_LIST[wardNo - 1] || `Ward ${wardNo}`,
      ward_no: wardNo,
      road_name: document.getElementById('r-road').value || null,
      issue_type: document.getElementById('r-issue').value,
      severity: document.getElementById('r-severity').value,
      description: document.getElementById('r-desc').value,
    });
    closeModal();
    showToast('Report submitted successfully', 'success');
    loadReports(); fetchBadge();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false; btn.textContent = 'Submit Report';
  }
}

function closeModal() { document.getElementById('report-modal-placeholder').innerHTML = ''; }
function closeModalBg(e) { if (e.target.id === 'report-modal') closeModal(); }
