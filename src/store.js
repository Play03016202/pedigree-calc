/* store.js — Individual data store, UUID, validation, topology */
window.App = window.App || {};

App.Store = (() => {
  const individuals = new Map(); // id -> individual object

  function generateId() {
    return 'i_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* Compute generation depth via memoized DFS */
  function computeDepth(id, visited = new Set()) {
    if (!id || !individuals.has(id)) return -1;
    if (visited.has(id)) return 0; // cycle guard (should not happen with validation)
    visited.add(id);
    const ind = individuals.get(id);
    let depth = 0;
    if (ind.sireId) depth = Math.max(depth, computeDepth(ind.sireId, new Set(visited)) + 1);
    if (ind.damId)  depth = Math.max(depth, computeDepth(ind.damId,  new Set(visited)) + 1);
    return depth;
  }

  /* Check if `ancestorId` is an ancestor of `id` (cycle detection) */
  function isAncestor(id, ancestorId, visited = new Set()) {
    if (!id || !individuals.has(id)) return false;
    if (id === ancestorId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const ind = individuals.get(id);
    return isAncestor(ind.sireId, ancestorId, visited) ||
           isAncestor(ind.damId,  ancestorId, visited);
  }

  /* Validate before add/update: returns error string or null */
  function validate(data, excludeId = null) {
    if (!data.name || !data.name.trim()) return '名前を入力してください';
    if (!['M', 'F', 'U'].includes(data.sex)) return '性別を選択してください';

    // Check parent IDs exist and don't create cycles
    for (const parentKey of ['sireId', 'damId']) {
      const pid = data[parentKey];
      if (!pid) continue;
      if (!individuals.has(pid)) return `指定された親 (${pid}) が存在しません`;
      if (excludeId && isAncestor(pid, excludeId)) {
        return '循環参照が生じるため、この親は設定できません';
      }
      // Can't be own parent
      if (excludeId && pid === excludeId) return '自分自身を親に設定できません';
    }

    // Sire and dam must not be the same individual
    if (data.sireId && data.damId && data.sireId === data.damId) {
      return '父と母に同じ個体は指定できません';
    }

    return null;
  }

  function updateDepths() {
    for (const ind of individuals.values()) {
      ind.generationDepth = computeDepth(ind.id);
    }
  }

  const api = {
    getAll() {
      return Array.from(individuals.values());
    },

    get(id) {
      return individuals.get(id) || null;
    },

    add(data) {
      const err = validate(data);
      if (err) return { ok: false, error: err };

      const ind = {
        id: data.id || generateId(),
        name: data.name.trim(),
        sex: data.sex || 'U',
        birthYear: data.birthYear ? Number(data.birthYear) : null,
        sireId: data.sireId || null,
        damId:  data.damId  || null,
        breed: (data.breed  || '').trim(),
        notes: (data.notes  || '').trim(),
        F: 0,
        ECG: 0,
        generationDepth: 0,
      };

      individuals.set(ind.id, ind);
      updateDepths();
      App.NRM && App.NRM.invalidate();
      return { ok: true, id: ind.id };
    },

    update(id, data) {
      if (!individuals.has(id)) return { ok: false, error: '個体が見つかりません' };
      const err = validate(data, id);
      if (err) return { ok: false, error: err };

      const ind = individuals.get(id);
      Object.assign(ind, {
        name: data.name.trim(),
        sex: data.sex || ind.sex,
        birthYear: data.birthYear != null ? Number(data.birthYear) : ind.birthYear,
        sireId: data.sireId !== undefined ? (data.sireId || null) : ind.sireId,
        damId:  data.damId  !== undefined ? (data.damId  || null) : ind.damId,
        breed: data.breed !== undefined ? data.breed.trim() : ind.breed,
        notes: data.notes !== undefined ? data.notes.trim() : ind.notes,
      });

      updateDepths();
      App.NRM && App.NRM.invalidate();
      return { ok: true };
    },

    delete(id) {
      if (!individuals.has(id)) return { ok: false, error: '個体が見つかりません' };
      // Detach children that reference this individual as parent
      for (const ind of individuals.values()) {
        if (ind.sireId === id) ind.sireId = null;
        if (ind.damId  === id) ind.damId  = null;
      }
      individuals.delete(id);
      updateDepths();
      App.NRM && App.NRM.invalidate();
      return { ok: true };
    },

    clear() {
      individuals.clear();
      App.NRM && App.NRM.invalidate();
    },

    /* Topological sort (Kahn): founders first, descendants after */
    topologicalSort() {
      const inDegree = new Map();
      const children = new Map();
      for (const ind of individuals.values()) {
        inDegree.set(ind.id, 0);
        children.set(ind.id, []);
      }
      for (const ind of individuals.values()) {
        for (const pid of [ind.sireId, ind.damId]) {
          if (pid && individuals.has(pid)) {
            children.get(pid).push(ind.id);
            inDegree.set(ind.id, inDegree.get(ind.id) + 1);
          }
        }
      }
      const queue = [];
      for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
      const result = [];
      while (queue.length) {
        const id = queue.shift();
        result.push(individuals.get(id));
        for (const cid of children.get(id)) {
          const d = inDegree.get(cid) - 1;
          inDegree.set(cid, d);
          if (d === 0) queue.push(cid);
        }
      }
      return result;
    },

    /* Get all ancestors of an individual */
    getAncestors(id, visited = new Set()) {
      if (!id || !individuals.has(id) || visited.has(id)) return visited;
      visited.add(id);
      const ind = individuals.get(id);
      if (ind.sireId) this.getAncestors(ind.sireId, visited);
      if (ind.damId)  this.getAncestors(ind.damId,  visited);
      return visited;
    },

    /* Get all descendants of an individual */
    getDescendants(id, visited = new Set()) {
      if (!id || visited.has(id)) return visited;
      visited.add(id);
      for (const ind of individuals.values()) {
        if (ind.sireId === id || ind.damId === id) {
          this.getDescendants(ind.id, visited);
        }
      }
      return visited;
    },

    getPotentialSires(excludeId = null) {
      return Array.from(individuals.values())
        .filter(i => i.sex === 'M' && i.id !== excludeId)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    getPotentialDams(excludeId = null) {
      return Array.from(individuals.values())
        .filter(i => i.sex === 'F' && i.id !== excludeId)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  };

  return api;
})();
