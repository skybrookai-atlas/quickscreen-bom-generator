/* ── Fence Layout Mapper (FM) module ── */
(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────
  const GRID = 50;          // px per grid square
  const NODE_R = 7;         // node circle radius px
  const GATE_COLOUR = '#f59e0b';
  const SEG_COLOUR  = '#2563eb';
  const NODE_COLOUR = '#2563eb';
  const GRID_COLOUR = '#e5e7eb';
  const AXIS_COLOUR = '#d1d5db';
  const LABEL_FONT  = '11px sans-serif';
  const ANGLE_FONT  = '10px sans-serif';
  const HINT_MODES  = {
    draw : 'Click to place nodes — double-click or press Enter to finish a run. Press Esc to cancel.',
    gate : 'Click on a fence segment to place a gate. You\'ll be prompted for the gate width.',
    move : 'Drag nodes to reposition them.',
    none : ''
  };

  // ─── State ────────────────────────────────────────────────────────────────
  const S = {
    nodes : [],      // [{x, y, label}]  — pixel coords on canvas
    gates : [],      // [{seg, t, widthMm}]  seg = index into segments()
    mode  : 'draw',
    scale : 1000,    // mm per grid square
    snap  : true,
    drawing : false, // true while placing nodes
    pendingNode : null,  // {x,y} ghost while mouse moves in draw mode
    dragging : null,     // index of node being dragged
    dragOffset : {x:0, y:0},
    applied : false,     // has "Use This Layout" been pressed?
  };

  let canvas, overlay, ctx, octx, wrap;
  let W = 0, H = 0;
  let labelCounter = 0;

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    canvas  = document.getElementById('fm-canvas');
    overlay = document.getElementById('fm-overlay');
    wrap    = document.getElementById('fm-canvas-wrap');
    if (!canvas) return;
    ctx  = canvas.getContext('2d');
    octx = overlay.getContext('2d');

    resize();
    bindEvents();
    render();
    updateSummary();
  }

  function resize() {
    const rect = wrap.getBoundingClientRect();
    W = Math.max(rect.width || 700, 700);
    H = Math.max(rect.height || 340, 340);
    canvas.width  = overlay.width  = W;
    canvas.height = overlay.height = H;
    canvas.style.width  = overlay.style.width  = W + 'px';
    canvas.style.height = overlay.style.height = H + 'px';
    render();
  }

  // ─── Toggle (collapse / expand) ──────────────────────────────────────────
  window.toggleFenceMapper = function () {
    const bar  = document.getElementById('fm-toggle-bar');
    const body = document.getElementById('fm-body');
    const open = body.classList.toggle('open');
    bar.classList.toggle('open', open);
    if (open) {
      setTimeout(() => { resize(); render(); }, 50);
    }
  };

  // ─── Coordinate helpers ───────────────────────────────────────────────────
  function snapPx(v) {
    return S.snap ? Math.round(v / GRID) * GRID : v;
  }

  function evtPx(e) {
    const r = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  function pxToMm(px) {
    return Math.round((px / GRID) * S.scale);
  }

  function distPx(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── Geometry ─────────────────────────────────────────────────────────────
  function segments() {
    const segs = [];
    for (let i = 0; i < S.nodes.length - 1; i++) {
      segs.push({ a: S.nodes[i], b: S.nodes[i + 1] });
    }
    return segs;
  }

  function segLenMm(seg) {
    return pxToMm(distPx(seg.a, seg.b));
  }

  function angleDeg(prev, cur, next) {
    const ax = cur.x - prev.x, ay = cur.y - prev.y;
    const bx = next.x - cur.x, by = next.y - cur.y;
    const dot = ax * bx + ay * by;
    const cross = ax * by - ay * bx;
    let deg = Math.atan2(Math.abs(cross), dot) * 180 / Math.PI;
    return Math.round(deg);
  }

  // ─── Rendering ────────────────────────────────────────────────────────────
  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawSegments();
    drawGates();
    drawNodes();
  }

  function renderOverlay(mx, my) {
    if (!octx) return;
    octx.clearRect(0, 0, W, H);
    if (S.mode === 'draw' && S.drawing && S.nodes.length > 0 && mx != null) {
      const last = S.nodes[S.nodes.length - 1];
      octx.save();
      octx.strokeStyle = SEG_COLOUR;
      octx.lineWidth = 2;
      octx.setLineDash([6, 4]);
      octx.globalAlpha = 0.5;
      octx.beginPath();
      octx.moveTo(last.x, last.y);
      octx.lineTo(mx, my);
      octx.stroke();
      octx.restore();
      // distance label on ghost segment
      const lenMm = pxToMm(distPx(last, { x: mx, y: my }));
      if (lenMm > 0) {
        octx.save();
        octx.font = '11px sans-serif';
        octx.fillStyle = '#64748b';
        octx.fillText(lenMm.toLocaleString() + ' mm', (last.x + mx) / 2 + 6, (last.y + my) / 2 - 4);
        octx.restore();
      }
    }
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = GRID_COLOUR;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += GRID) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Axis lines
    ctx.strokeStyle = AXIS_COLOUR;
    ctx.lineWidth = 1;
    const ox = Math.round(W / 2 / GRID) * GRID;
    const oy = Math.round(H / 2 / GRID) * GRID;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
    // Scale indicator
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('1 sq = ' + S.scale.toLocaleString() + 'mm', 8, H - 8);
    ctx.restore();
  }

  function drawSegments() {
    const segs = segments();
    segs.forEach((seg, i) => {
      const gatesOnSeg = S.gates.filter(g => g.seg === i);
      // Build draw intervals excluding gate gaps
      const intervals = computeIntervals(seg, gatesOnSeg);
      ctx.save();
      ctx.strokeStyle = SEG_COLOUR;
      ctx.lineWidth = 2.5;
      intervals.forEach(([t0, t1]) => {
        const ax = seg.a.x + (seg.b.x - seg.a.x) * t0;
        const ay = seg.a.y + (seg.b.y - seg.a.y) * t0;
        const bx = seg.a.x + (seg.b.x - seg.a.x) * t1;
        const by = seg.a.y + (seg.b.y - seg.a.y) * t1;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      });
      ctx.restore();

      // Length label
      const mx = (seg.a.x + seg.b.x) / 2;
      const my = (seg.a.y + seg.b.y) / 2;
      const lenMm = segLenMm(seg);
      ctx.save();
      ctx.font = LABEL_FONT;
      ctx.fillStyle = SEG_COLOUR;
      ctx.textAlign = 'center';
      ctx.fillText(lenMm.toLocaleString() + ' mm', mx, my - 7);
      ctx.restore();
    });

    // Corner angles
    for (let i = 1; i < S.nodes.length - 1; i++) {
      const deg = angleDeg(S.nodes[i - 1], S.nodes[i], S.nodes[i + 1]);
      if (deg > 0 && deg < 175) {
        ctx.save();
        ctx.font = ANGLE_FONT;
        ctx.fillStyle = '#7c3aed';
        ctx.textAlign = 'center';
        ctx.fillText(deg + '°', S.nodes[i].x + 12, S.nodes[i].y - 10);
        ctx.restore();
      }
    }
  }

  function computeIntervals(seg, gatesOnSeg) {
    if (!gatesOnSeg.length) return [[0, 1]];
    const segLenPx = distPx(seg.a, seg.b);
    const cuts = [];
    gatesOnSeg.forEach(g => {
      const halfPx = (g.widthMm / S.scale) * GRID / 2;
      const halfT  = segLenPx > 0 ? halfPx / segLenPx : 0;
      cuts.push([Math.max(0, g.t - halfT), Math.min(1, g.t + halfT)]);
    });
    cuts.sort((a, b) => a[0] - b[0]);
    const intervals = [];
    let pos = 0;
    cuts.forEach(([s, e]) => {
      if (s > pos) intervals.push([pos, s]);
      pos = e;
    });
    if (pos < 1) intervals.push([pos, 1]);
    return intervals;
  }

  function drawGates() {
    const segs = segments();
    S.gates.forEach(g => {
      if (g.seg >= segs.length) return;
      const seg = segs[g.seg];
      const gx  = seg.a.x + (seg.b.x - seg.a.x) * g.t;
      const gy  = seg.a.y + (seg.b.y - seg.a.y) * g.t;
      const segLenPx = distPx(seg.a, seg.b);
      const halfPx = (g.widthMm / S.scale) * GRID / 2;
      const halfT  = segLenPx > 0 ? halfPx / segLenPx : 0;
      const ax = seg.a.x + (seg.b.x - seg.a.x) * (g.t - halfT);
      const ay = seg.a.y + (seg.b.y - seg.a.y) * (g.t - halfT);
      const bx = seg.a.x + (seg.b.x - seg.a.x) * (g.t + halfT);
      const by = seg.a.y + (seg.b.y - seg.a.y) * (g.t + halfT);

      // Dashed gap line
      ctx.save();
      ctx.strokeStyle = GATE_COLOUR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();

      // Double-arrow heads
      drawArrow(ctx, ax, ay, bx, by, GATE_COLOUR);
      drawArrow(ctx, bx, by, ax, ay, GATE_COLOUR);

      // Width label
      ctx.save();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = GATE_COLOUR;
      ctx.textAlign = 'center';
      ctx.fillText(g.widthMm.toLocaleString() + ' mm gate', gx, gy + 16);
      ctx.restore();
    });
  }

  function drawArrow(c, x1, y1, x2, y2, colour) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size  = 8;
    c.save();
    c.strokeStyle = colour;
    c.fillStyle   = colour;
    c.lineWidth   = 1.5;
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - size * Math.cos(angle - 0.4), y2 - size * Math.sin(angle - 0.4));
    c.lineTo(x2 - size * Math.cos(angle + 0.4), y2 - size * Math.sin(angle + 0.4));
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawNodes() {
    S.nodes.forEach((n, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = NODE_COLOUR;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = NODE_COLOUR;
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y - 11);
      ctx.restore();
    });
  }

  // ─── Event binding ────────────────────────────────────────────────────────
  function bindEvents() {
    // Toolbar buttons
    document.getElementById('fm-mode-draw').addEventListener('click', () => setMode('draw'));
    document.getElementById('fm-mode-gate').addEventListener('click', () => setMode('gate'));
    document.getElementById('fm-mode-move').addEventListener('click', () => setMode('move'));
    document.getElementById('fm-undo').addEventListener('click', doUndo);
    document.getElementById('fm-clear').addEventListener('click', doClear);

    document.getElementById('fm-scale').addEventListener('change', function () {
      const v = parseInt(this.value);
      if (v > 0) { S.scale = v; render(); updateSummary(); }
    });

    document.getElementById('fm-snap-cb').addEventListener('change', function () {
      S.snap = this.checked;
    });

    // Canvas mouse events
    overlay.addEventListener('mousedown',  onMouseDown);
    overlay.addEventListener('mousemove',  onMouseMove);
    overlay.addEventListener('mouseup',    onMouseUp);
    overlay.addEventListener('dblclick',   onDblClick);

    // Touch events
    overlay.addEventListener('touchstart', onTouchStart, { passive: false });
    overlay.addEventListener('touchmove',  onTouchMove,  { passive: false });
    overlay.addEventListener('touchend',   onTouchEnd,   { passive: false });

    // Keyboard
    document.addEventListener('keydown', onKeyDown);

    // Apply button
    document.getElementById('fm-apply-btn').addEventListener('click', applyToCalculator);

    // Window resize
    window.addEventListener('resize', () => { resize(); });
  }

  function setMode(m) {
    S.mode = m;
    if (m !== 'draw') { S.drawing = false; S.pendingNode = null; }
    wrap.className = 'mode-' + m;
    document.getElementById('fm-canvas-wrap').className = 'mode-' + m;
    ['draw','gate','move'].forEach(id => {
      const btn = document.getElementById('fm-mode-' + id);
      if (btn) btn.classList.toggle('active', id === m);
    });
    document.getElementById('fm-hint').textContent = HINT_MODES[m] || '';
    octx.clearRect(0, 0, W, H);
  }

  // ─── Mouse handlers ───────────────────────────────────────────────────────
  function onMouseDown(e) {
    const {x, y} = evtPx(e);
    const sx = snapPx(x), sy = snapPx(y);

    if (S.mode === 'draw') {
      S.drawing = true;
      placeNode(sx, sy);
    } else if (S.mode === 'gate') {
      tryPlaceGate(x, y);
    } else if (S.mode === 'move') {
      const idx = hitTestNode(x, y);
      if (idx !== -1) {
        S.dragging = idx;
        S.dragOffset = { x: S.nodes[idx].x - x, y: S.nodes[idx].y - y };
      }
    }
    e.preventDefault();
  }

  function onMouseMove(e) {
    const {x, y} = evtPx(e);
    const sx = snapPx(x), sy = snapPx(y);

    if (S.mode === 'move' && S.dragging !== null) {
      S.nodes[S.dragging].x = sx + S.dragOffset.x;
      S.nodes[S.dragging].y = sy + S.dragOffset.y;
      // snap dragged node
      S.nodes[S.dragging].x = snapPx(S.nodes[S.dragging].x);
      S.nodes[S.dragging].y = snapPx(S.nodes[S.dragging].y);
      render();
      updateSummary();
    }

    if (S.mode === 'draw' && S.drawing) {
      S.pendingNode = { x: sx, y: sy };
      renderOverlay(sx, sy);
    }
    e.preventDefault();
  }

  function onMouseUp(e) {
    if (S.mode === 'move' && S.dragging !== null) {
      S.dragging = null;
      updateSummary();
    }
    e.preventDefault();
  }

  function onDblClick(e) {
    if (S.mode === 'draw' && S.drawing && S.nodes.length >= 2) {
      finishRun();
    }
    e.preventDefault();
  }

  // ─── Touch handlers ───────────────────────────────────────────────────────
  function onTouchStart(e) {
    e.preventDefault();
    const {x, y} = evtPx(e);
    const sx = snapPx(x), sy = snapPx(y);

    if (S.mode === 'draw') {
      S.drawing = true;
      placeNode(sx, sy);
    } else if (S.mode === 'gate') {
      tryPlaceGate(x, y);
    } else if (S.mode === 'move') {
      const idx = hitTestNode(x, y);
      if (idx !== -1) {
        S.dragging = idx;
        S.dragOffset = { x: S.nodes[idx].x - x, y: S.nodes[idx].y - y };
      }
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    const {x, y} = evtPx(e);
    const sx = snapPx(x), sy = snapPx(y);

    if (S.mode === 'move' && S.dragging !== null) {
      S.nodes[S.dragging].x = snapPx(sx + S.dragOffset.x);
      S.nodes[S.dragging].y = snapPx(sy + S.dragOffset.y);
      render();
      updateSummary();
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    if (S.mode === 'move') S.dragging = null;
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    const body = document.getElementById('fm-body');
    if (!body || !body.classList.contains('open')) return;

    if (e.key === 'Enter' && S.mode === 'draw' && S.drawing && S.nodes.length >= 2) {
      finishRun();
      e.preventDefault();
    }
    if (e.key === 'Escape' && S.mode === 'draw' && S.drawing) {
      S.drawing = false;
      S.pendingNode = null;
      if (S.nodes.length > 0) S.nodes.pop(); // remove last pending
      octx.clearRect(0, 0, W, H);
      render();
      e.preventDefault();
    }
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
      doUndo();
      e.preventDefault();
    }
  }

  // ─── Node placement ───────────────────────────────────────────────────────
  function nextLabel() {
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return labels[labelCounter++ % 26];
  }

  function placeNode(x, y) {
    // Don't place duplicate on same spot
    if (S.nodes.length > 0) {
      const last = S.nodes[S.nodes.length - 1];
      if (last.x === x && last.y === y) return;
    }
    S.nodes.push({ x, y, label: nextLabel() });
    render();
    updateSummary();
    updateApplyBtn();
  }

  function finishRun() {
    S.drawing = false;
    S.pendingNode = null;
    octx.clearRect(0, 0, W, H);
    render();
    updateSummary();
  }

  function hitTestNode(x, y) {
    for (let i = S.nodes.length - 1; i >= 0; i--) {
      const n = S.nodes[i];
      if (Math.abs(n.x - x) <= NODE_R + 4 && Math.abs(n.y - y) <= NODE_R + 4) return i;
    }
    return -1;
  }

  // ─── Gate placement ───────────────────────────────────────────────────────
  function tryPlaceGate(x, y) {
    const segs = segments();
    if (!segs.length) {
      showToast('Draw your fence run first, then place gates.');
      return;
    }
    let bestSeg = -1, bestT = 0, bestDist = Infinity;
    segs.forEach((seg, i) => {
      const { t, dist } = projectOnSegment(x, y, seg);
      if (dist < bestDist && dist < 20) {
        bestDist = dist; bestSeg = i; bestT = t;
      }
    });
    if (bestSeg === -1) {
      showToast('Click closer to a fence segment to place a gate.');
      return;
    }
    const seg = segs[bestSeg];
    const segMm = segLenMm(seg);
    const rawW = prompt('Gate opening width (mm)?', '900');
    if (rawW === null) return;
    const widthMm = parseInt(rawW);
    if (!widthMm || widthMm < 100) { alert('Invalid gate width.'); return; }
    if (widthMm >= segMm) { alert('Gate width (' + widthMm + 'mm) is too wide for this segment (' + segMm + 'mm).'); return; }
    S.gates.push({ seg: bestSeg, t: bestT, widthMm });
    render();
    updateSummary();
    updateApplyBtn();
  }

  function projectOnSegment(px, py, seg) {
    const dx = seg.b.x - seg.a.x, dy = seg.b.y - seg.a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { t: 0, dist: distPx({ x: px, y: py }, seg.a) };
    const t = Math.max(0, Math.min(1, ((px - seg.a.x) * dx + (py - seg.a.y) * dy) / lenSq));
    const cx = seg.a.x + t * dx, cy = seg.a.y + t * dy;
    return { t, dist: distPx({ x: px, y: py }, { x: cx, y: cy }) };
  }

  // ─── Undo / Clear ─────────────────────────────────────────────────────────
  function doUndo() {
    if (S.mode === 'draw' && S.nodes.length > 0) {
      S.nodes.pop();
      labelCounter = Math.max(0, labelCounter - 1);
      // remove gates that reference now-invalid segments
      const maxSeg = Math.max(0, S.nodes.length - 2);
      S.gates = S.gates.filter(g => g.seg < maxSeg);
    } else if (S.gates.length > 0) {
      S.gates.pop();
    }
    render();
    updateSummary();
    updateApplyBtn();
  }

  function doClear() {
    if (S.applied) {
      if (!confirm('This layout has already been applied to the calculator. Clearing it will not remove those values. Continue?')) return;
    }
    if ((S.nodes.length > 0 || S.gates.length > 0) &&
        !confirm('Clear all nodes and gates?')) return;
    S.nodes = [];
    S.gates = [];
    S.drawing = false;
    S.pendingNode = null;
    S.applied = false;
    labelCounter = 0;
    octx.clearRect(0, 0, W, H);
    render();
    updateSummary();
    updateApplyBtn();
  }

  // ─── Summary table ────────────────────────────────────────────────────────
  function updateSummary() {
    const segs = segments();
    const sumDiv = document.getElementById('fm-summary');
    if (!sumDiv) return;

    if (segs.length === 0) {
      sumDiv.innerHTML = '';
      document.getElementById('fm-totals').textContent = '';
      updateApplyBtn();
      return;
    }

    let totalFenceMm = 0, totalGatesMm = 0, cornerCount = 0;
    let rows = '';
    segs.forEach((seg, i) => {
      const segMm = segLenMm(seg);
      const gatesOnSeg = S.gates.filter(g => g.seg === i);
      const gatesTotalMm = gatesOnSeg.reduce((s, g) => s + g.widthMm, 0);
      const netFenceMm   = segMm - gatesTotalMm;
      totalFenceMm  += netFenceMm;
      totalGatesMm  += gatesTotalMm;
      const gateStr = gatesOnSeg.length
        ? gatesOnSeg.map(g => g.widthMm.toLocaleString() + ' mm').join(', ')
        : '—';
      // Angle at end node (if not last)
      let angleStr = '—';
      if (i < segs.length - 1) {
        const deg = angleDeg(seg.a, seg.b, segs[i + 1].b);
        if (deg > 0 && deg < 175) { angleStr = deg + '°'; cornerCount++; }
      }
      rows += `<tr>
        <td>${seg.a.label}–${seg.b.label}</td>
        <td>${segMm.toLocaleString()} mm</td>
        <td>${gateStr}</td>
        <td>${netFenceMm.toLocaleString()} mm</td>
        <td>${angleStr}</td>
      </tr>`;
    });

    sumDiv.innerHTML = `
      <div id="fm-summary-title">Run summary</div>
      <table>
        <thead><tr>
          <th>Segment</th><th>Length</th><th>Gates</th><th>Net fence</th><th>Corner angle</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    const gateCount = S.gates.length;
    document.getElementById('fm-totals').innerHTML =
      `Total fence: <strong>${totalFenceMm.toLocaleString()} mm (${(totalFenceMm / 1000).toFixed(2)} m)</strong>
       &nbsp;|&nbsp; Corners: <strong>${cornerCount}</strong>
       &nbsp;|&nbsp; Gates: <strong>${gateCount}</strong>
       ${gateCount ? '(total opening ' + totalGatesMm.toLocaleString() + ' mm)' : ''}`;

    updateApplyBtn();
  }

  function updateApplyBtn() {
    const btn = document.getElementById('fm-apply-btn');
    if (!btn) return;
    btn.disabled = S.nodes.length < 2;
  }

  // ─── Apply to calculator ──────────────────────────────────────────────────
  function applyToCalculator() {
    if (S.nodes.length < 2) return;
    const segs = segments();
    let totalFenceMm = 0, cornerCount = 0;
    segs.forEach((seg, i) => {
      const segMm = segLenMm(seg);
      const gatesOnSeg = S.gates.filter(g => g.seg === i);
      const gatesTotalMm = gatesOnSeg.reduce((s, g) => s + g.widthMm, 0);
      totalFenceMm += segMm - gatesTotalMm;
      if (i < segs.length - 1) {
        const deg = angleDeg(seg.a, seg.b, segs[i + 1].b);
        if (deg > 0 && deg < 175) cornerCount++;
      }
    });

    const totalFenceM = parseFloat((totalFenceMm / 1000).toFixed(2));
    const lengthEl   = document.getElementById('f_length');
    const cornersEl  = document.getElementById('f_corners');
    const jobDescEl  = document.getElementById('jobDesc');

    // Warn before overwriting existing run length
    if (lengthEl && lengthEl.value && parseFloat(lengthEl.value) !== totalFenceM) {
      if (!confirm('Overwrite current run length (' + lengthEl.value + 'm) with layout value (' + totalFenceM + 'm)?')) return;
    }

    if (lengthEl)  { lengthEl.value = totalFenceM; lengthEl.classList.add('prefilled'); }
    if (cornersEl) { cornersEl.value = cornerCount; cornersEl.classList.add('prefilled'); }

    // Prepend layout summary to job description
    const segSummary = segs.map((seg, i) => {
      const gatesOnSeg = S.gates.filter(g => g.seg === i);
      const gStr = gatesOnSeg.length ? ' (gate' + (gatesOnSeg.length > 1 ? 's' : '') + ': ' + gatesOnSeg.map(g => g.widthMm + 'mm').join(', ') + ')' : '';
      return seg.a.label + '–' + seg.b.label + ' ' + (segLenMm(seg) / 1000).toFixed(2) + 'm' + gStr;
    }).join(', ');

    const layoutNote = '[Layout: ' + segSummary + '; ' + cornerCount + ' corner' + (cornerCount !== 1 ? 's' : '') + ']';
    if (jobDescEl && !jobDescEl.value.startsWith('[Layout:')) {
      jobDescEl.value = layoutNote + (jobDescEl.value ? '\n' + jobDescEl.value : '');
    } else if (jobDescEl) {
      // Replace existing layout prefix
      jobDescEl.value = layoutNote + jobDescEl.value.replace(/^\[Layout:[^\]]*\]\n?/, '\n').trimStart();
    }

    // Add gates to the calculator gate list
    if (window.resetGates) window.resetGates();
    S.gates.forEach(g => {
      if (window.addGate) {
        const gMm = g.widthMm;
        const gType = gMm >= 2000 ? 'sliding' : gMm >= 1200 ? 'swing_double' : 'pedestrian';
        window.addGate({ type: gType, width: gMm, motor: false });
      }
    });

    S.applied = true;
    showToast('Layout applied — ' + totalFenceM + 'm fence, ' + cornerCount + ' corner' + (cornerCount !== 1 ? 's' : '') + ', ' + S.gates.length + ' gate' + (S.gates.length !== 1 ? 's' : ''));
  }

  // ─── Site plan for BOM output ─────────────────────────────────────────────
  window.fmGetSitePlanDataURL = function () {
    if (!canvas || S.nodes.length < 2) return null;
    // Render a clean copy on an offscreen canvas
    const oc = document.createElement('canvas');
    const margin = 40;
    // Find bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    S.nodes.forEach(n => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    const bw = maxX - minX + margin * 2;
    const bh = maxY - minY + margin * 2;
    oc.width  = Math.max(bw, 200);
    oc.height = Math.max(bh, 200);
    const oc2 = oc.getContext('2d');
    oc2.fillStyle = '#fff';
    oc2.fillRect(0, 0, oc.width, oc.height);

    // Offset transform
    const ox = margin - minX, oy = margin - minY;

    // Draw segments
    const segs = segments();
    segs.forEach((seg, i) => {
      const gatesOnSeg = S.gates.filter(g => g.seg === i);
      const intervals  = computeIntervals(seg, gatesOnSeg);
      oc2.save();
      oc2.strokeStyle = SEG_COLOUR; oc2.lineWidth = 2.5;
      intervals.forEach(([t0, t1]) => {
        oc2.beginPath();
        oc2.moveTo(seg.a.x + ox + (seg.b.x - seg.a.x) * t0, seg.a.y + oy + (seg.b.y - seg.a.y) * t0);
        oc2.lineTo(seg.a.x + ox + (seg.b.x - seg.a.x) * t1, seg.a.y + oy + (seg.b.y - seg.a.y) * t1);
        oc2.stroke();
      });
      oc2.restore();
      // Length label
      const mx = (seg.a.x + seg.b.x) / 2 + ox;
      const my = (seg.a.y + seg.b.y) / 2 + oy;
      oc2.save(); oc2.font = '11px sans-serif'; oc2.fillStyle = SEG_COLOUR; oc2.textAlign = 'center';
      oc2.fillText(segLenMm(seg).toLocaleString() + 'mm', mx, my - 7); oc2.restore();
    });

    // Draw gates
    S.gates.forEach(g => {
      if (g.seg >= segs.length) return;
      const seg = segs[g.seg];
      const gx = seg.a.x + (seg.b.x - seg.a.x) * g.t + ox;
      const gy = seg.a.y + (seg.b.y - seg.a.y) * g.t + oy;
      const segLenPx = distPx(seg.a, seg.b);
      const halfPx   = (g.widthMm / S.scale) * GRID / 2;
      const halfT    = segLenPx > 0 ? halfPx / segLenPx : 0;
      const ax = seg.a.x + (seg.b.x - seg.a.x) * (g.t - halfT) + ox;
      const ay = seg.a.y + (seg.b.y - seg.a.y) * (g.t - halfT) + oy;
      const bx = seg.a.x + (seg.b.x - seg.a.x) * (g.t + halfT) + ox;
      const by = seg.a.y + (seg.b.y - seg.a.y) * (g.t + halfT) + oy;
      oc2.save(); oc2.strokeStyle = GATE_COLOUR; oc2.lineWidth = 2; oc2.setLineDash([5, 4]);
      oc2.beginPath(); oc2.moveTo(ax, ay); oc2.lineTo(bx, by); oc2.stroke(); oc2.restore();
      oc2.save(); oc2.font = '10px sans-serif'; oc2.fillStyle = GATE_COLOUR; oc2.textAlign = 'center';
      oc2.fillText(g.widthMm + 'mm', gx, gy + 14); oc2.restore();
    });

    // Draw nodes
    S.nodes.forEach(n => {
      oc2.save();
      oc2.beginPath(); oc2.arc(n.x + ox, n.y + oy, NODE_R, 0, Math.PI * 2);
      oc2.fillStyle = '#fff'; oc2.fill();
      oc2.strokeStyle = NODE_COLOUR; oc2.lineWidth = 2; oc2.stroke();
      oc2.restore();
      oc2.save(); oc2.font = 'bold 11px sans-serif'; oc2.fillStyle = NODE_COLOUR; oc2.textAlign = 'center';
      oc2.fillText(n.label, n.x + ox, n.y + oy - 11); oc2.restore();
    });

    return oc.toDataURL('image/png');
  };

  // ─── Toast ────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('fm-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ─── Serialisation ────────────────────────────────────────────────────────
  window.fmGetState = function ()  { return JSON.stringify({ nodes: S.nodes, gates: S.gates, scale: S.scale }); };
  window.fmLoadState = function (json) {
    try {
      const d = JSON.parse(json);
      S.nodes = d.nodes || [];
      S.gates = d.gates || [];
      S.scale = d.scale || 1000;
      labelCounter = S.nodes.length;
      document.getElementById('fm-scale').value = S.scale;
      render(); updateSummary(); updateApplyBtn();
    } catch (e) { /* ignore */ }
  };

  // ─── Boot ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
