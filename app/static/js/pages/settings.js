/* Settings Page */

async function renderSettings(container) {
  const user = getUser() || { name: '', email: '', employee_id: '', department: '', role: 'viewer' };
  const isAdmin = user && user.role === 'admin';

  container.innerHTML = `
    <div class="page-header">
      <h2>Settings</h2>
      <p>Account preferences, system configuration and team management</p>
    </div>

    <div class="settings-section">
      <h3>My Profile</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">
        <div class="control-group">
          <label>Full Name</label>
          <input class="control-input" id="s-name" value="${user?.name || ''}" />
        </div>
        <div class="control-group">
          <label>Email</label>
          <input class="control-input" value="${user?.email || ''}" disabled style="opacity:.6" />
        </div>
        <div class="control-group">
          <label>Employee ID</label>
          <input class="control-input" id="s-empid" value="${user?.employee_id || ''}" />
        </div>
        <div class="control-group">
          <label>Department</label>
          <input class="control-input" id="s-dept" value="${user?.department || ''}" />
        </div>
        <div class="control-group">
          <label>Role</label>
          <input class="control-input" value="${user?.role || ''}" disabled style="opacity:.6;text-transform:capitalize" />
        </div>
      </div>
      <div style="margin-top:1rem">
        <button class="btn btn-primary btn-sm" id="save-profile-btn" onclick="saveProfile()">Save Profile</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>Risk Classification Thresholds</h3>
      <p class="text-sm text-muted" style="margin-bottom:1rem">These values define the risk score boundaries (from config.yaml)</p>
      <div style="display:flex;gap:1rem;flex-wrap:wrap">
        <div class="control-group">
          <label>Critical (≥)</label>
          <input class="control-input" type="number" id="rc-critical" value="75" style="width:100px" />
        </div>
        <div class="control-group">
          <label>High (≥)</label>
          <input class="control-input" type="number" id="rc-high" value="50" style="width:100px" />
        </div>
        <div class="control-group">
          <label>Medium (≥)</label>
          <input class="control-input" type="number" id="rc-medium" value="25" style="width:100px" />
        </div>
      </div>
      <div style="margin-top:1rem">
        <button class="btn btn-primary btn-sm" id="save-thresholds-btn" onclick="saveThresholds()">Update Thresholds</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>Budget Rate Configuration</h3>
      <p class="text-sm text-muted" style="margin-bottom:1rem">Cost per km (₹ Lakh) used for budget estimation — based on Gujarat PWD Schedule of Rates</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem">
        <div class="control-group">
          <label>Critical - Cost/km (₹ Lakh)</label>
          <input class="control-input" type="number" id="br-critical-cost" value="18" min="0" step="0.1" />
        </div>
        <div class="control-group">
          <label>Critical - Labour/km (Persons)</label>
          <input class="control-input" type="number" id="br-critical-labour" value="12" min="0" />
        </div>
        <div class="control-group">
          <label>Critical - Days/km</label>
          <input class="control-input" type="number" id="br-critical-days" value="10" min="0" />
        </div>
        <div class="control-group">
          <label>High - Cost/km (₹ Lakh)</label>
          <input class="control-input" type="number" id="br-high-cost" value="10" min="0" step="0.1" />
        </div>
        <div class="control-group">
          <label>High - Labour/km (Persons)</label>
          <input class="control-input" type="number" id="br-high-labour" value="8" min="0" />
        </div>
        <div class="control-group">
          <label>High - Days/km</label>
          <input class="control-input" type="number" id="br-high-days" value="7" min="0" />
        </div>
        <div class="control-group">
          <label>Medium - Cost/km (₹ Lakh)</label>
          <input class="control-input" type="number" id="br-medium-cost" value="5" min="0" step="0.1" />
        </div>
        <div class="control-group">
          <label>Medium - Labour/km (Persons)</label>
          <input class="control-input" type="number" id="br-medium-labour" value="5" min="0" />
        </div>
        <div class="control-group">
          <label>Medium - Days/km</label>
          <input class="control-input" type="number" id="br-medium-days" value="4" min="0" />
        </div>
        <div class="control-group">
          <label>Low - Cost/km (₹ Lakh)</label>
          <input class="control-input" type="number" id="br-low-cost" value="2" min="0" step="0.1" />
        </div>
        <div class="control-group">
          <label>Low - Labour/km (Persons)</label>
          <input class="control-input" type="number" id="br-low-labour" value="2" min="0" />
        </div>
        <div class="control-group">
          <label>Low - Days/km</label>
          <input class="control-input" type="number" id="br-low-days" value="2" min="0" />
        </div>
      </div>
      <div style="margin-top:1rem">
        <button class="btn btn-primary btn-sm" id="save-budget-rates-btn" onclick="saveBudgetRates()">Update Budget Rates</button>
      </div>
    </div>

    ${isAdmin ? `
    <div class="settings-section">
      <h3>Resource Constraints</h3>
      <p class="text-sm text-muted" style="margin-bottom:1rem">Define available resources for maintenance planning. The planner will adjust recommendations based on these constraints.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">
        <div class="control-group">
          <label>Total Budget (₹ Lakh)</label>
          <input class="control-input" type="number" id="rc-budget" placeholder="e.g., 500" min="0" step="0.1" />
        </div>
        <div class="control-group">
          <label>Available Workforce (Persons)</label>
          <input class="control-input" type="number" id="rc-labour" placeholder="e.g., 100" min="0" />
        </div>
        <div class="control-group">
          <label>Available Days</label>
          <input class="control-input" type="number" id="rc-days" placeholder="e.g., 90" min="0" />
        </div>
      </div>
      <div style="margin-top:1rem;display:flex;gap:.5rem;align-items:center">
        <button class="btn btn-primary btn-sm" id="save-rc-btn" onclick="saveResourceConstraints()">Save Constraints</button>
        <span id="rc-updated" class="text-xs text-muted"></span>
      </div>
    </div>

    <div class="settings-section">
      <h3>Team Members</h3>
      <div id="users-list">${skeleton('120px')}</div>
    </div>
    ` : ''}
  `;

  if (isAdmin) {
    loadUsersList();
    loadResourceConstraints();
  }
}

async function saveProfile() {
  const btn = document.getElementById('save-profile-btn');
  const name  = document.getElementById('s-name')?.value.trim();
  const empid = document.getElementById('s-empid')?.value.trim() || null;
  const dept  = document.getElementById('s-dept')?.value.trim() || null;
  if (!name || name.length < 2) { showToast('Name must be at least 2 characters', 'error'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const updated = await API.updateProfile({ name, employee_id: empid, department: dept });
    const user = getUser();
    setUser({ ...user, ...updated });
    setUserUI({ ...user, ...updated });
    showToast('Profile updated successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Profile'; }
  }
}

async function loadUsersList() {
  try {
    const users = await API.users();
    const wrap = document.getElementById('users-list');
    if (!users.length) { wrap.innerHTML = '<p class="text-sm text-muted">No users found.</p>'; return; }
    wrap.innerHTML = `<table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Employee ID</th><th>Joined</th></tr></thead>
      <tbody>
        ${users.map(u => `<tr>
          <td><strong>${u.name}</strong></td>
          <td class="text-sm">${u.email}</td>
          <td><span class="badge badge-${u.role === 'admin' ? 'critical' : u.role === 'engineer' ? 'high' : 'low'}">${u.role}</span></td>
          <td class="text-sm font-mono">${u.employee_id || '–'}</td>
          <td class="text-xs text-muted">${fmtDate(u.created_at)}</td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (_) {}
}

async function loadResourceConstraints() {
  try {
    // Load from localStorage for now (backend API has issues)
    const stored = localStorage.getItem('resource_constraints');
    if (stored) {
      const rc = JSON.parse(stored);
      if (rc.budget_lakh !== null) document.getElementById('rc-budget').value = rc.budget_lakh;
      if (rc.labour_persons !== null) document.getElementById('rc-labour').value = rc.labour_persons;
      if (rc.days_available !== null) document.getElementById('rc-days').value = rc.days_available;
      if (rc.updated_at) {
        document.getElementById('rc-updated').textContent = `Last updated: ${fmtDate(rc.updated_at)}`;
      }
    }
  } catch (err) {
    console.error('Failed to load resource constraints:', err);
  }
}

async function saveResourceConstraints() {
  const btn = document.getElementById('save-rc-btn');
  const budget = parseFloat(document.getElementById('rc-budget')?.value) || null;
  const labour = parseInt(document.getElementById('rc-labour')?.value) || null;
  const days = parseInt(document.getElementById('rc-days')?.value) || null;

  if (budget === null && labour === null && days === null) {
    showToast('Please enter at least one constraint', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    // Store in localStorage for now (backend API has issues)
    const constraints = { budget_lakh: budget, labour_persons: labour, days_available: days, updated_at: new Date().toISOString() };
    localStorage.setItem('resource_constraints', JSON.stringify(constraints));
    showToast('Resource constraints updated successfully', 'success');
    loadResourceConstraints();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Constraints'; }
  }
}

async function saveThresholds() {
  const btn = document.getElementById('save-thresholds-btn');
  const critical = parseInt(document.getElementById('rc-critical')?.value);
  const high = parseInt(document.getElementById('rc-high')?.value);
  const medium = parseInt(document.getElementById('rc-medium')?.value);

  if (!critical || !high || !medium) {
    showToast('Please fill all threshold values', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    // Store in localStorage for now (can be moved to backend later)
    localStorage.setItem('threshold_critical', critical);
    localStorage.setItem('threshold_high', high);
    localStorage.setItem('threshold_medium', medium);
    showToast('Thresholds updated successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Update Thresholds'; }
  }
}

async function saveBudgetRates() {
  const btn = document.getElementById('save-budget-rates-btn');
  const rates = {
    critical: {
      cost: parseFloat(document.getElementById('br-critical-cost')?.value),
      labour: parseInt(document.getElementById('br-critical-labour')?.value),
      days: parseInt(document.getElementById('br-critical-days')?.value)
    },
    high: {
      cost: parseFloat(document.getElementById('br-high-cost')?.value),
      labour: parseInt(document.getElementById('br-high-labour')?.value),
      days: parseInt(document.getElementById('br-high-days')?.value)
    },
    medium: {
      cost: parseFloat(document.getElementById('br-medium-cost')?.value),
      labour: parseInt(document.getElementById('br-medium-labour')?.value),
      days: parseInt(document.getElementById('br-medium-days')?.value)
    },
    low: {
      cost: parseFloat(document.getElementById('br-low-cost')?.value),
      labour: parseInt(document.getElementById('br-low-labour')?.value),
      days: parseInt(document.getElementById('br-low-days')?.value)
    }
  };

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    localStorage.setItem('budget_rates', JSON.stringify(rates));
    showToast('Budget rates updated successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Update Budget Rates'; }
  }
}
