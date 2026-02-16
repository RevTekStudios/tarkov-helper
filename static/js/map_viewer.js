(async () => {
  const params = new URLSearchParams(location.search);
  const slug = (params.get('map') || '').trim() || 'customs';

  const titleEl = document.getElementById('mapTitle');
  const backBtn = document.getElementById('backBtn');
  const resetBtn = document.getElementById('resetBtn');
  const shareBtn = document.getElementById('shareBtn');
  const searchInput = document.getElementById('searchInput');
  const layerList = document.getElementById('layerList');
  const detailsBody = document.getElementById('detailsBody');

  backBtn?.addEventListener('click', () => location.href = '/maps/index.html');

  const [layersDef, mapCfg, markers] = await Promise.all([
    fetch('/assets/maps/layers.json', { cache: 'no-store' }).then(r => r.json()),
    fetch(`/assets/maps/${slug}/map.json`, { cache: 'no-store' }).then(r => r.json()),
    fetch(`/assets/maps/${slug}/markers.json`, { cache: 'no-store' }).then(r => r.json())
  ]);

  titleEl.textContent = mapCfg.name;

  // Sidebar
  const sidebar = L.control.sidebar({ container: 'sidebar', position: 'left' }).addTo(
    L.map('map', { zoomControl: true, preferCanvas: true })
  );

  // Leaflet map instance (we created it inline above)
  const map = sidebar._map;

  // IMPORTANT: CRS.Simple makes this an "image space" map (not lat/lng) :contentReference[oaicite:4]{index=4}
  map.options.crs = L.CRS.Simple;

  // Derived bounds in "map units" using unproject
  const maxZ = mapCfg.maxZoom;
  const imgW = mapCfg.imgSize.w;
  const imgH = mapCfg.imgSize.h;

  const southWest = map.unproject([0, imgH], maxZ);
  const northEast = map.unproject([imgW, 0], maxZ);
  const bounds = new L.LatLngBounds(southWest, northEast);

  // Tiles: standard {z}/{x}/{y} layer (crisp like real web maps)
  const tileLayer = L.tileLayer(mapCfg.tileUrl, {
    minZoom: mapCfg.minZoom,
    maxZoom: mapCfg.maxZoom,
    bounds,
    noWrap: true,
    tileSize: mapCfg.tileSize || 256
  }).addTo(map);

  map.setMaxBounds(bounds.pad(0.15));

  // Initial view (pixel -> latlng)
  const start = mapCfg.start || { x: imgW / 2, y: imgH / 2, z: Math.floor((mapCfg.minZoom + mapCfg.maxZoom) / 2) };
  map.setView(map.unproject([start.x, start.y], maxZ), start.z);

  resetBtn?.addEventListener('click', () => {
    map.setView(map.unproject([start.x, start.y], maxZ), start.z);
  });

  shareBtn?.addEventListener('click', async () => {
    const enabled = getEnabledTypes();
    const q = new URLSearchParams(location.search);
    q.set('map', slug);
    q.set('layers', enabled.join(','));
    q.set('q', (searchInput?.value || '').trim());
    const url = `${location.origin}/maps/map.html?${q.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = 'Copied';
      setTimeout(() => (shareBtn.textContent = 'Share'), 900);
    } catch {
      prompt('Copy this link:', url);
    }
  });

  // --- Marker groups (clustered) ---
  // MarkerCluster is MIT and widely used :contentReference[oaicite:5]{index=5}
  const clustersByType = new Map();

  function ensureCluster(type) {
    if (!clustersByType.has(type)) {
      clustersByType.set(type, L.markerClusterGroup({
        // Keep it snappy (defaults are fine; tweak later)
        showCoverageOnHover: false
      }));
    }
    return clustersByType.get(type);
  }

  // Build markers
  markers.forEach(m => {
    const ll = map.unproject([m.x, m.y], maxZ);

    const marker = L.circleMarker(ll, {
      radius: 7,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.45
    });

    marker.on('click', () => {
      detailsBody.innerHTML = `
        <div style="font-weight:800; font-size:16px; margin-bottom:6px;">${escapeHtml(m.name)}</div>
        <div class="muted" style="margin-bottom:10px;">${escapeHtml(m.type)} · ${escapeHtml((m.tags||[]).join(', '))}</div>
        <div class="muted">x: ${m.x} · y: ${m.y}</div>
      `;
      sidebar.open('details');
    });

    ensureCluster(m.type).addLayer(marker);
  });

  // --- UI: layer toggles + search ---
  const knownTypes = Object.keys(layersDef);
  const markerCounts = markers.reduce((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {});

  function getEnabledTypes() {
    return [...layerList.querySelectorAll('input[type="checkbox"]')]
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }

  function applyLayersAndFilter() {
    // remove all clusters
    clustersByType.forEach(group => map.removeLayer(group));

    const enabled = new Set(getEnabledTypes());
    const q = (searchInput?.value || '').trim().toLowerCase();

    clustersByType.forEach((group, type) => {
      if (!enabled.has(type)) return;

      // Filter inside cluster by rebuilding if searching
      if (!q) {
        map.addLayer(group);
        return;
      }

      // Build a filtered group on the fly (fast enough for MVP)
      const filtered = L.markerClusterGroup({ showCoverageOnHover: false });
      group.eachLayer(layer => {
        // layer is circleMarker; we need corresponding marker data
        // easiest: store “meta” on layer when created (future improvement)
        filtered.addLayer(layer);
      });

      // NOTE: for true text filtering, we should rebuild markers from `markers`
      // (we’ll do that next pass). For now, we’ll filter by toggling clusters only.
      map.addLayer(filtered);
    });

    // URL state
    const qParams = new URLSearchParams(location.search);
    qParams.set('map', slug);
    qParams.set('layers', [...enabled].join(','));
    qParams.set('q', q);
    history.replaceState({}, '', `${location.pathname}?${qParams.toString()}`);
  }

  // Render checkboxes
  const initialLayers = (params.get('layers') || '').split(',').map(s => s.trim()).filter(Boolean);
  const enabledInit = new Set(initialLayers.length ? initialLayers : knownTypes);

  layerList.innerHTML = knownTypes.map(t => {
    const label = layersDef[t]?.label || t;
    const count = markerCounts[t] || 0;
    const checked = enabledInit.has(t) ? 'checked' : '';
    return `
      <label class="layer-item">
        <input type="checkbox" value="${t}" ${checked}/>
        <span class="label">${escapeHtml(label)}</span>
        <span class="count">${count}</span>
      </label>
    `;
  }).join('');

  // Hook events
  layerList.addEventListener('change', applyLayersAndFilter);
  searchInput?.addEventListener('input', debounce(applyLayersAndFilter, 120));

  // Open sidebar by default on desktop-ish widths
  if (window.innerWidth >= 900) sidebar.open('layers');

  // Add enabled layers initially
  knownTypes.forEach(t => {
    if (enabledInit.has(t)) map.addLayer(ensureCluster(t));
  });

  // preload query
  const qInit = (params.get('q') || '').trim();
  if (qInit && searchInput) searchInput.value = qInit;

  // helpers
  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
})();