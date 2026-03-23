/* ── Fence Layout Mapper (FM) v2 — zoom/pan + segment scale calibration ── */
(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────
  const GRID        = 50;
  const NODE_R      = 7;
  const GATE_COLOUR = '#f59e0b';
  const SEG_COLOUR  = '#2563eb';
  const NODE_COLOUR = '#2563eb';
  const GRID_COLOUR = '#e5e7eb';
  const AXIS_COLOUR = '#d1d5db';

  const HINT = {
    draw : 'Click to place nodes. Double-click last node or press Enter to finish. Esc to cancel.',
    gate : 'Click on a fence segment to place a gate.',
    move : 'Drag nodes to reposition. Right-drag or middle-mouse to pan. Scroll to zoom.',
    none : ''
  };

  // ─── State ────────────────────────────────────────────────────────────────
  const S = {
    nodes   : [],   // [{x, y, label}]  — world coords
    gates   : [],   // [{seg, t, widthMm}]
    mode    : 'draw',
    scale   : 1000, // mm per GRID world units
    snap    : true,
    drawing : false,
    // drag
    dragging   : null,
    dragOffset : { x: 0, y: 0 },
    // pan
    panning   : false,
    panStart  : { x: 0, y: 0 },
    panOrigin : { x: 0, y: 0 },
    // viewport
    zoom : 1,
    panX : 0,
    panY : 0,
    applied : false,
  };

  let canvas, overlay, ctx, octx, wrap;
  let W = 0, H = 0;
  let labelCounter = 0;

  // ─── Viewport helpers ─────────────────────────────────────────────────────
  // world coords → screen px
  function w2s(wx, wy) {
    return { x: (wx - S.panX) * S.zoom, y: (wy - S.panY) * S.zoom };
  }
  // screen px → world coords
  function s2w(sx, sy) {
    return { x: sx / S.zoom + S.panX, y: sy / S.zoom + S.panY };
  }

  function evtScreen(e) {
    const r = overlay.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  function evtWorld(e) {
    const s = evtScreen(e);
    return s2w(s.x, s.y);
  }

  function snapWorld(wx, wy) {
    if (!S.snap) return { x: wx, y: wy };
    return { x: Math.round(wx / GRID) * GRID, y: Math.round(wy / GRID) * GRID };
  }

  function distWorld(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pxToMm(worldPx) {
    return Math.round((worldPx / GRID) * S.scale);
  }

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

  // ─── Toggle ───────────────────────────────────────────────────────────────
  window.toggleFenceMapper = function () {
    const bar  = document.getElementById('fm-toggle-bar');
    const body = document.getElementById('fm-body');
    const open = body.classList.toggle('open');
    bar.classList.toggle('open', open);
    if (open) setTimeout(() => { resize(); render(); }, 50);
  };

  // ─── Geometry ─────────────────────────────────────────────────────────────
  function segments() {
    const out = [];
    for (let i = 0; i < S.nodes.length - 1; i++) {
      out.push({ a: S.nodes[i], b: S.nodes[i + 1], idx: i });
    }
    return out;
  }

  function segLenMm(seg) {
    return pxToMm(distWorld(seg.a, seg.b));
  }

  function angleDeg(prev, cur, next) {
    const ax = cur.x - prev.x, ay = cur.y - prev.y;
    const bx = next.x - cur.x, by = next.y - cur.y;
    const dot = ax * bx + ay * by;
    const cross = ax * by - ay * bx;
    return Math.round(Math.atan2(Math.abs(cross), dot) * 180 / Math.PI);
  }

  // Project screen point onto segment; returns {t, dist} in screen space
  function projectOnSegScreen(sx, sy, seg) {
    const sa = w2s(seg.a.x, seg.a.y);
    const sb = w2s(seg.b.x, seg.b.y);
    const dx = sb.x - sa.x, dy = sb.y - sa.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const d = Math.hypot(sx - sa.x, sy - sa.y);
      return { t: 0, dist: d };
    }
    const t = Math.max(0, Math.min(1, ((sx - sa.x) * dx + (sy - sa.y) * dy) / lenSq));
    const cx = sa.x + t * dx, cy = sa.y + t * dy;
    return { t, dist: Math.hypot(sx - cx, sy - cy) };
  }

  function hitTestNode(sx, sy) {
    for (let i = S.nodes.length - 1; i >= 0; i--) {
      const s = w2s(S.nodes[i].x, S.nodes[i].y);
      if (Math.hypot(sx - s.x, sy - s.y) <= NODE_R + 5) return i;
    }
    return -1;
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

  function renderOverlay(sx, sy) {
    if (!octx) return;
    octx.clearRect(0, 0, W, H);
    if (S.mode === 'draw' && S.drawing && S.nodes.length > 0 && sx != null) {
      const last  = w2s(S.nodes[S.nodes.length - 1].x, S.nodes[S.nodes.length - 1].y);
      octx.save();
      octx.strokeStyle = SEG_COLOUR;
      octx.lineWidth = 2;
      octx.setLineDash([6, 4]);
      octx.globalAlpha = 0.5;
      octx.beginPath();
      octx.moveTo(last.x, last.y);
      octx.lineTo(sx, sy);
      octx.stroke();
      octx.restore();
      // Distance label
      const wEnd = s2w(sx, sy);
      const wLast = S.nodes[S.nodes.length - 1];
      const lenMm = pxToMm(distWorld(wLast, wEnd));
      if (lenMm > 0) {
        octx.save();
        octx.font = '11px sans-serif';
        octx.fillStyle = '#64748b';
        octx.fillText(lenMm.toLocaleString() + ' mm', (last.x + sx) / 2 + 6, (last.y + sy) / 2 - 4);
        octx.restore();
      }
    }
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = GRID_COLOUR;
    ctx.lineWidth = 0.5;
    // Determine world bounds
    const wl = s2w(0, 0).x, wr = s2w(W, 0).x;
    const wt = s2w(0, 0).y, wb = s2w(0, H).y;
    const sx0 = Math.floor(wl / GRID) * GRID;
    const sy0 = Math.floor(wt / GRID) * GRID;
    for (let wx = sx0; wx <= wr; wx += GRID) {
      const p = w2s(wx, 0);
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, H); ctx.stroke();
    }
    for (let wy = sy0; wy <= wb; wy += GRID) {
      const p = w2s(0, wy);
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(W, p.y); ctx.stroke();
    }
    // Axes
    ctx.strokeStyle = AXIS_COLOUR;
    ctx.lineWidth = 1;
    const ax0 = w2s(0, 0);
    ctx.beginPath(); ctx.moveTo(ax0.x, 0); ctx.lineTo(ax0.x, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ax0.y); ctx.lineTo(W, ax0.y); ctx.stroke();
    // Scale label
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('1 sq = ' + S.scale.toLocaleString() + ' mm  |  zoom ' + S.zoom.toFixed(2) + '×', 8, H - 8);
    ctx.restore();
  }

  function drawSegments() {
    const segs = segments();
    segs.forEach((seg, i) => {
      const gatesOnSeg = S.gates.filter(g => g.seg === i);
      const intervals  = computeIntervals(seg, gatesOnSeg);
      const sa = w2s(seg.a.x, seg.a.y);
      const sb = w2s(seg.b.x, seg.b.y);
      ctx.save();
      ctx.strokeStyle = SEG_COLOUR;
      ctx.lineWidth = 2.5;
      intervals.forEach(([t0, t1]) => {
        ctx.beginPath();
        ctx.moveTo(sa.x + (sb.x - sa.x) * t0, sa.y + (sb.y - sa.y) * t0);
        ctx.lineTo(sa.x + (sb.x - sa.x) * t1, sa.y + (sb.y - sa.y) * t1);
        ctx.stroke();
      });
      ctx.restore();
      // Length label
      const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2;
      ctx.save();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = SEG_COLOUR;
      ctx.textAlign = 'center';
      ctx.fillText(segLenMm(seg).toLocaleString() + ' mm', mx, my - 8);
      ctx.restore();
    });
    // Corner angles
    for (let i = 1; i < S.nodes.length - 1; i++) {
      const deg = angleDeg(S.nodes[i - 1], S.nodes[i], S.nodes[i + 1]);
      if (deg > 2 && deg < 175) {
        const sp = w2s(S.nodes[i].x, S.nodes[i].y);
        ctx.save();
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#7c3aed';
        ctx.textAlign = 'center';
        ctx.fillText(deg + '°', sp.x + 14, sp.y - 12);
        ctx.restore();
      }
    }
  }

  function computeIntervals(seg, gatesOnSeg) {
    if (!gatesOnSeg.length) return [[0, 1]];
    const segLenPx = distWorld(seg.a, seg.b);
    const cuts = gatesOnSeg.map(g => {
      const halfPx  = (g.widthMm / S.scale) * GRID / 2;
      const halfT   = segLenPx > 0 ? halfPx / segLenPx : 0;
      return [Math.max(0, g.t - halfT), Math.min(1, g.t + halfT)];
    }).sort((a, b) => a[0] - b[0]);
    const out = [];
    let pos = 0;
    cuts.forEach(([s, e]) => { if (s > pos) out.push([pos, s]); pos = e; });
    if (pos < 1) out.push([pos, 1]);
    return out;
  }

  function drawGates() {
    const segs = segments();
    S.gates.forEach(g => {
      if (g.seg >= segs.length) return;
      const seg     = segs[g.seg];
      const sa      = w2s(seg.a.x, seg.a.y);
      const sb      = w2s(seg.b.x, seg.b.y);
      const gsx     = sa.x + (sb.x - sa.x) * g.t;
      const gsy     = sa.y + (sb.y - sa.y) * g.t;
      const segLenPx = distWorld(seg.a, seg.b);
      const halfPx  = (g.widthMm / S.scale) * GRID / 2;
      const halfT   = segLenPx > 0 ? halfPx / segLenPx : 0;
      const ax = sa.x + (sb.x - sa.x) * (g.t - halfT);
      const ay = sa.y + (sb.y - sa.y) * (g.t - halfT);
      const bx = sa.x + (sb.x - sa.x) * (g.t + halfT);
      const by = sa.y + (sb.y - sa.y) * (g.t + halfT);
      ctx.save();
      ctx.strokeStyle = GATE_COLOUR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
      drawArrow(ctx, ax, ay, bx, by, GATE_COLOUR);
      drawArrow(ctx, bx, by, ax, ay, GATE_COLOUR);
      ctx.save();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = GATE_COLOUR;
      ctx.textAlign = 'center';
      ctx.fillText(g.widthMm.toLocaleString() + ' mm gate', gsx, gsy + 18);
      ctx.restore();
    });
  }

  function drawArrow(c, x1, y1, x2, y2, colour) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size  = 8;
    c.save();
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - size * Math.cos(angle - 0.4), y2 - size * Math.sin(angle - 0.4));
    c.lineTo(x2 - size * Math.cos(angle + 0.4), y2 - size * Math.sin(angle + 0.4));
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawNodes() {
    S.nodes.forEach(n => {
      const s = w2s(n.x, n.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, NODE_R, 0, Math.PI * 2);
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
      ctx.fillText(n.label, s.x, s.y - 12);
      ctx.restore();
    });
  }

  // ─── Event binding ────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('fm-mode-draw').addEventListener('click', () => setMode('draw'));
    document.getElementById('fm-mode-gate').addEventListener('click', () => setMode('gate'));
    document.getElementById('fm-mode-move').addEventListener('click', () => setMode('move'));
    document.getElementById('fm-undo').addEventListener('click', doUndo);
    document.getElementById('fm-clear').addEventListener('click', doClear);

    const resetBtn = document.getElementById('fm-reset-view');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      S.zoom = 1; S.panX = 0; S.panY = 0; render();
    });

    document.getElementById('fm-scale').addEventListener('change', function () {
      const v = parseInt(this.value);
      if (v > 0) { S.scale = v; render(); updateSummary(); }
    });

    document.getElementById('fm-snap-cb').addEventListener('change', function () {
      S.snap = this.checked;
    });

    // Mouse events
    overlay.addEventListener('mousedown',  onMouseDown);
    overlay.addEventListener('mousemove',  onMouseMove);
    overlay.addEventListener('mouseup',    onMouseUp);
    overlay.addEventListener('dblclick',   onDblClick);
    overlay.addEventListener('wheel',      onWheel, { passive: false });
    overlay.addEventListener('contextmenu', e => e.preventDefault());

    // Touch
    overlay.addEventListener('touchstart', onTouchStart, { passive: false });
    overlay.addEventListener('touchmove',  onTouchMove,  { passive: false });
    overlay.addEventListener('touchend',   onTouchEnd,   { passive: false });

    // Keyboard
    document.addEventListener('keydown', onKeyDown);

    document.getElementById('fm-apply-btn').addEventListener('click', applyToCalculator);
    window.addEventListener('resize', () => resize());
  }

  function setMode(m) {
    S.mode = m;
    if (m !== 'draw') { S.drawing = false; octx.clearRect(0, 0, W, H); }
    document.getElementById('fm-canvas-wrap').className = 'mode-' + m;
    ['draw','gate','move'].forEach(id => {
      const btn = document.getElementById('fm-mode-' + id);
      if (btn) btn.classList.toggle('active', id === m);
    });
    const hint = document.getElementById('fm-hint');
    if (hint) hint.textContent = HINT[m] || '';
  }

  // ─── Wheel zoom ───────────────────────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault();
    const s = evtScreen(e);
    // World pos under mouse before zoom
    const wx = s.x / S.zoom + S.panX;
    const wy = s.y / S.zoom + S.panY;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    S.zoom = Math.max(0.1, Math.min(10, S.zoom * factor));
    // Keep wx,wy under mouse after zoom
    S.panX = wx - s.x / S.zoom;
    S.panY = wy - s.y / S.zoom;
    render();
  }

  // ─── Mouse ────────────────────────────────────────────────────────────────
  function onMouseDown(e) {
    const s  = evtScreen(e);
    const wp = s2w(s.x, s.y);
    const snapped = snapWorld(wp.x, wp.y);

    // Middle or right button → pan
    if (e.button === 1 || e.button === 2) {
      S.panning   = true;
      S.panStart  = s;
      S.panOrigin = { x: S.panX, y: S.panY };
      e.preventDefault();
      return;
    }

    if (S.mode === 'draw') {
      S.drawing = true;
      placeNode(snapped.x, snapped.y);
    } else if (S.mode === 'gate') {
      tryPlaceGate(s.x, s.y);
    } else if (S.mode === 'move') {
      const idx = hitTestNode(s.x, s.y);
      if (idx !== -1) {
        S.dragging   = idx;
        S.dragOffset = { x: S.nodes[idx].x - wp.x, y: S.nodes[idx].y - wp.y };
      } else {
        // Start pan in move mode via left-drag on empty space
        S.panning   = true;
        S.panStart  = s;
        S.panOrigin = { x: S.panX, y: S.panY };
      }
    }
    e.preventDefault();
  }

  function onMouseMove(e) {
    const s  = evtScreen(e);
    const wp = s2w(s.x, s.y);

    if (S.panning) {
      S.panX = S.panOrigin.x - (s.x - S.panStart.x) / S.zoom;
      S.panY = S.panOrigin.y - (s.y - S.panStart.y) / S.zoom;
      render();
      return;
    }

    if (S.mode === 'move' && S.dragging !== null) {
      const snapped = snapWorld(wp.x + S.dragOffset.x, wp.y + S.dragOffset.y);
      S.nodes[S.dragging].x = snapped.x;
      S.nodes[S.dragging].y = snapped.y;
      render();
      updateSummary();
      return;
    }

    if (S.mode === 'draw' && S.drawing) {
      const snapped = snapWorld(wp.x, wp.y);
      renderOverlay(w2s(snapped.x, snapped.y).x, w2s(snapped.x, snapped.y).y);
    }
    e.preventDefault();
  }

  function onMouseUp(e) {
    S.panning  = false;
    S.dragging = null;
    e.preventDefault();
  }

  function onDblClick(e) {
    const s = evtScreen(e);
    // Check if double-clicking on a segment → calibrate scale
    const segs = segments();
    for (let i = 0; i < segs.length; i++) {
      const { dist } = projectOnSegScreen(s.x, s.y, segs[i]);
      if (dist < 12) {
        calibrateScale(segs[i]);
        e.preventDefault();
        return;
      }
    }
    // Double-click not on a segment → finish run if drawing
    if (S.mode === 'draw' && S.drawing && S.nodes.length >= 2) {
      finishRun();
    }
    e.preventDefault();
  }

  // ─── Scale calibration ────────────────────────────────────────────────────
  function calibrateScale(seg) {
    const currentMm = segLenMm(seg);
    const raw = prompt(
      'What is the real length of this segment in mm?\n' +
      '(Currently showing ' + currentMm.toLocaleString() + ' mm at this scale)\n\n' +
      'Enter the actual length to recalibrate the entire map:',
      currentMm
    );
    if (raw === null) return;
    const realMm = parseFloat(raw);
    if (!realMm || realMm <= 0) { alert('Invalid length.'); return; }
    const worldPx = distWorld(seg.a, seg.b);
    if (worldPx === 0) { alert('Segment has zero length — drag nodes apart first.'); return; }
    S.scale = Math.round(realMm / (worldPx / GRID));
    const scaleEl = document.getElementById('fm-scale');
    if (scaleEl) scaleEl.value = S.scale;
    render();
    updateSummary();
    showToast('Scale set: 1 grid sq = ' + S.scale.toLocaleString() + ' mm');
  }

  // ─── Touch ────────────────────────────────────────────────────────────────
  let lastTouchDist = null;

  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      return;
    }
    const s  = evtScreen(e);
    const wp = s2w(s.x, s.y);
    const snapped = snapWorld(wp.x, wp.y);

    if (S.mode === 'draw') {
      S.drawing = true;
      placeNode(snapped.x, snapped.y);
    } else if (S.mode === 'gate') {
      tryPlaceGate(s.x, s.y);
    } else if (S.mode === 'move') {
      const idx = hitTestNode(s.x, s.y);
      if (idx !== -1) {
        S.dragging   = idx;
        S.dragOffset = { x: S.nodes[idx].x - wp.x, y: S.nodes[idx].y - wp.y };
      } else {
        S.panning   = true;
        S.panStart  = s;
        S.panOrigin = { x: S.panX, y: S.panY };
      }
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - overlay.getBoundingClientRect().left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - overlay.getBoundingClientRect().top;
        const wx = midX / S.zoom + S.panX;
        const wy = midY / S.zoom + S.panY;
        S.zoom = Math.max(0.1, Math.min(10, S.zoom * dist / lastTouchDist));
        S.panX = wx - midX / S.zoom;
        S.panY = wy - midY / S.zoom;
        render();
      }
      lastTouchDist = dist;
      return;
    }
    lastTouchDist = null;
    const s  = evtScreen(e);
    const wp = s2w(s.x, s.y);

    if (S.panning) {
      S.panX = S.panOrigin.x - (s.x - S.panStart.x) / S.zoom;
      S.panY = S.panOrigin.y - (s.y - S.panStart.y) / S.zoom;
      render();
      return;
    }
    if (S.mode === 'move' && S.dragging !== null) {
      const snapped = snapWorld(wp.x + S.dragOffset.x, wp.y + S.dragOffset.y);
      S.nodes[S.dragging].x = snapped.x;
      S.nodes[S.dragging].y = snapped.y;
      render();
      updateSummary();
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    lastTouchDist = null;
    S.panning  = false;
    S.dragging = null;
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    const body = document.getElementById('fm-body');
    if (!body || !body.classList.contains('open')) return;
    if (e.key === 'Enter' && S.mode === 'draw' && S.drawing && S.nodes.length >= 2) {
      finishRun(); e.preventDefault();
    }
    if (e.key === 'Escape' && S.mode === 'draw') {
      S.drawing = false;
      octx.clearRect(0, 0, W, H);
      e.preventDefault();
    }
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
      doUndo(); e.preventDefault();
    }
  }

  // ─── Node placement ───────────────────────────────────────────────────────
  function nextLabel() {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[labelCounter++ % 26];
  }

  function placeNode(wx, wy) {
    if (S.nodes.length > 0) {
      const last = S.nodes[S.nodes.length - 1];
      if (last.x === wx && last.y === wy) return;
    }
    S.nodes.push({ x: wx, y: wy, label: nextLabel() });
    render();
    updateSummary();
    updateApplyBtn();
  }

  function finishRun() {
    S.drawing = false;
    octx.clearRect(0, 0, W, H);
    render();
    updateSummary();
  }

  // ─── Gate placement ───────────────────────────────────────────────────────
  function tryPlaceGate(sx, sy) {
    const segs = segments();
    if (!segs.length) { showToast('Draw your fence run first.'); return; }
    let bestSeg = -1, bestT = 0, bestDist = Infinity;
    segs.forEach((seg, i) => {
      const { t, dist } = projectOnSegScreen(sx, sy, seg);
      if (dist < bestDist && dist < 20) { bestDist = dist; bestSeg = i; bestT = t; }
    });
    if (bestSeg === -1) { showToast('Click closer to a fence segment.'); return; }
    const seg    = segs[bestSeg];
    const segMm  = segLenMm(seg);
    const raw    = prompt('Gate opening width (mm)?', '900');
    if (raw === null) return;
    const widthMm = parseInt(raw);
    if (!widthMm || widthMm < 100) { alert('Invalid gate width.'); return; }
    if (widthMm >= segMm) { alert('Gate (' + widthMm + 'mm) too wide for segment (' + segMm + 'mm).'); return; }
    S.gates.push({ seg: bestSeg, t: bestT, widthMm });
    render();
    updateSummary();
    updateApplyBtn();
  }

  // ─── Undo / Clear ─────────────────────────────────────────────────────────
  function doUndo() {
    if (S.gates.length > 0 && S.mode === 'gate') {
      S.gates.pop();
    } else if (S.nodes.length > 0) {
      S.nodes.pop();
      labelCounter = Math.max(0, labelCounter - 1);
      S.gates = S.gates.filter(g => g.seg < Math.max(0, S.nodes.length - 1));
    }
    render();
    updateSummary();
    updateApplyBtn();
  }

  function doClear() {
    if (S.applied) {
      if (!confirm('This layout has already been applied to the calculator. Clearing will not remove those values. Continue?')) return;
    }
    if ((S.nodes.length > 0 || S.gates.length > 0) && !confirm('Clear all?')) return;
    S.nodes = []; S.gates = []; S.drawing = false; S.applied = false;
    labelCounter = 0;
    octx.clearRect(0, 0, W, H);
    render();
    updateSummary();
    updateApplyBtn();
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  function updateSummary() {
    const segs   = segments();
    const sumDiv = document.getElementById('fm-summary');
    const totDiv = document.getElementById('fm-totals');
    if (!sumDiv) return;

    if (segs.length === 0) {
      sumDiv.innerHTML = '';
      if (totDiv) totDiv.textContent = '';
      updateApplyBtn();
      return;
    }

    let totalFence = 0, totalGates = 0, cornerCount = 0;
    let rows = '';
    segs.forEach((seg, i) => {
      const mm   = segLenMm(seg);
      const gons = S.gates.filter(g => g.seg === i);
      const gMm  = gons.reduce((s, g) => s + g.widthMm, 0);
      totalFence += mm - gMm;
      totalGates += gMm;
      const gStr = gons.length ? gons.map(g => g.widthMm.toLocaleString() + 'mm').join(', ') : '—';
      let angleStr = '—';
      if (i < segs.length - 1) {
        const deg = angleDeg(seg.a, seg.b, segs[i + 1].b);
        if (deg > 2 && deg < 175) { angleStr = deg + '°'; cornerCount++; }
      }
      rows += `<tr><td>${seg.a.label}–${seg.b.label}</td><td>${mm.toLocaleString()} mm</td><td>${gStr}</td><td>${(mm - gMm).toLocaleString()} mm</td><td>${angleStr}</td></tr>`;
    });

    sumDiv.innerHTML = `
      <div id="fm-summary-title">Run summary</div>
      <table>
        <thead><tr><th>Segment</th><th>Length</th><th>Gates</th><th>Net fence</th><th>Corner</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    if (totDiv) {
      totDiv.innerHTML = `Total fence: <strong>${totalFence.toLocaleString()} mm (${(totalFence/1000).toFixed(2)} m)</strong>
        &nbsp;|&nbsp; Corners: <strong>${cornerCount}</strong>
        &nbsp;|&nbsp; Gates: <strong>${S.gates.length}</strong>
        ${S.gates.length ? '(total opening ' + totalGates.toLocaleString() + ' mm)' : ''}`;
    }
    updateApplyBtn();
  }

  function updateApplyBtn() {
    const btn = document.getElementById('fm-apply-btn');
    if (btn) btn.disabled = S.nodes.length < 2;
  }

  // ─── Apply to calculator ──────────────────────────────────────────────────
  window.applyFenceLayout = function () { applyToCalculator(); };

  function applyToCalculator() {
    if (S.nodes.length < 2) return;
    const segs = segments();
    let totalFence = 0, cornerCount = 0;
    segs.forEach((seg, i) => {
      const mm   = segLenMm(seg);
      const gMm  = S.gates.filter(g => g.seg === i).reduce((s, g) => s + g.widthMm, 0);
      totalFence += mm - gMm;
      if (i < segs.length - 1) {
        const deg = angleDeg(seg.a, seg.b, segs[i + 1].b);
        if (deg > 2 && deg < 175) cornerCount++;
      }
    });

    const totalM = parseFloat((totalFence / 1000).toFixed(2));

    // runLength is in mm in the Generator form
    const lenEl     = document.getElementById('runLength');
    const cornersEl = document.getElementById('corners');

    if (lenEl && lenEl.value && parseInt(lenEl.value) !== totalFence) {
      if (!confirm('Overwrite current run length (' + (parseInt(lenEl.value)/1000).toFixed(2) + 'm) with layout value (' + totalM + 'm)?')) return;
    }
    if (lenEl)     { lenEl.value     = totalFence; }
    if (cornersEl) { cornersEl.value = cornerCount; }

    // Trigger live update
    if (typeof onConfigChange === 'function') onConfigChange();

    // Prepend layout note to job description
    const nlEl = document.getElementById('nl-input');
    if (nlEl) {
      const segSummary = segs.map((seg, i) => {
        const gons = S.gates.filter(g => g.seg === i);
        const gStr = gons.length ? ' (gate' + (gons.length > 1 ? 's' : '') + ': ' + gons.map(g => g.widthMm + 'mm').join(',') + ')' : '';
        return seg.a.label + '–' + seg.b.label + ' ' + (segLenMm(seg)/1000).toFixed(2) + 'm' + gStr;
      }).join(', ');
      const note = '[Layout: ' + segSummary + '; ' + cornerCount + ' corner' + (cornerCount !== 1 ? 's' : '') + ']';
      if (!nlEl.value.startsWith('[Layout:')) {
        nlEl.value = note + (nlEl.value ? '\n' + nlEl.value : '');
      } else {
        nlEl.value = note + nlEl.value.replace(/^\[Layout:[^\]]*\]\n?/, '\n').trimStart();
      }
    }

    S.applied = true;
    showToast('Layout applied — ' + totalM + 'm, ' + cornerCount + ' corner' + (cornerCount !== 1 ? 's' : '') + ', ' + S.gates.length + ' gate' + (S.gates.length !== 1 ? 's' : ''));
  }

  // ─── Site plan export ─────────────────────────────────────────────────────
  window.fmGetSitePlanDataURL = function () {
    if (!canvas || S.nodes.length < 2) return null;
    const margin = 40;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    S.nodes.forEach(n => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    const oc  = document.createElement('canvas');
    oc.width  = Math.max(maxX - minX + margin * 2, 200);
    oc.height = Math.max(maxY - minY + margin * 2, 200);
    const oc2 = oc.getContext('2d');
    oc2.fillStyle = '#fff';
    oc2.fillRect(0, 0, oc.width, oc.height);
    const ox = margin - minX, oy = margin - minY;

    const segs = segments();
    segs.forEach((seg, i) => {
      const gons = S.gates.filter(g => g.seg === i);
      const ivs  = computeIntervals(seg, gons);
      oc2.save();
      oc2.strokeStyle = SEG_COLOUR; oc2.lineWidth = 2;
      ivs.forEach(([t0, t1]) => {
        oc2.beginPath();
        oc2.moveTo(seg.a.x + ox + (seg.b.x - seg.a.x) * t0, seg.a.y + oy + (seg.b.y - seg.a.y) * t0);
        oc2.lineTo(seg.a.x + ox + (seg.b.x - seg.a.x) * t1, seg.a.y + oy + (seg.b.y - seg.a.y) * t1);
        oc2.stroke();
      });
      oc2.restore();
      oc2.save();
      oc2.font = '11px sans-serif'; oc2.fillStyle = SEG_COLOUR; oc2.textAlign = 'center';
      oc2.fillText(segLenMm(seg).toLocaleString() + 'mm',
        (seg.a.x + seg.b.x) / 2 + ox, (seg.a.y + seg.b.y) / 2 + oy - 7);
      oc2.restore();
    });
    S.gates.forEach(g => {
      if (g.seg >= segs.length) return;
      const seg = segs[g.seg];
      const segLenPx = distWorld(seg.a, seg.b);
      const halfPx = (g.widthMm / S.scale) * GRID / 2;
      const halfT  = segLenPx > 0 ? halfPx / segLenPx : 0;
      const ax = seg.a.x + (seg.b.x - seg.a.x) * (g.t - halfT) + ox;
      const ay = seg.a.y + (seg.b.y - seg.a.y) * (g.t - halfT) + oy;
      const bx = seg.a.x + (seg.b.x - seg.a.x) * (g.t + halfT) + ox;
      const by = seg.a.y + (seg.b.y - seg.a.y) * (g.t + halfT) + oy;
      oc2.save(); oc2.strokeStyle = GATE_COLOUR; oc2.lineWidth = 2; oc2.setLineDash([5,4]);
      oc2.beginPath(); oc2.moveTo(ax, ay); oc2.lineTo(bx, by); oc2.stroke(); oc2.restore();
    });
    S.nodes.forEach(n => {
      oc2.save();
      oc2.beginPath(); oc2.arc(n.x + ox, n.y + oy, NODE_R, 0, Math.PI * 2);
      oc2.fillStyle = '#fff'; oc2.fill(); oc2.strokeStyle = NODE_COLOUR; oc2.lineWidth = 2; oc2.stroke(); oc2.restore();
      oc2.save(); oc2.font = 'bold 11px sans-serif'; oc2.fillStyle = NODE_COLOUR; oc2.textAlign = 'center';
      oc2.fillText(n.label, n.x + ox, n.y + oy - 12); oc2.restore();
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
  window.fmGetState   = () => JSON.stringify({ nodes: S.nodes, gates: S.gates, scale: S.scale });
  window.fmLoadState  = (json) => {
    try {
      const d = JSON.parse(json);
      S.nodes = d.nodes || []; S.gates = d.gates || []; S.scale = d.scale || 1000;
      labelCounter = S.nodes.length;
      const el = document.getElementById('fm-scale');
      if (el) el.value = S.scale;
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
