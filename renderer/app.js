/* PixelArt - Minecraft skin & image to pixel art */
const $ = (id) => document.getElementById(id);

let sourceImage = null;
let isSkinMode = true;
let currentSize = 8;
let recommendedSize = 8;
let customSize = null;
let grid = null;
let lastOutput = '';

let skinName = '';
let skinUuid = '';

const SIZES = [4, 6, 8, 10, 12];

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#111;border:1px solid #333;color:#e0e0e0;padding:10px 14px;border-radius:8px;z-index:300;font-size:13px';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function show(id, on = true) { $(id).classList.toggle('hidden', !on); }

function isUuid(s) { const c = s.trim().replace(/-/g, ''); return /^[0-9a-f]{32}$/i.test(c); }

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

async function urlToImage(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = objectUrl; });
  return img;
}

function removeBackground(img, tolerance = 28) {
  const c = makeCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const pts = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]];
  const samples = pts.map(([x, y]) => { const i = (y * c.width + x) * 4; return [data.data[i], data.data[i + 1], data.data[i + 2]]; });
  const bg = samples.reduce((a, s) => [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [0, 0, 0]).map(v => v / samples.length);
  for (let i = 0; i < data.data.length; i += 4) {
    const dr = Math.abs(data.data[i] - bg[0]);
    const dg = Math.abs(data.data[i + 1] - bg[1]);
    const db = Math.abs(data.data[i + 2] - bg[2]);
    if (dr + dg + db < tolerance * 3) data.data[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  const out = new Image();
  return new Promise((res) => { out.onload = () => res(out); out.src = c.toDataURL(); });
}

// ---------- Hat detection ----------
function hasHatLayer(img) {
  const c = makeCanvas(8, 8);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
  const d = ctx.getImageData(0, 0, 8, 8).data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0 && (d[i] !== 0 || d[i + 1] !== 0 || d[i + 2] !== 0)) return true;
  }
  return false;
}

// ---------- API ----------
async function mojangLookupName(name) {
  try {
    const r = await fetch(`https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(name)}`);
    if (r.ok) {
      const d = await r.json();
      return { uuid: d.id, name: d.name };
    }
  } catch (e) {}
  try {
    const r = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`);
    if (r.ok) {
      const d = await r.json();
      return { uuid: d.id, name: d.name };
    }
  } catch (e) {}
  return null;
}

async function getSkinByUuid(uuid) {
  const r = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
  if (!r.ok) throw new Error('Profile fetch failed');
  const prof = await r.json();
  const prop = (prof.properties || []).find(p => p.name === 'textures');
  if (!prop) throw new Error('No texture');
  const tex = JSON.parse(atob(prop.value));
  return { url: tex.textures.SKIN.url, name: prof.name };
}

// ---------- Core load ----------
async function loadSkinByInput(input) {
  const raw = input.trim();

  // Direct image URL
  if (/^https?:\/\//i.test(raw) && /\.(png|jpe?g|webp)(\?.*)?$/i.test(raw)) {
    let img = await urlToImage(raw);
    if ($('removeBg') && $('removeBg').checked) img = await removeBackground(img);
    sourceImage = img; isSkinMode = false;
    skinName = 'Image URL'; skinUuid = 'url';
    finishLoad(); return;
  }

  if (isUuid(raw)) {
    const uuid = raw.replace(/-/g, '');
    const { url, name } = await getSkinByUuid(uuid);
    sourceImage = await urlToImage(url); isSkinMode = true;
    skinName = name || raw; skinUuid = uuid;
    finishLoad(); return;
  }

  // Username fallback -> exact Mojang lookup
  const info = await mojangLookupName(raw);
  if (info) {
    const { url, name } = await getSkinByUuid(info.uuid);
    sourceImage = await urlToImage(url); isSkinMode = true;
    skinName = name || info.name; skinUuid = info.uuid;
    finishLoad(); return;
  }

  throw new Error('Player not found');
}

function finishLoad() {
  // Auto-detect hat layer
  if (isSkinMode && sourceImage) {
    const hatCheck = hasHatLayer(sourceImage);
    $('includeHat').checked = hatCheck;
  }

  recommendedSize = computeRecommended(sourceImage, isSkinMode);
  currentSize = recommendedSize;
  $('skinName').textContent = skinName || '—';
  $('skinUuid').textContent = isSkinMode ? skinUuid : 'Uploaded image';
  buildSizeButtons();
  updateSizeButtons();
  generate();
  renderPreviews();
  show('workspace', true);
}

function computeRecommended(img, skin) {
  const c = makeCanvas(8, 8);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = skin;
  if (skin) ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
  else ctx.drawImage(img, 0, 0, 8, 8);
  const d = ctx.getImageData(0, 0, 8, 8).data;
  const colors = new Set(); let edges = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (y * 8 + x) * 4; colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) {
    const i = (y * 8 + x) * 4, j = (y * 8 + x + 1) * 4;
    if (d[i] !== d[j] || d[i + 1] !== d[j + 1] || d[i + 2] !== d[j + 2]) edges++;
  }
  if (colors.size > 40 || edges > 40) return 10;
  return 8;
}

function getHeadCanvas(img, includeHat) {
  const c = makeCanvas(8, 8);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (isSkinMode) {
    ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
    if (includeHat) ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, 8, 8);
  }
  return c;
}

function extractGrid(img, size, opts) {
  const smoothing = !opts.nearest;
  const includeHat = opts.includeHat;
  let srcCanvas;
  if (isSkinMode) {
    srcCanvas = makeCanvas(8, 8);
    const sctx = srcCanvas.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
    if (includeHat) sctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
  } else {
    srcCanvas = makeCanvas(img.width, img.height);
    const sctx = srcCanvas.getContext('2d');
    sctx.drawImage(img, 0, 0);
  }
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = smoothing;
  ctx.imageSmoothingQuality = 'high';
  if (isSkinMode) ctx.drawImage(srcCanvas, 0, 0, 8, 8, 0, 0, size, size);
  else ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const g = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      row.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] });
    }
    g.push(row);
  }
  return g;
}

const NAMED_COLORS = [
  { hex: '000000' }, { hex: '0000AA' }, { hex: '00AA00' }, { hex: '00AAAA' }, { hex: 'AA0000' }, { hex: 'AA00AA' },
  { hex: 'FFAA00' }, { hex: 'AAAAAA' }, { hex: '555555' }, { hex: '5555FF' }, { hex: '55FF55' }, { hex: '55FFFF' },
  { hex: 'FF5555' }, { hex: 'FF55FF' }, { hex: 'FFFF55' }, { hex: 'FFFFFF' }
];
const NAMED_CODE = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
function nearestNamed(hex) {
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  let best = 0, bestD = Infinity;
  NAMED_COLORS.forEach((c, idx) => {
    const cr = parseInt(c.hex.slice(0, 2), 16), cg = parseInt(c.hex.slice(2, 4), 16), cb = parseInt(c.hex.slice(4, 6), 16);
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = idx; }
  });
  return NAMED_CODE[best];
}
function hexStr(p) { return [p.r, p.g, p.b].map(v => v.toString(16).padStart(2, '0')).join(''); }
function colorCode(p, format) {
  const h = hexStr(p);
  switch (format) {
    case 'hashamp': return '&#' + h;
    case 'angle': return '<#' + h + '>';
    case 'section': return '§x§' + h.split('').join('§');
    case 'ampx': return '&x&' + h.split('').join('&');
    case 'named': return '&' + nearestNamed(h);
  }
  return '&#' + h;
}
function isTransparent(p) { return p.a < 128; }

function generateLines() {
  const size = currentSize;
  const format = $('colorFormat').value;
  const block = $('blockChar').value;
  const compact = $('compact').checked;
  const transSpace = $('transparentSpace').checked;
  const addReset = $('addReset').checked;
  const lines = [];
  for (let y = 0; y < size; y++) {
    let line = '';
    let runColor = null;
    let runCount = 0;
    const flushRun = () => {
      if (runCount > 0 && runColor) {
        line += colorCode(runColor, format) + block.repeat(runCount);
        runColor = null; runCount = 0;
      }
    };
    for (let x = 0; x < size; x++) {
      const p = grid[y][x];
      if (isTransparent(p)) { flushRun(); line += transSpace ? ' ' : ''; continue; }
      const code = colorCode(p, format);
      if (compact && runColor && colorCode(runColor, format) === code) { runCount++; }
      else { flushRun(); runColor = { r: p.r, g: p.g, b: p.b, a: p.a }; runCount = 1; }
    }
    flushRun();
    if (addReset) { line += (format === 'section') ? '§r' : '&r'; }
    lines.push(line);
  }
  return lines;
}

function buildOutput(lines) {
  const template = $('template').value;
  const cmd = $('cmdName').value.trim() || 'pixelart';
  if (template === 'raw') return lines.join('\n');
  if (template === 'messages') return lines.map(l => `send "${l}" to player`).join('\n');
  if (template === 'skript') {
    const indented = lines.map(l => `        send "${l}" to player`).join('\n');
    return `command /${cmd}:\n    trigger:\n${indented}`;
  }
  if (template === 'java') {
    const arr = lines.map(l => '            "' + l.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',\n');
    return `String[] lines = new String[] {\n${arr}\n};`;
  }
  if (template === 'json') return JSON.stringify({ size: currentSize, lines }, null, 2);
  return lines.join('\n');
}

function generate() {
  if (!sourceImage) return;
  grid = extractGrid(sourceImage, currentSize, {
    includeHat: $('includeHat') ? $('includeHat').checked : false,
    nearest: $('useNearest') ? $('useNearest').checked : false
  });
  const lines = generateLines();
  const out = buildOutput(lines);
  lastOutput = out;
  $('output').value = out;
  $('outputInfo').textContent = `${currentSize}x${currentSize} = ${currentSize * currentSize} pixels - ${lines.length} lines`;
  renderPreviews();
  renderSvg();
}

function drawSourcePreview(canvas, img) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * scale, h = img.height * scale;
  const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

function renderPreviews() {
  if (!sourceImage) return;
  drawSourcePreview($('headCanvas'), sourceImage);
  const cell = 16;
  const spc = $('sizePreviewCanvas');
  spc.width = currentSize * cell; spc.height = currentSize * cell;
  const spctx = spc.getContext('2d');
  spctx.imageSmoothingEnabled = false;
  spctx.clearRect(0, 0, spc.width, spc.height);
  if (grid) {
    for (let y = 0; y < currentSize; y++) for (let x = 0; x < currentSize; x++) {
      const p = grid[y][x];
      if (p.a < 128) continue;
      spctx.fillStyle = '#' + hexStr(p);
      spctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const gc = $('gridCanvas');
  gc.width = currentSize * cell; gc.height = currentSize * cell;
  const gctx = gc.getContext('2d');
  gctx.imageSmoothingEnabled = false;
  gctx.clearRect(0, 0, gc.width, gc.height);
  if (grid) {
    for (let y = 0; y < currentSize; y++) for (let x = 0; x < currentSize; x++) {
      const p = grid[y][x];
      gctx.fillStyle = p.a < 128 ? '#0a0a0a' : '#' + hexStr(p);
      gctx.fillRect(x * cell, y * cell, cell, cell);
      gctx.strokeStyle = 'rgba(255,255,255,.08)';
      gctx.strokeRect(x * cell, y * cell, cell, cell);
    }
  }
}

function renderSvg() {
  if (!grid) return;
  const size = currentSize;
  const cellSize = 12;
  const total = size * cellSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" shape-rendering="crispEdges" style="background:#000">`;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = grid[y][x];
    if (p.a < 128) continue;
    svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#${hexStr(p)}"/>`;
  }
  svg += '</svg>';
  $('svgPreview').innerHTML = svg;
  window._lastSvg = svg;
}

function buildSizeButtons() {
  const container = $('sizeButtons');
  container.innerHTML = '';
  for (const s of SIZES) {
    const b = document.createElement('button');
    b.className = 'size-btn';
    b.textContent = s + 'x' + s;
    const active = (customSize === null && s === currentSize);
    if (s === recommendedSize) b.classList.add('recommended');
    if (active) b.classList.add('active');
    b.addEventListener('click', () => { currentSize = s; customSize = null; $('customSize').value = ''; updateSizeButtons(); generate(); });
    container.appendChild(b);
  }
  if (customSize) {
    const b = document.createElement('button');
    b.className = 'size-btn active';
    b.textContent = customSize + 'x' + customSize;
    b.addEventListener('click', () => { customSize = null; currentSize = 8; $('customSize').value = ''; updateSizeButtons(); generate(); });
    container.appendChild(b);
  }
}
function updateSizeButtons() {
  document.querySelectorAll('.size-btn:not(.active-custom)').forEach((b, i) => {
    const s = SIZES[i];
    b.classList.toggle('active', s === currentSize && customSize === null);
  });
}

// ---------- Events ----------
async function doLoad() {
  const input = $('uuidInput').value.trim();
  if (!input) return;
  try {
    await loadSkinByInput(input);
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

$('loadBtn').addEventListener('click', doLoad);
$('uuidInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLoad(); });

$('applyCustomSize').addEventListener('click', () => {
  const v = parseInt($('customSize').value, 10);
  if (!v || v < 2 || v > 32) { toast('Enter 2-32'); return; }
  customSize = v;
  currentSize = v;
  buildSizeButtons();
  generate();
});
$('customSize').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('applyCustomSize').click(); });

// UUID auto-load
let uuidTimer = null;
$('uuidInput').addEventListener('input', () => {
  const v = $('uuidInput').value.trim();
  if (isUuid(v)) {
    clearTimeout(uuidTimer);
    uuidTimer = setTimeout(() => doLoad(), 400);
  }
});

$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => { openCrop(img); };
  img.src = url;
});

$('cropConfirm').addEventListener('click', confirmCrop);
$('cropCancel').addEventListener('click', () => { show('cropModal', false); cropState = null; });

$('backBtn').addEventListener('click', () => {
  show('workspace', false);
  sourceImage = null;
});

// Brush
$('brushColor').addEventListener('input', (e) => {
  if (cropState) { cropState.brushColor = e.target.value; cropState.transparentBrush = false; }
});
$('brushToggle').addEventListener('click', () => {
  if (!cropState) return;
  cropState.transparentBrush = !cropState.transparentBrush;
  $('brushToggle').textContent = cropState.transparentBrush ? 'Transparent' : 'Paint';
});
$('autoBg').addEventListener('click', () => {
  if (!cropState) return;
  removeBackground(cropState.painted).then(img => {
    cropState.painted = img;
    const canvas = $('editorCanvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    toast('Background removed');
  });
});

['includeHat', 'useNearest'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('change', () => { if (sourceImage) generate(); });
});
['colorFormat', 'template'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('change', () => { if (grid) generate(); });
});

$('blockChar').addEventListener('change', () => {
  const b = $('blockChar').value;
  const bp = $('blockPreview');
  if (bp) bp.textContent = b;
  if (grid) generate();
});
['cmdName'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', () => { if (grid) generate(); });
});
['compact', 'transparentSpace', 'addReset'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('change', () => { if (grid) generate(); });
});

$('copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lastOutput); toast('Copied'); }
  catch { toast('Copy failed'); }
});
$('output').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lastOutput); toast('Copied'); }
  catch { toast('Copy failed'); }
});
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
$('downloadBtn').addEventListener('click', () => download(($('cmdName').value || 'pixelart') + '.sk', lastOutput, 'text/plain'));
$('downloadTxtBtn').addEventListener('click', () => download(($('cmdName').value || 'pixelart') + '.txt', lastOutput, 'text/plain'));
$('downloadSvgBtn').addEventListener('click', () => download(($('cmdName').value || 'pixelart') + '.svg', window._lastSvg || '', 'image/svg+xml'));

// ---------- Crop / pixel editor ----------
function openCrop(img) {
  const editorCanvas = $('editorCanvas');
  const ctx = editorCanvas.getContext('2d');
  const minDim = 320;
  const scale = Math.max(1, Math.ceil(minDim / Math.min(img.width, img.height)));
  const w = img.width * scale;
  const h = img.height * scale;
  editorCanvas.width = w;
  editorCanvas.height = h;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= img.width; i++) { ctx.beginPath(); ctx.moveTo(i * scale, 0); ctx.lineTo(i * scale, h); ctx.stroke(); }
  for (let i = 0; i <= img.height; i++) { ctx.beginPath(); ctx.moveTo(0, i * scale); ctx.lineTo(w, i * scale); ctx.stroke(); }
  cropState = { img, scale, w, h, x: 0, y: 0, size: Math.min(w, h) * 0.6, dragging: false, resizing: false, startX: 0, startY: 0, startBox: null, painted: makeCanvas(img.width, img.height), transparentBrush: true, brushColor: '#ff0000' };
  const pctx = cropState.painted.getContext('2d');
  pctx.drawImage(img, 0, 0);
  const size = Math.min(w, h) * 0.6;
  cropState.x = (w - size) / 2; cropState.y = (h - size) / 2; cropState.size = size;
  const cb = $('cropBox');
  cb.style.left = cropState.x + 'px'; cb.style.top = cropState.y + 'px';
  cb.style.width = cropState.size + 'px'; cb.style.height = cropState.size + 'px';
  const stage = $('cropStage');
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  attachCropEvents(editorCanvas);
  show('cropModal', true);
}

function attachCropEvents(canvas) {
  const cb = $('cropBox');
  cb.onmousedown = (e) => {
    if (e.target.classList.contains('crop-handle')) cropState.resizing = true;
    else cropState.dragging = true;
    cropState.startX = e.clientX;
    cropState.startY = e.clientY;
    cropState.startBox = { x: cropState.x, y: cropState.y, size: cropState.size };
    e.preventDefault(); e.stopPropagation();
  };
  const handle = cb.querySelector('.crop-handle');
  if (handle) handle.onmousedown = (e) => {
    cropState.resizing = true;
    cropState.startX = e.clientX;
    cropState.startY = e.clientY;
    cropState.startBox = { x: cropState.x, y: cropState.y, size: cropState.size };
    e.preventDefault(); e.stopPropagation();
  };
  window.onmousemove = (e) => {
    if (!cropState) return;
    if (cropState.dragging) {
      const dx = e.clientX - cropState.startX;
      const dy = e.clientY - cropState.startY;
      cropState.x = Math.max(0, Math.min(canvas.width - cropState.size, cropState.startBox.x + dx));
      cropState.y = Math.max(0, Math.min(canvas.height - cropState.size, cropState.startBox.y + dy));
      cb.style.left = cropState.x + 'px';
      cb.style.top = cropState.y + 'px';
    } else if (cropState.resizing) {
      const dx = e.clientX - cropState.startX;
      const dy = e.clientY - cropState.startY;
      const delta = Math.max(dx, dy);
      let newSize = cropState.startBox.size + delta;
      newSize = Math.max(20, Math.min(newSize, canvas.width - cropState.x, canvas.height - cropState.y));
      cropState.size = newSize;
      cb.style.width = cropState.size + 'px';
      cb.style.height = cropState.size + 'px';
    }
  };
  window.onmouseup = () => { if (cropState) { cropState.dragging = false; cropState.resizing = false; } };
  canvas.onmousedown = (e) => { cropState.painting = true; paintPixel(e, canvas); };
  canvas.onmousemove = (e) => { if (cropState && cropState.painting) paintPixel(e, canvas); };
  window.addEventListener('mouseup', () => { if (cropState) cropState.painting = false; });
}

function paintPixel(e, canvas) {
  if (!cropState) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cropState.scale);
  const y = Math.floor((e.clientY - rect.top) / cropState.scale);
  if (x < 0 || y < 0 || x >= cropState.img.width || y >= cropState.img.height) return;
  const pctx = cropState.painted.getContext('2d');
  if (cropState.transparentBrush) pctx.clearRect(x, y, 1, 1);
  else { pctx.fillStyle = cropState.brushColor; pctx.fillRect(x, y, 1, 1); }
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(cropState.painted, 0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= cropState.img.width; i++) { ctx.beginPath(); ctx.moveTo(i * cropState.scale, 0); ctx.lineTo(i * cropState.scale, canvas.height); ctx.stroke(); }
  for (let i = 0; i <= cropState.img.height; i++) { ctx.beginPath(); ctx.moveTo(0, i * cropState.scale); ctx.lineTo(canvas.width, i * cropState.scale); ctx.stroke(); }
}

function confirmCrop() {
  if (!cropState) {
    toast('No selection made.');
    return;
  }
  const img = cropState.painted;
  const ix = Math.round(cropState.x / cropState.scale);
  const iy = Math.round(cropState.y / cropState.scale);
  const is = Math.round(cropState.size / cropState.scale);
  const c = makeCanvas(is, is);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, ix, iy, is, is, 0, 0, is, is);
  const out = new Image();
  out.onload = async () => {
    try {
      let finalImg = out;
      const removeBgEl = $('removeBg');
      if (removeBgEl && removeBgEl.checked) finalImg = await removeBackground(finalImg);
      sourceImage = finalImg;
      isSkinMode = false;
      skinName = 'Edited image';
      skinUuid = 'crop';
      finishLoad();
      show('cropModal', false);
      cropState = null;
      toast('Image loaded.');
    } catch (e) {
      toast('Confirm failed: ' + e.message);
      console.error(e);
    }
  };
  out.onerror = () => toast('Image could not be processed.');
  out.src = c.toDataURL();
}