/* app.js — Application bootstrap and coordination */
window.App = window.App || {};

App.main = (() => {
  let genFilter = Infinity;
  let inbreedPathShown = false;
  let inbreedPathId = null;

  function refresh() {
    App.NRM.ensureBuilt();
    const individuals = App.Store.getAll();
    const layoutResult = App.Layout.compute(individuals, genFilter);
    App.Renderer.render(individuals, layoutResult);
    App.Panel.refresh();
    updateStatus(individuals.length);
    updateGenSlider(layoutResult.maxLayer);
  }

  function updateStatus(count) {
    const el = document.getElementById('status-bar');
    if (el) el.textContent = `${count} 個体`;
  }

  function updateGenSlider(maxLayer) {
    const slider = document.getElementById('gen-slider');
    const label  = document.getElementById('gen-value');
    if (!slider) return;
    const max = maxLayer != null ? maxLayer : 0;
    slider.max = max;
    if (slider.value > max) slider.value = max;
    if (label) {
      label.textContent = slider.value >= max ? '全世代' : slider.value + ' 世代';
    }
  }

  function toggleInbreedPath(id) {
    if (inbreedPathShown && inbreedPathId === id) {
      App.Renderer.clearInbreedPath();
      inbreedPathShown = false;
      inbreedPathId = null;
    } else {
      App.NRM.ensureBuilt();
      const ind = App.Store.get(id);
      if (!ind || ind.F <= 0) {
        alert('この個体には近親交配パスがありません (F = 0)');
        return;
      }
      App.Renderer.showInbreedPath(id);
      inbreedPathShown = true;
      inbreedPathId = id;
    }
  }

  function init() {
    // Initialize modules
    App.Tooltip.init();
    App.Renderer.init(document.getElementById('pedigree-svg'));
    App.Panel.init();

    // Header buttons
    document.getElementById('btn-csv-import').addEventListener('click', () => {
      App.IO.triggerFileInput('.csv', (text, fname) => {
        const result = App.IO.importCSV(text);
        if (!result.ok) { alert('CSV 読み込みエラー: ' + result.error); return; }
        window._renderedOnce = false;
        refresh();
        alert(`${result.count} 個体を読み込みました`);
      });
    });

    document.getElementById('btn-csv-export').addEventListener('click', () => {
      App.IO.exportCSV();
    });

    document.getElementById('btn-json-save').addEventListener('click', () => {
      App.IO.exportJSON();
    });

    document.getElementById('btn-json-load').addEventListener('click', () => {
      App.IO.triggerFileInput('.json', (text) => {
        const result = App.IO.importJSON(text);
        if (!result.ok) { alert('JSON 読み込みエラー: ' + result.error); return; }
        window._renderedOnce = false;
        refresh();
        alert(`${result.count} 個体を読み込みました`);
      });
    });

    document.getElementById('btn-sample').addEventListener('click', () => {
      window._renderedOnce = false;
      App.IO.loadInlineSample();
    });

    document.getElementById('btn-reset-zoom').addEventListener('click', () => {
      App.Renderer.resetZoom();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      if (!confirm('全個体を削除しますか？')) return;
      App.Store.clear();
      window._renderedOnce = false;
      refresh();
    });

    // Generation slider
    const slider = document.getElementById('gen-slider');
    const genLabel = document.getElementById('gen-value');
    slider.addEventListener('input', () => {
      const max = Number(slider.max);
      const val = Number(slider.value);
      genFilter = val >= max ? Infinity : val;
      if (genLabel) genLabel.textContent = val >= max ? '全世代' : val + ' 世代';
      App.NRM.ensureBuilt();
      const individuals = App.Store.getAll();
      const layoutResult = App.Layout.compute(individuals, genFilter);
      App.Renderer.render(individuals, layoutResult);
    });

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
      App.Renderer.setSearch(searchInput.value);
    });

    // Load sample on first launch
    window._renderedOnce = false;
    App.IO.loadInlineSample();
  }

  return { init, refresh, toggleInbreedPath };
})();

document.addEventListener('DOMContentLoaded', () => App.main.init());
