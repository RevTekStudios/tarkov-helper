(() => {
  const viewport = document.getElementById("viewport");
  const stage = document.getElementById("stage");
  const img = document.getElementById("map");

  const backBtn = document.getElementById("backBtn");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomResetBtn = document.getElementById("zoomResetBtn");

  backBtn.addEventListener("click", () => location.href = "customs.html");

  let scale = 1, tx = 0, ty = 0;

  // ✅ allow zooming out further (entire map visible + extra space)
  const MIN_SCALE = 0.10;   // was 0.5
  const MAX_SCALE = 6;      // was 5

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function update(){
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function fit(){
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;

    stage.style.width = iw + "px";
    stage.style.height = ih + "px";
    img.style.width = iw + "px";
    img.style.height = ih + "px";

    const s = Math.min(vw / iw, vh / ih);
    scale = clamp(s, MIN_SCALE, MAX_SCALE);

    tx = (vw - iw * scale) / 2;
    ty = (vh - ih * scale) / 2;

    update();
  }

  function zoomAt(clientX, clientY, factor){
    const prev = scale;
    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    if (next === prev) return;

    const r = viewport.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;

    const wx = (x - tx) / prev;
    const wy = (y - ty) / prev;

    scale = next;
    tx = x - wx * scale;
    ty = y - wy * scale;

    update();
  }

  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1/1.12);
  }, { passive:false });

  let dragging = false, lastX = 0, lastY = 0;

  viewport.addEventListener("pointerdown", (e) => {
    dragging = true;
    viewport.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    tx += (e.clientX - lastX);
    ty += (e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
    update();
  });

  function endDrag(){ dragging = false; }
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("pointerleave", endDrag);

  zoomInBtn.addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width/2, r.top + r.height/2, 1.2);
  });

  zoomOutBtn.addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width/2, r.top + r.height/2, 1/1.2);
  });

  zoomResetBtn.addEventListener("click", fit);

  img.addEventListener("load", fit);
  window.addEventListener("resize", fit);

  // If cached
  if (img.complete && img.naturalWidth) fit();
})();