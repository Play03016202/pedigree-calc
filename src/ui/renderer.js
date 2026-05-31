/* renderer.js — D3 SVG rendering: nodes, edges, zoom, highlight */
window.App = window.App || {};

App.Renderer = (() => {
  let svg, g, gGenLines, gEdges, gInbreedEdges, gNodes;
  let zoom;
  let positions = {};
  let selectedId = null;
  let highlightSet = null;   // Set<id> or null
  let dimSet      = null;    // Set<id> or null
  let inbreedPathEdges = []; // [{from,to}]
  let genFilter = Infinity;
  let searchTerm = '';

  // Node dimensions (mirrored from Layout)
  const NW = 130, NH = 52;

  function fColor(F) {
    if (F <= 0)       return '#21262d';
    if (F < 0.0625)   return '#0d2e10';
    if (F < 0.125)    return '#2d2000';
    if (F < 0.25)     return '#2d1500';
    return '#2d0a0a';
  }
  function fStroke(F) {
    if (F <= 0)       return '#484f58';
    if (F < 0.0625)   return '#2ea043';
    if (F < 0.125)    return '#b08800';
    if (F < 0.25)     return '#cf6f00';
    return '#da3633';
  }
  function fTextColor(F) {
    if (F <= 0)       return '#8b949e';
    if (F < 0.0625)   return '#2ea043';
    if (F < 0.125)    return '#d4a017';
    if (F < 0.25)     return '#e07c00';
    return '#ff7b72';
  }

  function fPct(F) {
    if (F <= 0) return 'F = 0%';
    return 'F = ' + (F * 100).toFixed(2) + '%';
  }

  function sexIcon(sex) {
    if (sex === 'M') return '♂';
    if (sex === 'F') return '♀';
    return '?';
  }

  function init(svgEl) {
    svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    // Defs for arrow markers
    const defs = svg.append('defs');
    ['sire', 'dam'].forEach(type => {
      defs.append('marker')
        .attr('id', 'arrow-' + type)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 8).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', type === 'sire' ? '#388bfd' : '#db61a2');
    });

    g = svg.append('g').attr('class', 'zoom-group');
    gGenLines    = g.append('g').attr('class', 'gen-lines');
    gEdges       = g.append('g').attr('class', 'edges');
    gInbreedEdges = g.append('g').attr('class', 'inbreed-path-edges');
    gNodes       = g.append('g').attr('class', 'nodes');

    // Zoom & pan
    zoom = d3.zoom()
      .scaleExtent([0.08, 6])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    svg.on('click', e => {
      if (e.target === svgEl) clearSelection();
    });

    // Double-click reset zoom
    svg.on('dblclick.zoom', null);
  }

  function render(individuals, layoutResult) {
    if (!svg) return;
    positions = layoutResult.positions || {};
    const { maxLayer } = layoutResult;

    // Collect visible individuals (those with positions)
    const visible = individuals.filter(i => positions[i.id]);

    // ── Generation grid lines ──
    const layers = new Set(Object.values(positions).map(p => p.layer));
    const allX = Object.values(positions).map(p => p.x);
    const minX = Math.min(...allX) - NW * 2;
    const maxX = Math.max(...allX) + NW * 2;

    const layerArr = [...layers].sort((a, b) => a - b);
    gGenLines.selectAll('.gen-row').data(layerArr, d => d)
      .join(
        enter => {
          const grp = enter.append('g').attr('class', 'gen-row');
          grp.append('line').attr('class', 'gen-grid-line');
          grp.append('text').attr('class', 'gen-grid-label');
          return grp;
        },
        update => update
      )
      .each(function(layer) {
        const y = layer * (NH + layoutResult.V_GAP) - layoutResult.V_GAP / 2;
        d3.select(this).select('line')
          .attr('x1', minX).attr('y1', y)
          .attr('x2', maxX).attr('y2', y);
        d3.select(this).select('text')
          .attr('x', minX + 8)
          .attr('y', y + 14)
          .text('Gen ' + layer);
      });

    // ── Edges ──
    const edges = [];
    for (const ind of visible) {
      const cp = positions[ind.id];
      if (!cp) continue;
      if (ind.sireId && positions[ind.sireId]) {
        edges.push({ from: ind.sireId, to: ind.id, type: 'sire', childF: ind.F });
      }
      if (ind.damId && positions[ind.damId]) {
        edges.push({ from: ind.damId, to: ind.id, type: 'dam', childF: ind.F });
      }
    }

    gEdges.selectAll('.edge-line').data(edges, d => d.from + '>' + d.to + d.type)
      .join('path')
      .attr('class', d => 'edge-line' + (d.childF > 0 ? ' edge-inbreed' : ''))
      .attr('stroke', d => {
        if (d.childF > 0) return '#e3b341';
        return d.type === 'sire' ? '#388bfd' : '#db61a2';
      })
      .attr('d', d => edgePath(d));

    // ── Inbreeding path overlay edges ──
    gInbreedEdges.selectAll('.inbreed-path-edge')
      .data(inbreedPathEdges, d => d.from + '|' + d.to)
      .join('path')
      .attr('class', 'inbreed-path-edge')
      .attr('d', d => {
        const fp = positions[d.from], tp = positions[d.to];
        if (!fp || !tp) return '';
        return edgePathCoords(fp.x, fp.y, tp.x, tp.y);
      });

    // ── Nodes ──
    const nodeData = visible.map(ind => ({ ind, pos: positions[ind.id] }));
    const nodeGroups = gNodes.selectAll('.node-group')
      .data(nodeData, d => d.ind.id)
      .join(
        enter => {
          const grp = enter.append('g').attr('class', 'node-group');
          grp.append('rect').attr('class', 'node-rect')
            .attr('rx', 8).attr('ry', 8)
            .attr('width', NW).attr('height', NH);
          grp.append('text').attr('class', 'node-name-text');
          grp.append('text').attr('class', 'node-f-text');
          return grp;
        },
        update => update
      )
      .attr('transform', d => `translate(${d.pos.x - NW/2},${d.pos.y - NH/2})`)
      .attr('class', d => {
        let cls = 'node-group';
        if (dimSet && dimSet.has(d.ind.id)) cls += ' dimmed';
        else if (highlightSet && highlightSet.has(d.ind.id)) cls += ' highlighted';
        if (d.ind.id === selectedId) cls += ' selected-node';
        if (searchTerm && !d.ind.name.toLowerCase().includes(searchTerm)) cls += ' dimmed';
        return cls;
      })
      .on('mouseenter', (e, d) => {
        App.Tooltip.show(d.ind, e.clientX, e.clientY);
      })
      .on('mousemove', (e) => {
        const tt = document.getElementById('tooltip');
        if (tt) {
          const W = window.innerWidth, H = window.innerHeight;
          const w = tt.offsetWidth, h = tt.offsetHeight;
          let left = e.clientX + 14, top = e.clientY - 10;
          if (left + w > W - 10) left = e.clientX - w - 14;
          if (top + h > H - 10) top = H - h - 10;
          if (top < 10) top = 10;
          tt.style.left = left + 'px'; tt.style.top = top + 'px';
        }
      })
      .on('mouseleave', () => App.Tooltip.hide())
      .on('click', (e, d) => {
        e.stopPropagation();
        // Drive selection through Panel so both panel and renderer update
        const ancestors   = App.Store.getAncestors(d.ind.id);
        const descendants = App.Store.getDescendants(d.ind.id);
        const allRelated  = new Set([...ancestors, ...descendants, d.ind.id]);
        const allIds      = new Set(visible.map(i => i.id));
        const dimmed = new Set([...allIds].filter(id => !allRelated.has(id)));
        setHighlight(allRelated, dimmed);
        setSelected(d.ind.id);
        App.Panel && App.Panel.select(d.ind.id, { keepHighlight: true });
      });

    // Node rect styling
    nodeGroups.select('.node-rect')
      .attr('fill',   d => fColor(d.ind.F))
      .attr('stroke', d => d.ind.id === selectedId ? '#f0f6fc' : fStroke(d.ind.F));

    // Name text (with sex icon)
    nodeGroups.select('.node-name-text')
      .attr('x', NW / 2)
      .attr('y', NH / 2 - 8)
      .text(d => sexIcon(d.ind.sex) + ' ' + d.ind.name);

    // F value text
    nodeGroups.select('.node-f-text')
      .attr('x', NW / 2)
      .attr('y', NH / 2 + 9)
      .attr('fill', d => fTextColor(d.ind.F))
      .text(d => fPct(d.ind.F));

    // Auto-fit on first render — delay one frame so layout is painted
    if (visible.length > 0 && !window._renderedOnce) {
      window._renderedOnce = true;
      requestAnimationFrame(() => fitAll(visible));
    }
  }

  function edgePath(d) {
    const fp = positions[d.from], tp = positions[d.to];
    if (!fp || !tp) return '';
    return edgePathCoords(fp.x, fp.y, tp.x, tp.y);
  }

  function edgePathCoords(fx, fy, tx, ty) {
    // S-curve bezier from parent bottom-center to child top-center
    const x1 = fx, y1 = fy + NH / 2;
    const x2 = tx, y2 = ty - NH / 2;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }

  function setSelected(id) {
    selectedId = id;
    // Update visual state only — caller is responsible for panel update
    if (gNodes) {
      gNodes.selectAll('.node-group').attr('class', d => {
        let cls = 'node-group';
        if (dimSet && dimSet.has(d.ind.id)) cls += ' dimmed';
        else if (highlightSet && highlightSet.has(d.ind.id)) cls += ' highlighted';
        if (d.ind.id === selectedId) cls += ' selected-node';
        return cls;
      });
      gNodes.selectAll('.node-rect')
        .attr('stroke', d => d.ind.id === selectedId ? '#f0f6fc' : fStroke(d.ind.F));
    }
  }

  function clearSelection() {
    selectedId = null;
    highlightSet = null;
    dimSet = null;
    inbreedPathEdges = [];
    App.Panel && App.Panel.select(null);
    // Re-apply classes
    gNodes && gNodes.selectAll('.node-group').attr('class', d => {
      let cls = 'node-group';
      if (searchTerm && !d.ind.name.toLowerCase().includes(searchTerm)) cls += ' dimmed';
      return cls;
    });
    gNodes && gNodes.selectAll('.node-rect')
      .attr('stroke', d => fStroke(d.ind.F));
    gInbreedEdges && gInbreedEdges.selectAll('.inbreed-path-edge').remove();
  }

  function setHighlight(hl, dm) {
    highlightSet = hl;
    dimSet = dm;
    if (!gNodes) return;
    gNodes.selectAll('.node-group').attr('class', d => {
      let cls = 'node-group';
      if (dimSet && dimSet.has(d.ind.id)) cls += ' dimmed';
      else if (highlightSet && highlightSet.has(d.ind.id)) cls += ' highlighted';
      if (d.ind.id === selectedId) cls += ' selected-node';
      return cls;
    });
    gNodes.selectAll('.node-rect')
      .attr('stroke', d => d.ind.id === selectedId ? '#f0f6fc' : fStroke(d.ind.F));
  }

  function showInbreedPath(id) {
    const { nodeSet, edgePairs } = App.Path.getInbreedingHighlight(id);
    inbreedPathEdges = edgePairs
      .filter(([from, to]) => from && to && positions[from] && positions[to])
      .map(([from, to]) => ({ from, to }));

    highlightSet = nodeSet;
    dimSet = null;
    if (gNodes) {
      gNodes.selectAll('.node-group').attr('class', d => {
        let cls = 'node-group';
        if (highlightSet && !highlightSet.has(d.ind.id)) cls += ' dimmed';
        else if (highlightSet && highlightSet.has(d.ind.id)) cls += ' highlighted';
        if (d.ind.id === selectedId) cls += ' selected-node';
        return cls;
      });
    }
    if (gInbreedEdges) {
      gInbreedEdges.selectAll('.inbreed-path-edge')
        .data(inbreedPathEdges, d => d.from + '|' + d.to)
        .join('path')
        .attr('class', 'inbreed-path-edge')
        .attr('d', d => {
          const fp = positions[d.from], tp = positions[d.to];
          if (!fp || !tp) return '';
          return edgePathCoords(fp.x, fp.y, tp.x, tp.y);
        });
    }
  }

  function clearHighlight() {
    highlightSet = null;
    dimSet = null;
    if (gNodes) {
      gNodes.selectAll('.node-group').attr('class', d => {
        let cls = 'node-group';
        if (d.ind.id === selectedId) cls += ' selected-node';
        return cls;
      });
    }
  }

  function clearInbreedPath() {
    inbreedPathEdges = [];
    highlightSet = null;
    dimSet = null;
    gInbreedEdges && gInbreedEdges.selectAll('.inbreed-path-edge').remove();
    gNodes && gNodes.selectAll('.node-group').attr('class', d => {
      let cls = 'node-group';
      if (d.ind.id === selectedId) cls += ' selected-node';
      return cls;
    });
  }

  function fitAll(visible) {
    if (!svg || !visible || visible.length === 0) return;
    // Use filter that keeps 0 values (avoid filter(Boolean) bug)
    const xs = visible.map(i => positions[i.id]?.x).filter(v => v !== undefined && v !== null);
    const ys = visible.map(i => positions[i.id]?.y).filter(v => v !== undefined && v !== null);
    if (!xs.length) return;
    const minX = Math.min(...xs) - NW,  maxX = Math.max(...xs) + NW;
    const minY = Math.min(...ys) - NH,  maxY = Math.max(...ys) + NH;
    const W = svg.node().clientWidth  || 800;
    const H = svg.node().clientHeight || 600;
    const pad = 0.85;
    const scale = Math.min(pad, Math.min(W * pad / (maxX - minX), H * pad / (maxY - minY)));
    const tx = W / 2 - (minX + maxX) / 2 * scale;
    const ty = 40 + (H * 0.4) - (minY + maxY) / 2 * scale;
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function resetZoom() {
    const inds = App.Store.getAll().filter(i => positions[i.id]);
    fitAll(inds);
  }

  function setGenFilter(val) { genFilter = val; }

  function setSearch(term) {
    searchTerm = term.toLowerCase();
    if (!gNodes) return;
    gNodes.selectAll('.node-group').attr('class', d => {
      let cls = 'node-group';
      if (searchTerm && !d.ind.name.toLowerCase().includes(searchTerm)) cls += ' dimmed';
      if (d.ind.id === selectedId) cls += ' selected-node';
      return cls;
    });
    // Scroll to first match
    if (searchTerm) {
      const match = App.Store.getAll().find(i => i.name.toLowerCase().includes(searchTerm));
      if (match && positions[match.id]) {
        const p = positions[match.id];
        const W = svg.node().clientWidth  || 800;
        const H = svg.node().clientHeight || 600;
        const scale = 1.2;
        svg.transition().duration(400).call(
          zoom.transform,
          d3.zoomIdentity.translate(W/2 - p.x * scale, H/2 - p.y * scale).scale(scale)
        );
      }
    }
  }

  return {
    init,
    render,
    setSelected,
    clearSelection,
    clearHighlight,
    showInbreedPath,
    clearInbreedPath,
    resetZoom,
    setGenFilter,
    setSearch,
    fitAll,
  };
})();
