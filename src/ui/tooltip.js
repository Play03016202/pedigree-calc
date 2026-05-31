/* tooltip.js — Hover tooltip management */
window.App = window.App || {};

App.Tooltip = (() => {
  let el = null;

  function init() {
    el = document.getElementById('tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tooltip';
      el.className = 'tooltip';
      document.body.appendChild(el);
    }
  }

  function fColor(F) {
    if (F <= 0)       return '#8b949e';
    if (F < 0.0625)   return '#2ea043';
    if (F < 0.125)    return '#b08800';
    if (F < 0.25)     return '#cf6f00';
    return '#da3633';
  }

  function fPct(F) {
    return (F * 100).toFixed(2) + '%';
  }

  function show(ind, x, y) {
    if (!el || !ind) return;

    const sire = ind.sireId ? App.Store.get(ind.sireId) : null;
    const dam  = ind.damId  ? App.Store.get(ind.damId)  : null;

    let html = `<div class="tt-name">${ind.name}</div>`;
    html += `<div class="tt-row"><span class="tt-key">性別</span><span class="tt-val">${ind.sex === 'M' ? 'オス' : ind.sex === 'F' ? 'メス' : '不明'}</span></div>`;
    if (ind.birthYear) {
      html += `<div class="tt-row"><span class="tt-key">生年</span><span class="tt-val">${ind.birthYear}</span></div>`;
    }
    if (ind.breed) {
      html += `<div class="tt-row"><span class="tt-key">品種</span><span class="tt-val">${ind.breed}</span></div>`;
    }
    html += `<div class="tt-sep"></div>`;
    html += `<div class="tt-row"><span class="tt-key">近交係数 F</span><span class="tt-val" style="color:${fColor(ind.F)};font-weight:700">${fPct(ind.F)}</span></div>`;
    html += `<div class="tt-row"><span class="tt-key">ECG</span><span class="tt-val">${ind.ECG.toFixed(1)} 世代</span></div>`;
    html += `<div class="tt-sep"></div>`;
    html += `<div class="tt-row"><span class="tt-key">父</span><span class="tt-val">${sire ? sire.name : '不明'}</span></div>`;
    html += `<div class="tt-row"><span class="tt-key">母</span><span class="tt-val">${dam ? dam.name : '不明'}</span></div>`;
    if (ind.notes) {
      html += `<div class="tt-sep"></div><div style="font-size:11px;color:#8b949e">${ind.notes}</div>`;
    }

    el.innerHTML = html;
    el.style.display = 'block';
    positionTooltip(x, y);
  }

  function positionTooltip(x, y) {
    if (!el) return;
    const W = window.innerWidth, H = window.innerHeight;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = x + 14, top = y - 10;
    if (left + w > W - 10) left = x - w - 14;
    if (top + h > H - 10) top = H - h - 10;
    if (top < 10) top = 10;
    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
  }

  function hide() {
    if (el) el.style.display = 'none';
  }

  return { init, show, hide };
})();
