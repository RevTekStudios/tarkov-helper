(() => {
  // ============================
  // CONFIG
  // ============================
  const STORAGE_KEY = "tarkov.maps.customs.layers.v1";

  const LAYERS = [
    "pmcExtracts","scavExtracts","transits",
    "pmcSpawns","scavSpawns","sniperSpawns","bossSpawns",
  ];

  const PRESETS = {
    base:     { pmcExtracts:false, scavExtracts:false, transits:false, pmcSpawns:false, scavSpawns:false, sniperSpawns:false, bossSpawns:false },
    extracts: { pmcExtracts:true,  scavExtracts:true,  transits:true,  pmcSpawns:false, scavSpawns:false, sniperSpawns:false, bossSpawns:false },
    spawns:   { pmcExtracts:false, scavExtracts:false, transits:false, pmcSpawns:true,  scavSpawns:true,  sniperSpawns:true,  bossSpawns:false },
    boss:     { pmcExtracts:false, scavExtracts:false, transits:false, pmcSpawns:false, scavSpawns:false, sniperSpawns:true,  bossSpawns:true  },
  };

  // ============================
  // DOM
  // ============================
  const stage   = document.getElementById("stage");
  const backToMapsBtn = document.getElementById("backToMapsBtn");
  const viewport= document.getElementById("viewport");
  const base    = document.getElementById("base");

  const hotspots     = document.getElementById("hotspots");
  const dormsHotspot = document.getElementById("dormsHotspot");

  const layersPanel  = document.getElementById("layersPanel");
  const togglePanelBtn = document.getElementById("togglePanelBtn");

  const zoomInBtn    = document.getElementById("zoomInBtn");
  const zoomOutBtn   = document.getElementById("zoomOutBtn");
  const zoomResetBtn = document.getElementById("zoomResetBtn");

  // ============================
  // HELPERS
  // ============================
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function isHotspotEvent(e){
    return e.target && (e.target.closest && e.target.closest("#hotspots"));
  }

  function getSavedState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const out = {};
      for (const k of LAYERS) out[k] = !!obj[k];
      return out;
    } catch {
      return null;
    }
  }

  if (backToMapsBtn) {
    backToMapsBtn.addEventListener("click", () => {
      window.location.href = "../pages/maps.html";
    });
  }

  function saveState(state){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function applyState(state){
    for (const id of LAYERS) {
      const img = document.getElementById(id);
      const cb  = document.querySelector(`input[data-layer="${id}"]`);
      const on  = !!state[id];
      if (img) img.classList.toggle("hidden", !on);
      if (cb)  cb.checked = on;
    }
  }

  function readStateFromUI(){
    const state = {};
    for (const id of LAYERS) {
      const cb = document.querySelector(`input[data-layer="${id}"]`);
      state[id] = cb ? cb.checked : false;
    }
    return state;
  }

  function setPreset(name){
    const preset = PRESETS[name];
    if (!preset) return;
    applyState(preset);
    saveState(preset);
  }

  // ============================
  // LAYERS UI
  // ============================
  document.querySelectorAll('input[data-layer]').forEach(cb => {
    cb.addEventListener("change", () => {
      const id  = cb.getAttribute("data-layer");
      const img = document.getElementById(id);
      if (img) img.classList.toggle("hidden", !cb.checked);
      saveState(readStateFromUI());
    });
  });

  document.querySelectorAll('button[data-preset]').forEach(btn => {
    btn.addEventListener("click", () => setPreset(btn.getAttribute("data-preset")));
  });

  togglePanelBtn.addEventListener("click", () => {
    layersPanel.classList.toggle("collapsed");
    togglePanelBtn.textContent = layersPanel.classList.contains("collapsed") ? "▸" : "▾";
  });

  // ============================
  // HOTSPOT CLICK
  // ============================
  dormsHotspot.addEventListener("click", () => {
    window.location.href = "customs-dorms.html";
  });

  // Stop hotspot pointerdown from bubbling into viewport drag start
  hotspots.addEventListener("pointerdown", (e) => e.stopPropagation());

  // ============================
  // ZOOM / PAN
  // ============================
  let scale = 1;
  let tx = 0, ty = 0;

  // Allow zooming out far enough to see entire map
  const MIN_SCALE = 0.10;
  const MAX_SCALE = 6;

  function updateTransform(){
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function fitInitial(){
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const iw = base.naturalWidth;
    const ih = base.naturalHeight;

    const s = Math.min(vw / iw, vh / ih);
    scale = clamp(s, MIN_SCALE, MAX_SCALE);

    tx = (vw - iw * scale) / 2;
    ty = (vh - ih * scale) / 2;

    updateTransform();
  }

  function zoomAt(clientX, clientY, deltaScale){
    const prev = scale;
    const next = clamp(scale * deltaScale, MIN_SCALE, MAX_SCALE);
    if (next === prev) return;

    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // world coords before zoom
    const wx = (x - tx) / prev;
    const wy = (y - ty) / prev;

    scale = next;

    // keep same world point under cursor
    tx = x - wx * scale;
    ty = y - wy * scale;

    updateTransform();
  }

  // mouse wheel zoom
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1.12 : 1/1.12;
    zoomAt(e.clientX, e.clientY, dir);
  }, { passive:false });

  // drag pan (pointer events)
  let dragging = false;
  let lastX = 0, lastY = 0;

  viewport.addEventListener("pointerdown", (e) => {
    // If they started on the dorms outline, let the click happen (no drag capture)
    if (isHotspotEvent(e)) return;

    dragging = true;
    viewport.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    tx += dx;
    ty += dy;
    updateTransform();
  });

  function endDrag(){ dragging = false; }
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("pointerleave", endDrag);

  // zoom buttons
  zoomInBtn.addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width/2, r.top + r.height/2, 1.2);
  });

  zoomOutBtn.addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width/2, r.top + r.height/2, 1/1.2);
  });

  zoomResetBtn.addEventListener("click", fitInitial);

  // ============================
  // SIZE BASE + OVERLAYS + SVG
  // ============================
  function sizeOverlaysToBase(){
    const iw = base.naturalWidth;
    const ih = base.naturalHeight;

    // make stage match image natural size
    stage.style.width = iw + "px";
    stage.style.height = ih + "px";

    // make every layer match that same coordinate system
    document.querySelectorAll(".layer").forEach(img => {
      img.style.width = iw + "px";
      img.style.height = ih + "px";
    });

    // make hotspot svg match image coords
    hotspots.setAttribute("width", iw);
    hotspots.setAttribute("height", ih);
    hotspots.setAttribute("viewBox", `0 0 ${iw} ${ih}`);

    // --- Dorms hotspot box (move right + up) ---
    // Start with the ORIGINAL box you had (in image pixel coords)
    const x1 = 2400;
    const y1 = 3500;
    const x2 = 3100;
    const y2 = 4200;

    // Box size
    const w = x2 - x1;
    const h = y2 - y1;

    // Move: 1 full box width to the right, and 1/2 box height up
    const dx = w * 1.3;        // right 1 box
    const dy = -h / 2;   // up 1/2 box

    const nx1 = x1 + dx;
    const ny1 = y1 + dy;
    const nx2 = x2 + dx;
    const ny2 = y2 + dy;

    dormsHotspot.setAttribute(
    "points",
    `${nx1},${ny1} ${nx2},${ny1} ${nx2},${ny2} ${nx1},${ny2}`
    );
  }


  // ============================
  // BOOT
  // ============================
  base.addEventListener("load", () => {
    sizeOverlaysToBase();

    const saved = getSavedState();
    if (saved) applyState(saved);
    else setPreset("base");

    fitInitial();
  });

  // If cached and already complete, run immediately
  if (base.complete && base.naturalWidth) {
    sizeOverlaysToBase();
    const saved = getSavedState();
    if (saved) applyState(saved);
    else setPreset("base");
    fitInitial();
  }

  window.addEventListener("resize", fitInitial);
})();