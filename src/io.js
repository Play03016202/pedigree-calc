/* io.js — CSV / JSON import and export */
window.App = window.App || {};

App.IO = (() => {
  const CSV_HEADER = 'id,name,sex,birthYear,sireId,damId,breed,notes';

  function exportCSV() {
    const rows = [CSV_HEADER];
    // Export in topological order so parents appear before children
    const sorted = App.Store.topologicalSort();
    for (const ind of sorted) {
      rows.push([
        csvEsc(ind.id),
        csvEsc(ind.name),
        csvEsc(ind.sex),
        ind.birthYear != null ? ind.birthYear : '',
        csvEsc(ind.sireId || ''),
        csvEsc(ind.damId  || ''),
        csvEsc(ind.breed  || ''),
        csvEsc(ind.notes  || ''),
      ].join(','));
    }
    download('pedigree.csv', rows.join('\r\n'), 'text/csv');
  }

  function importCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { ok: false, error: 'データが空です' };

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idxOf = name => header.indexOf(name);

    const idx = {
      id:        idxOf('id'),
      name:      idxOf('name'),
      sex:       idxOf('sex'),
      birthYear: idxOf('birthyear'),
      sireId:    idxOf('sireid'),
      damId:     idxOf('damid'),
      breed:     idxOf('breed'),
      notes:     idxOf('notes'),
    };

    if (idx.name < 0) return { ok: false, error: '「name」列が見つかりません' };

    App.Store.clear();
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const row = {
        id:        idx.id >= 0 ? cols[idx.id] || null : null,
        name:      idx.name >= 0 ? cols[idx.name] || '' : '',
        sex:       idx.sex >= 0 ? cols[idx.sex] || 'U' : 'U',
        birthYear: idx.birthYear >= 0 ? cols[idx.birthYear] || null : null,
        sireId:    idx.sireId >= 0 ? cols[idx.sireId] || null : null,
        damId:     idx.damId  >= 0 ? cols[idx.damId]  || null : null,
        breed:     idx.breed >= 0 ? cols[idx.breed] || '' : '',
        notes:     idx.notes >= 0 ? cols[idx.notes] || '' : '',
      };
      if (!row.name) continue;
      rows.push(row);
    }

    // Two-pass import: first add all without parents, then link parents
    const idMap = new Map(); // original csv id -> actual stored id
    for (const row of rows) {
      const result = App.Store.add({ ...row, sireId: null, damId: null });
      if (result.ok) {
        if (row.id) idMap.set(row.id, result.id);
        else idMap.set(row.name, result.id);
      }
    }

    // Second pass: set parent links
    for (const row of rows) {
      const thisId = row.id ? idMap.get(row.id) : idMap.get(row.name);
      if (!thisId) continue;
      const sireId = row.sireId ? idMap.get(row.sireId) : null;
      const damId  = row.damId  ? idMap.get(row.damId)  : null;
      if (sireId || damId) {
        App.Store.update(thisId, {
          name: App.Store.get(thisId).name,
          sex:  App.Store.get(thisId).sex,
          sireId: sireId || null,
          damId:  damId  || null,
        });
      }
    }

    return { ok: true, count: idMap.size };
  }

  function exportJSON() {
    const sorted = App.Store.topologicalSort();
    const data = sorted.map(ind => ({
      id: ind.id, name: ind.name, sex: ind.sex,
      birthYear: ind.birthYear, sireId: ind.sireId, damId: ind.damId,
      breed: ind.breed, notes: ind.notes,
    }));
    download('pedigree.json', JSON.stringify({ version: 1, individuals: data }, null, 2), 'application/json');
  }

  function importJSON(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { return { ok: false, error: 'JSON パースエラー: ' + e.message }; }

    const inds = data.individuals || data;
    if (!Array.isArray(inds)) return { ok: false, error: '個体配列が見つかりません' };

    App.Store.clear();
    for (const ind of inds) {
      App.Store.add({ ...ind, sireId: null, damId: null });
    }
    for (const ind of inds) {
      if (ind.sireId || ind.damId) {
        const stored = App.Store.get(ind.id);
        if (stored) {
          App.Store.update(ind.id, {
            ...stored, sireId: ind.sireId, damId: ind.damId
          });
        }
      }
    }
    return { ok: true, count: inds.length };
  }

  function loadSampleData() {
    fetch('sample/sample-pedigree.csv')
      .then(r => r.text())
      .then(text => {
        const result = importCSV(text);
        if (result.ok) {
          App.NRM.ensureBuilt();
          App.main && App.main.refresh();
        }
      })
      .catch(() => {
        // file:// protocol doesn't support fetch — load inline sample
        loadInlineSample();
      });
  }

  function loadInlineSample() {
    const csv = `id,name,sex,birthYear,sireId,damId,breed,notes
f1,Alpha,M,2015,,,Labrador,創始者
f2,Beta,F,2015,,,Labrador,創始者
f3,Gamma,M,2016,,,Labrador,創始者
f4,Delta,F,2016,,,Labrador,創始者
g1,Echo,M,2018,f1,f2,Labrador,
g2,Foxtrot,F,2018,f3,f4,Labrador,
g3,Golf,M,2018,f1,f2,Labrador,Echo の同腹兄弟
g4,Hotel,F,2019,f1,f4,Labrador,
p1,India,M,2020,g1,g2,Labrador,
p2,Juliet,F,2020,g3,g2,Labrador,
c1,Kilo,M,2021,p1,p2,Labrador,F≈18.75%
c2,Lima,F,2021,g1,g4,Labrador,F≈12.5%
gc1,Mike,U,2022,c1,c2,Labrador,F≈15.6%`;
    const result = importCSV(csv);
    if (result.ok) App.main && App.main.refresh();
  }

  /* ── Utilities ── */
  function csvEsc(s) {
    s = String(s || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  function download(filename, content, mime) {
    const blob = new Blob(['﻿' + content], { type: mime + ';charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function triggerFileInput(accept, callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => callback(ev.target.result, file.name);
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  }

  return {
    exportCSV, importCSV, exportJSON, importJSON,
    loadSampleData, loadInlineSample, triggerFileInput,
  };
})();
