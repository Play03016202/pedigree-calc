/* stats.js — Population statistics panel */
window.App = window.App || {};

App.Stats = (() => {
  function render() {
    const inds = App.Store.getAll();
    if (inds.length === 0) {
      document.getElementById('stats-content').innerHTML =
        '<div style="color:#8b949e;font-size:12px">個体データがありません</div>';
      return;
    }

    App.NRM.ensureBuilt();

    const Fvals = inds.map(i => i.F);
    const avgF  = Fvals.reduce((a, b) => a + b, 0) / Fvals.length;
    const maxF  = Math.max(...Fvals);
    const inbredCount = Fvals.filter(f => f > 0).length;

    // ΔF and Ne estimation using generation-based approach
    const byGen = {};
    for (const ind of inds) {
      const g = ind.generationDepth;
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(ind.F);
    }
    const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);
    let Ne = null;
    let deltaF = null;
    if (gens.length >= 2) {
      const g1 = gens[gens.length - 2];
      const g2 = gens[gens.length - 1];
      const avgF1 = byGen[g1].reduce((a, b) => a + b, 0) / byGen[g1].length;
      const avgF2 = byGen[g2].reduce((a, b) => a + b, 0) / byGen[g2].length;
      if (avgF1 < 1) {
        deltaF = (avgF2 - avgF1) / (1 - avgF1);
        if (deltaF > 0) Ne = Math.round(1 / (2 * deltaF));
      }
    }

    // Build histogram bins
    const bins = [
      { label: 'F=0', min: -Infinity, max: 0.00001, color: '#484f58' },
      { label: '<6.25%', min: 0.00001, max: 0.0625,  color: '#2ea043' },
      { label: '<12.5%', min: 0.0625,  max: 0.125,   color: '#b08800' },
      { label: '<25%',   min: 0.125,   max: 0.25,    color: '#cf6f00' },
      { label: '≥25%',  min: 0.25,    max: Infinity, color: '#da3633' },
    ];
    const counts = bins.map(b => Fvals.filter(f => f >= b.min && f < b.max).length);
    const maxCount = Math.max(...counts, 1);

    const neWarn = Ne !== null && Ne < 50
      ? `<div class="warning-ne" style="margin-bottom:8px">⚠ Ne ≈ ${Ne} — 危険水域 (< 50)</div>`
      : '';

    const histogram = bins.map((b, i) => `
      <div class="hist-bar-row">
        <span style="width:46px;flex-shrink:0">${b.label}</span>
        <div class="hist-bar-bg">
          <div class="hist-bar-fill" style="width:${(counts[i]/maxCount*100).toFixed(0)}%;background:${b.color}"></div>
        </div>
        <span style="width:22px;text-align:right;flex-shrink:0">${counts[i]}</span>
      </div>
    `).join('');

    document.getElementById('stats-content').innerHTML = `
      ${neWarn}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val">${(avgF * 100).toFixed(2)}%</div>
          <div class="stat-key">平均 F</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${(maxF * 100).toFixed(2)}%</div>
          <div class="stat-key">最大 F</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${Ne !== null ? Ne : '–'}</div>
          <div class="stat-key">推定 Ne</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${inds.length}</div>
          <div class="stat-key">個体数</div>
        </div>
      </div>
      <div class="hist-bar-wrap">${histogram}</div>
    `;
  }

  return { render };
})();
