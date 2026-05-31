/* panel.js — Side panel: individual list, detail view, mating simulator */
window.App = window.App || {};

App.Panel = (() => {
  let selectedId = null;
  let editingId  = null;

  function fClass(F) {
    if (F <= 0)     return 'fb-none';
    if (F < 0.0625) return 'fb-low';
    if (F < 0.125)  return 'fb-mid';
    if (F < 0.25)   return 'fb-high';
    return 'fb-danger';
  }

  function fPct(F) {
    if (F <= 0) return '0%';
    return (F * 100).toFixed(2) + '%';
  }

  function fColor(F) {
    if (F <= 0)       return '#8b949e';
    if (F < 0.0625)   return '#2ea043';
    if (F < 0.125)    return '#b08800';
    if (F < 0.25)     return '#cf6f00';
    return '#da3633';
  }

  /* ── Individual List ── */
  function renderList() {
    const list = document.getElementById('ind-list');
    if (!list) return;
    const inds = App.Store.getAll().sort((a, b) => {
      if (a.generationDepth !== b.generationDepth) return a.generationDepth - b.generationDepth;
      return a.name.localeCompare(b.name);
    });

    if (inds.length === 0) {
      list.innerHTML = '<div class="detail-empty" style="padding:6px">個体がいません</div>';
      return;
    }

    list.innerHTML = inds.map(ind => `
      <div class="ind-item${ind.id === selectedId ? ' selected' : ''}"
           data-id="${ind.id}" onclick="App.Panel.select('${ind.id}', {keepHighlight:false})">
        <div class="sex-dot ${ind.sex}">${ind.sex}</div>
        <span class="ind-name">${escHtml(ind.name)}</span>
        <span class="f-badge ${fClass(ind.F)}">${fPct(ind.F)}</span>
      </div>
    `).join('');
  }

  /* ── Detail Panel ── */
  function renderDetail() {
    const detail = document.getElementById('ind-detail');
    if (!detail) return;

    if (!selectedId) {
      detail.innerHTML = '<div class="detail-empty">個体を選択してください</div>';
      document.getElementById('ind-actions').style.display = 'none';
      return;
    }
    const ind = App.Store.get(selectedId);
    if (!ind) { selectedId = null; renderDetail(); return; }

    const sire = ind.sireId ? App.Store.get(ind.sireId) : null;
    const dam  = ind.damId  ? App.Store.get(ind.damId)  : null;

    detail.innerHTML = `
      <div class="detail-row">
        <span class="detail-key">名前</span>
        <span class="detail-val">${escHtml(ind.name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">性別</span>
        <span class="detail-val">${ind.sex === 'M' ? 'オス ♂' : ind.sex === 'F' ? 'メス ♀' : '不明'}</span>
      </div>
      ${ind.birthYear ? `<div class="detail-row"><span class="detail-key">生年</span><span class="detail-val">${ind.birthYear}</span></div>` : ''}
      ${ind.breed ? `<div class="detail-row"><span class="detail-key">品種</span><span class="detail-val">${escHtml(ind.breed)}</span></div>` : ''}
      <div class="detail-row">
        <span class="detail-key">父 (Sire)</span>
        <span class="detail-val">${sire ? escHtml(sire.name) : '–'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">母 (Dam)</span>
        <span class="detail-val">${dam ? escHtml(dam.name) : '–'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">近交係数 F</span>
        <span class="detail-val" style="color:${fColor(ind.F)};font-weight:700">${fPct(ind.F)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">ECG</span>
        <span class="detail-val">${ind.ECG.toFixed(2)} 世代</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">世代</span>
        <span class="detail-val">${ind.generationDepth}</span>
      </div>
      ${ind.notes ? `<div style="margin-top:6px;font-size:11px;color:#8b949e">${escHtml(ind.notes)}</div>` : ''}
    `;

    document.getElementById('ind-actions').style.display = 'flex';
  }

  /* ── Mating Simulator ── */
  function renderSimulator() {
    const inds = App.Store.getAll();
    const males   = inds.filter(i => i.sex === 'M').sort((a, b) => a.name.localeCompare(b.name));
    const females = inds.filter(i => i.sex === 'F').sort((a, b) => a.name.localeCompare(b.name));

    const sireEl = document.getElementById('mate-sire');
    const damEl  = document.getElementById('mate-dam');
    if (!sireEl || !damEl) return;

    const prevSire = sireEl.value;
    const prevDam  = damEl.value;

    sireEl.innerHTML = '<option value="">– 父を選択 –</option>' +
      males.map(i => `<option value="${i.id}"${i.id === prevSire ? ' selected' : ''}>${escHtml(i.name)}</option>`).join('');
    damEl.innerHTML = '<option value="">– 母を選択 –</option>' +
      females.map(i => `<option value="${i.id}"${i.id === prevDam ? ' selected' : ''}>${escHtml(i.name)}</option>`).join('');

    updateSimResult();
  }

  function updateSimResult() {
    const sireId = document.getElementById('mate-sire')?.value;
    const damId  = document.getElementById('mate-dam')?.value;
    const resultEl = document.getElementById('mate-result');
    if (!resultEl) return;

    if (!sireId || !damId) {
      resultEl.innerHTML = '<div class="mate-result-label">父と母を選択してください</div>';
      return;
    }

    App.NRM.ensureBuilt();
    const F = App.NRM.simulateMating(sireId, damId);
    if (F === null) { resultEl.innerHTML = '–'; return; }

    const pct = (F * 100).toFixed(2) + '%';
    const color = fColor(F);
    const cls   = fClass(F);
    let risk = '';
    if (F <= 0)      risk = '近交なし';
    else if (F < 0.0625) risk = '低リスク';
    else if (F < 0.125)  risk = '要注意';
    else if (F < 0.25)   risk = '高リスク';
    else                  risk = '非常に高リスク';

    resultEl.innerHTML = `
      <div class="mate-result-label">産仔の予測 F 値</div>
      <div class="mate-result-f" style="color:${color}">${pct}</div>
      <div style="margin-top:4px"><span class="f-badge ${cls}">${risk}</span></div>
    `;
  }

  /* ── Modal (Add / Edit) ── */
  function openModal(id = null) {
    editingId = id;
    const ind = id ? App.Store.get(id) : null;
    const modal = document.getElementById('modal-overlay');
    modal.classList.add('open');

    document.getElementById('modal-title-text').textContent = ind ? '個体を編集' : '個体を追加';
    document.getElementById('form-name').value      = ind ? ind.name      : '';
    document.getElementById('form-sex').value       = ind ? ind.sex       : 'U';
    document.getElementById('form-year').value      = ind ? (ind.birthYear || '') : '';
    document.getElementById('form-breed').value     = ind ? ind.breed     : '';
    document.getElementById('form-notes').value     = ind ? ind.notes     : '';

    // Populate parent selects (exclude self)
    const all = App.Store.getAll().sort((a, b) => a.name.localeCompare(b.name));
    const sires   = all.filter(i => i.sex === 'M' && i.id !== id);
    const dams    = all.filter(i => i.sex === 'F' && i.id !== id);

    const sireEl = document.getElementById('form-sire');
    const damEl  = document.getElementById('form-dam');
    sireEl.innerHTML = '<option value="">– なし –</option>' +
      sires.map(i => `<option value="${i.id}"${ind && ind.sireId === i.id ? ' selected' : ''}>${escHtml(i.name)}</option>`).join('');
    damEl.innerHTML = '<option value="">– なし –</option>' +
      dams.map(i => `<option value="${i.id}"${ind && ind.damId === i.id ? ' selected' : ''}>${escHtml(i.name)}</option>`).join('');

    document.getElementById('form-error').textContent = '';
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    editingId = null;
  }

  function submitModal() {
    const data = {
      name:      document.getElementById('form-name').value,
      sex:       document.getElementById('form-sex').value,
      birthYear: document.getElementById('form-year').value || null,
      breed:     document.getElementById('form-breed').value,
      notes:     document.getElementById('form-notes').value,
      sireId:    document.getElementById('form-sire').value || null,
      damId:     document.getElementById('form-dam').value  || null,
    };

    let result;
    if (editingId) {
      result = App.Store.update(editingId, data);
    } else {
      result = App.Store.add(data);
      if (result.ok) selectedId = result.id;
    }

    if (!result.ok) {
      document.getElementById('form-error').textContent = result.error;
      return;
    }

    closeModal();
    App.main && App.main.refresh();
  }

  /* ── Public API ── */
  function init() {
    document.getElementById('btn-add').addEventListener('click', () => openModal());
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-modal-save').addEventListener('click', submitModal);

    document.getElementById('btn-edit-ind').addEventListener('click', () => {
      if (selectedId) openModal(selectedId);
    });
    document.getElementById('btn-delete-ind').addEventListener('click', () => {
      if (!selectedId) return;
      const ind = App.Store.get(selectedId);
      if (!ind) return;
      if (!confirm(`「${ind.name}」を削除しますか？`)) return;
      App.Store.delete(selectedId);
      selectedId = null;
      App.main && App.main.refresh();
    });

    document.getElementById('btn-show-path').addEventListener('click', () => {
      if (selectedId) App.main && App.main.toggleInbreedPath(selectedId);
    });

    document.getElementById('mate-sire').addEventListener('change', updateSimResult);
    document.getElementById('mate-dam').addEventListener('change',  updateSimResult);
  }

  function select(id, { keepHighlight = false } = {}) {
    selectedId = id;
    renderList();
    renderDetail();
    if (App.Renderer) {
      if (!keepHighlight) App.Renderer.clearHighlight();
      App.Renderer.setSelected(id);
    }
  }

  function getSelectedId() { return selectedId; }

  function refresh() {
    App.NRM.ensureBuilt();
    renderList();
    renderDetail();
    renderSimulator();
    App.Stats.render();
  }

  return { init, refresh, select, getSelectedId, openModal, closeModal };
})();

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
