// Factory map viewer (pan/zoom + layer toggles) — Customs-style
(() => {
  const viewport = document.getElementById('viewport');
  const stage = document.getElementById('stage');
  const baseLayer = document.getElementById('baseLayer');
  const backToMapsBtn = document.getElementById("backToMapsBtn");

  const zoomReadout = document.getElementById('zoomReadout');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetBtn = document.getElementById('resetBtn');
  const fitBtn = document.getElementById('fitBtn');

  const panel = document.getElementById('panel');
  const togglePanelBtn = document.getElementById('togglePanelBtn');

  // ----- State -----
  let scale = 1;
  let x = 0;
  let y = 0;

  const MIN_SCALE = 0.07;
  const MAX_SCALE = 6.0;

  let dragging = false;
  let lastPx = 0;
  let lastPy = 0;

  // base image dimensions (natural)
  let mapW = 0;
  let mapH = 0;

  // ----- Helpers -----
  if (backToMapsBtn) {
    backToMapsBtn.addEventListener("click", () => {
      window.location.href = "../pages/maps.html";
    });
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function updateReadout() {
    if (!zoomReadout) return;
    zoomReadout.textContent = `${Math.round(scale * 100)}%`;
  }

  function applyTransform() {
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    updateReadout();
  }

  function centerOn(xCenter, yCenter) {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    x = (vw / 2) - (xCenter * scale);
    y = (vh / 2) - (yCenter * scale);
    applyTransform();
  }

  function fitToScreen() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (!mapW || !mapH) return;

    const sx = vw / mapW;
    const sy = vh / mapH;
    scale = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);

    // center
    const cx = mapW / 2;
    const cy = mapH / 2;
    centerOn(cx, cy);
  }

  function resetView() {
    scale = 1;
    x = 0;
    y = 0;
    applyTransform();
  }

  function zoomAt(deltaScale, clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    // world coords before zoom
    const wx = (px - x) / scale;
    const wy = (py - y) / scale;

    const next = clamp(scale * deltaScale, MIN_SCALE, MAX_SCALE);
    const actualFactor = next / scale;
    scale = next;

    // keep cursor anchored
    x = px - wx * scale;
    y = py - wy * scale;

    applyTransform();
  }

  // ----- Layer toggles -----
  const toggles = document.querySelectorAll('input[type="checkbox"][data-layer]');
  function setLayerVisible(id, visible) {
    const el = document.querySelector(`.layer[data-layer-id="${id}"]`);
    if (!el) return;
    el.classList.toggle('hidden', !visible);
  }

  toggles.forEach(cb => {
    setLayerVisible(cb.dataset.layer, cb.checked);
    cb.addEventListener('change', () => setLayerVisible(cb.dataset.layer, cb.checked));
  });

  // ----- Panel collapse -----
  if (togglePanelBtn && panel) {
    togglePanelBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      togglePanelBtn.textContent = panel.classList.contains('collapsed') ? 'Expand' : 'Collapse';
    });
  }

  // ----- Pan (pointer drag) -----
  viewport.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastPx = e.clientX;
    lastPy = e.clientY;
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPx;
    const dy = e.clientY - lastPy;
    lastPx = e.clientX;
    lastPy = e.clientY;
    x += dx;
    y += dy;
    applyTransform();
  });

  viewport.addEventListener('pointerup', (e) => {
    dragging = false;
    try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  viewport.addEventListener('pointercancel', () => { dragging = false; });

  // ----- Wheel zoom (trackpad/mouse) -----
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(dir, e.clientX, e.clientY);
  }, { passive: false });

  // ----- Zoom buttons -----
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
    const rect = viewport.getBoundingClientRect();
    zoomAt(1.15, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    const rect = viewport.getBoundingClientRect();
    zoomAt(0.85, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  if (resetBtn) resetBtn.addEventListener('click', resetView);
  if (fitBtn) fitBtn.addEventListener('click', fitToScreen);

  // ----- Init sizing once base image loads -----
  function syncLayerSizes() {
    // Ensure all layers match the base natural size
    mapW = baseLayer.naturalWidth || 0;
    mapH = baseLayer.naturalHeight || 0;
    if (!mapW || !mapH) return;

    stage.style.width = `${mapW}px`;
    stage.style.height = `${mapH}px`;

    // Set every layer to base size (absolute positioned)
    document.querySelectorAll('.factory-page .layer').forEach(img => {
      img.style.width = `${mapW}px`;
      img.style.height = `${mapH}px`;
    });
  }

  if (baseLayer && baseLayer.complete) {
    syncLayerSizes();
    fitToScreen();
  } else if (baseLayer) {
    baseLayer.addEventListener('load', () => {
      syncLayerSizes();
      fitToScreen();
    });
  }

  // Re-fit on resize (nice for rotating devices)
  window.addEventListener('resize', () => {
    // keep current center as best effort by just fitting again
    fitToScreen();
  });

  // initial paint
  applyTransform();
})();