// VICE HEAT — Cover Studio: the page wiring.
//
// Holds the cover state (layout, grade, title, and one {photo, focus, zoom, tag} per
// panel), the photo filmstrip, the canvas interactions (click to select a panel, drag to
// pan its photo, scroll to zoom), Smart Frame, and the full-resolution exports. Photos are
// read locally and never uploaded. A `?shot=` query loads a fixed scene instead
// (./shots.js), for screenshots.
import {
  GRADES,
  LAYOUTS,
  clampFocus,
  computePanels,
  detectFaceFocus,
  drawCover,
  fitParams,
  hitPanel,
  layoutById,
} from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const status = $('status');

const SAMPLES = [
  { key: 'hero', label: 'Hero', file: 'samples/hero.jpg' },
  { key: 'driver', label: 'Driver', file: 'samples/driver.jpg' },
  { key: 'boat', label: 'Boat', file: 'samples/boat.jpg' },
];

const state = {
  layoutId: 'hero',
  gradeId: 'sunset',
  title: 'VICE HEAT',
  subtitle: 'WELCOME BACK TO VICE CITY',
  selected: 0,
  panels: Array.from({ length: 6 }, () => ({ photo: null, focus: { x: 0.5, y: 0.42 }, zoom: 1, tag: '' })),
};
state.panels[0].tag = 'LUCIA';
state.panels[1].tag = 'JASON';
state.panels[2].tag = 'THE GETAWAY';
state.panels[3].tag = 'VICE CITY';

const photos = []; // { id, name, img, url }
const sampleCache = new Map();
let photoSeq = 0;
let lastPanels = computePanels(layoutById(state.layoutId), canvas.width, canvas.height);

function setStatus(text) {
  status.textContent = text;
}

/** Loads an image from a URL, resolving once it can be drawn. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function render() {
  lastPanels = computePanels(layoutById(state.layoutId), canvas.width, canvas.height);
  drawCover(canvas, state, { preview: true, panels: lastPanels });
}

// ---------------------------------------------------------------------------
// Photos and the filmstrip.
// ---------------------------------------------------------------------------
function addPhoto(img, name, url) {
  const photo = { id: ++photoSeq, name, img, url };
  photos.push(photo);
  renderFilmstrip();
  return photo;
}

async function loadSample(key) {
  if (sampleCache.has(key)) return sampleCache.get(key);
  const sample = SAMPLES.find((s) => s.key === key);
  const img = await loadImage(sample.file);
  const photo = addPhoto(img, `Sample — ${sample.label}`, sample.file);
  sampleCache.set(key, photo);
  return photo;
}

function assignToSelected(photo) {
  state.panels[state.selected].photo = photo.img;
  renderFilmstrip();
  render();
}

function renderFilmstrip() {
  const strip = $('filmstrip');
  strip.replaceChildren();
  const selectedPhoto = state.panels[state.selected]?.photo;
  for (const photo of photos) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb' + (photo.img === selectedPhoto ? ' in-panel' : '');
    btn.title = `${photo.name} — click to place in the selected panel`;
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      assignToSelected(photo);
      setStatus(`${photo.name} placed in panel ${state.selected + 1}.`);
    });
    strip.appendChild(btn);
  }
}

async function addFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  let first = null;
  for (const file of images) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const photo = addPhoto(img, file.name, url);
    first ??= photo;
  }
  if (first) {
    assignToSelected(first);
    setStatus(`${images.length} photo${images.length === 1 ? '' : 's'} added — the first is in panel ${state.selected + 1}.`);
  }
}

$('file').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = '';
});

for (const btn of document.querySelectorAll('[data-sample]')) {
  btn.addEventListener('click', async () => {
    const photo = await loadSample(btn.dataset.sample);
    assignToSelected(photo);
    setStatus(`${photo.name} placed in panel ${state.selected + 1}.`);
  });
}

const stage = $('stage');
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  stage.classList.add('dragging');
});
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) stage.classList.remove('dragging');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  stage.classList.remove('dragging');
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
});

// ---------------------------------------------------------------------------
// Layout, grade and panel pickers.
// ---------------------------------------------------------------------------
function buildPickers() {
  const layoutsEl = $('layouts');
  layoutsEl.replaceChildren();
  for (const layout of LAYOUTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = layout.name;
    btn.className = layout.id === state.layoutId ? 'active' : '';
    btn.addEventListener('click', () => {
      state.layoutId = layout.id;
      state.selected = Math.min(state.selected, layout.panels.length - 1);
      buildPickers();
      syncPanelControls();
      render();
    });
    layoutsEl.appendChild(btn);
  }

  const gradesEl = $('grades');
  gradesEl.replaceChildren();
  for (const [id, grade] of Object.entries(GRADES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = id === state.gradeId ? 'active' : '';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = `linear-gradient(180deg, ${grade.stops.map((s) => s[1]).join(', ')})`;
    btn.append(swatch, document.createTextNode(grade.name));
    btn.addEventListener('click', () => {
      state.gradeId = id;
      buildPickers();
      render();
    });
    gradesEl.appendChild(btn);
  }

  const panelsEl = $('panelBtns');
  panelsEl.replaceChildren();
  const layout = layoutById(state.layoutId);
  layout.panels.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = i === state.selected ? 'active' : '';
    const tag = state.panels[i].tag.trim();
    btn.textContent = tag ? `Panel ${i + 1} · ${tag}` : `Panel ${i + 1}`;
    btn.addEventListener('click', () => selectPanel(i));
    panelsEl.appendChild(btn);
  });
}

function selectPanel(i) {
  state.selected = i;
  buildPickers();
  syncPanelControls();
  renderFilmstrip();
  render();
}

function syncPanelControls() {
  const panel = state.panels[state.selected];
  $('zoom').value = panel.zoom;
  $('zoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  $('tag').value = panel.tag;
}

$('zoom').addEventListener('input', (e) => {
  const panel = state.panels[state.selected];
  panel.zoom = Number(e.target.value);
  $('zoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  render();
});

$('tag').addEventListener('input', (e) => {
  state.panels[state.selected].tag = e.target.value;
  buildPickers();
  render();
});

$('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  render();
});

$('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  render();
});

// ---------------------------------------------------------------------------
// Smart frame: face-aware framing via detectFaceFocus().
// ---------------------------------------------------------------------------
function smartFrame(i) {
  const panel = state.panels[i];
  if (!panel.photo) return false;
  const layout = layoutById(state.layoutId);
  const info = computePanels(layout, canvas.width, canvas.height)[i];
  panel.focus = detectFaceFocus(panel.photo);
  panel.zoom = Math.max(panel.zoom, 1.2);
  panel.focus = clampFocus(panel.focus, info.fitBb, panel.photo, panel.zoom);
  return true;
}

$('smart').addEventListener('click', () => {
  if (smartFrame(state.selected)) {
    syncPanelControls();
    render();
    setStatus(`Smart frame centred the face in panel ${state.selected + 1}.`);
  } else {
    setStatus(`Panel ${state.selected + 1} has no photo to frame yet.`);
  }
});

$('smartAll').addEventListener('click', () => {
  const layout = layoutById(state.layoutId);
  let framed = 0;
  layout.panels.forEach((_, i) => {
    if (smartFrame(i)) framed++;
  });
  syncPanelControls();
  render();
  setStatus(framed ? `Smart frame centred ${framed} panel${framed === 1 ? '' : 's'}.` : 'No photos to frame yet.');
});

// ---------------------------------------------------------------------------
// Canvas interaction: click to select, drag to pan, scroll to zoom.
// ---------------------------------------------------------------------------
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  };
}

let drag = null;

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = hitPanel(layoutById(state.layoutId), canvas.width, canvas.height, p.x, p.y);
  if (hit >= 0 && hit !== state.selected) selectPanel(hit);
  drag = { x: p.x, y: p.y };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const dx = p.x - drag.x;
  const dy = p.y - drag.y;
  drag = p;
  const panel = state.panels[state.selected];
  if (!panel.photo || (dx === 0 && dy === 0)) return;
  const info = lastPanels[state.selected];
  const { dw, dh } = fitParams(info.fitBb, panel.photo, panel.focus, panel.zoom);
  panel.focus = clampFocus(
    { x: panel.focus.x - dx / dw, y: panel.focus.y - dy / dh },
    info.fitBb,
    panel.photo,
    panel.zoom,
  );
  render();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (e) => {
  const panel = state.panels[state.selected];
  if (!panel.photo) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.07 : 1 / 1.07;
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * factor));
  syncPanelControls();
  render();
}, { passive: false });

// ---------------------------------------------------------------------------
// Export: the same drawCover(), rendered offscreen at full resolution.
// ---------------------------------------------------------------------------
for (const btn of document.querySelectorAll('[data-export]')) {
  btn.addEventListener('click', () => {
    const [w, h] = btn.dataset.export.split('x').map(Number);
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    drawCover(off, state, { preview: false });
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-heat-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStatus(`Saved vice-heat-${w}x${h}.png`);
    }, 'image/png');
  });
}

// ---------------------------------------------------------------------------
// Scenes: a default studio scene, or a fixed one for screenshots.
// ---------------------------------------------------------------------------
async function applyScene(spec) {
  state.layoutId = spec.layout;
  state.gradeId = spec.grade;
  state.title = spec.title;
  state.subtitle = spec.subtitle;
  $('title').value = spec.title;
  $('subtitle').value = spec.subtitle;
  const loaded = [];
  for (const sample of SAMPLES) loaded.push(await loadSample(sample.key));
  const order = [loaded[0], loaded[1], loaded[2], loaded[0], loaded[1], loaded[2]];
  const layout = layoutById(state.layoutId);
  layout.panels.forEach((_, i) => {
    state.panels[i].photo = order[i].img;
  });
  state.selected = 0;
  buildPickers();
  syncPanelControls();
  renderFilmstrip();
  render();
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, applyScene);
} else {
  applyScene({
    layout: state.layoutId,
    grade: state.gradeId,
    title: state.title,
    subtitle: state.subtitle,
  });
}
