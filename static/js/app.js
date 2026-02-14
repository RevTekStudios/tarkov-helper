(async () => {
  const grid = document.getElementById("tileGrid");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const modal = document.getElementById("moduleModal");
  const modalClose = document.getElementById("modalClose");

  const modalIcon = document.getElementById("modalIcon");
  const modalTitle = document.getElementById("modalTitle");
  const modalMeta = document.getElementById("modalMeta");

  const levelSelect = document.getElementById("levelSelect");
  const saveLevelBtn = document.getElementById("saveLevelBtn");
  const saveHint = document.getElementById("saveHint");

  const reqList = document.getElementById("reqList");
  const reqEmpty = document.getElementById("reqEmpty");

  const progressText   = document.getElementById("progressText");
  const progressCounts = document.getElementById("progressCounts");
  const progressFill   = document.getElementById("progressFill");
  const remainingList  = document.getElementById("remainingList");

  let hideout = null;
  let progress = null;
  let activeModule = null;

  function renderRemaining(remainingObj) {
    remainingList.innerHTML = "";
    const entries = Object.entries(remainingObj || {})
      .filter(([_, qty]) => qty > 0)
      .sort((a,b) => b[1] - a[1]); // biggest first

    // keep it readable (top 60). we can add search later.
    entries.slice(0, 60).forEach(([item, qty]) => {
      const row = document.createElement("div");
      row.className = "remaining-item";
      row.innerHTML = `<div>${item}</div><div class="qty">× ${qty}</div>`;
      remainingList.appendChild(row);
    });

    if (!entries.length) {
      const row = document.createElement("div");
      row.className = "hint";
      row.textContent = "Nothing remaining — hideout complete.";
      remainingList.appendChild(row);
    }
  }

  async function refreshSummary() {
    const sum = await getJSON("/api/summary");
    if (!sum.ok) return;

    const pct = sum.completion.percent;
    progressText.textContent = `Hideout Completion: ${pct}%`;
    progressCounts.textContent = `${sum.completion.done_levels} / ${sum.completion.total_levels} levels`;
    progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    renderRemaining(sum.remaining);
  }

  function showModal() {
    modalBackdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
    modalBackdrop.setAttribute("aria-hidden", "false");
  }

  function hideModal() {
    modalBackdrop.classList.add("hidden");
    modal.classList.add("hidden");
    modalBackdrop.setAttribute("aria-hidden", "true");
    activeModule = null;
  }

  modalBackdrop.addEventListener("click", hideModal);
  modalClose.addEventListener("click", hideModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });

  async function getJSON(url) {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    return res.json();
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  function getLevel(moduleId) {
    return (progress?.levels?.[moduleId] ?? 0) | 0;
  }

  // NEW: update the bottom level bar (replaces badge behavior)
  function setTileLevelBar(tile, lvl) {
    const bar = tile.querySelector(".tile-levelbar");
    if (!bar) return;
    bar.setAttribute("data-level", String(lvl));
    bar.textContent = `Level ${lvl}`;
  }

  function renderTiles() {
    grid.innerHTML = "";
    hideout.modules.forEach((m) => {
      const lvl = getLevel(m.id);

      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("role", "button");
      tile.setAttribute("tabindex", "0");

      // Removed: top-right badge
      // Replaced: bottom level bar
      tile.innerHTML = `
        <img class="tile-icon" src="${m.icon}" alt="${m.name} icon" />
        <div class="tile-name">${m.name}</div>
        <div class="tile-levelbar" data-level="${lvl}">Level ${lvl}</div>
      `;

      const open = () => openModule(m.id);
      tile.addEventListener("click", open);
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") open();
      });

      grid.appendChild(tile);
    });
  }

  function renderLevelSelect(maxLevel, current) {
    levelSelect.innerHTML = "";
    for (let i = 0; i <= maxLevel; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === current) opt.selected = true;
      levelSelect.appendChild(opt);
    }
  }

  function renderRequirements(moduleObj, currentLevel) {
    // Next upgrade = current + 1 (if exists)
    const next = currentLevel + 1;

    reqList.innerHTML = "";
    reqEmpty.classList.add("hidden");

    if (next > moduleObj.max_level) {
      reqEmpty.classList.remove("hidden");
      return;
    }

    const req = moduleObj.upgrades[String(next)] || [];
    if (!req.length) {
      reqEmpty.classList.remove("hidden");
      return;
    }

    req.forEach((r) => {
      const row = document.createElement("div");
      row.className = "req-item";
      row.innerHTML = `
        <div><strong>${r.item}</strong>${r.note ? ` <span class="hint">(${r.note})</span>` : ""}</div>
        <div>× ${r.qty}</div>
      `;
      reqList.appendChild(row);
    });
  }

  function openModule(moduleId) {
    const moduleObj = hideout.modules.find((m) => m.id === moduleId);
    if (!moduleObj) return;

    activeModule = moduleObj;

    const current = getLevel(moduleObj.id);

    modalIcon.src = moduleObj.icon;
    modalIcon.alt = `${moduleObj.name} icon`;
    modalTitle.textContent = moduleObj.name;

    const next = Math.min(current + 1, moduleObj.max_level);
    modalMeta.textContent = `Level ${current} → Next: Level ${next}`;

    renderLevelSelect(moduleObj.max_level, current);
    renderRequirements(moduleObj, current);

    saveHint.textContent = "";
    showModal();
  }

  saveLevelBtn.addEventListener("click", async () => {
    if (!activeModule) return;

    const newLevel = parseInt(levelSelect.value, 10);
    const resp = await postJSON("/api/progress", { module_id: activeModule.id, level: newLevel });

    if (!resp.ok) {
      saveHint.textContent = "Save failed.";
      return;
    }

    progress = resp.progress;
    await refreshSummary();

    // Update tiles without re-rendering everything
    const tiles = [...grid.querySelectorAll(".tile")];
    const idx = hideout.modules.findIndex((m) => m.id === activeModule.id);
    const tile = tiles[idx];
    if (tile) {
      setTileLevelBar(tile, newLevel);
    }

    // Update modal view
    const next = Math.min(newLevel + 1, activeModule.max_level);
    modalMeta.textContent = `Level ${newLevel} → Next: Level ${next}`;
    renderRequirements(activeModule, newLevel);

    saveHint.textContent = "Saved.";
  });

  // Boot
  const hideoutResp = await getJSON("/api/hideout");
  const progResp = await getJSON("/api/progress");

  hideout = hideoutResp.data;
  progress = progResp.progress;

  renderTiles();
  await refreshSummary();

})();