/* Smart Blackboard - static app (HTML/CSS/JS)
 * Features: pen, highlighter, eraser, line, rectangle, text, undo/redo,
 * dynamic sepia theming, grid, export/copy, autosave, keyboard+touch support.
 */

const q = (sel) => document.querySelector(sel);
const qa = (sel) => Array.from(document.querySelectorAll(sel));

const DEFAULTS = {
  theme: 'sepia-dark',
  tool: 'pen',
  color: '#1f4b3f',
  size: 8,
  showGrid: true,
};

const STORAGE_KEYS = {
  settings: 'smart-blackboard:settings',
  drawing: 'smart-blackboard:drawing',
};

const HISTORY_LIMIT = 50;

const els = {
  board: q('#board'),
  bgCanvas: q('#bgCanvas'),
  drawCanvas: q('#drawCanvas'),
  overlayCanvas: q('#overlayCanvas'),
  toolButtons: qa('.tool-btn[data-tool]'),
  color: q('#color'),
  size: q('#size'),
  gridToggle: q('#gridToggle'),
  theme: q('#theme'),
  undo: q('#undo'),
  redo: q('#redo'),
  clear: q('#clear'),
  exportBtn: q('#export'),
  copyBtn: q('#copy'),
  textInput: q('#textInput'),
};

const ctx = {
  bg: els.bgCanvas.getContext('2d'),
  draw: els.drawCanvas.getContext('2d'),
  overlay: els.overlayCanvas.getContext('2d'),
};

const state = {
  tool: DEFAULTS.tool,
  color: DEFAULTS.color,
  size: DEFAULTS.size,
  showGrid: DEFAULTS.showGrid,
  theme: DEFAULTS.theme,
  isPointerDown: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  history: [],
  redo: [],
  dpr: Math.max(1, window.devicePixelRatio || 1),
  savingTimer: 0,
};

function getCssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function setActiveTool(tool) {
  state.tool = tool;
  els.toolButtons.forEach((btn) => {
    const isActive = btn.dataset.tool === tool;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

function setTheme(theme) {
  state.theme = theme;
  document.body.setAttribute('data-theme', theme);
  els.theme.value = theme;
  drawBackground();
  saveSettingsDebounced();
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.theme) setTheme(s.theme);
    if (typeof s.showGrid === 'boolean') state.showGrid = s.showGrid;
    if (s.tool) state.tool = s.tool;
    if (s.color) state.color = s.color;
    if (s.size) state.size = s.size;
  } catch {}
}

function saveSettingsDebounced() {
  window.clearTimeout(state.savingTimer);
  state.savingTimer = window.setTimeout(saveSettings, 200);
}

function saveSettings() {
  const s = {
    theme: state.theme,
    showGrid: state.showGrid,
    tool: state.tool,
    color: state.color,
    size: state.size,
  };
  try { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(s)); } catch {}
}

function getBoardSize() {
  const r = els.board.getBoundingClientRect();
  return { width: Math.max(1, Math.floor(r.width)), height: Math.max(1, Math.floor(r.height)) };
}

function configureCanvas(canvas, context, width, height, dpr) {
  const cssW = width;
  const cssH = height;
  const pixelW = Math.floor(cssW * dpr);
  const pixelH = Math.floor(cssH * dpr);
  // Preserve current image for draw layer when resizing
  let prevBitmap = null;
  if (canvas === els.drawCanvas) {
    try { prevBitmap = canvas.transferToImageBitmap ? canvas.transferToImageBitmap() : null; } catch {}
  }
  canvas.width = pixelW;
  canvas.height = pixelH;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  if (typeof context.setTransform === 'function') {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else {
    context.resetTransform?.();
    context.scale(dpr, dpr);
  }
  if (prevBitmap) {
    // Draw previous content back at 1:1 CSS scale
    const scaleX = Math.min(cssW, prevBitmap.width / dpr) / (prevBitmap.width / dpr);
    const scaleY = Math.min(cssH, prevBitmap.height / dpr) / (prevBitmap.height / dpr);
    const scale = Math.min(scaleX, scaleY);
    const drawW = (prevBitmap.width / dpr) * scale;
    const drawH = (prevBitmap.height / dpr) * scale;
    context.drawImage(prevBitmap, 0, 0, prevBitmap.width, prevBitmap.height, 0, 0, drawW, drawH);
  }
}

function resizeAllCanvases() {
  const { width, height } = getBoardSize();
  state.dpr = Math.max(1, window.devicePixelRatio || 1);
  configureCanvas(els.bgCanvas, ctx.bg, width, height, state.dpr);
  configureCanvas(els.drawCanvas, ctx.draw, width, height, state.dpr);
  configureCanvas(els.overlayCanvas, ctx.overlay, width, height, state.dpr);
  drawBackground();
}

function clearCanvas(context) {
  const { width, height } = getBoardSize();
  context.clearRect(0, 0, width, height);
}

function drawBackground() {
  const { width, height } = getBoardSize();
  const bgColor = getCssVar('--board-bg') || '#2b2418';
  const gridColor = getCssVar('--grid-line') || '#3a3223';
  const gridMajor = getCssVar('--grid-major') || '#4a3f2a';

  clearCanvas(ctx.bg);
  // Fill background
  ctx.bg.fillStyle = bgColor;
  ctx.bg.fillRect(0, 0, width, height);

  if (!state.showGrid) return;

  const minor = 32; // px (CSS pixels)
  const majorEvery = 5;

  ctx.bg.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x <= width; x += minor) {
    const isMajor = (Math.round(x / minor) % majorEvery) === 0;
    ctx.bg.strokeStyle = isMajor ? gridMajor : gridColor;
    ctx.bg.beginPath();
    const adjX = Math.round(x) + 0.5; // crisp 1px
    ctx.bg.moveTo(adjX, 0);
    ctx.bg.lineTo(adjX, height);
    ctx.bg.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += minor) {
    const isMajor = (Math.round(y / minor) % majorEvery) === 0;
    ctx.bg.strokeStyle = isMajor ? gridMajor : gridColor;
    ctx.bg.beginPath();
    const adjY = Math.round(y) + 0.5;
    ctx.bg.moveTo(0, adjY);
    ctx.bg.lineTo(width, adjY);
    ctx.bg.stroke();
  }
}

function getPointerPos(evt) {
  const r = els.overlayCanvas.getBoundingClientRect();
  return {
    x: (evt.clientX - r.left),
    y: (evt.clientY - r.top),
  };
}

function beginStroke(x, y) {
  ctx.draw.lineCap = 'round';
  ctx.draw.lineJoin = 'round';
  ctx.draw.lineWidth = state.size;
  ctx.draw.strokeStyle = state.color;
  ctx.draw.globalAlpha = 1.0;
  ctx.draw.globalCompositeOperation = 'source-over';

  if (state.tool === 'highlighter') {
    ctx.draw.globalAlpha = 0.33;
  } else if (state.tool === 'eraser') {
    ctx.draw.globalCompositeOperation = 'destination-out';
  }

  ctx.draw.beginPath();
  ctx.draw.moveTo(x, y);
}

function continueStroke(x, y) {
  ctx.draw.lineTo(x, y);
  ctx.draw.stroke();
}

function endStroke() {
  ctx.draw.closePath();
  ctx.draw.globalAlpha = 1.0;
  ctx.draw.globalCompositeOperation = 'source-over';
  snapshotHistory();
}

function drawShapePreview(x, y) {
  clearCanvas(ctx.overlay);
  ctx.overlay.lineWidth = Math.max(1, state.size);
  ctx.overlay.strokeStyle = state.color;
  ctx.overlay.setLineDash([8, 6]);
  ctx.overlay.beginPath();
  if (state.tool === 'line') {
    ctx.overlay.moveTo(state.startX, state.startY);
    ctx.overlay.lineTo(x, y);
  } else if (state.tool === 'rect') {
    const w = x - state.startX;
    const h = y - state.startY;
    ctx.overlay.rect(state.startX, state.startY, w, h);
  }
  ctx.overlay.stroke();
  ctx.overlay.setLineDash([]);
}

function commitShape(x, y) {
  clearCanvas(ctx.overlay);
  ctx.draw.lineWidth = Math.max(1, state.size);
  ctx.draw.strokeStyle = state.color;
  ctx.draw.globalAlpha = 1.0;
  ctx.draw.globalCompositeOperation = 'source-over';
  ctx.draw.beginPath();
  if (state.tool === 'line') {
    ctx.draw.moveTo(state.startX, state.startY);
    ctx.draw.lineTo(x, y);
    ctx.draw.stroke();
  } else if (state.tool === 'rect') {
    const w = x - state.startX;
    const h = y - state.startY;
    ctx.draw.strokeRect(state.startX + 0.5, state.startY + 0.5, w, h);
  }
  ctx.draw.closePath();
  snapshotHistory();
}

function showTextInput(x, y) {
  const fontSize = Math.max(10, Math.round(state.size * 4));
  const family = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial';
  const el = els.textInput;
  el.classList.remove('hidden');
  el.value = '';
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.fontSize = `${fontSize}px`;
  el.style.color = state.color;
  el.style.lineHeight = '1.25';
  el.style.fontFamily = family;
  el.focus();

  const commit = () => {
    const text = el.value.replace(/\s+$/g, '');
    if (text) {
      ctx.draw.globalCompositeOperation = 'source-over';
      ctx.draw.globalAlpha = 1.0;
      ctx.draw.fillStyle = state.color;
      ctx.draw.textBaseline = 'top';
      ctx.draw.font = `${fontSize}px ${family}`;
      const lines = text.split(/\n/);
      for (let i = 0; i < lines.length; i++) {
        ctx.draw.fillText(lines[i], Math.round(x), Math.round(y + i * fontSize * 1.25));
      }
      snapshotHistory();
    }
    el.classList.add('hidden');
    el.value = '';
  };

  el.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault();
      commit();
    }
  };
  el.onblur = () => {
    // Commit on blur for convenience
    commit();
  };
}

function snapshotDataUrl(canvas) {
  try { return canvas.toDataURL('image/png'); } catch { return null; }
}

function drawDataUrlOn(ctx2d, dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve();
    const img = new Image();
    img.onload = () => {
      const { width, height } = getBoardSize();
      // Context is scaled to DPR already; use CSS pixel dimensions for destination
      ctx2d.drawImage(img, 0, 0, width, height);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
}

function snapshotHistory() {
  const dataUrl = snapshotDataUrl(els.drawCanvas);
  if (!dataUrl) return;
  state.history.push(dataUrl);
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
  state.redo = [];
  saveDrawingDebounced();
}

function undo() {
  if (state.history.length <= 1) return; // keep at least one
  const current = state.history.pop();
  state.redo.push(current);
  const prev = state.history[state.history.length - 1];
  clearCanvas(ctx.draw);
  drawDataUrlOn(ctx.draw, prev).then(saveDrawingDebounced);
}

function redo() {
  if (!state.redo.length) return;
  const next = state.redo.pop();
  state.history.push(next);
  clearCanvas(ctx.draw);
  drawDataUrlOn(ctx.draw, next).then(saveDrawingDebounced);
}

function clearBoard() {
  clearCanvas(ctx.draw);
  snapshotHistory();
}

function saveDrawingDebounced() {
  window.clearTimeout(state.savingTimer);
  state.savingTimer = window.setTimeout(saveDrawing, 200);
}

function saveDrawing() {
  const data = snapshotDataUrl(els.drawCanvas);
  if (!data) return;
  try { localStorage.setItem(STORAGE_KEYS.drawing, data); } catch {}
}

async function restoreDrawing() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.drawing);
    if (data) {
      await drawDataUrlOn(ctx.draw, data);
    }
  } catch {}
  // Initialize history with current state
  const current = snapshotDataUrl(els.drawCanvas);
  if (current) state.history = [current];
  state.redo = [];
}

function exportCompositeBlob() {
  return new Promise((resolve) => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = els.drawCanvas.width; // includes DPR
    exportCanvas.height = els.drawCanvas.height;
    const ectx = exportCanvas.getContext('2d');
    ectx.drawImage(els.bgCanvas, 0, 0);
    ectx.drawImage(els.drawCanvas, 0, 0);
    exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

async function handleExport() {
  const blob = await exportCompositeBlob();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blackboard-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleCopy() {
  const blob = await exportCompositeBlob();
  if (!blob) return;
  try {
    await navigator.clipboard.write([
      new window.ClipboardItem({ 'image/png': blob })
    ]);
  } catch (e) {
    // Fallback: open export in new tab
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

function handlePointerDown(evt) {
  if (evt.button !== undefined && evt.button !== 0) return;
  const pos = getPointerPos(evt);
  state.isPointerDown = true;
  state.startX = state.lastX = pos.x;
  state.startY = state.lastY = pos.y;
  els.overlayCanvas.setPointerCapture?.(evt.pointerId ?? 0);

  if (state.tool === 'pen' || state.tool === 'highlighter' || state.tool === 'eraser') {
    beginStroke(pos.x, pos.y);
  } else if (state.tool === 'line' || state.tool === 'rect') {
    drawShapePreview(pos.x, pos.y);
  } else if (state.tool === 'text') {
    showTextInput(pos.x, pos.y);
  }
}

function handlePointerMove(evt) {
  if (!state.isPointerDown) return;
  const pos = getPointerPos(evt);
  if (state.tool === 'pen' || state.tool === 'highlighter' || state.tool === 'eraser') {
    continueStroke(pos.x, pos.y);
  } else if (state.tool === 'line' || state.tool === 'rect') {
    drawShapePreview(pos.x, pos.y);
  }
  state.lastX = pos.x;
  state.lastY = pos.y;
}

function handlePointerUp(evt) {
  if (!state.isPointerDown) return;
  state.isPointerDown = false;
  els.overlayCanvas.releasePointerCapture?.(evt.pointerId ?? 0);
  const pos = getPointerPos(evt);
  if (state.tool === 'pen' || state.tool === 'highlighter' || state.tool === 'eraser') {
    continueStroke(pos.x, pos.y);
    endStroke();
  } else if (state.tool === 'line' || state.tool === 'rect') {
    commitShape(pos.x, pos.y);
  }
}

function applyUiFromState() {
  setActiveTool(state.tool);
  els.color.value = state.color;
  els.size.value = String(state.size);
  els.gridToggle.checked = state.showGrid;
  els.theme.value = state.theme;
}

function wireToolbar() {
  els.toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveTool(btn.dataset.tool);
      saveSettingsDebounced();
    });
  });

  els.color.addEventListener('input', () => {
    state.color = els.color.value;
    saveSettingsDebounced();
  });

  els.size.addEventListener('input', () => {
    state.size = Number(els.size.value);
    saveSettingsDebounced();
  });

  els.gridToggle.addEventListener('change', () => {
    state.showGrid = els.gridToggle.checked;
    drawBackground();
    saveSettingsDebounced();
  });

  els.theme.addEventListener('change', () => {
    setTheme(els.theme.value);
  });

  els.undo.addEventListener('click', undo);
  els.redo.addEventListener('click', redo);
  els.clear.addEventListener('click', clearBoard);
  els.exportBtn.addEventListener('click', handleExport);
  els.copyBtn.addEventListener('click', handleCopy);
}

function wireBoard() {
  els.overlayCanvas.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
}

function handleKeydown(e) {
  const k = e.key.toLowerCase();
  const meta = e.metaKey || e.ctrlKey;
  if (meta && k === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if (k === 'delete' || k === 'backspace') {
    if (document.activeElement === els.textInput && !els.textInput.classList.contains('hidden')) return;
    e.preventDefault();
    clearBoard();
    return;
  }
  // Tool shortcuts
  if (!meta && !e.altKey) {
    if (k === 'p') setActiveTool('pen');
    else if (k === 'h') setActiveTool('highlighter');
    else if (k === 'e') setActiveTool('eraser');
    else if (k === 'l') setActiveTool('line');
    else if (k === 'r') setActiveTool('rect');
    else if (k === 't') setActiveTool('text');
    else if (k === 'g') { state.showGrid = !state.showGrid; els.gridToggle.checked = state.showGrid; drawBackground(); saveSettingsDebounced(); }
  }
}

function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function init() {
  loadSettings();
  applyUiFromState();
  setTheme(state.theme);

  resizeAllCanvases();
  await restoreDrawing();

  wireToolbar();
  wireBoard();
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', debounce(resizeAllCanvases, 150));
}

document.addEventListener('DOMContentLoaded', init);

