/* nrm.js — Numerator Relationship Matrix (Tabular Method) + F value + ECG */
window.App = window.App || {};

App.NRM = (() => {
  // Symmetric NRM storage: canonical key = smaller_id + '|' + larger_id
  // Diagonal stored as id + '|' + id
  let nrmMap = new Map();
  let dirty = true;
  let sortedCache = null;

  function key(id1, id2) {
    return id1 <= id2 ? id1 + '|' + id2 : id2 + '|' + id1;
  }

  function nrmGet(id1, id2) {
    if (!id1 || !id2) return 0;
    return nrmMap.get(key(id1, id2)) || 0;
  }

  function nrmSet(id1, id2, val) {
    nrmMap.set(key(id1, id2), val);
  }

  /* Build full NRM using the Tabular Method */
  function build() {
    nrmMap = new Map();
    const sorted = App.Store.topologicalSort();
    sortedCache = sorted;

    const processed = []; // ordered list processed so far

    for (const ind of sorted) {
      const s = ind.sireId;
      const d = ind.damId;

      // F(i) = 0.5 × NRM[sire][dam]
      let Fi = 0;
      if (s && d) Fi = 0.5 * nrmGet(s, d);
      else if (s)  Fi = 0;  // single known parent → assume F=0 by convention
      else if (d)  Fi = 0;
      ind.F = Fi;

      // Diagonal: NRM[i][i] = 1 + F(i)
      nrmSet(ind.id, ind.id, 1 + Fi);

      // Off-diagonal with all previously processed individuals j
      for (const j of processed) {
        let val = 0;
        if (s) val += nrmGet(j.id, s);
        if (d) val += nrmGet(j.id, d);
        nrmSet(ind.id, j.id, 0.5 * val);
      }

      processed.push(ind);
    }

    // Compute ECG for each individual
    for (const ind of sorted) {
      ind.ECG = computeECG(ind.id, sorted);
    }

    dirty = false;
  }

  /* ECG (Equivalent Complete Generations) = Σ (1/2)^(n+1) for each known ancestor n generations back */
  function computeECG(id, sorted) {
    const indMap = new Map(sorted.map(i => [i.id, i]));
    let ecg = 0;

    function walk(currentId, depth) {
      if (!currentId || !indMap.has(currentId)) return;
      // This ancestor is known: contribute (1/2)^depth
      ecg += Math.pow(0.5, depth);
      const cur = indMap.get(currentId);
      walk(cur.sireId, depth + 1);
      walk(cur.damId,  depth + 1);
    }

    const ind = indMap.get(id);
    if (!ind) return 0;
    walk(ind.sireId, 1);
    walk(ind.damId,  1);
    return Math.round(ecg * 100) / 100;
  }

  /* Simulate mating: predicted F of offspring = 0.5 × NRM[sire][dam] */
  function simulateMating(sireId, damId) {
    if (!sireId || !damId) return null;
    if (dirty) build();
    return 0.5 * nrmGet(sireId, damId);
  }

  const api = {
    invalidate() { dirty = true; },

    ensureBuilt() {
      if (dirty) build();
    },

    get(id1, id2) {
      if (dirty) build();
      return nrmGet(id1, id2);
    },

    getF(id) {
      if (dirty) build();
      const ind = App.Store.get(id);
      return ind ? ind.F : 0;
    },

    simulateMating,

    /* Find inbreeding paths for an individual (Wright path method) */
    findInbreedingPaths(id) {
      if (dirty) build();
      const ind = App.Store.get(id);
      if (!ind || ind.F <= 0) return { paths: [], commonAncestors: new Set() };

      // Collect all ancestors reachable from sire and dam sides
      const sireAnc = getAllAncestorPaths(ind.sireId);
      const damAnc  = getAllAncestorPaths(ind.damId);

      // Common ancestors = intersection of sire and dam ancestor sets
      const commonAncestors = new Set();
      for (const aid of sireAnc.keys()) {
        if (damAnc.has(aid)) commonAncestors.add(aid);
      }

      // Build path list: for each common ancestor, enumerate paths
      const paths = [];
      for (const ancId of commonAncestors) {
        const sirePaths = sireAnc.get(ancId);
        const damPaths  = damAnc.get(ancId);
        const ancF = (App.Store.get(ancId) || {}).F || 0;
        for (const sp of sirePaths) {
          for (const dp of damPaths) {
            const contrib = Math.pow(0.5, sp.length + dp.length) * (1 + ancF);
            paths.push({ ancId, sirePath: sp, damPath: dp, contrib });
          }
        }
      }
      paths.sort((a, b) => b.contrib - a.contrib);
      return { paths, commonAncestors };
    },
  };

  /* Return Map<ancestorId, Array<path>> where path is array of ids from start → ancestor */
  function getAllAncestorPaths(startId) {
    const result = new Map();
    function dfs(id, path) {
      if (!id) return;
      const ind = App.Store.get(id);
      if (!ind) return;
      if (!result.has(id)) result.set(id, []);
      result.get(id).push([...path]);
      dfs(ind.sireId, [...path, ind.sireId]);
      dfs(ind.damId,  [...path, ind.damId]);
    }
    if (startId) dfs(startId, [startId]);
    return result;
  }

  return api;
})();
