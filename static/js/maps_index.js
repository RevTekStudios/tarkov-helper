(async () => {
  const grid = document.getElementById('mapsGrid');
  if (!grid) return;

  const res = await fetch('/assets/maps/manifest.json', { cache: 'no-store' });
  const maps = await res.json();

  grid.innerHTML = maps.map(m => `
    <a class="map-card" href="/maps/map.html?map=${encodeURIComponent(m.slug)}">
      <img src="${m.thumb}" alt="${m.name} map thumbnail">
      <div class="meta">
        <div class="name">${m.name}</div>
        <div class="hint">Open interactive map →</div>
      </div>
    </a>
  `).join('');
})();