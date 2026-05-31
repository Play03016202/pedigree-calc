/* path.js — Wright path coefficient visualization helper */
window.App = window.App || {};

App.Path = (() => {
  /* Given an individual id, return the set of node ids and edge pairs to highlight */
  function getInbreedingHighlight(id) {
    const { paths, commonAncestors } = App.NRM.findInbreedingPaths(id);
    if (!paths.length) return { nodeSet: new Set(), edgePairs: [] };

    const nodeSet = new Set();
    const edgePairs = []; // [fromId, toId] pairs

    nodeSet.add(id);
    const ind = App.Store.get(id);
    if (!ind) return { nodeSet, edgePairs: [] };
    if (ind.sireId) nodeSet.add(ind.sireId);
    if (ind.damId)  nodeSet.add(ind.damId);

    for (const { sirePath, damPath, ancId } of paths.slice(0, 8)) { // limit to top paths
      nodeSet.add(ancId);
      // Sire path: sirePath = [sireId, ..., ancId]
      const sireChain = sirePath.filter(Boolean);
      for (let i = 0; i < sireChain.length - 1; i++) {
        nodeSet.add(sireChain[i]);
        nodeSet.add(sireChain[i + 1]);
        edgePairs.push([sireChain[i + 1], sireChain[i]]); // ancestor → child direction
      }
      // Dam path
      const damChain = damPath.filter(Boolean);
      for (let i = 0; i < damChain.length - 1; i++) {
        nodeSet.add(damChain[i]);
        nodeSet.add(damChain[i + 1]);
        edgePairs.push([damChain[i + 1], damChain[i]]);
      }
      // Edge from sire/dam to the individual itself
      edgePairs.push([id, ind.sireId]);
      edgePairs.push([id, ind.damId]);
    }

    return { nodeSet, edgePairs };
  }

  return { getInbreedingHighlight };
})();
