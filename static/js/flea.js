// static/js/flea.js
(() => {
  const API_URL = "https://api.tarkov.dev/graphql";

  // Elements
  const searchInput = document.getElementById("searchInput");
  const refreshBtn  = document.getElementById("refreshBtn");
  const statusLine  = document.getElementById("statusLine");
  const itemsTbody  = document.getElementById("itemsTbody");

  const detailEmpty  = document.getElementById("detailEmpty");
  const detailBody   = document.getElementById("detailBody");
  const detailIcon   = document.getElementById("detailIcon");
  const detailName   = document.getElementById("detailName");
  const detailMeta   = document.getElementById("detailMeta");
  const detailAvg    = document.getElementById("detailAvg");
  const detailChange = document.getElementById("detailChange");
  const detailLink   = document.getElementById("detailLink");
  const detailSellFor= document.getElementById("detailSellFor");

  // State
  let items = [];
  let filtered = [];
  let selectedId = null;

  // Cache (to avoid hammering API on every reload)
  const CACHE_KEY = "eft_flea_items_v1";
  const CACHE_MS  = 10 * 60 * 1000; // 10 minutes

  function fmtRub(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x)) return "—";
    return x.toLocaleString("en-US") + " ₽";
  }

  function fmtPct(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    const sign = x > 0 ? "+" : "";
    return `${sign}${x.toFixed(1)}%`;
  }

  function setStatus(msg) {
    statusLine.textContent = msg || "";
  }

  async function gql(query, variables) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: variables || {} })
    });
    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || "GraphQL error");
    }
    return json.data;
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;
      if (!Array.isArray(obj.items)) return null;
      if (!obj.ts || (Date.now() - obj.ts) > CACHE_MS) return null;
      return obj.items;
    } catch {
      return null;
    }
  }

  function saveCache(list) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: list }));
    } catch {
      // ignore
    }
  }

  async function loadItems(force = false) {
    setStatus("Loading flea data…");

    if (!force) {
      const cached = loadCache();
      if (cached) {
        items = cached;
        setStatus(`Loaded ${items.length} items (cached).`);
        return;
      }
    }

    // Keep this query LIGHT for GitHub Pages + friends use.
    // We’ll pull deeper details only when you click an item.
    const QUERY = `
      query {
        items {
          id
          name
          shortName
          avg24hPrice
          changeLast48hPercent
          iconLink
          link
        }
      }
    `;

    const data = await gql(QUERY);
    items = (data?.items || []).filter(Boolean);
    saveCache(items);
    setStatus(`Loaded ${items.length} items.`);
  }

  function applyFilter() {
    const q = (searchInput.value || "").trim().toLowerCase();
    if (!q) {
      filtered = items.slice(0, 250); // keep DOM sane by default
      return;
    }
    filtered = items
      .filter(it => {
        const n = (it.name || "").toLowerCase();
        const s = (it.shortName || "").toLowerCase();
        return n.includes(q) || s.includes(q);
      })
      .slice(0, 500);
  }

  function renderTable() {
    itemsTbody.innerHTML = "";

    if (!filtered.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4" class="muted">No results.</td>`;
      itemsTbody.appendChild(tr);
      return;
    }

    for (const it of filtered) {
      const tr = document.createElement("tr");
      tr.className = "market-row" + (it.id === selectedId ? " selected" : "");
      tr.tabIndex = 0;

      const change = Number(it.changeLast48hPercent);
      const changeClass =
        Number.isFinite(change) ? (change > 0 ? "pos" : change < 0 ? "neg" : "neu") : "neu";

      tr.innerHTML = `
        <td><img class="market-icon" src="${it.iconLink || ""}" alt=""></td>
        <td>
          <div class="market-item-name">${it.name || "—"}</div>
          <div class="market-item-sub muted">${it.shortName || ""}</div>
        </td>
        <td>${fmtRub(it.avg24hPrice)}</td>
        <td class="${changeClass}">${fmtPct(change)}</td>
      `;

      const open = () => selectItem(it.id);
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") open();
      });

      itemsTbody.appendChild(tr);
    }
  }

  async function selectItem(itemId) {
    selectedId = itemId;
    renderTable();

    detailEmpty.classList.add("hidden");
    detailBody.classList.remove("hidden");
    detailSellFor.innerHTML = `<div class="hint">Loading item details…</div>`;

    // Pull deeper data only for the clicked item.
    // Using items(ids: [...]) is common in this API; if it ever changes, we’ll adjust here.
    const QUERY = `
      query ($ids: [ID!]!) {
        items(ids: $ids) {
          id
          name
          shortName
          avg24hPrice
          changeLast48hPercent
          iconLink
          link
          sellFor {
            price
            source
          }
        }
      }
    `;

    try {
      const data = await gql(QUERY, { ids: [itemId] });
      const it = (data?.items || [])[0];
      if (!it) throw new Error("Item not found.");

      detailIcon.src = it.iconLink || "";
      detailIcon.alt = it.name ? `${it.name} icon` : "";
      detailName.textContent = it.name || "—";
      detailMeta.textContent = it.shortName ? it.shortName : "";

      detailAvg.textContent = fmtRub(it.avg24hPrice);

      const ch = Number(it.changeLast48hPercent);
      detailChange.textContent = fmtPct(ch);
      detailChange.className = "metric-val " + (ch > 0 ? "pos" : ch < 0 ? "neg" : "neu");

      // tarkov.dev link (relative or full depending on API)
      if (it.link) {
        detailLink.href = it.link.startsWith("http") ? it.link : ("https://tarkov.dev" + it.link);
      } else {
        detailLink.href = "https://tarkov.dev/";
      }

      const sell = Array.isArray(it.sellFor) ? it.sellFor.slice() : [];
      sell.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));

      detailSellFor.innerHTML = "";
      if (!sell.length) {
        detailSellFor.innerHTML = `<div class="hint">No sell-for data.</div>`;
      } else {
        sell.slice(0, 10).forEach(s => {
          const row = document.createElement("div");
          row.className = "sellfor-row";
          row.innerHTML = `<div class="muted">${s.source || "—"}</div><div>${fmtRub(s.price)}</div>`;
          detailSellFor.appendChild(row);
        });
      }
    } catch (err) {
      console.error(err);
      detailSellFor.innerHTML = `<div class="hint">Failed to load item details. Check console.</div>`;
    }
  }

  // Events
  searchInput?.addEventListener("input", () => {
    applyFilter();
    renderTable();
  });

  refreshBtn?.addEventListener("click", async () => {
    try {
      await loadItems(true);
      applyFilter();
      renderTable();
    } catch (err) {
      console.error(err);
      setStatus("Refresh failed. Check console.");
    }
  });

  // Boot
  (async () => {
    try {
      await loadItems(false);
      applyFilter();
      renderTable();
      setStatus(statusLine.textContent + " Tip: search to narrow results.");
    } catch (err) {
      console.error(err);
      setStatus("Error loading flea data. Check console.");
    }
  })();
})();