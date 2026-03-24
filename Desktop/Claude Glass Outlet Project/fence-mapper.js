/* ── Fence Layout Mapper (FM) v3 — multi-run, per-run config, gate types, Google Maps ── */
(function () {
  'use strict';

  const GRID        = 50;
  const NODE_R      = 7;
  const GATE_COLOUR = '#f59e0b';
  const GOOGLE_MAPS_API_KEY = 'AIzaSyAndiFD6Rt2rRQF4ibm0DsJ3sEbL5oPSXg';
  const GRID_COLOUR = '#e5e7eb';
  const AXIS_COLOUR = '#d1d5db';
  const RUN_PALETTE = ['#2563eb','#16a34a','#7c3aed','#dc2626','#ea580c','#0891b2','#b45309','#0f766e'];

  const HINT = {
    draw : 'Click to place nodes. Double-click to finish a run. Start clicking again for a new run. Esc cancels current run.',
    gate : 'Click on a fence segment to place a gate.',
    move : 'Drag nodes to reposition. Right-drag or middle-mouse to pan. Scroll to zoom. Click segment label to edit length.',
  };

  // ─── State ────────────────────────────────────────────────────────────────
  const S = {
    runs      : [],      // Run[]
    activeRun : -1,      // index of run being drawn (-1 = none)
    mode      : 'draw',
    scale     : 1000,    // mm per GRID world units
    snap      : true,
    dragging  : null,    // {runIdx, nodeIdx}
    dragOffset: { x:0, y:0 },
    panning   : false,
    panStart  : { x:0, y:0 }, panOrigin: { x:0, y:0 },
    zoom      : 1, panX: 0, panY: 0,
    showPosts : false,
    mapImage  : null,
    mapOpacity: 0.5,
    mapWorldOrigin     : { x:0, y:0 },
    mapPixelsPerWorldUnit: 1,
    labelRects: [],      // [{runIdx, segIdx, labelRect, gearRect}] rebuilt each render
    applied   : false,
  };

  function newRun(label) {
    return {
      nodes   : [],
      gates   : [],   // [{segIdx, t, widthMm, gateType, direction}]
      config  : { height:null, slatSize:null, gap:null, colour:null,
                  postMount:null, leftTerm:null, rightTerm:null, maxPanel:null },
      label   : label,
      finished: false,
      postPositions: [],
    };
  }

  let canvas, overlay, ctx, octx, wrap;
  let W = 0, H = 0;
  let runLabelCounter  = 0;
  let lastPlaceTime    = 0;   // ms — for dblclick node-removal guard

  // ─── Viewport helpers ─────────────────────────────────────────────────────
  function w2s(wx, wy) { return { x:(wx-S.panX)*S.zoom, y:(wy-S.panY)*S.zoom }; }
  function s2w(sx, sy) { return { x:sx/S.zoom+S.panX,   y:sy/S.zoom+S.panY   }; }

  function evtScreen(e) {
    const r = overlay.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX-r.left, y: src.clientY-r.top };
  }
  function snapWorld(wx, wy) {
    if (!S.snap) return { x:wx, y:wy };
    return { x: Math.round(wx/GRID)*GRID, y: Math.round(wy/GRID)*GRID };
  }
  function distWorld(a, b) {
    return Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2);
  }
  function pxToMm(worldPx) { return Math.round((worldPx/GRID)*S.scale); }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    canvas  = document.getElementById('fm-canvas');
    overlay = document.getElementById('fm-overlay');
    wrap    = document.getElementById('fm-canvas-wrap');
    if (!canvas) return;
    ctx  = canvas.getContext('2d');
    octx = overlay.getContext('2d');
    injectPanels();
    resize();
    bindEvents();
    render();
    updateSummary();
  }

  function resize() {
    const rect = wrap.getBoundingClientRect();
    W = Math.max(rect.width || 700, 700);
    H = Math.max(rect.height || 400, 400);
    canvas.width = overlay.width = W;
    canvas.height = overlay.height = H;
    canvas.style.width = overlay.style.width = W+'px';
    canvas.style.height = overlay.style.height = H+'px';
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

  // ─── Inject floating panels ───────────────────────────────────────────────
  function injectPanels() {
    if (document.getElementById('fm-run-config')) return;

    const style = document.createElement('style');
    style.textContent = `
      .fm-panel{position:fixed;z-index:10000;background:#fff;border:1.5px solid #ccd4e0;border-radius:8px;
        box-shadow:0 4px 20px rgba(0,0,0,.18);padding:16px;min-width:260px;max-width:340px;font-size:13px}
      .fm-panel h4{font-size:13px;font-weight:700;color:#1a4480;margin-bottom:10px;
        display:flex;justify-content:space-between;align-items:center}
      .fm-panel label{display:block;font-size:11px;font-weight:600;color:#444;margin:7px 0 2px}
      .fm-panel input,.fm-panel select{width:100%;border:1.5px solid #ccd4e0;border-radius:4px;
        padding:5px 7px;font-size:12px;box-sizing:border-box}
      .fm-panel .btn-row{display:flex;gap:6px;margin-top:12px}
      .fm-panel .btn-row button{flex:1;padding:6px 8px;border-radius:5px;border:none;
        cursor:pointer;font-size:12px;font-weight:600}
      .fm-btn-save{background:#16a34a;color:#fff} .fm-btn-save:hover{background:#15803d}
      .fm-btn-cancel{background:#f3f4f6;color:#444;border:1.5px solid #ccd4e0!important}
      .fm-btn-cancel:hover{background:#e5e7eb}
      .fm-btn-del{background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5!important}
      .fm-btn-del:hover{background:#fecaca}
      .fm-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:9998;
        display:none;align-items:center;justify-content:center}
      .fm-modal-overlay.open{display:flex}
      .fm-modal{background:#fff;border-radius:8px;padding:20px;min-width:300px;max-width:420px;
        box-shadow:0 8px 32px rgba(0,0,0,.22)}
      .fm-modal h4{font-size:14px;font-weight:700;color:#1a4480;margin-bottom:14px}
      .fm-modal label{display:block;font-size:12px;font-weight:600;color:#444;margin:10px 0 3px}
      .fm-modal input,.fm-modal select{width:100%;border:1.5px solid #ccd4e0;border-radius:4px;
        padding:6px 8px;font-size:13px;box-sizing:border-box}
      .fm-radio-group{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
      .fm-radio-opt{display:flex;align-items:center;gap:4px;cursor:pointer;background:#f3f6fc;
        border:1.5px solid #ccd4e0;border-radius:5px;padding:5px 10px;font-size:12px;font-weight:600;
        transition:.1s}
      .fm-radio-opt:hover{background:#e0edff;border-color:#2563a8}
      .fm-radio-opt.selected{background:#2563a8;color:#fff;border-color:#2563a8}
      .fm-modal .btn-row{display:flex;gap:8px;margin-top:16px}
      .fm-modal .btn-row button{flex:1;padding:8px;border-radius:5px;border:none;
        cursor:pointer;font-size:13px;font-weight:600}
      .fm-modal .btn-ok{background:#16a34a;color:#fff} .fm-modal .btn-ok:hover{background:#15803d}
      .fm-modal .btn-cancel2{background:#f3f4f6;color:#444} .fm-modal .btn-cancel2:hover{background:#e5e7eb}
      #fm-inline-input{position:absolute;z-index:1000;border:2px solid #2563a8!important;
        border-radius:4px;padding:2px 6px!important;font-size:12px;font-weight:600;
        color:#1a4480;text-align:center;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);
        width:84px!important}
      .fm-run-swatch{display:inline-block;width:10px;height:10px;border-radius:2px;
        margin-right:4px;vertical-align:middle;flex-shrink:0}
    `;
    document.head.appendChild(style);

    // ── Run config panel ──
    document.body.insertAdjacentHTML('beforeend', `
      <div id="fm-run-config" class="fm-panel" style="display:none;top:100px;left:20px">
        <h4>Configure Run
          <button onclick="closeFmRunConfig()"
            style="background:none;border:none;cursor:pointer;font-size:16px;color:#888;padding:0;line-height:1">×</button>
        </h4>
        <label>Run Label</label>
        <input id="fmrc-label" type="text" placeholder="e.g. Side Fence">
        <label>Height override (mm — blank = inherit from form)</label>
        <input id="fmrc-height" type="number" min="300" max="3000" placeholder="inherit">
        <label>Slat Size</label>
        <select id="fmrc-slatsize">
          <option value="">— inherit —</option>
          <option value="65">65mm</option>
          <option value="90">90mm</option>
        </select>
        <label>Slat Gap</label>
        <select id="fmrc-gap">
          <option value="">— inherit —</option>
          <option value="5">5mm</option>
          <option value="9">9mm</option>
          <option value="20">20mm</option>
        </select>
        <label>Colour</label>
        <select id="fmrc-colour">
          <option value="">— inherit —</option>
          <option value="B">Black Satin</option>
          <option value="MN">Monument</option>
          <option value="G">Woodland Grey</option>
          <option value="SM">Surfmist</option>
          <option value="W">Pearl White</option>
          <option value="BS">Basalt</option>
          <option value="D">Dune</option>
          <option value="M">Mill</option>
          <option value="S">Palladium Silver</option>
        </select>
        <label>Post Mounting</label>
        <select id="fmrc-postmount">
          <option value="">— inherit —</option>
          <option value="concreted">Concreted in ground</option>
          <option value="baseplate">Base-plated to slab</option>
          <option value="coredrilled">Core-drilled</option>
        </select>
        <label>Left Termination</label>
        <select id="fmrc-leftterm">
          <option value="">— inherit —</option>
          <option value="post">Post</option>
          <option value="wall">Wall (F-section)</option>
        </select>
        <label>Right Termination</label>
        <select id="fmrc-rightterm">
          <option value="">— inherit —</option>
          <option value="post">Post</option>
          <option value="wall">Wall (F-section)</option>
        </select>
        <label>Max Panel Width</label>
        <select id="fmrc-maxpanel">
          <option value="">— inherit —</option>
          <option value="2600">2600mm (standard)</option>
          <option value="2000">2000mm (windy area)</option>
        </select>
        <div class="btn-row">
          <button class="fm-btn-save" onclick="saveFmRunConfig()">Save</button>
          <button class="fm-btn-cancel" onclick="closeFmRunConfig()">Cancel</button>
          <button class="fm-btn-del" onclick="deleteFmRun()">Delete Run</button>
        </div>
      </div>
    `);

    // ── Gate placement modal ──
    document.body.insertAdjacentHTML('beforeend', `
      <div id="fm-gate-modal-overlay" class="fm-modal-overlay">
        <div class="fm-modal">
          <h4>Place Gate</h4>
          <label>Gate Type</label>
          <div class="fm-radio-group" id="fmg-type-group">
            <div class="fm-radio-opt selected" data-val="single" onclick="fmgSelect(this,'type')">Single Swing</div>
            <div class="fm-radio-opt" data-val="double" onclick="fmgSelect(this,'type')">Double Swing</div>
            <div class="fm-radio-opt" data-val="sliding" onclick="fmgSelect(this,'type')">Sliding</div>
          </div>
          <label>Opening Width (mm)</label>
          <input id="fmg-width" type="number" value="900" min="400" max="8000" step="50">
          <label>Opening Direction (viewed from outside)</label>
          <div class="fm-radio-group" id="fmg-dir-group">
            <div class="fm-radio-opt selected" data-val="left" onclick="fmgSelect(this,'dir')">← Open Left</div>
            <div class="fm-radio-opt" data-val="right" onclick="fmgSelect(this,'dir')">Open Right →</div>
          </div>
          <div class="btn-row">
            <button class="btn-ok" onclick="confirmFmGate()"
              style="flex:1;padding:8px;border-radius:5px;border:none;cursor:pointer;font-size:13px;font-weight:600;background:#16a34a;color:#fff">
              Add Gate</button>
            <button class="btn-cancel2" onclick="cancelFmGate()"
              style="flex:1;padding:8px;border-radius:5px;border:none;cursor:pointer;font-size:13px;font-weight:600;background:#f3f4f6;color:#444">
              Cancel</button>
          </div>
        </div>
      </div>
    `);

    // ── Inline length input ──
    const inp = document.createElement('input');
    inp.id = 'fm-inline-input';
    inp.type = 'number';
    inp.min = '100';
    inp.max = '99999';
    inp.style.cssText = 'display:none;position:absolute;z-index:1000;width:84px';
    wrap.appendChild(inp);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); }
    });
    inp.addEventListener('blur', () => setTimeout(() => { if (_inlineEdit) commitInlineEdit(); }, 120));
  }

  // ─── Run config panel (exposed to global onclick) ─────────────────────────
  let _editingRunIdx = -1;

  window.closeFmRunConfig = function () {
    document.getElementById('fm-run-config').style.display = 'none';
    _editingRunIdx = -1;
  };

  window.saveFmRunConfig = function () {
    if (_editingRunIdx < 0 || _editingRunIdx >= S.runs.length) return;
    const run = S.runs[_editingRunIdx];
    const label = document.getElementById('fmrc-label').value.trim();
    if (label) run.label = label;
    const h  = document.getElementById('fmrc-height').value;   run.config.height    = h  ? parseInt(h)  : null;
    const ss = document.getElementById('fmrc-slatsize').value; run.config.slatSize  = ss ? parseInt(ss) : null;
    const g  = document.getElementById('fmrc-gap').value;      run.config.gap       = g  ? parseInt(g)  : null;
    const c  = document.getElementById('fmrc-colour').value;   run.config.colour    = c  || null;
    const pm = document.getElementById('fmrc-postmount').value; run.config.postMount = pm || null;
    const lt = document.getElementById('fmrc-leftterm').value;  run.config.leftTerm  = lt || null;
    const rt = document.getElementById('fmrc-rightterm').value; run.config.rightTerm = rt || null;
    const mp = document.getElementById('fmrc-maxpanel').value; run.config.maxPanel  = mp ? parseInt(mp) : null;
    window.closeFmRunConfig();
    render(); updateSummary();
    showToast('Run "' + run.label + '" config saved');
  };

  window.deleteFmRun = function () {
    if (_editingRunIdx < 0) return;
    if (!confirm('Delete "' + S.runs[_editingRunIdx].label + '"?')) return;
    S.runs.splice(_editingRunIdx, 1);
    if (S.activeRun === _editingRunIdx)      S.activeRun = -1;
    else if (S.activeRun > _editingRunIdx)   S.activeRun--;
    window.closeFmRunConfig();
    render(); updateSummary(); updateApplyBtn();
  };

  function openRunConfig(runIdx, clientX, clientY) {
    _editingRunIdx = runIdx;
    const run = S.runs[runIdx];
    document.getElementById('fmrc-label').value    = run.label;
    document.getElementById('fmrc-height').value   = run.config.height    || '';
    document.getElementById('fmrc-slatsize').value = run.config.slatSize  || '';
    document.getElementById('fmrc-gap').value      = run.config.gap       || '';
    document.getElementById('fmrc-colour').value   = run.config.colour    || '';
    document.getElementById('fmrc-postmount').value= run.config.postMount || '';
    document.getElementById('fmrc-leftterm').value = run.config.leftTerm  || '';
    document.getElementById('fmrc-rightterm').value= run.config.rightTerm || '';
    document.getElementById('fmrc-maxpanel').value = run.config.maxPanel  || '';
    const panel = document.getElementById('fm-run-config');
    panel.style.display = 'block';
    const pw = 340, ph = 560;
    let left = clientX + 12, top = clientY - 20;
    if (left + pw > window.innerWidth  - 10) left = clientX - pw - 12;
    if (top  + ph > window.innerHeight - 10) top  = window.innerHeight - ph - 20;
    panel.style.left = Math.max(10, left) + 'px';
    panel.style.top  = Math.max(10, top)  + 'px';
    panel.style.right = 'auto';
  }

  // ─── Gate modal helpers ───────────────────────────────────────────────────
  let _pendingGate = null;

  window.fmgSelect = function (el, group) {
    const groupId = group === 'type' ? 'fmg-type-group' : 'fmg-dir-group';
    document.getElementById(groupId).querySelectorAll('.fm-radio-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
  };

  function openGateModal(runIdx, segIdx, t) {
    _pendingGate = { runIdx, segIdx, t };
    document.getElementById('fmg-width').value = 900;
    // Reset radio selections
    document.getElementById('fmg-type-group').querySelectorAll('.fm-radio-opt').forEach((el,i) => el.classList.toggle('selected', i===0));
    document.getElementById('fmg-dir-group').querySelectorAll('.fm-radio-opt').forEach((el,i) => el.classList.toggle('selected', i===0));
    document.getElementById('fm-gate-modal-overlay').classList.add('open');
  }

  window.confirmFmGate = function () {
    if (!_pendingGate) return;
    const { runIdx, segIdx, t } = _pendingGate;
    const gateType  = document.querySelector('#fmg-type-group .fm-radio-opt.selected')?.dataset.val || 'single';
    const direction = document.querySelector('#fmg-dir-group .fm-radio-opt.selected')?.dataset.val  || 'left';
    const widthMm   = parseInt(document.getElementById('fmg-width').value) || 900;
    const run = S.runs[runIdx];
    const seg = getSegment(run, segIdx);
    if (seg) {
      const segMm = pxToMm(distWorld(seg.a, seg.b));
      if (widthMm >= segMm) { alert(`Gate (${widthMm}mm) too wide for segment (${segMm}mm).`); return; }
    }
    run.gates.push({ segIdx, t, widthMm, gateType, direction });
    document.getElementById('fm-gate-modal-overlay').classList.remove('open');
    _pendingGate = null;
    render(); updateSummary(); updateApplyBtn();
    showToast(`${gateType === 'sliding' ? 'Sliding' : gateType === 'double' ? 'Double swing' : 'Single swing'} gate (${widthMm}mm) added`);
  };

  window.cancelFmGate = function () {
    document.getElementById('fm-gate-modal-overlay').classList.remove('open');
    _pendingGate = null;
  };

  // ─── Inline segment label editing ────────────────────────────────────────
  let _inlineEdit = null;

  function openInlineEdit(runIdx, segIdx, labelRect) {
    _inlineEdit = { runIdx, segIdx };
    const run = S.runs[runIdx];
    const seg = getSegment(run, segIdx);
    if (!seg) { _inlineEdit = null; return; }
    const mm = pxToMm(distWorld(seg.a, seg.b));
    const inp = document.getElementById('fm-inline-input');
    inp.value = mm;
    inp.style.left = Math.round(labelRect.x + labelRect.w/2 - 42) + 'px';
    inp.style.top  = Math.round(labelRect.y - 20) + 'px';
    inp.style.display = 'block';
    requestAnimationFrame(() => { inp.select(); inp.focus(); });
  }

  function commitInlineEdit() {
    if (!_inlineEdit) return;
    const inp = document.getElementById('fm-inline-input');
    inp.style.display = 'none';
    const newMm = parseFloat(inp.value);
    const { runIdx, segIdx } = _inlineEdit;
    _inlineEdit = null;
    if (!newMm || newMm < 10) return;
    const run = S.runs[runIdx];
    const seg = getSegment(run, segIdx);
    if (!seg) return;
    const curW  = distWorld(seg.a, seg.b);
    if (curW === 0) return;
    const newW  = (newMm / S.scale) * GRID;
    const delta = newW - curW;
    const ux = (seg.b.x - seg.a.x) / curW;
    const uy = (seg.b.y - seg.a.y) / curW;
    for (let i = segIdx + 1; i < run.nodes.length; i++) {
      run.nodes[i].x += ux * delta;
      run.nodes[i].y += uy * delta;
    }
    render(); updateSummary();
    showToast(`Segment set to ${newMm.toLocaleString()}mm`);
  }

  function cancelInlineEdit() {
    _inlineEdit = null;
    const inp = document.getElementById('fm-inline-input');
    if (inp) inp.style.display = 'none';
  }

  // ─── Geometry helpers ─────────────────────────────────────────────────────
  function getSegment(run, segIdx) {
    if (segIdx < 0 || segIdx >= run.nodes.length - 1) return null;
    return { a: run.nodes[segIdx], b: run.nodes[segIdx+1], idx: segIdx };
  }

  function getRunSegments(run) {
    const out = [];
    for (let i = 0; i < run.nodes.length - 1; i++)
      out.push({ a: run.nodes[i], b: run.nodes[i+1], idx: i });
    return out;
  }

  function segLenMm(seg) { return pxToMm(distWorld(seg.a, seg.b)); }

  function angleDeg(prev, cur, next) {
    const ax=cur.x-prev.x, ay=cur.y-prev.y, bx=next.x-cur.x, by=next.y-cur.y;
    return Math.round(Math.atan2(Math.abs(ax*by-ay*bx), ax*bx+ay*by)*180/Math.PI);
  }

  function projectOnSegScreen(sx, sy, seg) {
    const sa=w2s(seg.a.x,seg.a.y), sb=w2s(seg.b.x,seg.b.y);
    const dx=sb.x-sa.x, dy=sb.y-sa.y, lenSq=dx*dx+dy*dy;
    if (lenSq===0) return { t:0, dist:Math.hypot(sx-sa.x,sy-sa.y) };
    const t=Math.max(0,Math.min(1,((sx-sa.x)*dx+(sy-sa.y)*dy)/lenSq));
    return { t, dist:Math.hypot(sx-(sa.x+t*dx), sy-(sa.y+t*dy)) };
  }

  function hitTestNode(sx, sy) {
    for (let ri=S.runs.length-1; ri>=0; ri--) {
      const run=S.runs[ri];
      for (let ni=run.nodes.length-1; ni>=0; ni--) {
        const s=w2s(run.nodes[ni].x,run.nodes[ni].y);
        if (Math.hypot(sx-s.x,sy-s.y) <= NODE_R+5) return { runIdx:ri, nodeIdx:ni };
      }
    }
    return null;
  }

  function hitTestLabelRects(sx, sy) {
    for (const lr of S.labelRects) {
      const l=lr.labelRect, g=lr.gearRect;
      if (sx>=l.x&&sx<=l.x+l.w&&sy>=l.y&&sy<=l.y+l.h)
        return { type:'label', runIdx:lr.runIdx, segIdx:lr.segIdx, rect:l };
      if (sx>=g.x&&sx<=g.x+g.w&&sy>=g.y&&sy<=g.y+g.h)
        return { type:'gear',  runIdx:lr.runIdx, segIdx:lr.segIdx, rect:g };
    }
    return null;
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function render() {
    if (!ctx) return;
    S.labelRects = [];
    ctx.clearRect(0,0,W,H);
    drawMapUnderlay();
    drawGrid();
    S.runs.forEach((run, ri) => {
      const col = RUN_PALETTE[ri % RUN_PALETTE.length];
      drawRunSegments(run, ri, col);
      drawSegmentLabels(run, ri, col);
      drawGates(run, ri);
      if (S.showPosts) drawPostPositions(run, ri);
      drawRunNodes(run, ri, col);
    });
    drawActiveRunHighlight();
  }

  function renderOverlay(sx, sy) {
    if (!octx) return;
    octx.clearRect(0,0,W,H);
    if (S.mode!=='draw' || S.activeRun<0) return;
    const run = S.runs[S.activeRun];
    if (!run || !run.nodes.length || sx==null) return;
    const col  = RUN_PALETTE[S.activeRun % RUN_PALETTE.length];
    const last = w2s(run.nodes[run.nodes.length-1].x, run.nodes[run.nodes.length-1].y);
    octx.save();
    octx.strokeStyle=col; octx.lineWidth=2; octx.setLineDash([6,4]); octx.globalAlpha=.5;
    octx.beginPath(); octx.moveTo(last.x,last.y); octx.lineTo(sx,sy); octx.stroke();
    octx.restore();
    const wEnd  = s2w(sx,sy);
    const wLast = run.nodes[run.nodes.length-1];
    const mm = pxToMm(distWorld(wLast,wEnd));
    if (mm > 0) {
      octx.save(); octx.font='11px sans-serif'; octx.fillStyle='#64748b';
      octx.fillText(mm.toLocaleString()+' mm', (last.x+sx)/2+6, (last.y+sy)/2-4);
      octx.restore();
    }
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle=GRID_COLOUR; ctx.lineWidth=.5;
    const wl=s2w(0,0).x, wr=s2w(W,0).x, wt=s2w(0,0).y, wb=s2w(0,H).y;
    for (let wx=Math.floor(wl/GRID)*GRID; wx<=wr; wx+=GRID) {
      const p=w2s(wx,0); ctx.beginPath(); ctx.moveTo(p.x,0); ctx.lineTo(p.x,H); ctx.stroke();
    }
    for (let wy=Math.floor(wt/GRID)*GRID; wy<=wb; wy+=GRID) {
      const p=w2s(0,wy); ctx.beginPath(); ctx.moveTo(0,p.y); ctx.lineTo(W,p.y); ctx.stroke();
    }
    ctx.strokeStyle=AXIS_COLOUR; ctx.lineWidth=1;
    const ax=w2s(0,0);
    ctx.beginPath(); ctx.moveTo(ax.x,0);   ctx.lineTo(ax.x,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,ax.y);   ctx.lineTo(W,ax.y); ctx.stroke();
    ctx.font='10px sans-serif'; ctx.fillStyle='#9ca3af';
    const runCount = S.runs.filter(r=>r.nodes.length>=2).length;
    ctx.fillText(`1 sq = ${S.scale.toLocaleString()} mm  |  zoom ${S.zoom.toFixed(2)}×  |  ${runCount} run${runCount!==1?'s':''}`, 8, H-8);
    ctx.restore();
  }

  function drawRunSegments(run, ri, col) {
    const segs = getRunSegments(run);
    const isActive = ri === S.activeRun;
    segs.forEach((seg, si) => {
      const gatesOnSeg = run.gates.filter(g=>g.segIdx===si);
      const intervals  = computeIntervals(seg, gatesOnSeg);
      const sa=w2s(seg.a.x,seg.a.y), sb=w2s(seg.b.x,seg.b.y);
      ctx.save();
      ctx.strokeStyle=col; ctx.lineWidth=isActive?3:2.5;
      intervals.forEach(([t0,t1]) => {
        ctx.beginPath();
        ctx.moveTo(sa.x+(sb.x-sa.x)*t0, sa.y+(sb.y-sa.y)*t0);
        ctx.lineTo(sa.x+(sb.x-sa.x)*t1, sa.y+(sb.y-sa.y)*t1);
        ctx.stroke();
      });
      ctx.restore();
      // Corner angle at end node
      if (si < segs.length-1) {
        const deg = angleDeg(seg.a, seg.b, segs[si+1].b);
        if (deg>2 && deg<175) {
          const sp=w2s(seg.b.x,seg.b.y);
          ctx.save(); ctx.font='10px sans-serif'; ctx.fillStyle='#7c3aed'; ctx.textAlign='center';
          ctx.fillText(deg+'°', sp.x+14, sp.y-12); ctx.restore();
        }
      }
    });
  }

  function drawSegmentLabels(run, ri, col) {
    const segs = getRunSegments(run);
    segs.forEach((seg, si) => {
      const sa=w2s(seg.a.x,seg.a.y), sb=w2s(seg.b.x,seg.b.y);
      const mx=(sa.x+sb.x)/2, my=(sa.y+sb.y)/2;
      const mm = segLenMm(seg);
      const text = mm.toLocaleString()+' mm';
      ctx.save(); ctx.font='11px sans-serif';
      const tw = ctx.measureText(text).width;
      const pw=tw+14, ph=17;
      const px=mx-pw/2, py=my-ph-5;
      // Pill bg
      ctx.fillStyle=col; ctx.globalAlpha=.13;
      roundRect(ctx, px, py, pw, ph, 4); ctx.fill();
      ctx.globalAlpha=1;
      // Text
      ctx.fillStyle=col; ctx.textAlign='center';
      ctx.fillText(text, mx, py+12);
      ctx.restore();
      // Gear icon
      const gx=px+pw+3, gy=py, gw=18, gh=17;
      ctx.save(); ctx.font='13px sans-serif'; ctx.fillStyle='#666'; ctx.globalAlpha=.75;
      ctx.fillText('⚙', gx+2, gy+13); ctx.restore();
      S.labelRects.push({ runIdx:ri, segIdx:si,
        labelRect:{ x:px, y:py, w:pw, h:ph },
        gearRect :{ x:gx, y:gy, w:gw, h:gh }
      });
    });
    // Run name at first node
    if (run.nodes.length>0) {
      const fn=w2s(run.nodes[0].x,run.nodes[0].y);
      const hasOverride = Object.values(run.config).some(v=>v!=null);
      const suffix = run.config.height ? ` (${run.config.height}mm)` : hasOverride ? ' ✦' : '';
      ctx.save(); ctx.font='bold 11px sans-serif'; ctx.fillStyle=col; ctx.textAlign='left';
      ctx.fillText(run.label+suffix, fn.x+10, fn.y-10); ctx.restore();
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y);
    c.closePath();
  }

  function computeIntervals(seg, gates) {
    if (!gates.length) return [[0,1]];
    const lenPx = distWorld(seg.a,seg.b);
    const cuts = gates.map(g => {
      const half = lenPx>0 ? (g.widthMm/S.scale)*GRID/2/lenPx : 0;
      return [Math.max(0,g.t-half), Math.min(1,g.t+half)];
    }).sort((a,b)=>a[0]-b[0]);
    const out=[]; let pos=0;
    cuts.forEach(([s,e])=>{ if(s>pos) out.push([pos,s]); pos=e; });
    if(pos<1) out.push([pos,1]);
    return out;
  }

  function drawGates(run, ri) {
    run.gates.forEach(g => {
      const seg = getSegment(run, g.segIdx);
      if (!seg) return;
      const sa=w2s(seg.a.x,seg.a.y), sb=w2s(seg.b.x,seg.b.y);
      const lenPx = distWorld(seg.a,seg.b);
      const half  = lenPx>0 ? (g.widthMm/S.scale)*GRID/2/lenPx : 0;
      const ax=sa.x+(sb.x-sa.x)*(g.t-half), ay=sa.y+(sb.y-sa.y)*(g.t-half);
      const bx=sa.x+(sb.x-sa.x)*(g.t+half), by=sa.y+(sb.y-sa.y)*(g.t+half);
      const mx=(ax+bx)/2, my=(ay+by)/2;
      const segAngle  = Math.atan2(sb.y-sa.y, sb.x-sa.x);
      const perpAngle = segAngle + (g.direction==='left' ? -Math.PI/2 : Math.PI/2);
      const arcR      = Math.hypot(bx-ax,by-ay)/2;

      // Dashed gap
      ctx.save(); ctx.strokeStyle=GATE_COLOUR; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.restore();

      if (g.gateType==='sliding') {
        // Double-headed arrow
        drawArrow(ctx,ax,ay,bx,by,GATE_COLOUR);
        drawArrow(ctx,bx,by,ax,ay,GATE_COLOUR);
        // Slide direction line
        const ex=mx+Math.cos(perpAngle)*arcR*0.7, ey=my+Math.sin(perpAngle)*arcR*0.7;
        ctx.save(); ctx.strokeStyle=GATE_COLOUR; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(ex,ey); ctx.stroke(); ctx.restore();
        drawArrow(ctx,mx,my,ex,ey,GATE_COLOUR);
        ctx.save(); ctx.font='bold 9px sans-serif'; ctx.fillStyle=GATE_COLOUR; ctx.textAlign='center';
        ctx.fillText('SLIDE', mx+Math.cos(perpAngle)*18, my+Math.sin(perpAngle)*18+4); ctx.restore();
      } else {
        // Swing arc
        ctx.save(); ctx.strokeStyle=GATE_COLOUR; ctx.lineWidth=1.5; ctx.setLineDash([]);
        if (g.gateType==='double') {
          const ang = Math.atan2(by-ay,bx-ax);
          ctx.beginPath(); ctx.arc(ax,ay,arcR, ang-Math.PI/3, ang+Math.PI/3); ctx.stroke();
          ctx.beginPath(); ctx.arc(bx,by,arcR, ang+Math.PI*2/3, ang+Math.PI*4/3); ctx.stroke();
        } else {
          const hx = g.direction==='left' ? ax : bx;
          const hy = g.direction==='left' ? ay : by;
          const sa2 = Math.atan2(my-hy, mx-hx);
          ctx.beginPath(); ctx.arc(hx,hy,arcR, sa2-Math.PI/3, sa2+Math.PI/3); ctx.stroke();
        }
        ctx.restore();
        const lbl = g.gateType==='double' ? 'DBL' : 'GATE';
        ctx.save(); ctx.font='bold 9px sans-serif'; ctx.fillStyle=GATE_COLOUR; ctx.textAlign='center';
        ctx.fillText(lbl, mx+Math.cos(perpAngle)*15, my+Math.sin(perpAngle)*15+4); ctx.restore();
      }

      // Width indicator arrows
      drawArrow(ctx,mx,my,ax,ay,GATE_COLOUR);
      drawArrow(ctx,mx,my,bx,by,GATE_COLOUR);

      // Distance annotations: distA | ←width→ | distB
      const distAMm = Math.max(0, pxToMm(lenPx*g.t) - g.widthMm/2);
      const distBMm = Math.max(0, pxToMm(lenPx*(1-g.t)) - g.widthMm/2);
      ctx.save(); ctx.font='9px sans-serif'; ctx.fillStyle=GATE_COLOUR; ctx.textAlign='center';
      ctx.fillText(`${distAMm}mm | ←${g.widthMm}mm→ | ${distBMm}mm`, mx, my+22); ctx.restore();
    });
  }

  function drawArrow(c, x1, y1, x2, y2, colour) {
    const angle=Math.atan2(y2-y1,x2-x1), sz=7;
    c.save(); c.fillStyle=colour;
    c.beginPath(); c.moveTo(x2,y2);
    c.lineTo(x2-sz*Math.cos(angle-.4), y2-sz*Math.sin(angle-.4));
    c.lineTo(x2-sz*Math.cos(angle+.4), y2-sz*Math.sin(angle+.4));
    c.closePath(); c.fill(); c.restore();
  }

  function drawPostPositions(run, ri) {
    run.postPositions.forEach(p => {
      const s=w2s(p.wx,p.wy);
      ctx.save();
      ctx.fillStyle   = p.type==='gate' ? '#dc2626' : '#f59e0b';
      ctx.strokeStyle = '#fff'; ctx.lineWidth=1.5;
      ctx.fillRect(s.x-5,s.y-5,10,10);
      ctx.strokeRect(s.x-5,s.y-5,10,10);
      ctx.restore();
    });
  }

  function drawRunNodes(run, ri, col) {
    run.nodes.forEach((n,ni) => {
      const s=w2s(n.x,n.y);
      const isEnd = ni===0 || ni===run.nodes.length-1;
      ctx.save();
      if (isEnd) { ctx.beginPath(); ctx.rect(s.x-NODE_R,s.y-NODE_R,NODE_R*2,NODE_R*2); }
      else        { ctx.beginPath(); ctx.arc(s.x,s.y,NODE_R,0,Math.PI*2); }
      ctx.fillStyle='#fff'; ctx.fill();
      ctx.strokeStyle=col; ctx.lineWidth=2; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.font='bold 10px sans-serif'; ctx.fillStyle=col; ctx.textAlign='center';
      ctx.fillText(n.label, s.x, s.y-11); ctx.restore();
    });
  }

  function drawActiveRunHighlight() {
    if (S.activeRun<0 || S.activeRun>=S.runs.length) return;
    const run = S.runs[S.activeRun];
    if (!run.nodes.length) return;
    const last = run.nodes[run.nodes.length-1];
    const s = w2s(last.x,last.y);
    ctx.save(); ctx.beginPath(); ctx.arc(s.x,s.y,NODE_R+5,0,Math.PI*2);
    ctx.strokeStyle=RUN_PALETTE[S.activeRun%RUN_PALETTE.length];
    ctx.lineWidth=2; ctx.setLineDash([3,3]); ctx.globalAlpha=.7;
    ctx.stroke(); ctx.restore();
  }

  function drawMapUnderlay() {
    if (!S.mapImage) return;
    const { x,y } = w2s(S.mapWorldOrigin.x, S.mapWorldOrigin.y);
    const iw = S.mapImage.width  * S.zoom * S.mapPixelsPerWorldUnit;
    const ih = S.mapImage.height * S.zoom * S.mapPixelsPerWorldUnit;
    ctx.save(); ctx.globalAlpha=S.mapOpacity;
    ctx.drawImage(S.mapImage, x-iw/2, y-ih/2, iw, ih);
    ctx.restore();
  }

  // ─── Events ───────────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('fm-mode-draw').addEventListener('click', ()=>setMode('draw'));
    document.getElementById('fm-mode-gate').addEventListener('click', ()=>setMode('gate'));
    document.getElementById('fm-mode-move').addEventListener('click', ()=>setMode('move'));
    document.getElementById('fm-undo').addEventListener('click', doUndo);
    document.getElementById('fm-clear').addEventListener('click', doClear);
    const rb = document.getElementById('fm-reset-view');
    if (rb) rb.addEventListener('click', ()=>{ S.zoom=1; S.panX=0; S.panY=0; render(); });
    document.getElementById('fm-scale').addEventListener('change', function(){
      const v=parseInt(this.value); if(v>0){S.scale=v; render(); updateSummary();}
    });
    document.getElementById('fm-snap-cb').addEventListener('change', function(){ S.snap=this.checked; });
    const mapBtn = document.getElementById('fm-load-map');
    if (mapBtn) mapBtn.addEventListener('click', loadGoogleMap);
    const opSlider = document.getElementById('fm-map-opacity');
    if (opSlider) opSlider.addEventListener('input', function(){ S.mapOpacity=parseFloat(this.value); render(); });
    overlay.addEventListener('mousedown',   onMouseDown);
    overlay.addEventListener('mousemove',   onMouseMove);
    overlay.addEventListener('mouseup',     onMouseUp);
    overlay.addEventListener('click',       onCanvasClick);
    overlay.addEventListener('dblclick',    onDblClick);
    overlay.addEventListener('wheel',       onWheel, { passive:false });
    overlay.addEventListener('contextmenu', e=>e.preventDefault());
    overlay.addEventListener('touchstart',  onTouchStart, { passive:false });
    overlay.addEventListener('touchmove',   onTouchMove,  { passive:false });
    overlay.addEventListener('touchend',    onTouchEnd,   { passive:false });
    document.addEventListener('keydown',    onKeyDown);
    document.getElementById('fm-apply-btn').addEventListener('click', applyToCalculator);
    window.addEventListener('resize', ()=>resize());
  }

  function setMode(m) {
    S.mode=m;
    if (m!=='draw') { octx&&octx.clearRect(0,0,W,H); }
    document.getElementById('fm-canvas-wrap').className='mode-'+m;
    ['draw','gate','move'].forEach(id=>{
      const btn=document.getElementById('fm-mode-'+id);
      if(btn) btn.classList.toggle('active', id===m);
    });
    const hint=document.getElementById('fm-hint');
    if(hint) hint.textContent=HINT[m]||'';
  }

  function onWheel(e) {
    e.preventDefault();
    const s=evtScreen(e);
    const wx=s.x/S.zoom+S.panX, wy=s.y/S.zoom+S.panY;
    S.zoom=Math.max(.1,Math.min(10,S.zoom*(e.deltaY<0?1.15:1/1.15)));
    S.panX=wx-s.x/S.zoom; S.panY=wy-s.y/S.zoom;
    render();
  }

  // Track if we should suppress a click (fired right after mousedown-handled node placement)
  let _suppressClick = false;

  function onMouseDown(e) {
    _suppressClick = false;
    const s=evtScreen(e), wp=s2w(s.x,s.y);
    if (e.button===1||e.button===2) {
      S.panning=true; S.panStart=s; S.panOrigin={x:S.panX,y:S.panY};
      e.preventDefault(); return;
    }
    if (S.mode==='draw') {
      // Let dblclick handle the label rect checks; in draw mode place node only if not hitting a label
      const hit=hitTestLabelRects(s.x,s.y);
      if (!hit) {
        const snapped=snapWorld(wp.x,wp.y);
        placeNode(snapped.x,snapped.y);
        _suppressClick=true;
      }
    } else if (S.mode==='gate') {
      tryPlaceGate(s.x,s.y);
      _suppressClick=true;
    } else if (S.mode==='move') {
      const hn=hitTestNode(s.x,s.y);
      if (hn) {
        const node=S.runs[hn.runIdx].nodes[hn.nodeIdx];
        S.dragging=hn; S.dragOffset={x:node.x-wp.x,y:node.y-wp.y};
        _suppressClick=true;
      } else {
        S.panning=true; S.panStart=s; S.panOrigin={x:S.panX,y:S.panY};
        _suppressClick=true;
      }
    }
    e.preventDefault();
  }

  function onCanvasClick(e) {
    if (_suppressClick) { _suppressClick=false; return; }
    const s=evtScreen(e);
    const hit=hitTestLabelRects(s.x,s.y);
    if (hit) {
      if (hit.type==='label') openInlineEdit(hit.runIdx, hit.segIdx, hit.rect);
      else if (hit.type==='gear') openRunConfig(hit.runIdx, e.clientX, e.clientY);
    }
  }

  function onMouseMove(e) {
    const s=evtScreen(e), wp=s2w(s.x,s.y);
    if (S.panning) {
      S.panX=S.panOrigin.x-(s.x-S.panStart.x)/S.zoom;
      S.panY=S.panOrigin.y-(s.y-S.panStart.y)/S.zoom;
      render(); return;
    }
    if (S.mode==='move' && S.dragging) {
      const snapped=snapWorld(wp.x+S.dragOffset.x,wp.y+S.dragOffset.y);
      S.runs[S.dragging.runIdx].nodes[S.dragging.nodeIdx].x=snapped.x;
      S.runs[S.dragging.runIdx].nodes[S.dragging.nodeIdx].y=snapped.y;
      render(); updateSummary(); return;
    }
    if (S.mode==='draw' && S.activeRun>=0) {
      const snapped=snapWorld(wp.x,wp.y), ss=w2s(snapped.x,snapped.y);
      renderOverlay(ss.x,ss.y);
    }
    e.preventDefault();
  }

  function onMouseUp(e) { S.panning=false; S.dragging=null; }

  function onDblClick(e) {
    e.preventDefault();
    const s=evtScreen(e);
    // Finish active drawing run
    if (S.mode==='draw' && S.activeRun>=0) {
      const run=S.runs[S.activeRun];
      // Remove node placed by the 2nd click of this dblclick (within last 400ms)
      if (run.nodes.length>0 && Date.now()-lastPlaceTime<400) {
        run.nodes.pop();
      }
      if (run.nodes.length>=2) {
        finishActiveRun();
      } else {
        S.runs.splice(S.activeRun,1); S.activeRun=-1;
        octx.clearRect(0,0,W,H); render(); updateSummary(); updateApplyBtn();
        showToast('Run cancelled (need at least 2 nodes)');
      }
      return;
    }
    // Double-click on segment → calibrate scale
    for (const run of S.runs) {
      const segs=getRunSegments(run);
      for (const seg of segs) {
        if (projectOnSegScreen(s.x,s.y,seg).dist<12) { calibrateScale(seg); return; }
      }
    }
  }

  function calibrateScale(seg) {
    const cur=segLenMm(seg);
    const raw=prompt(`Real length of this segment in mm?\n(Showing ${cur.toLocaleString()}mm)\nEnter to recalibrate all measurements:`, cur);
    if (!raw) return;
    const mm=parseFloat(raw);
    if (!mm||mm<=0) { alert('Invalid.'); return; }
    const wp=distWorld(seg.a,seg.b);
    if (!wp) { alert('Zero-length segment.'); return; }
    S.scale=Math.round(mm/(wp/GRID));
    const el=document.getElementById('fm-scale');
    if(el) el.value=S.scale;
    render(); updateSummary();
    showToast(`Scale: 1 sq = ${S.scale.toLocaleString()}mm`);
  }

  // ─── Touch ────────────────────────────────────────────────────────────────
  let lastTouchDist=null;
  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length===2) {
      lastTouchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      return;
    }
    const s=evtScreen(e), wp=s2w(s.x,s.y), sn=snapWorld(wp.x,wp.y);
    if (S.mode==='draw') placeNode(sn.x,sn.y);
    else if (S.mode==='gate') tryPlaceGate(s.x,s.y);
    else if (S.mode==='move') {
      const hn=hitTestNode(s.x,s.y);
      if (hn) { const n=S.runs[hn.runIdx].nodes[hn.nodeIdx]; S.dragging=hn; S.dragOffset={x:n.x-wp.x,y:n.y-wp.y}; }
      else    { S.panning=true; S.panStart=s; S.panOrigin={x:S.panX,y:S.panY}; }
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length===2) {
      const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      if (lastTouchDist) {
        const r=overlay.getBoundingClientRect();
        const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-r.left;
        const my=(e.touches[0].clientY+e.touches[1].clientY)/2-r.top;
        const wx=mx/S.zoom+S.panX, wy=my/S.zoom+S.panY;
        S.zoom=Math.max(.1,Math.min(10,S.zoom*dist/lastTouchDist));
        S.panX=wx-mx/S.zoom; S.panY=wy-my/S.zoom; render();
      }
      lastTouchDist=dist; return;
    }
    lastTouchDist=null;
    const s=evtScreen(e), wp=s2w(s.x,s.y);
    if (S.panning) { S.panX=S.panOrigin.x-(s.x-S.panStart.x)/S.zoom; S.panY=S.panOrigin.y-(s.y-S.panStart.y)/S.zoom; render(); return; }
    if (S.mode==='move'&&S.dragging) {
      const sn=snapWorld(wp.x+S.dragOffset.x,wp.y+S.dragOffset.y);
      S.runs[S.dragging.runIdx].nodes[S.dragging.nodeIdx].x=sn.x;
      S.runs[S.dragging.runIdx].nodes[S.dragging.nodeIdx].y=sn.y;
      render(); updateSummary();
    }
  }
  function onTouchEnd(e) { e.preventDefault(); lastTouchDist=null; S.panning=false; S.dragging=null; }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    const body=document.getElementById('fm-body');
    if (!body||!body.classList.contains('open')) return;
    if (e.key==='Enter' && S.mode==='draw' && S.activeRun>=0) {
      const run=S.runs[S.activeRun];
      if (run.nodes.length>=2) finishActiveRun();
      e.preventDefault();
    }
    if (e.key==='Escape') {
      cancelInlineEdit();
      if (S.mode==='draw' && S.activeRun>=0) {
        S.runs.splice(S.activeRun,1); S.activeRun=-1;
        octx.clearRect(0,0,W,H); render(); updateSummary(); updateApplyBtn();
        showToast('Run cancelled');
      }
      e.preventDefault();
    }
    if ((e.key==='z'||e.key==='Z')&&(e.ctrlKey||e.metaKey)) { doUndo(); e.preventDefault(); }
  }

  // ─── Node placement ───────────────────────────────────────────────────────
  function placeNode(wx, wy) {
    if (S.activeRun>=0) {
      const run=S.runs[S.activeRun];
      const last=run.nodes[run.nodes.length-1];
      if (last&&last.x===wx&&last.y===wy) return;
      run.nodes.push({ x:wx, y:wy, label:'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[run.nodes.length%26] });
    } else {
      runLabelCounter++;
      const run=newRun('Run '+runLabelCounter);
      run.nodes.push({ x:wx, y:wy, label:'A' });
      S.runs.push(run);
      S.activeRun=S.runs.length-1;
    }
    lastPlaceTime=Date.now();
    render(); updateSummary(); updateApplyBtn();
  }

  function finishActiveRun() {
    if (S.activeRun<0||S.activeRun>=S.runs.length) return;
    S.runs[S.activeRun].finished=true;
    S.activeRun=-1;
    octx.clearRect(0,0,W,H);
    render(); updateSummary();
    showToast('Run finished. Click anywhere to start a new run.');
  }

  // ─── Gate placement ───────────────────────────────────────────────────────
  function tryPlaceGate(sx, sy) {
    if (!S.runs.length) { showToast('Draw a fence run first.'); return; }
    let bestRun=-1, bestSeg=-1, bestT=0, bestDist=Infinity;
    S.runs.forEach((run,ri)=>{
      getRunSegments(run).forEach((seg,si)=>{
        const {t,dist}=projectOnSegScreen(sx,sy,seg);
        if (dist<bestDist&&dist<20) { bestDist=dist; bestRun=ri; bestSeg=si; bestT=t; }
      });
    });
    if (bestRun===-1) { showToast('Click closer to a fence segment.'); return; }
    openGateModal(bestRun,bestSeg,bestT);
  }

  // ─── Undo / Clear ─────────────────────────────────────────────────────────
  function doUndo() {
    if (S.activeRun>=0) {
      const run=S.runs[S.activeRun];
      if (run.nodes.length>0) {
        run.nodes.pop();
        if (run.nodes.length===0) { S.runs.pop(); S.activeRun=-1; }
      }
    } else {
      // Remove last gate from any finished run
      for (let i=S.runs.length-1;i>=0;i--) {
        if (S.runs[i].gates.length>0) { S.runs[i].gates.pop(); break; }
      }
    }
    render(); updateSummary(); updateApplyBtn();
  }

  function doClear() {
    if (S.applied&&!confirm('This layout was applied to the calculator. Clear anyway?')) return;
    if (S.runs.length>0&&!confirm('Clear all runs and gates?')) return;
    S.runs=[]; S.activeRun=-1; S.applied=false; runLabelCounter=0;
    S.showPosts=false;
    octx&&octx.clearRect(0,0,W,H);
    render(); updateSummary(); updateApplyBtn();
  }

  // ─── Google Maps ──────────────────────────────────────────────────────────
  async function loadGoogleMap() {
    const addrEl=document.getElementById('fm-map-address');
    const address=addrEl?addrEl.value.trim():'';
    if (!address) { showToast('Enter an address first.'); return; }

    const apiKey=GOOGLE_MAPS_API_KEY;

    const loadBtn=document.getElementById('fm-load-map');
    if(loadBtn) loadBtn.textContent='Loading...';
    showToast('Loading satellite map…');

    try {
      const geoRes=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
      const geoData=await geoRes.json();
      if (geoData.status!=='OK'||!geoData.results.length) {
        showToast('Address not found — check address or API key'); return;
      }
      const {lat,lng}=geoData.results[0].geometry.location;
      const zoom=20, imgW=800, imgH=600;
      const mapUrl=`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${imgW}x${imgH}&maptype=satellite&key=${apiKey}`;
      const img=new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>{
        S.mapImage=img;
        // meters per pixel at this lat/zoom
        const mPerPx=(156543.03392*Math.cos(lat*Math.PI/180))/Math.pow(2,zoom);
        // world units per pixel: (S.scale mm / 1000 m) / (mPerPx * GRID world-px per unit)
        S.mapPixelsPerWorldUnit=(S.scale/1000)/(mPerPx*GRID);
        const c=s2w(W/2,H/2);
        S.mapWorldOrigin={x:c.x,y:c.y};
        render();
        showToast('Satellite map loaded — draw your fence on top');
      };
      img.onerror=()=>showToast('Map image failed to load — check API key billing');
      img.src=mapUrl;
    } catch(err) {
      showToast('Map error: '+(err.message||err));
    } finally {
      if(loadBtn) loadBtn.textContent='Load Map';
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  function updateSummary() {
    const sumDiv=document.getElementById('fm-summary');
    const totDiv=document.getElementById('fm-totals');
    if (!sumDiv) return;
    const valid=S.runs.filter(r=>r.nodes.length>=2);
    if (!valid.length&&S.activeRun<0) { sumDiv.innerHTML=''; if(totDiv)totDiv.textContent=''; updateApplyBtn(); return; }

    let rows='', grandFence=0, grandGates=0, grandCorners=0;
    S.runs.forEach((run,ri)=>{
      if (run.nodes.length<2) return;
      const segs=getRunSegments(run), col=RUN_PALETTE[ri%RUN_PALETTE.length];
      let fence=0,gates=0,corners=0;
      segs.forEach((seg,si)=>{
        const mm=segLenMm(seg);
        const gMm=run.gates.filter(g=>g.segIdx===si).reduce((s,g)=>s+g.widthMm,0);
        fence+=mm-gMm; gates+=gMm;
        if(si<segs.length-1){const d=angleDeg(seg.a,seg.b,segs[si+1].b);if(d>2&&d<175)corners++;}
      });
      const overrides=Object.entries(run.config).filter(([,v])=>v!=null).map(([k,v])=>`${k}=${v}`).join(', ');
      rows+=`<tr>
        <td><span class="fm-run-swatch" style="background:${col}"></span>${run.label}${run.finished?'':' ✏'}</td>
        <td>${(fence/1000).toFixed(2)}m</td>
        <td>${run.gates.length}</td>
        <td>${corners}</td>
        <td style="font-size:11px;color:#888;max-width:140px;overflow:hidden;text-overflow:ellipsis">${overrides||'—'}</td>
      </tr>`;
      grandFence+=fence; grandGates+=run.gates.length; grandCorners+=corners;
    });

    sumDiv.innerHTML=`<div id="fm-summary-title">Runs</div>
      <table>
        <thead><tr><th>Run</th><th>Length</th><th>Gates</th><th>Corners</th><th>Config overrides</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    if(totDiv) totDiv.innerHTML=`Total fence: <strong>${(grandFence/1000).toFixed(2)}m</strong>
      &nbsp;|&nbsp; Runs: <strong>${valid.length}</strong>
      &nbsp;|&nbsp; Corners: <strong>${grandCorners}</strong>
      &nbsp;|&nbsp; Gates: <strong>${grandGates}</strong>`;
    updateApplyBtn();
  }

  function updateApplyBtn() {
    const btn=document.getElementById('fm-apply-btn');
    if(btn) btn.disabled=!S.runs.some(r=>r.nodes.length>=2);
  }

  // ─── Apply to calculator ──────────────────────────────────────────────────
  window.applyFenceLayout=function(){ applyToCalculator(); };

  function applyToCalculator() {
    const valid=S.runs.filter(r=>r.nodes.length>=2);
    if (!valid.length) return;

    // Build window.fmRuns for per-run BOM generation
    window.fmRuns=valid.map((run,i)=>{
      const segs=getRunSegments(run);
      let totalMm=0, corners=0;
      segs.forEach((seg,si)=>{
        totalMm+=segLenMm(seg);
        run.gates.filter(g=>g.segIdx===si).forEach(g=>{ totalMm-=g.widthMm; });
        if(si<segs.length-1){const d=angleDeg(seg.a,seg.b,segs[si+1].b);if(d>2&&d<175)corners++;}
      });
      return { runIdx:i, label:run.label, totalLengthMm:Math.max(0,totalMm), gates:run.gates, corners, config:run.config };
    });

    // Back-fill form with first run (single-run compat)
    const first=window.fmRuns[0];
    const lenEl=document.getElementById('runLength');
    const cornersEl=document.getElementById('corners');
    if (lenEl&&lenEl.value&&parseInt(lenEl.value)!==Math.round(first.totalLengthMm)) {
      if (!confirm('Overwrite current run length?')) { window.fmRuns=null; return; }
    }
    if(lenEl)     lenEl.value=Math.round(first.totalLengthMm);
    if(cornersEl) cornersEl.value=first.corners;

    const nlEl=document.getElementById('nl-input');
    if (nlEl) {
      const summary=window.fmRuns.map(r=>`${r.label}: ${(r.totalLengthMm/1000).toFixed(2)}m, ${r.corners} corner${r.corners!==1?'s':''}, ${r.gates.length} gate${r.gates.length!==1?'s':''}`).join('; ');
      const note=`[Layout: ${window.fmRuns.length} run${window.fmRuns.length!==1?'s':''} — ${summary}]`;
      if (!nlEl.value.startsWith('[Layout:')) nlEl.value=note+(nlEl.value?'\n'+nlEl.value:'');
      else nlEl.value=note+nlEl.value.replace(/^\[Layout:[^\]]*\]\n?/,'\n').trimStart();
    }

    if(typeof onConfigChange==='function') onConfigChange();
    S.applied=true;
    const totalM=(window.fmRuns.reduce((s,r)=>s+r.totalLengthMm,0)/1000).toFixed(2);
    showToast(`Applied: ${window.fmRuns.length} run${window.fmRuns.length!==1?'s':''}, ${totalM}m total`);
  }

  // ─── Post positions (called from generateBOM) ─────────────────────────────
  window.fmSetPostPositions=function(runIdx, postPositions) {
    if (runIdx>=0&&runIdx<S.runs.length) {
      S.runs[runIdx].postPositions=postPositions;
      S.showPosts=true;
      render();
    }
  };

  // ─── Site plan export ─────────────────────────────────────────────────────
  window.fmGetSitePlanDataURL=function() {
    if (!canvas||!S.runs.some(r=>r.nodes.length>=2)) return null;
    const margin=40;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    S.runs.forEach(r=>r.nodes.forEach(n=>{
      minX=Math.min(minX,n.x); maxX=Math.max(maxX,n.x);
      minY=Math.min(minY,n.y); maxY=Math.max(maxY,n.y);
    }));
    const oc=document.createElement('canvas');
    oc.width=Math.max(maxX-minX+margin*2,200); oc.height=Math.max(maxY-minY+margin*2,200);
    const c2=oc.getContext('2d');
    c2.fillStyle='#fff'; c2.fillRect(0,0,oc.width,oc.height);
    const ox=margin-minX, oy=margin-minY;
    S.runs.forEach((run,ri)=>{
      const col=RUN_PALETTE[ri%RUN_PALETTE.length];
      const segs=getRunSegments(run);
      segs.forEach((seg,si)=>{
        const gons=run.gates.filter(g=>g.segIdx===si);
        computeIntervals(seg,gons).forEach(([t0,t1])=>{
          c2.save(); c2.strokeStyle=col; c2.lineWidth=2;
          c2.beginPath();
          c2.moveTo(seg.a.x+ox+(seg.b.x-seg.a.x)*t0, seg.a.y+oy+(seg.b.y-seg.a.y)*t0);
          c2.lineTo(seg.a.x+ox+(seg.b.x-seg.a.x)*t1, seg.a.y+oy+(seg.b.y-seg.a.y)*t1);
          c2.stroke(); c2.restore();
        });
        c2.save(); c2.font='10px sans-serif'; c2.fillStyle=col; c2.textAlign='center';
        c2.fillText(segLenMm(seg).toLocaleString()+'mm', (seg.a.x+seg.b.x)/2+ox, (seg.a.y+seg.b.y)/2+oy-5);
        c2.restore();
      });
      run.nodes.forEach(n=>{
        c2.save(); c2.beginPath(); c2.arc(n.x+ox,n.y+oy,NODE_R,0,Math.PI*2);
        c2.fillStyle='#fff'; c2.fill(); c2.strokeStyle=col; c2.lineWidth=2; c2.stroke(); c2.restore();
        c2.save(); c2.font='bold 10px sans-serif'; c2.fillStyle=col; c2.textAlign='center';
        c2.fillText(n.label, n.x+ox, n.y+oy-12); c2.restore();
      });
      if (run.nodes.length>0) {
        const fn=run.nodes[0];
        c2.save(); c2.font='bold 11px sans-serif'; c2.fillStyle=col;
        c2.fillText(run.label, fn.x+ox+10, fn.y+oy-16); c2.restore();
      }
    });
    return oc.toDataURL('image/png');
  };

  // ─── Toast ────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t=document.getElementById('fm-toast');
    if(!t) return;
    t.textContent=msg; t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 3000);
  }

  // ─── Serialisation ────────────────────────────────────────────────────────
  window.fmGetState=()=>JSON.stringify({ runs:S.runs, scale:S.scale, zoom:S.zoom, panX:S.panX, panY:S.panY, runLabelCounter });
  window.fmLoadState=(json)=>{
    try {
      const d=JSON.parse(typeof json==='string'?json:JSON.stringify(json));
      S.runs=d.runs||[]; S.scale=d.scale||1000; S.zoom=d.zoom||1; S.panX=d.panX||0; S.panY=d.panY||0;
      runLabelCounter=d.runLabelCounter||S.runs.length;
      const el=document.getElementById('fm-scale'); if(el) el.value=S.scale;
      render(); updateSummary(); updateApplyBtn();
    } catch(e){}
  };

  // ─── Boot ─────────────────────────────────────────────────────────────────
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();

})();
