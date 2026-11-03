/* Ward Risk Map Page */
let _map = null;
let _wardLayer = null;

async function renderMap(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Ward Risk Map</h2>
      <p>Interactive choropleth map of road risk across Vadodara's 12 wards</p>
    </div>
    <div class="two-col" style="align-items:start;gap:1rem">
      <div class="card" style="grid-column:1/3">
        <div class="card-header">
          <div><div class="card-title">Live Ward Risk Map</div><div class="card-subtitle">Click a ward for details</div></div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <div style="display:flex;gap:.5rem;align-items:center;font-size:.7rem;color:var(--gray-500)">
              <span style="width:10px;height:10px;background:#dc2626;border-radius:2px;display:inline-block"></span>Critical
              <span style="width:10px;height:10px;background:#ea580c;border-radius:2px;display:inline-block;margin-left:6px"></span>High
              <span style="width:10px;height:10px;background:#ca8a04;border-radius:2px;display:inline-block;margin-left:6px"></span>Medium
              <span style="width:10px;height:10px;background:#16a34a;border-radius:2px;display:inline-block;margin-left:6px"></span>Low
              <span style="width:10px;height:10px;background:#94a3b8;border-radius:2px;display:inline-block;margin-left:6px"></span>No data
            </div>
          </div>
        </div>
        <div id="ward-map"></div>
      </div>
    </div>
    <div id="ward-detail-panel" class="card mt-2 hidden">
      <div class="card-header">
        <div id="ward-detail-title" class="card-title">Ward Details</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ward-detail-panel').classList.add('hidden')">✕ Close</button>
      </div>
      <div class="card-body" id="ward-detail-body"></div>
    </div>
  `;

  // Init map
  if (_map) { _map.remove(); _map = null; }
  _map = L.map('ward-map', { zoomControl: true }).setView([22.307, 73.181], 12);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  }).addTo(_map);

  try {
    const [geoData, riskData] = await Promise.all([
      API.wardsGeoJSON(),
      API.wardRisk().catch(() => null),
    ]);

    const riskMap = {};
    if (riskData && riskData.wards) {
      riskData.wards.forEach(w => {
        riskMap[w.ward.toLowerCase().trim()] = w;
        riskMap[String(w.ward_no)] = w;
      });
    }

    const COLOR = { Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a', None: '#94a3b8' };

    _wardLayer = L.geoJSON(geoData, {
      style: feature => {
        const name = (feature.properties.ward_name || '').toLowerCase().trim();
        const wno  = String(feature.properties.ward_no || '');
        const w    = riskMap[name] || riskMap[wno];
        const color = w ? COLOR[w.priority_level] || COLOR.None : COLOR.None;
        return { fillColor: color, fillOpacity: 0.55, color: '#fff', weight: 2 };
      },
      onEachFeature: (feature, layer) => {
        const name = (feature.properties.ward_name || '').toLowerCase().trim();
        const wno  = String(feature.properties.ward_no || '');
        const w    = riskMap[name] || riskMap[wno];
        const label = feature.properties.ward_name || 'Unknown';

        layer.bindTooltip(`<strong>${label}</strong>${w ? `<br>Risk: ${fmtNum(w.risk_mean,1)} — ${w.priority_level}` : '<br>No data yet'}`, { sticky: true });

        layer.on('click', () => showWardDetail(feature.properties, w));
      }
    }).addTo(_map);

    _map.fitBounds(_wardLayer.getBounds(), { padding: [20, 20] });

    // Try to add hotspot layer
    try {
      const hotspots = await API.hotspotsGeoJSON();
      L.geoJSON(hotspots, {
        style: { color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.3, weight: 1 },
      }).bindTooltip('Pothole Hotspot').addTo(_map);
    } catch (_) {}

  } catch (err) {
    document.getElementById('ward-map').innerHTML =
      `<div class="empty-state" style="height:520px">${emptyState('Map Error', err.message)}</div>`;
  }
}

function showWardDetail(props, w) {
  const panel = document.getElementById('ward-detail-panel');
  const title = document.getElementById('ward-detail-title');
  const body  = document.getElementById('ward-detail-body');
  title.textContent = props.ward_name || 'Ward';
  panel.classList.remove('hidden');

  if (!w) {
    body.innerHTML = `<p class="text-muted text-sm">No risk data available for this ward. Run the pipeline first.</p>`;
    return;
  }

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.75rem">
      ${detailMetric('Risk Score', fmtNum(w.risk_mean,1) + '/100', riskColor(w.risk_mean))}
      ${detailMetric('Priority', w.priority_level)}
      ${detailMetric('Potholes Detected', fmtNum(w.potholes))}
      ${detailMetric('Road Length', fmtNum(w.km,2) + ' km')}
      ${detailMetric('Critical Roads', fmtNum(w.critical_km,2) + ' km')}
      ${detailMetric('Labour Required', fmtNum(w.labour_required) + ' persons')}
      ${detailMetric('Budget Estimate', '₹ ' + fmtNum(w.budget_estimate_lakh,1) + ' Lakh')}
      ${detailMetric('Est. Duration', w.estimated_days + ' days')}
    </div>
    <div style="margin-top:1rem">
      ${priorityBadge(w.priority_level)}
      <button class="btn btn-primary btn-sm" style="margin-left:.5rem" onclick="navigate('budget')">View Budget Plan →</button>
    </div>
  `;
}

function detailMetric(label, value, color='') {
  return `<div style="background:var(--gray-50);border-radius:var(--radius);padding:.75rem">
    <div style="font-size:.7rem;color:var(--gray-500);font-weight:500;margin-bottom:.25rem">${label}</div>
    <div style="font-size:1rem;font-weight:700;color:${color||'var(--gray-900)'}">${value}</div>
  </div>`;
}
