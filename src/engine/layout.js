/* layout.js — Sugiyama-style hierarchical layout for pedigree graphs */
window.App = window.App || {};

App.Layout = (() => {
  const NODE_W = 130;
  const NODE_H = 52;
  const H_GAP  = 36;  // horizontal gap between nodes in same layer
  const V_GAP  = 78;  // vertical gap between layers

  function compute(individuals, genFilter = Infinity) {
    if (!individuals || individuals.length === 0) return { positions: {}, NODE_W, NODE_H, V_GAP };

    const sorted = App.Store.topologicalSort();
    if (sorted.length === 0) return { positions: {}, NODE_W, NODE_H, V_GAP };

    // --- Phase 1: Layer Assignment ---
    const layers = {};
    for (const ind of sorted) {
      let layer = 0;
      if (ind.sireId && layers[ind.sireId] !== undefined) layer = Math.max(layer, layers[ind.sireId] + 1);
      if (ind.damId  && layers[ind.damId]  !== undefined) layer = Math.max(layer, layers[ind.damId]  + 1);
      // If parents exist but are not in our set (unknown), still shift down by 1
      if (ind.sireId && layers[ind.sireId] === undefined) layer = Math.max(layer, 1);
      if (ind.damId  && layers[ind.damId]  === undefined) layer = Math.max(layer, 1);
      layers[ind.id] = layer;
      // Also store on the individual for external use
      ind.generationDepth = layer;
    }

    // Determine max layer after filter
    const maxGenerations = genFilter === Infinity
      ? Math.max(...Object.values(layers))
      : genFilter;

    // Filter individuals to display
    const visible = sorted.filter(i => layers[i.id] <= maxGenerations);

    // Group by layer
    const maxLayer = Math.max(...visible.map(i => layers[i.id]));
    const layerGroups = {};
    for (let l = 0; l <= maxLayer; l++) layerGroups[l] = [];
    for (const ind of visible) layerGroups[layers[ind.id]].push(ind);

    // --- Phase 2: Barycenter Vertex Ordering ---
    // Assign initial positions (left-to-right)
    const pos = {};
    for (const ind of visible) pos[ind.id] = 0;

    for (let pass = 0; pass < 4; pass++) {
      // Top-down: each node's position = average of its parents' positions
      for (let l = 1; l <= maxLayer; l++) {
        for (const ind of layerGroups[l]) {
          const pp = [];
          if (ind.sireId && pos[ind.sireId] !== undefined) pp.push(pos[ind.sireId]);
          if (ind.damId  && pos[ind.damId]  !== undefined) pp.push(pos[ind.damId]);
          if (pp.length) pos[ind.id] = pp.reduce((a, b) => a + b, 0) / pp.length;
        }
        layerGroups[l].sort((a, b) => pos[a.id] - pos[b.id]);
        layerGroups[l].forEach((ind, i) => pos[ind.id] = i);
      }
      // Bottom-up: each node's position = average of its children's positions
      for (let l = maxLayer - 1; l >= 0; l--) {
        for (const ind of layerGroups[l]) {
          const children = visible.filter(c => c.sireId === ind.id || c.damId === ind.id);
          if (children.length) {
            pos[ind.id] = children.reduce((sum, c) => sum + pos[c.id], 0) / children.length;
          }
        }
        layerGroups[l].sort((a, b) => pos[a.id] - pos[b.id]);
        layerGroups[l].forEach((ind, i) => pos[ind.id] = i);
      }
    }

    // --- Phase 3: Coordinate Assignment ---
    const positions = {};
    for (let l = 0; l <= maxLayer; l++) {
      const nodes = layerGroups[l];
      const totalW = nodes.length * NODE_W + (nodes.length - 1) * H_GAP;
      const startX = -totalW / 2 + NODE_W / 2;
      nodes.forEach((ind, i) => {
        positions[ind.id] = {
          x: startX + i * (NODE_W + H_GAP),
          y: l * (NODE_H + V_GAP),
          w: NODE_W,
          h: NODE_H,
          layer: l,
        };
      });
    }

    return { positions, NODE_W, NODE_H, V_GAP, maxLayer };
  }

  return { compute, NODE_W, NODE_H, V_GAP };
})();
