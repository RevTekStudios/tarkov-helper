// static/js/app.js
(() => {
  // -------------------------------
  // Elements
  // -------------------------------
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

  const progressText = document.getElementById("progressText");
  const progressCounts = document.getElementById("progressCounts");
  const progressFill = document.getElementById("progressFill");
  const remainingList = document.getElementById("remainingList");

  // -------------------------------
  // State
  // -------------------------------
  let hideout = null;
  let progress = null;
  let activeModule = null;

  // LocalStorage key (bump version if schema changes)
  const LS_KEY = "eft_hideout_progress_v1";

  // -------------------------------
  // Storage (static replacement for /api/progress)
  // -------------------------------
  function loadProgress() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return { levels: {} };
      if (!parsed.levels || typeof parsed.levels !== "object") parsed.levels = {};
      return parsed;
    } catch {
      return { levels: {} };
    }
  }

  function saveProgress(p) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------
  // Data load (static replacement for /api/hideout)
  // -------------------------------
  async function loadHideout() {
    // This fetches directly from your repo/site:
    // /data/hideout_data.json (relative)
    const res = await fetch("data/hideout_data.json", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Failed to load hideout_data.json (${res.status})`);
    const data = await res.json();
    // Expected: { "modules": [...] }
    if (!data || typeof data !== "object" || !Array.isArray(data.modules)) {
      throw new Error("hideout_data.json is missing { modules: [...] }");
    }
    return data;
  }

  // -------------------------------
  // UI helpers
  // -------------------------------
  function renderRemaining(remainingObj) {
    remainingList.innerHTML = "";
    const entries = Object.entries(remainingObj || {})
      .filter(([_, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1]); // biggest first

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

      // Normalize icon path so GitHub Pages always resolves correctly
      const iconSrc = new URL(m.icon, window.location.href).toString();

      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("role", "button");
      tile.setAttribute("tabindex", "0");

      tile.innerHTML = `
        <img class="tile-icon" src="${iconSrc}" alt="${m.name} icon" />
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

    const req = moduleObj.upgrades?.[String(next)] || [];
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

    // Normalize icon path here too
    modalIcon.src = new URL(moduleObj.icon, window.location.href).toString();
    modalIcon.alt = `${moduleObj.name} icon`;
    modalTitle.textContent = moduleObj.name;

    const next = Math.min(current + 1, moduleObj.max_level);
    modalMeta.textContent = `Level ${current} → Next: Level ${next}`;

    renderLevelSelect(moduleObj.max_level, current);
    renderRequirements(moduleObj, current);

    saveHint.textContent = "";
    showModal();
  }

  // -------------------------------
  // Summary (static replacement for /api/summary)
  // -------------------------------
  function computeSummary(hideoutData, progressData) {
    const levels = progressData?.levels || {};

    let total_levels = 0;
    let done_levels = 0;

    const remaining = {}; // item -> qty remaining
    const remaining_fir = {}; // item -> qty remaining where FIR is ever required

    for (const m of hideoutData.modules || []) {
      const mid = m.id;
      const max_level = Number(m.max_level || 0);
      const cur = Number(levels[mid] || 0);

      total_levels += max_level;
      done_levels += Math.min(cur, max_level);

      // Remaining: sum requirements for levels > cur
      const upgrades = m.upgrades || {};
      for (const [lvlStr, reqs] of Object.entries(upgrades)) {
        const lvl = Number(lvlStr);
        if (lvl <= cur) continue;

        for (const r of reqs || []) {
          const item = (r.item || "").trim();
          const qty = Number(r.qty || 0);
          if (!item || qty <= 0) continue;

          remaining[item] = (remaining[item] || 0) + qty;

          if (r.fir === true) {
            remaining_fir[item] = (remaining_fir[item] || 0) + qty;
          }
        }
      }
    }

    const percent =
      total_levels === 0 ? 100.0 : Math.round((done_levels / total_levels) * 10000) / 100;

    return {
      completion: {
        done_levels,
        total_levels,
        percent,
      },
      remaining,
      remaining_fir,
    };
  }

  function refreshSummary() {
    const sum = computeSummary(hideout, progress);

    const pct = sum.completion.percent;
    progressText.textContent = `Hideout Completion: ${pct}%`;
    progressCounts.textContent = `${sum.completion.done_levels} / ${sum.completion.total_levels} levels`;
    progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    renderRemaining(sum.remaining);
  }

  // -------------------------------
  // Save flow (static replacement for POST /api/progress)
  // -------------------------------
  saveLevelBtn.addEventListener("click", () => {
    if (!activeModule) return;

    const newLevel = parseInt(levelSelect.value, 10);

    if (!activeModule.id || !Number.isInteger(newLevel) || newLevel < 0) {
      saveHint.textContent = "Invalid level.";
      return;
    }

    progress.levels = progress.levels || {};
    progress.levels[activeModule.id] = newLevel;

    const ok = saveProgress(progress);
    if (!ok) {
      saveHint.textContent = "Save failed (storage blocked?).";
      return;
    }

    refreshSummary();

    // Update tiles without re-rendering everything
    const tiles = [...grid.querySelectorAll(".tile")];
    const idx = hideout.modules.findIndex((m) => m.id === activeModule.id);
    const tile = tiles[idx];
    if (tile) setTileLevelBar(tile, newLevel);

    // Update modal view
    const next = Math.min(newLevel + 1, activeModule.max_level);
    modalMeta.textContent = `Level ${newLevel} → Next: Level ${next}`;
    renderRequirements(activeModule, newLevel);

    saveHint.textContent = "Saved.";
  });

  // -------------------------------
  // Boot
  // -------------------------------
  (async () => {
    try {
      hideout = await loadHideout();
      progress = loadProgress();

      renderTiles();
      refreshSummary();
    } catch (err) {
      console.error(err);
      // Minimal visible error for users:
      progressText.textContent = "Error loading tracker data.";
      progressCounts.textContent = "";
      if (remainingList) {
        remainingList.innerHTML = `<div class="hint">Could not load hideout_data.json. Check console.</div>`;
      }
    }
  })();
})();