// VICE HEAT — cover rendering engine.
//
// Everything the poster is made of lives here: the six multi-panel layouts, the six colour
// grades, the striped-chrome title, the cast name tags, and the face-aware framing helper.
// drawCover() paints a whole cover onto any canvas at that canvas's own size, so the live
// preview and the full-resolution exports share exactly one code path. No network, no
// libraries: plain Canvas 2D.

// ---------------------------------------------------------------------------
// Grades: a canvas filter for the photo itself, one gradient overlay blended
// over it, and a vignette strength for the finished cover.
// ---------------------------------------------------------------------------
export const GRADES = {
  sunset: {
    name: 'Sunset',
    filter: 'saturate(1.28) contrast(1.06) sepia(0.22) brightness(1.03)',
    mode: 'overlay',
    stops: [[0, 'rgba(255, 138, 60, 0.10)'], [0.55, 'rgba(255, 84, 112, 0.28)'], [1, 'rgba(146, 32, 128, 0.42)']],
    vignette: 0.26,
  },
  neon: {
    name: 'Neon Nights',
    filter: 'saturate(1.5) contrast(1.16) brightness(0.96)',
    mode: 'overlay',
    stops: [[0, 'rgba(34, 211, 238, 0.34)'], [0.5, 'rgba(64, 40, 160, 0.18)'], [1, 'rgba(255, 46, 136, 0.40)']],
    vignette: 0.42,
  },
  golden: {
    name: 'Golden Hour',
    filter: 'sepia(0.34) saturate(1.22) contrast(1.04) brightness(1.06)',
    mode: 'soft-light',
    stops: [[0, 'rgba(255, 214, 120, 0.42)'], [0.6, 'rgba(255, 150, 60, 0.30)'], [1, 'rgba(120, 52, 20, 0.34)']],
    vignette: 0.2,
  },
  teal: {
    name: 'Teal Heat',
    filter: 'saturate(1.32) contrast(1.1) hue-rotate(-12deg)',
    mode: 'overlay',
    stops: [[0, 'rgba(20, 184, 166, 0.30)'], [0.55, 'rgba(12, 74, 110, 0.16)'], [1, 'rgba(255, 122, 40, 0.34)']],
    vignette: 0.3,
  },
  vice: {
    name: 'Vice Pink',
    filter: 'saturate(1.42) contrast(1.05) brightness(1.05)',
    mode: 'soft-light',
    stops: [[0, 'rgba(255, 170, 220, 0.34)'], [0.55, 'rgba(255, 80, 170, 0.30)'], [1, 'rgba(90, 30, 160, 0.36)']],
    vignette: 0.22,
  },
  noir: {
    name: 'Noir',
    filter: 'grayscale(1) contrast(1.28) brightness(0.96)',
    mode: 'overlay',
    stops: [[0, 'rgba(255, 255, 255, 0.10)'], [0.6, 'rgba(0, 0, 0, 0.12)'], [1, 'rgba(0, 0, 0, 0.42)']],
    vignette: 0.55,
  },
};

// ---------------------------------------------------------------------------
// Layouts. Panels are polygons in cover fractions (0..1 on both axes), so a
// layout adapts to any export aspect. `pop` on a panel is how far (in cover
// height) its photo spills above the panel's top edge in the pop-out pass.
// ---------------------------------------------------------------------------
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const F = 0.035; // frame inset
const TOP = 0.175; // first panel row (the title band lives above it)
const BOT = 0.925; // last panel row (the subtitle band lives below it)

export const LAYOUTS = [
  {
    id: 'hero',
    name: 'Hero Pop-Out',
    panels: [
      { poly: rect(F, TOP, 1 - F, 0.63), pop: 0.115 },
      { poly: rect(F, 0.655, 0.4925, BOT) },
      { poly: rect(0.5075, 0.655, 1 - F, BOT) },
    ],
  },
  {
    id: 'cast',
    name: 'Cast Grid',
    panels: [
      { poly: rect(F, TOP, 0.4925, 0.545) },
      { poly: rect(0.5075, TOP, 1 - F, 0.545) },
      { poly: rect(F, 0.555, 0.4925, BOT) },
      { poly: rect(0.5075, 0.555, 1 - F, BOT) },
    ],
  },
  {
    id: 'triptych',
    name: 'Triptych',
    panels: [
      { poly: [[F, TOP], [0.35, TOP], [0.35, BOT], [F, BOT]] },
      { poly: [[0.35, TOP], [0.70, TOP], [0.62, BOT], [0.35, BOT]] },
      { poly: [[0.70, TOP], [1 - F, TOP], [1 - F, BOT], [0.62, BOT]] },
    ],
  },
  {
    id: 'duo',
    name: 'Duo',
    panels: [
      { poly: rect(F, TOP, 0.4925, BOT) },
      { poly: rect(0.5075, TOP, 1 - F, BOT) },
    ],
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    panels: [
      { poly: rect(F, TOP, 1 - F, 0.56) },
      { poly: rect(F, 0.585, 0.335, BOT) },
      { poly: rect(0.35, 0.585, 0.65, BOT) },
      { poly: rect(0.665, 0.585, 1 - F, BOT) },
    ],
  },
  {
    id: 'billboard',
    name: 'Billboard',
    panels: [{ poly: rect(0.02, 0.02, 0.98, 0.98) }],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

// ---------------------------------------------------------------------------
// Geometry helpers (pixel space).
// ---------------------------------------------------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function pathPoly(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function bboxOf(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Shrinks a polygon toward its centroid by `d` pixels — the photo window inside the white border. */
function insetPoly(poly, d) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => {
    const dx = cx - x;
    const dy = cy - y;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * d, y + (dy / len) * d];
  });
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Resolves a layout to pixel geometry for a W x H canvas: for each panel its outer polygon,
 * the inner photo window, the fit box the photo is composed against (extended upward for a
 * pop-out panel), and the pop-out polygon when the layout has one.
 */
export function computePanels(layout, W, H) {
  const border = Math.max(3, Math.round(W * 0.007));
  return layout.panels.map((panel) => {
    const poly = panel.poly.map(([x, y]) => [x * W, y * H]);
    const inner = insetPoly(poly, border);
    const bb = bboxOf(inner);
    let popPoly = null;
    let popBb = null;
    if (panel.pop) {
      popPoly = insetPoly(poly.map(([x, y]) => [x, y - panel.pop * H]), border);
      popBb = bboxOf(popPoly);
    }
    return { poly, inner, bb, fitBb: popBb ?? bb, popPoly, popBb, border };
  });
}

/** Which panel (if any) contains the canvas point — a pop-out spill counts as its panel. */
export function hitPanel(layout, W, H, x, y) {
  const panels = computePanels(layout, W, H);
  for (let i = panels.length - 1; i >= 0; i--) {
    if (panels[i].popPoly && pointInPoly(x, y, panels[i].popPoly)) return i;
    if (pointInPoly(x, y, panels[i].poly)) return i;
  }
  return -1;
}

/**
 * Cover-fit maths: how big `img` is drawn against box `bb` at `zoom`, and where its top-left
 * lands when `focus` (a 0..1 point of the photo) is centred — clamped so the photo always
 * covers the box.
 */
export function fitParams(bb, img, focus, zoom) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(bb.w / iw, bb.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const ox = clamp(bb.x + bb.w / 2 - focus.x * dw, bb.x + bb.w - dw, bb.x);
  const oy = clamp(bb.y + bb.h / 2 - focus.y * dh, bb.y + bb.h - dh, bb.y);
  return { dw, dh, ox, oy };
}

/** Keeps a focus point inside the range where the photo still covers box `bb`. */
export function clampFocus(focus, bb, img, zoom) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(bb.w / iw, bb.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  return {
    x: dw > bb.w ? clamp(focus.x, (bb.w / 2) / dw, 1 - (bb.w / 2) / dw) : 0.5,
    y: dh > bb.h ? clamp(focus.y, (bb.h / 2) / dh, 1 - (bb.h / 2) / dh) : 0.5,
  };
}

// ---------------------------------------------------------------------------
// Face-aware framing. The photo is downscaled to a strip and scanned for a
// skin-tone cluster in its upper two-thirds; the cluster's centroid is the
// point Smart Frame centres in the panel. Falls back to a classic
// rule-of-thirds point when no convincing skin cluster shows up.
// ---------------------------------------------------------------------------
function isSkinTone(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12 && max - min > 15 && max - min < 130;
}

export function detectFaceFocus(image) {
  const fallback = { x: 0.5, y: 0.38 };
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return fallback;
  const w = 96;
  const h = Math.max(1, Math.round((w * ih) / iw));
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return fallback;
  }
  const yMax = Math.floor((h * 2) / 3);
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < yMax; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isSkinTone(data[i], data[i + 1], data[i + 2])) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  if (n < w * h * 0.004) return fallback;
  return { x: (sx / n + 0.5) / w, y: (sy / n + 0.5) / h };
}

// ---------------------------------------------------------------------------
// Painting.
// ---------------------------------------------------------------------------
function drawPhoto(ctx, img, bb, panelState, grade) {
  const { dw, dh, ox, oy } = fitParams(bb, img, panelState.focus, panelState.zoom);
  ctx.save();
  try {
    ctx.filter = grade.filter;
  } catch {
    /* a browser without canvas filters just skips the filter pass */
  }
  ctx.drawImage(img, ox, oy, dw, dh);
  ctx.restore();
}

function applyGradeOverlay(ctx, bb, grade) {
  ctx.save();
  ctx.globalCompositeOperation = grade.mode;
  const g = ctx.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
  for (const [off, col] of grade.stops) g.addColorStop(off, col);
  ctx.fillStyle = g;
  ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  ctx.restore();
}

function drawTag(ctx, panel, text, H) {
  const tag = (text ?? '').trim().toUpperCase();
  if (!tag) return;
  const size = Math.max(11, H * 0.021);
  ctx.save();
  ctx.font = `800 ${size}px Arial, sans-serif`;
  const w = ctx.measureText(tag).width;
  const padX = size * 0.55;
  const x = panel.bb.x + size * 0.6;
  const y = panel.bb.y + panel.bb.h - size * 0.6;
  ctx.fillStyle = 'rgba(5, 5, 10, 0.74)';
  ctx.beginPath();
  ctx.roundRect(x - padX, y - size - size * 0.32, w + padX * 2, size * 1.55, size * 0.28);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(tag, x, y);
  ctx.restore();
}

function drawPanel(ctx, info, panelState, grade, H) {
  // White border first, then the photo clipped into the window inside it.
  pathPoly(ctx, info.poly);
  ctx.fillStyle = '#f4f1ea';
  ctx.fill();
  if (!panelState.photo) {
    pathPoly(ctx, info.inner);
    ctx.fillStyle = '#191922';
    ctx.fill();
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `600 ${Math.max(12, H * 0.02)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', info.bb.x + info.bb.w / 2, info.bb.y + info.bb.h / 2);
    ctx.restore();
    return;
  }
  ctx.save();
  pathPoly(ctx, info.inner);
  ctx.clip();
  drawPhoto(ctx, panelState.photo, info.fitBb, panelState, grade);
  applyGradeOverlay(ctx, info.fitBb, grade);
  ctx.restore();
  drawTag(ctx, info, panelState.tag, H);
}

/** The pop-out pass: the hero photo again, above its panel's top edge, over the frame. */
function drawPopOut(ctx, info, panelState, grade, H) {
  if (!info.popPoly || !panelState.photo) return;
  ctx.save();
  ctx.translate(0, H * 0.014);
  pathPoly(ctx, info.popPoly);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  ctx.restore();
  ctx.save();
  pathPoly(ctx, info.popPoly);
  ctx.clip();
  drawPhoto(ctx, panelState.photo, info.fitBb, panelState, grade);
  applyGradeOverlay(ctx, info.fitBb, grade);
  ctx.restore();
}

// The striped chrome the title is filled with: hard horizontal colour bands,
// polished metal at the top melting through sunset stripes into neon.
const CHROME_BANDS = [
  [0.0, '#f8fafc'], [0.16, '#f8fafc'], [0.21, '#9fb3c8'], [0.27, '#ffe259'],
  [0.41, '#ffa751'], [0.53, '#ff5e62'], [0.65, '#ff2e88'], [0.77, '#7b2ff7'],
  [0.89, '#22d3ee'], [1.0, '#b3f0ff'],
];

function drawTitle(ctx, state, layout, W, H) {
  const title = (state.title ?? '').trim().toUpperCase();
  const billboard = layout.id === 'billboard';
  if (billboard) {
    const shade = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H * 0.3);
  }
  if (title) {
    let size = H * (billboard ? 0.13 : 0.115);
    const setFont = () => {
      ctx.font = `900 ${size}px "Arial Narrow", "Liberation Sans Narrow", Impact, sans-serif`;
    };
    setFont();
    while (ctx.measureText(title).width > W * 0.94 && size > 14) {
      size -= 2;
      setFont();
    }
    const cy = H * (billboard ? 0.145 : 0.092);
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.transform(1, 0, -0.07, 1, 0, 0); // the slight italic skew
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.1;
    ctx.shadowOffsetY = size * 0.05;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.17;
    ctx.strokeStyle = '#07070c';
    ctx.strokeText(title, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const grad = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
    for (const [off, col] of CHROME_BANDS) grad.addColorStop(off, col);
    ctx.fillStyle = grad;
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  if (subtitle) {
    const size = H * (billboard ? 0.03 : 0.027);
    ctx.save();
    ctx.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(size * 0.42)}px`;
    } catch {
      /* letterSpacing is a progressive enhancement */
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = size * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subtitle, W / 2, H * (billboard ? 0.935 : 0.963));
    ctx.restore();
  }
}

/**
 * Paints the whole cover described by `state` onto `canvas` at the canvas's own size.
 * state: { layoutId, gradeId, title, subtitle, selected, panels: [{photo, focus, zoom, tag}] }
 * opts.preview draws the editor-only selection outline; exports leave it off.
 */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const layout = layoutById(state.layoutId);
  const grade = GRADES[state.gradeId] ?? GRADES.sunset;
  const panels = opts.panels ?? computePanels(layout, W, H);

  ctx.fillStyle = '#060609';
  ctx.fillRect(0, 0, W, H);

  panels.forEach((info, i) => drawPanel(ctx, info, state.panels[i], grade, H));
  panels.forEach((info, i) => drawPopOut(ctx, info, state.panels[i], grade, H));

  if (grade.vignette > 0) {
    const r = Math.hypot(W, H) / 2;
    const v = ctx.createRadialGradient(W / 2, H / 2, r * 0.52, W / 2, H / 2, r * 1.02);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, `rgba(0, 0, 0, ${grade.vignette})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  drawTitle(ctx, state, layout, W, H);

  if (opts.preview && panels[state.selected]) {
    ctx.save();
    pathPoly(ctx, panels[state.selected].poly);
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(2, W * 0.0035);
    ctx.setLineDash([W * 0.012, W * 0.008]);
    ctx.stroke();
    ctx.restore();
  }
}
