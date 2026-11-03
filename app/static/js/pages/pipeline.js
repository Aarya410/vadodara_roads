/* AI Pipeline Page */
let _pipelinePoller = null;
let _currentRunId   = null;

async function renderPipeline(container) {
  const user = getUser();
  const canTrigger = user && (user.role === 'admin' || user.role === 'engineer');

  container.innerHTML = `
    <div class="page-header">
      <h2>AI Pipeline</h2>
      <p>Run the 5-step road damage detection and risk analysis pipeline</p>
    </div>

    <div class="two-col" style="align-items:start;gap:1rem">
      <!-- Left: trigger + steps -->
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="card">
          <div class="card-header"><div class="card-title">Pipeline Overview</div></div>
          <div class="card-body">
            <div class="step-indicator">
              ${pipelineStep(1, 'Build Basemap', 'OSM roads + VMC wards + POIs → basemap.gpkg')}
              ${pipelineStep(2, 'Train Detector', 'Fine-tune YOLOv8n on IndiaRDD2022 dataset (875 imgs)')}
              ${pipelineStep(3, 'Fetch Mapillary', 'Download geotagged street images (needs token)')}
              ${pipelineStep(4, 'Detect & Geotag', 'Run detector on images → detections.gpkg')}
              ${pipelineStep(5, 'Risk Scoring', 'DBSCAN hotspots + 0-100 risk per segment + ward ranking')}
            </div>
            ${canTrigger ? `
            <div style="margin-top:1rem;display:flex;gap:.75rem">
              <button class="btn btn-primary w-full" id="run-pipeline-btn" onclick="triggerPipeline()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Run Pipeline
              </button>
            </div>
            <p class="text-xs text-muted" style="margin-top:.625rem">Note: Step 2 (YOLO training) may take 30–60 min on CPU. Steps 3 &amp; 4 require a Mapillary token.</p>
            ` : `<p class="text-xs text-muted mt-1">Engineer or Admin role required to trigger the pipeline.</p>`}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Dataset Info</div></div>
          <div class="card-body">
            <table style="width:100%;font-size:.8rem;border-collapse:collapse">
              <tr><td style="padding:.4rem;color:var(--gray-500);font-weight:500">Dataset</td><td>IndiaRDD2022 (Roboflow)</td></tr>
              <tr><td style="padding:.4rem;color:var(--gray-500);font-weight:500">License</td><td>CC BY 4.0</td></tr>
              <tr><td style="padding:.4rem;color:var(--gray-500);font-weight:500">Train images</td><td>875</td></tr>
              <tr><td style="padding:.4rem;color:var(--gray-500);font-weight:500">Val images</td><td>434</td></tr>
              <tr><td style="padding:.4rem;color:var(--gray-500);font-weight:500">Classes</td><td>1 (road damage / pothole)</td></tr>
              <tr><td style="padding:.4rem;color:var(--gray-500);font-weight:500">Model</td><td>YOLOv8n (fine-tuned)</td></tr>
              <tr><td style="padding:.4rem;color:var(--gray-500);font-weight:500">Ward file</td><td>VMC wards (12 wards)</td></tr>
            </table>
          </div>
        </div>
      </div>

      <!-- Right: run history + live log -->
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="card">
          <div class="card-header"><div class="card-title">Run History</div></div>
          <div class="card-body no-pad" id="run-history">${skeleton('150px')}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Live Log</div>
            <span class="status-pill status-queued" id="run-status-pill">No active run</span>
          </div>
          <div class="card-body" style="padding:.75rem">
            <div class="log-terminal" id="pipeline-log">Waiting for pipeline run…</div>
          </div>
        </div>
      </div>
    </div>
  `;

  loadPipelineHistory();
}

function pipelineStep(num, title, desc) {
  return `<div class="step-item">
    <div class="step-dot step-pending" id="step-dot-${num}"></div>
    <div>
      <div style="font-weight:600;font-size:.8rem">Step ${num}: ${title}</div>
      <div class="text-xs text-muted">${desc}</div>
    </div>
  </div>`;
}

async function loadPipelineHistory() {
  try {
    const runs = await API.pipelineRuns();
    const wrap = document.getElementById('run-history');
    if (!runs.length) {
      wrap.innerHTML = `<div class="card-body">${emptyState('No runs yet', 'Trigger the pipeline to start analysis')}</div>`;
      return;
    }
    wrap.innerHTML = `<table class="data-table">
      <thead><tr><th>Started</th><th>Status</th><th>By</th><th></th></tr></thead>
      <tbody>${runs.map(r => `<tr>
        <td class="text-xs">${fmtDate(r.started_at)}</td>
        <td>${statusPill(r.status)}</td>
        <td class="text-xs">${r.triggered_by}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="showRunLog('${r.id}')">Log</button></td>
      </tr>`).join('')}
      </tbody></table>`;

    // If there's a running job, auto-attach
    const running = runs.find(r => r.status === 'running');
    if (running) startPolling(running.id);
  } catch (_) {}
}

async function triggerPipeline() {
  const btn = document.getElementById('run-pipeline-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
  try {
    const run = await API.triggerPipeline();
    showToast('Pipeline started!', 'success');
    _currentRunId = run.id;
    startPolling(run.id);
    loadPipelineHistory();
  } catch (err) {
    showToast(err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Pipeline`; }
  }
}

function startPolling(runId) {
  if (_pipelinePoller) clearInterval(_pipelinePoller);
  _pipelinePoller = setInterval(() => pollRun(runId), 3000);
  pollRun(runId);
}

async function pollRun(runId) {
  try {
    const run = await API.pipelineRun(runId);
    updateLiveLog(run);
    if (run.status !== 'running') {
      clearInterval(_pipelinePoller);
      _pipelinePoller = null;
      loadPipelineHistory();
      const btn = document.getElementById('run-pipeline-btn');
      if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Pipeline`; }
      if (run.status === 'done') showToast('Pipeline completed!', 'success');
      if (run.status === 'failed') showToast('Pipeline failed — check log', 'error');
    }
  } catch (_) {}
}

function updateLiveLog(run) {
  const logEl = document.getElementById('pipeline-log');
  const pillEl = document.getElementById('run-status-pill');
  if (logEl && run.log_tail) {
    const colored = run.log_tail
      .replace(/\[OK\]/g, '<span class="log-ok">[OK]</span>')
      .replace(/\[FAIL\]/g, '<span class="log-fail">[FAIL]</span>')
      .replace(/\[SKIP\]/g, '<span class="log-skip">[SKIP]</span>')
      .replace(/\[INFO\]/g, '<span class="log-info">[INFO]</span>')
      .replace(/\[DONE\]/g, '<span class="log-ok">[DONE]</span>')
      .replace(/\[RUN\]/g, '<span class="log-info">[RUN]</span>');
    logEl.innerHTML = colored;
    logEl.scrollTop = logEl.scrollHeight;
  }
  if (pillEl) { pillEl.className = `status-pill status-${run.status}`; pillEl.textContent = run.status; }
}

async function showRunLog(runId) {
  try {
    const run = await API.pipelineRun(runId);
    updateLiveLog(run);
  } catch (_) {}
}
