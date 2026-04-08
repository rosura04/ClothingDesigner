const draftCanvas = document.getElementById("draftCanvas");
const draftCtx = draftCanvas.getContext("2d");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const patternOutput = document.getElementById("patternOutput");

const controls = {
  baseColor: document.getElementById("baseColor"),
  accentColor: document.getElementById("accentColor"),
  measureBust: document.getElementById("measureBust"),
  measureWaist: document.getElementById("measureWaist"),
  measureHips: document.getElementById("measureHips"),
  applyMeasurementsBtn: document.getElementById("applyMeasurementsBtn"),
  seamAllowance: document.getElementById("seamAllowance"),
  sleeveLength: document.getElementById("sleeveLength"),
  shapeSelect: document.getElementById("shapeSelect"),
  layerNameInput: document.getElementById("layerNameInput"),
  addShapeBtn: document.getElementById("addShapeBtn"),
  addDetailBtn: document.getElementById("addDetailBtn"),
  deleteLayerBtn: document.getElementById("deleteLayerBtn"),
  addPointBtn: document.getElementById("addPointBtn"),
  removePointBtn: document.getElementById("removePointBtn"),
  generatePatternBtn: document.getElementById("generatePatternBtn"),
  downloadPreviewBtn: document.getElementById("downloadPreviewBtn"),
  downloadPatternBtn: document.getElementById("downloadPatternBtn"),
  resetShapeBtn: document.getElementById("resetShapeBtn"),
  openPatternDesignerBtn: document.getElementById("openPatternDesignerBtn"),
  closePatternDesignerBtn: document.getElementById("closePatternDesignerBtn"),
  uploadPatternBtn: document.getElementById("uploadPatternBtn"),
  patternImageInput: document.getElementById("patternImageInput"),
  clearPatternBtn: document.getElementById("clearPatternBtn"),
  applyDrawnPatternBtn: document.getElementById("applyDrawnPatternBtn"),
  patternStatus: document.getElementById("patternStatus"),
  patternDesignerModal: document.getElementById("patternDesignerModal"),
  patternDrawCanvas: document.getElementById("patternDrawCanvas"),
  patternBrushBtn: document.getElementById("patternBrushBtn"),
  patternEraserBtn: document.getElementById("patternEraserBtn"),
  patternBrushColor: document.getElementById("patternBrushColor"),
  patternBrushSize: document.getElementById("patternBrushSize"),
  clearPatternDrawBtn: document.getElementById("clearPatternDrawBtn"),
  savePatternDrawBtn: document.getElementById("savePatternDrawBtn")
};

const patternDrawCtx = controls.patternDrawCanvas.getContext("2d");

/** Draft-space outline from body measurements (cm). Half-width scales with each circumference. */
function measureProportionalShape(bustCm, waistCm, hipCm) {
  const cx = 450;
  const k = 2.55;
  const hb = Math.max(45, (bustCm / 2) * k);
  const hw = Math.max(38, (waistCm / 2) * k);
  const hh = Math.max(45, (hipCm / 2) * k);
  const yNeck = 140;
  const yBust = 285;
  const yWaist = 485;
  const yHem = 768;
  const neck = Math.min(60, hb * 0.34);
  return [
    { x: cx - neck, y: yNeck + 48 },
    { x: cx - hb, y: yBust },
    { x: cx - hw * 0.97, y: yWaist },
    { x: cx - hh * 0.91, y: yHem },
    { x: cx + hh * 0.91, y: yHem },
    { x: cx + hw * 0.97, y: yWaist },
    { x: cx + hb, y: yBust },
    { x: cx + neck, y: yNeck + 48 }
  ];
}

function defaultMainShapePoints() {
  return measureProportionalShape(90, 75, 100);
}

function defaultOverlayShapePoints() {
  const cx = 450;
  const cy = 520;
  const s = 55;
  return [
    { x: cx - s, y: cy - s * 0.6 },
    { x: cx + s, y: cy - s * 0.6 },
    { x: cx + s, y: cy + s * 0.6 },
    { x: cx - s, y: cy + s * 0.6 }
  ];
}

/** Editable sleeve pieces in flat-draft space (left and right of torso). */
function defaultLeftSleevePoints() {
  return [
    { x: 95, y: 230 },
    { x: 265, y: 230 },
    { x: 248, y: 430 },
    { x: 112, y: 430 }
  ];
}

function defaultRightSleevePoints() {
  return [
    { x: 635, y: 230 },
    { x: 805, y: 230 },
    { x: 788, y: 430 },
    { x: 652, y: 430 }
  ];
}

function createDefaultShapes() {
  return [
    { id: "main", kind: "main", name: "Main garment", points: defaultMainShapePoints() },
    { id: "sleeveL", kind: "sleeve", name: "Sleeve (left)", points: defaultLeftSleevePoints() },
    { id: "sleeveR", kind: "sleeve", name: "Sleeve (right)", points: defaultRightSleevePoints() }
  ];
}

let overlayIdCounter = 0;

const state = {
  shapes: createDefaultShapes(),
  activeShapeIndex: 0,
  draggingShapeIndex: -1,
  draggingIndex: -1,
  dragMode: null,
  shapeDragLast: null,
  selectedPointIndex: -1,
  rotatePrevAngle: null,
  resizeCorner: null,
  resizeSnapshot: null,
  lastPatternSVG: "",
  fillPatternImage: null,
  fillPatternLabel: "default stripe overlay",
  drawingPattern: false,
  patternTool: "brush"
};

function initPatternDrawCanvas() {
  patternDrawCtx.fillStyle = "#ffffff";
  patternDrawCtx.fillRect(0, 0, controls.patternDrawCanvas.width, controls.patternDrawCanvas.height);
  patternDrawCtx.strokeStyle = "#e2e8f0";
  for (let x = 0; x <= controls.patternDrawCanvas.width; x += 32) {
    patternDrawCtx.beginPath();
    patternDrawCtx.moveTo(x, 0);
    patternDrawCtx.lineTo(x, controls.patternDrawCanvas.height);
    patternDrawCtx.stroke();
  }
  for (let y = 0; y <= controls.patternDrawCanvas.height; y += 32) {
    patternDrawCtx.beginPath();
    patternDrawCtx.moveTo(0, y);
    patternDrawCtx.lineTo(controls.patternDrawCanvas.width, y);
    patternDrawCtx.stroke();
  }
}

function getCanvasPoint(canvas, event) {
  const r = canvas.getBoundingClientRect();
  const x = ((event.clientX - r.left) / r.width) * canvas.width;
  const y = ((event.clientY - r.top) / r.height) * canvas.height;
  return { x, y };
}

function polygonPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function getMainShape() {
  return state.shapes.find((s) => s.kind === "main");
}

function shapeLabelEntry(sh, index) {
  if (sh.kind === "main") return `Shape ${index + 1} (main garment)`;
  if (sh.id === "sleeveL") return `Shape ${index + 1} (sleeve left)`;
  if (sh.id === "sleeveR") return `Shape ${index + 1} (sleeve right)`;
  if (sh.kind === "detail") return `Shape ${index + 1} (detail)`;
  if (sh.kind === "overlay") return `Shape ${index + 1} (layer)`;
  return `Shape ${index + 1}`;
}

function isPolylineDetail(sh) {
  return sh.kind === "detail" && sh.points.length === 2 && !sh.closed;
}

function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny);
}

function centroidOf(points) {
  let sx = 0;
  let sy = 0;
  points.forEach((p) => {
    sx += p.x;
    sy += p.y;
  });
  return { x: sx / points.length, y: sy / points.length };
}

function minPointsForShape(sh) {
  if (sh.kind === "detail") return 2;
  return 4;
}

function rotatePointsAround(points, cx, cy, deltaRad) {
  const cos = Math.cos(deltaRad);
  const sin = Math.sin(deltaRad);
  points.forEach((p) => {
    const x = p.x - cx;
    const y = p.y - cy;
    p.x = cx + x * cos - y * sin;
    p.y = cy + x * sin + y * cos;
  });
}

function snapshotPoints(pts) {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

function getHandlePositions(bb) {
  const { minX, maxX, minY, maxY } = bb;
  const pad = 32;
  return {
    rotate: { x: (minX + maxX) / 2, y: minY - pad },
    nw: { x: minX, y: minY },
    ne: { x: maxX, y: minY },
    sw: { x: minX, y: maxY },
    se: { x: maxX, y: maxY }
  };
}

function dist2(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function hitTestTransformHandles(pos) {
  const sh = state.shapes[state.activeShapeIndex];
  if (!sh || sh.points.length < 2) return null;
  const bb = bboxOf(sh.points);
  const h = getHandlePositions(bb);
  if (dist2(pos.x, pos.y, h.rotate.x, h.rotate.y) < 16) return { type: "rotate" };
  const corners = ["nw", "ne", "sw", "se"];
  for (let i = 0; i < corners.length; i += 1) {
    const k = corners[i];
    if (dist2(pos.x, pos.y, h[k].x, h[k].y) < 14) return { type: "resize", corner: k };
  }
  return null;
}

function applyResizeFromSnapshot(sh, snapPts, bb0, corner, pos) {
  const nw = { x: bb0.minX, y: bb0.minY };
  const se = { x: bb0.maxX, y: bb0.maxY };
  const ne = { x: bb0.maxX, y: bb0.minY };
  const sw = { x: bb0.minX, y: bb0.maxY };
  const w0 = Math.max(1e-6, bb0.maxX - bb0.minX);
  const h0 = Math.max(1e-6, bb0.maxY - bb0.minY);
  let sx;
  let sy;
  let ax;
  let ay;
  if (corner === "se") {
    ax = nw.x;
    ay = nw.y;
    sx = Math.max(0.05, (pos.x - nw.x) / w0);
    sy = Math.max(0.05, (pos.y - nw.y) / h0);
  } else if (corner === "nw") {
    ax = se.x;
    ay = se.y;
    sx = Math.max(0.05, (se.x - pos.x) / w0);
    sy = Math.max(0.05, (se.y - pos.y) / h0);
  } else if (corner === "ne") {
    ax = sw.x;
    ay = sw.y;
    sx = Math.max(0.05, (pos.x - sw.x) / w0);
    sy = Math.max(0.05, (sw.y - pos.y) / h0);
  } else {
    ax = ne.x;
    ay = ne.y;
    sx = Math.max(0.05, (ne.x - pos.x) / w0);
    sy = Math.max(0.05, (pos.y - ne.y) / h0);
  }
  snapPts.forEach((sp, i) => {
    sh.points[i].x = ax + (sp.x - ax) * sx;
    sh.points[i].y = ay + (sp.y - ay) * sy;
  });
}

function drawTransformHandles() {
  const sh = state.shapes[state.activeShapeIndex];
  if (!sh || sh.points.length < 2) return;
  const bb = bboxOf(sh.points);
  const { minX, maxX, minY, maxY } = bb;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 1 && h < 1) return;
  const hp = getHandlePositions(bb);
  draftCtx.save();
  draftCtx.strokeStyle = "rgba(34, 211, 238, 0.85)";
  draftCtx.lineWidth = 1.5;
  draftCtx.setLineDash([7, 5]);
  draftCtx.strokeRect(minX, minY, w, h);
  draftCtx.setLineDash([]);
  draftCtx.beginPath();
  draftCtx.moveTo((minX + maxX) / 2, minY);
  draftCtx.lineTo(hp.rotate.x, hp.rotate.y);
  draftCtx.strokeStyle = "#94a3b8";
  draftCtx.stroke();
  draftCtx.beginPath();
  draftCtx.arc(hp.rotate.x, hp.rotate.y, 9, 0, Math.PI * 2);
  draftCtx.fillStyle = "#38bdf8";
  draftCtx.fill();
  draftCtx.strokeStyle = "#0f172a";
  draftCtx.lineWidth = 1.5;
  draftCtx.stroke();
  ["nw", "ne", "sw", "se"].forEach((k) => {
    const p = hp[k];
    draftCtx.fillStyle = "#f8fafc";
    draftCtx.fillRect(p.x - 6, p.y - 6, 12, 12);
    draftCtx.strokeStyle = "#22d3ee";
    draftCtx.strokeRect(p.x - 6, p.y - 6, 12, 12);
  });
  draftCtx.restore();
}

function displayNameForShape(sh, index) {
  if (sh.name && String(sh.name).trim()) return String(sh.name).trim();
  return shapeLabelEntry(sh, index);
}

function drawDraftGrid() {
  draftCtx.clearRect(0, 0, draftCanvas.width, draftCanvas.height);
  draftCtx.fillStyle = "#0a1222";
  draftCtx.fillRect(0, 0, draftCanvas.width, draftCanvas.height);

  draftCtx.strokeStyle = "#1e293b";
  draftCtx.lineWidth = 1;
  for (let x = 0; x <= draftCanvas.width; x += 45) {
    draftCtx.beginPath();
    draftCtx.moveTo(x, 0);
    draftCtx.lineTo(x, draftCanvas.height);
    draftCtx.stroke();
  }
  for (let y = 0; y <= draftCanvas.height; y += 45) {
    draftCtx.beginPath();
    draftCtx.moveTo(0, y);
    draftCtx.lineTo(draftCanvas.width, y);
    draftCtx.stroke();
  }
}

function getDraftBounds() {
  const all = [];
  state.shapes.forEach((sh) => {
    sh.points.forEach((p) => all.push(p));
  });
  if (all.length === 0) {
    return { minX: 0, minY: 0, maxX: 900, maxY: 900, w: 900, h: 900 };
  }
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  return {
    minX,
    maxX,
    minY,
    maxY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY)
  };
}

function getMainDraftBounds() {
  const main = getMainShape();
  if (!main || main.points.length === 0) return getDraftBounds();
  const pts = main.points;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  return {
    minX,
    maxX,
    minY,
    maxY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY)
  };
}

function getDraftToPreviewTransform() {
  const { minX, minY, w, h } = getMainDraftBounds();
  const targetW = 560;
  const targetH = 760;
  const scale = Math.min(targetW / w, targetH / h);
  const offsetX = (previewCanvas.width - w * scale) / 2 - minX * scale;
  const offsetY = 220 - minY * scale;
  return { scale, offsetX, offsetY };
}

function scaleShapeToPreview(points) {
  const t = getDraftToPreviewTransform();
  return points.map((p) => ({ x: p.x * t.scale + t.offsetX, y: p.y * t.scale + t.offsetY }));
}

function drawDraftShape() {
  drawDraftGrid();
  for (let si = 0; si < state.shapes.length; si += 1) {
    const sh = state.shapes[si];
    const pts = sh.points;
    const isActive = si === state.activeShapeIndex;
    if (isPolylineDetail(sh)) {
      draftCtx.beginPath();
      draftCtx.moveTo(pts[0].x, pts[0].y);
      draftCtx.lineTo(pts[1].x, pts[1].y);
      draftCtx.strokeStyle = isActive ? "#cbd5e1" : "#64748b";
      draftCtx.lineWidth = isActive ? 4 : 3;
      draftCtx.stroke();
    } else {
      polygonPath(draftCtx, pts);
      draftCtx.fillStyle = isActive ? "rgba(79, 70, 229, 0.3)" : "rgba(148, 163, 184, 0.16)";
      draftCtx.strokeStyle = isActive ? "#cbd5e1" : "#64748b";
      draftCtx.lineWidth = isActive ? 2.5 : 1.8;
      draftCtx.fill();
      draftCtx.stroke();
    }
  }
  for (let si = 0; si < state.shapes.length; si += 1) {
    const pts = state.shapes[si].points;
    const isActive = si === state.activeShapeIndex;
    const r = isActive ? 8 : 6;
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      draftCtx.beginPath();
      draftCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
      let fill;
      if (isActive && i === state.selectedPointIndex) fill = "#f59e0b";
      else if (isActive) fill = "#f8fafc";
      else fill = "#94a3b8";
      draftCtx.fillStyle = fill;
      draftCtx.fill();
      draftCtx.strokeStyle = "#0f172a";
      draftCtx.lineWidth = 2;
      draftCtx.stroke();
    }
  }
  drawTransformHandles();
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const bg = previewCtx.createLinearGradient(0, 0, 0, previewCanvas.height);
  bg.addColorStop(0, "#0b1222");
  bg.addColorStop(1, "#0a101d");
  previewCtx.fillStyle = bg;
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  previewCtx.strokeStyle = "#94a3b8";
  previewCtx.lineWidth = 2;
  previewCtx.beginPath();
  previewCtx.arc(450, 130, 70, 0, Math.PI * 2);
  previewCtx.stroke();

  for (let si = 0; si < state.shapes.length; si += 1) {
    const sh = state.shapes[si];
    const p = scaleShapeToPreview(sh.points);
    if (isPolylineDetail(sh)) {
      previewCtx.beginPath();
      previewCtx.moveTo(p[0].x, p[0].y);
      previewCtx.lineTo(p[1].x, p[1].y);
      previewCtx.strokeStyle = controls.accentColor.value;
      previewCtx.lineWidth = 5;
      previewCtx.globalAlpha = 0.95;
      previewCtx.stroke();
      previewCtx.globalAlpha = 1;
      continue;
    }
    polygonPath(previewCtx, p);
    previewCtx.fillStyle = controls.baseColor.value;
    previewCtx.strokeStyle = "#e2e8f0";
    previewCtx.lineWidth = 3;
    previewCtx.globalAlpha = sh.kind === "main" ? 1 : sh.kind === "sleeve" ? 0.88 : 0.9;
    previewCtx.fill();
    previewCtx.stroke();
    previewCtx.globalAlpha = 1;

    previewCtx.save();
    polygonPath(previewCtx, p);
    previewCtx.clip();
    if (state.fillPatternImage) {
      const pattern = previewCtx.createPattern(state.fillPatternImage, "repeat");
      if (pattern) {
        previewCtx.globalAlpha = 0.45;
        previewCtx.fillStyle = pattern;
        previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
    } else {
      previewCtx.globalAlpha = 0.25;
      previewCtx.strokeStyle = controls.accentColor.value;
      previewCtx.lineWidth = 2;
      for (let x = 120; x < 830; x += 30) {
        previewCtx.beginPath();
        previewCtx.moveTo(x, 160);
        previewCtx.lineTo(x + 90, 1040);
        previewCtx.stroke();
      }
    }
    previewCtx.restore();
  }

  const b = Number(controls.measureBust.value) || 0;
  const w = Number(controls.measureWaist.value) || 0;
  const h = Number(controls.measureHips.value) || 0;
  previewCtx.font = "14px Inter, Arial, sans-serif";
  previewCtx.fillStyle = "#64748b";
  previewCtx.textAlign = "left";
  previewCtx.fillText(`Proportions (cm): bust ${b} / waist ${w} / hips ${h}`, 24, previewCanvas.height - 28);
}

function seamOffset(points, amountPx) {
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * amountPx, y: p.y + (dy / len) * amountPx };
  });
}

function pointsToPathData(points, moveX = 0, moveY = 0) {
  return points.map((pt, i) => `${i === 0 ? "M" : "L"} ${Math.round(pt.x + moveX)} ${Math.round(pt.y + moveY)}`).join(" ") + " Z";
}

function pointsToOpenPathData(points, moveX = 0, moveY = 0) {
  return points.map((pt, i) => `${i === 0 ? "M" : "L"} ${Math.round(pt.x + moveX)} ${Math.round(pt.y + moveY)}`).join(" ");
}

function shapeFrontBack(pts) {
  const front = pts.map((p) => ({ ...p }));
  const minX = Math.min(...front.map((p) => p.x));
  const maxX = Math.max(...front.map((p) => p.x));
  const minY = Math.min(...front.map((p) => p.y));
  const maxY = Math.max(...front.map((p) => p.y));
  const height = maxY - minY;
  const back = front.map((p) => ({ x: maxX - (p.x - minX), y: p.y }));
  return { front, back, minX, minY, height };
}

function bboxOf(pts) {
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

function generatePattern() {
  const seamCm = Math.max(0, Number(controls.seamAllowance.value) || 0);
  const sleeveFactor = Number(controls.sleeveLength.value) / 100;
  const pxPerCm = 12;
  const seamPx = seamCm * pxPerCm;

  const mainShape = getMainShape();
  if (!mainShape) return;

  const main = shapeFrontBack(mainShape.points);
  const front0 = main.front;
  const front0Cut = seamOffset(front0, seamPx);
  const back0 = main.back;
  const back0Cut = seamOffset(back0, seamPx);
  const width = Math.max(...front0.map((p) => p.x)) - main.minX;
  const height0 = main.height;

  const sleeveL = state.shapes.find((s) => s.id === "sleeveL");
  const sleeveR = state.shapes.find((s) => s.id === "sleeveR");

  let sleeveBlocks = "";
  let sleeveColumnY = 200;
  let sleeveStackBottom = 450;
  if (sleeveL && sleeveR) {
    const lPts = sleeveL.points;
    const rPts = sleeveR.points;
    const lCut = seamOffset(lPts, seamPx);
    const rCut = seamOffset(rPts, seamPx);
    const lb = bboxOf(lPts);
    const rb = bboxOf(rPts);
    sleeveBlocks += `
  <g transform="translate(1110,${sleeveColumnY})">
    <path d="${pointsToPathData(lCut, -lb.minX + 10, -lb.minY + 10)}" fill="#fef3c7" stroke="#1f2937" stroke-width="2"/>
    <path d="${pointsToPathData(lPts, -lb.minX + 10, -lb.minY + 10)}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="0" y="${Math.round(lb.h + 40)}" font-size="18" font-family="Arial" fill="#111827">Sleeve left (from draft)</text>
  </g>`;
    sleeveColumnY += lb.h + 80;
    sleeveBlocks += `
  <g transform="translate(1110,${sleeveColumnY})">
    <path d="${pointsToPathData(rCut, -rb.minX + 10, -rb.minY + 10)}" fill="#fef9c3" stroke="#1f2937" stroke-width="2"/>
    <path d="${pointsToPathData(rPts, -rb.minX + 10, -rb.minY + 10)}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="0" y="${Math.round(rb.h + 40)}" font-size="18" font-family="Arial" fill="#111827">Sleeve right (from draft)</text>
  </g>`;
    sleeveStackBottom = sleeveColumnY + rb.h + 60;
  } else {
    const sleeveW = Math.max(120, width * 0.45);
    const sleeveH = Math.max(120, height0 * sleeveFactor);
    const sleeve = [
      { x: 0, y: 0 },
      { x: sleeveW, y: 0 },
      { x: sleeveW * 0.92, y: sleeveH },
      { x: sleeveW * 0.08, y: sleeveH }
    ];
    const sleeveCut = seamOffset(sleeve, seamPx);
    sleeveStackBottom = 200 + sleeveH + 80;
    sleeveBlocks = `
  <g transform="translate(1110,200)">
    <path d="${pointsToPathData(sleeveCut, 0, 0)}" fill="#fef3c7" stroke="#1f2937" stroke-width="2"/>
    <path d="${pointsToPathData(sleeve, 0, 0)}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="0" y="${Math.round(sleeveH + 45)}" font-size="20" font-family="Arial" fill="#111827">Sleeve (auto - add both sleeve shapes in app for custom)</text>
  </g>`;
  }

  const layerColors = ["#eef2ff", "#ecfeff", "#f0fdf4", "#fef3c7", "#fce7f3", "#e0f2fe"];
  const extraRows = [];
  let rowY = 120 + height0 + 70;
  let layerNum = 0;
  for (let i = 0; i < state.shapes.length; i += 1) {
    const sh = state.shapes[i];
    if (sh.kind !== "overlay") continue;
    layerNum += 1;
    const sb = shapeFrontBack(sh.points);
    const f = sb.front;
    const fCut = seamOffset(f, seamPx);
    const b = sb.back;
    const bCut = seamOffset(b, seamPx);
    const fill = layerColors[(layerNum + 1) % layerColors.length];
    const fill2 = layerColors[(layerNum + 2) % layerColors.length];
    extraRows.push(`
  <g transform="translate(60,${rowY})">
    <path d="${pointsToPathData(fCut, -sb.minX + 10, -sb.minY + 10)}" fill="${fill}" stroke="#1f2937" stroke-width="2"/>
    <path d="${pointsToPathData(f, -sb.minX + 10, -sb.minY + 10)}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="10" y="${Math.round(sb.height + 45)}" font-size="18" font-family="Arial" fill="#111827">Layer detail ${layerNum} - front</text>
  </g>
  <g transform="translate(560,${rowY})">
    <path d="${pointsToPathData(bCut, -sb.minX + 10, -sb.minY + 10)}" fill="${fill2}" stroke="#1f2937" stroke-width="2"/>
    <path d="${pointsToPathData(b, -sb.minX + 10, -sb.minY + 10)}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="10" y="${Math.round(sb.height + 45)}" font-size="18" font-family="Arial" fill="#111827">Layer detail ${layerNum} - back</text>
  </g>`);
    rowY += sb.height + 70;
  }

  const detailRows = [];
  let detailY = rowY;
  let detailNum = 0;
  for (let i = 0; i < state.shapes.length; i += 1) {
    const sh = state.shapes[i];
    if (sh.kind !== "detail") continue;
    detailNum += 1;
    const bb = bboxOf(sh.points);
    if (isPolylineDetail(sh)) {
      const dOpen = pointsToOpenPathData(sh.points, -bb.minX + 10, -bb.minY + 10);
      detailRows.push(`
  <g transform="translate(60,${detailY})">
    <path d="${dOpen}" fill="none" stroke="#1f2937" stroke-width="2"/>
    <text x="10" y="${Math.max(36, bb.h + 28)}" font-size="18" font-family="Arial" fill="#111827">Detail ${detailNum} (open line)</text>
  </g>`);
      detailY += Math.max(70, bb.h + 45);
    } else {
      const pts = sh.points;
      const cut = seamOffset(pts, seamPx);
      const dCut = pointsToPathData(cut, -bb.minX + 10, -bb.minY + 10);
      const dSt = pointsToPathData(pts, -bb.minX + 10, -bb.minY + 10);
      detailRows.push(`
  <g transform="translate(60,${detailY})">
    <path d="${dCut}" fill="#fdf4ff" stroke="#1f2937" stroke-width="2"/>
    <path d="${dSt}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="10" y="${Math.round(bb.h + 45)}" font-size="18" font-family="Arial" fill="#111827">Detail ${detailNum} (closed)</text>
  </g>`);
      detailY += bb.h + 70;
    }
  }

  const viewH = Math.max(1100, rowY + 120, sleeveStackBottom + 120, detailY + 120);
  const legendY = Math.max(500, viewH - 300);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 ${viewH}">
  <rect x="0" y="0" width="1600" height="${viewH}" fill="white" />
  <text x="30" y="45" font-size="28" font-family="Arial" fill="#111827">Sewing Pattern (cm seam allowance: ${seamCm.toFixed(2)}) - main body + sleeves from draft when present</text>

  <g transform="translate(60,120)">
    <path d="${pointsToPathData(front0Cut, -main.minX + 10, -main.minY + 10)}" fill="#eef2ff" stroke="#1f2937" stroke-width="2"/>
    <path d="${pointsToPathData(front0, -main.minX + 10, -main.minY + 10)}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="10" y="${Math.round(height0 + 45)}" font-size="20" font-family="Arial" fill="#111827">Front Panel - main (cut 1 on fold)</text>
  </g>

  <g transform="translate(560,120)">
    <path d="${pointsToPathData(back0Cut, -main.minX + 10, -main.minY + 10)}" fill="#ecfeff" stroke="#1f2937" stroke-width="2"/>
    <path d="${pointsToPathData(back0, -main.minX + 10, -main.minY + 10)}" fill="none" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="1.8"/>
    <text x="10" y="${Math.round(height0 + 45)}" font-size="20" font-family="Arial" fill="#111827">Back Panel - main (cut 1 on fold)</text>
  </g>
${sleeveBlocks}
${extraRows.join("\n")}
${detailRows.join("\n")}

  <g transform="translate(1110,${legendY})">
    <rect x="0" y="0" width="410" height="250" fill="#f8fafc" stroke="#1f2937" />
    <text x="20" y="40" font-size="20" font-family="Arial" fill="#111827">Legend</text>
    <line x1="20" y1="75" x2="110" y2="75" stroke="#ef4444" stroke-dasharray="8 6" stroke-width="2"/>
    <text x="130" y="82" font-size="18" font-family="Arial" fill="#111827">Stitch line</text>
    <line x1="20" y1="120" x2="110" y2="120" stroke="#1f2937" stroke-width="2"/>
    <text x="130" y="127" font-size="18" font-family="Arial" fill="#111827">Cut line</text>
    <text x="20" y="170" font-size="18" font-family="Arial" fill="#111827">Export at 100% for print scaling.</text>
  </g>
</svg>`.trim();

  state.lastPatternSVG = svg;
  patternOutput.innerHTML = svg;
}

function downloadPreview() {
  const link = document.createElement("a");
  link.href = previewCanvas.toDataURL("image/png");
  link.download = "clothing-preview.png";
  link.click();
}

function downloadPatternSVG() {
  if (!state.lastPatternSVG) generatePattern();
  const blob = new Blob([state.lastPatternSVG], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sewing-pattern.svg";
  link.click();
  URL.revokeObjectURL(url);
}

function hitTestDraftPoint(pos) {
  const hitR = 14;
  for (let si = state.shapes.length - 1; si >= 0; si -= 1) {
    const pts = state.shapes[si].points;
    const r = si === state.activeShapeIndex ? 8 : 6;
    const thresh = Math.max(hitR, r + 6);
    for (let i = pts.length - 1; i >= 0; i -= 1) {
      if (Math.hypot(pts[i].x - pos.x, pts[i].y - pos.y) < thresh) {
        return { shapeIndex: si, pointIndex: i };
      }
    }
  }
  return null;
}

function hitTestShapeFill(pos) {
  for (let si = state.shapes.length - 1; si >= 0; si -= 1) {
    const sh = state.shapes[si];
    const pts = sh.points;
    if (isPolylineDetail(sh)) {
      if (distPointToSegment(pos.x, pos.y, pts[0].x, pts[0].y, pts[1].x, pts[1].y) < 16) return si;
    } else if (pts.length >= 3) {
      if (pointInPolygon(pos.x, pos.y, pts)) return si;
    }
  }
  return -1;
}

function onPointerDown(event) {
  const pos = getCanvasPoint(draftCanvas, event);
  const hit = hitTestDraftPoint(pos);
  if (hit) {
    state.dragMode = "point";
    state.activeShapeIndex = hit.shapeIndex;
    populateShapeSelect();
    controls.shapeSelect.value = String(hit.shapeIndex);
    syncLayerNameInput();
    state.selectedPointIndex = hit.pointIndex;
    state.draggingIndex = hit.pointIndex;
    state.draggingShapeIndex = hit.shapeIndex;
    state.shapeDragLast = null;
  } else {
    const th = hitTestTransformHandles(pos);
    if (th) {
      if (th.type === "rotate") {
        state.dragMode = "rotate";
        const sh = state.shapes[state.activeShapeIndex];
        const c = centroidOf(sh.points);
        state.rotatePrevAngle = Math.atan2(pos.y - c.y, pos.x - c.x);
      } else {
        state.dragMode = "resize";
        state.resizeCorner = th.corner;
        state.resizeSnapshot = snapshotPoints(state.shapes[state.activeShapeIndex].points);
      }
    } else {
      const fillIdx = hitTestShapeFill(pos);
      if (fillIdx >= 0) {
        state.dragMode = "shape";
        state.draggingShapeIndex = fillIdx;
        state.activeShapeIndex = fillIdx;
        state.selectedPointIndex = -1;
        state.draggingIndex = -1;
        state.shapeDragLast = { x: pos.x, y: pos.y };
        populateShapeSelect();
        controls.shapeSelect.value = String(fillIdx);
        syncLayerNameInput();
      } else {
        state.dragMode = null;
        state.draggingIndex = -1;
        state.draggingShapeIndex = -1;
        state.shapeDragLast = null;
      }
    }
  }
  drawDraftShape();
  if (state.dragMode) draftCanvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  const pos = getCanvasPoint(draftCanvas, event);
  if (state.dragMode === "rotate") {
    const sh = state.shapes[state.activeShapeIndex];
    const c = centroidOf(sh.points);
    const angle = Math.atan2(pos.y - c.y, pos.x - c.x);
    if (state.rotatePrevAngle !== null) {
      let delta = angle - state.rotatePrevAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      rotatePointsAround(sh.points, c.x, c.y, delta);
    }
    state.rotatePrevAngle = angle;
    drawDraftShape();
    drawPreview();
    return;
  }
  if (state.dragMode === "resize" && state.resizeSnapshot && state.resizeCorner) {
    const sh = state.shapes[state.activeShapeIndex];
    const bb0 = bboxOf(state.resizeSnapshot);
    applyResizeFromSnapshot(sh, state.resizeSnapshot, bb0, state.resizeCorner, pos);
    drawDraftShape();
    drawPreview();
    return;
  }
  if (state.dragMode === "shape" && state.draggingShapeIndex >= 0 && state.shapeDragLast) {
    const dx = pos.x - state.shapeDragLast.x;
    const dy = pos.y - state.shapeDragLast.y;
    state.shapeDragLast = { x: pos.x, y: pos.y };
    const pts = state.shapes[state.draggingShapeIndex].points;
    pts.forEach((p) => {
      p.x = Math.max(20, Math.min(draftCanvas.width - 20, p.x + dx));
      p.y = Math.max(20, Math.min(draftCanvas.height - 20, p.y + dy));
    });
    drawDraftShape();
    drawPreview();
    return;
  }
  if (state.dragMode !== "point" || state.draggingShapeIndex < 0 || state.draggingIndex < 0) return;
  const pts = state.shapes[state.draggingShapeIndex].points;
  pts[state.draggingIndex].x = Math.max(20, Math.min(draftCanvas.width - 20, pos.x));
  pts[state.draggingIndex].y = Math.max(20, Math.min(draftCanvas.height - 20, pos.y));
  drawDraftShape();
  drawPreview();
}

function onPointerUp(event) {
  const wasTransform =
    state.dragMode === "shape" ||
    state.dragMode === "rotate" ||
    state.dragMode === "resize";
  state.dragMode = null;
  state.shapeDragLast = null;
  state.draggingIndex = -1;
  state.draggingShapeIndex = -1;
  state.rotatePrevAngle = null;
  state.resizeCorner = null;
  state.resizeSnapshot = null;
  if (wasTransform) generatePattern();
  try {
    draftCanvas.releasePointerCapture(event.pointerId);
  } catch (_) {
    /* not capturing */
  }
}

function addPoint() {
  const sh = state.shapes[state.activeShapeIndex];
  const pts = sh.points;
  if (sh.kind === "detail" && pts.length === 2 && !sh.closed) {
    const a = pts[0];
    const b = pts[1];
    pts.push({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 50 });
    sh.closed = true;
    state.selectedPointIndex = 2;
    drawDraftShape();
    drawPreview();
    generatePattern();
    return;
  }
  const n = pts.length;
  const sel = state.selectedPointIndex;
  if (sel >= 0 && sel < n) {
    const next = (sel + 1) % n;
    const a = pts[sel];
    const b = pts[next];
    pts.splice(sel + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    state.selectedPointIndex = sel + 1;
  } else {
    const a = pts[n - 1];
    const b = pts[0];
    pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    state.selectedPointIndex = n;
  }
  drawDraftShape();
  drawPreview();
  generatePattern();
}

function removePoint() {
  const sh = state.shapes[state.activeShapeIndex];
  const pts = sh.points;
  const minPts = minPointsForShape(sh);
  if (pts.length <= minPts) return;
  const idx = state.selectedPointIndex;
  if (idx >= 0 && idx < pts.length) {
    pts.splice(idx, 1);
  } else {
    pts.pop();
  }
  if (sh.kind === "detail" && pts.length === 2) sh.closed = false;
  state.selectedPointIndex = -1;
  drawDraftShape();
  drawPreview();
  generatePattern();
}

function populateShapeSelect() {
  controls.shapeSelect.innerHTML = "";
  for (let i = 0; i < state.shapes.length; i += 1) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = displayNameForShape(state.shapes[i], i);
    controls.shapeSelect.appendChild(opt);
  }
  controls.shapeSelect.value = String(state.activeShapeIndex);
  syncLayerNameInput();
}

function syncLayerNameInput() {
  const sh = state.shapes[state.activeShapeIndex];
  if (controls.layerNameInput && sh) {
    controls.layerNameInput.value = sh.name != null ? String(sh.name) : "";
  }
}

function commitLayerName() {
  const sh = state.shapes[state.activeShapeIndex];
  if (!sh || !controls.layerNameInput) return;
  sh.name = controls.layerNameInput.value.trim();
  populateShapeSelect();
  controls.shapeSelect.value = String(state.activeShapeIndex);
}

function addShape() {
  overlayIdCounter += 1;
  state.shapes.push({
    id: `overlay-${overlayIdCounter}`,
    kind: "overlay",
    name: `Layer ${overlayIdCounter}`,
    points: defaultOverlayShapePoints()
  });
  state.activeShapeIndex = state.shapes.length - 1;
  state.selectedPointIndex = -1;
  populateShapeSelect();
  drawDraftShape();
  drawPreview();
  generatePattern();
}

function addDetail() {
  overlayIdCounter += 1;
  const cx = 450;
  state.shapes.push({
    id: `detail-${overlayIdCounter}`,
    kind: "detail",
    name: `Detail ${overlayIdCounter}`,
    closed: false,
    points: [
      { x: cx - 50, y: 500 },
      { x: cx + 50, y: 500 }
    ]
  });
  state.activeShapeIndex = state.shapes.length - 1;
  state.selectedPointIndex = -1;
  populateShapeSelect();
  drawDraftShape();
  drawPreview();
  generatePattern();
}

function deleteLayer() {
  const sh = state.shapes[state.activeShapeIndex];
  if (!sh || sh.kind === "main") return;
  state.shapes.splice(state.activeShapeIndex, 1);
  state.activeShapeIndex = Math.min(state.activeShapeIndex, state.shapes.length - 1);
  state.selectedPointIndex = -1;
  populateShapeSelect();
  drawDraftShape();
  drawPreview();
  generatePattern();
}

function onShapeSelectChange() {
  state.activeShapeIndex = Number(controls.shapeSelect.value);
  state.selectedPointIndex = -1;
  syncLayerNameInput();
  drawDraftShape();
}

function readMeasurements() {
  return {
    bust: Math.max(40, Math.min(200, Number(controls.measureBust.value) || 90)),
    waist: Math.max(40, Math.min(200, Number(controls.measureWaist.value) || 75)),
    hips: Math.max(40, Math.min(200, Number(controls.measureHips.value) || 100))
  };
}

function applyMeasurements() {
  const { bust, waist, hips } = readMeasurements();
  controls.measureBust.value = String(bust);
  controls.measureWaist.value = String(waist);
  controls.measureHips.value = String(hips);
  const main = getMainShape();
  if (main) main.points = measureProportionalShape(bust, waist, hips);
  state.activeShapeIndex = state.shapes.findIndex((s) => s.kind === "main");
  if (state.activeShapeIndex < 0) state.activeShapeIndex = 0;
  state.selectedPointIndex = -1;
  populateShapeSelect();
  drawDraftShape();
  drawPreview();
  generatePattern();
}

function resetShape() {
  controls.measureBust.value = "90";
  controls.measureWaist.value = "75";
  controls.measureHips.value = "100";
  overlayIdCounter = 0;
  state.shapes = createDefaultShapes();
  state.activeShapeIndex = 0;
  state.selectedPointIndex = -1;
  populateShapeSelect();
  drawDraftShape();
  drawPreview();
  generatePattern();
}

function setPatternImageFromDataUrl(dataUrl, label) {
  const img = new Image();
  img.onload = () => {
    state.fillPatternImage = img;
    state.fillPatternLabel = label;
    controls.patternStatus.textContent = `Current fill: ${label}.`;
    drawPreview();
  };
  img.src = dataUrl;
}

function openPatternDesigner() {
  controls.patternDesignerModal.classList.add("open");
  controls.patternDesignerModal.setAttribute("aria-hidden", "false");
}

function closePatternDesigner() {
  controls.patternDesignerModal.classList.remove("open");
  controls.patternDesignerModal.setAttribute("aria-hidden", "true");
}

function uploadPatternImage(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    setPatternImageFromDataUrl(reader.result, `uploaded image (${file.name})`);
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

function clearPattern() {
  state.fillPatternImage = null;
  state.fillPatternLabel = "default stripe overlay";
  controls.patternStatus.textContent = "Current fill: default stripe overlay.";
  drawPreview();
}

function startPatternDrawing(event) {
  state.drawingPattern = true;
  const pos = getCanvasPoint(controls.patternDrawCanvas, event);
  patternDrawCtx.beginPath();
  patternDrawCtx.moveTo(pos.x, pos.y);
}

function stopPatternDrawing() {
  state.drawingPattern = false;
  patternDrawCtx.beginPath();
}

function drawOnPatternCanvas(event) {
  if (!state.drawingPattern) return;
  const pos = getCanvasPoint(controls.patternDrawCanvas, event);
  patternDrawCtx.lineCap = "round";
  patternDrawCtx.lineJoin = "round";
  patternDrawCtx.lineWidth = Number(controls.patternBrushSize.value);
  if (state.patternTool === "eraser") {
    patternDrawCtx.globalCompositeOperation = "destination-out";
  } else {
    patternDrawCtx.globalCompositeOperation = "source-over";
    patternDrawCtx.strokeStyle = controls.patternBrushColor.value;
  }
  patternDrawCtx.lineTo(pos.x, pos.y);
  patternDrawCtx.stroke();
  patternDrawCtx.beginPath();
  patternDrawCtx.moveTo(pos.x, pos.y);
}

function clearPatternDrawing() {
  patternDrawCtx.globalCompositeOperation = "source-over";
  patternDrawCtx.fillStyle = "#ffffff";
  patternDrawCtx.fillRect(0, 0, controls.patternDrawCanvas.width, controls.patternDrawCanvas.height);
}

function savePatternDrawing() {
  const dataUrl = controls.patternDrawCanvas.toDataURL("image/png");
  setPatternImageFromDataUrl(dataUrl, "drawn pattern");
  closePatternDesigner();
}

[controls.baseColor, controls.accentColor].forEach((el) => {
  el.addEventListener("input", drawPreview);
  el.addEventListener("change", drawPreview);
});

[controls.measureBust, controls.measureWaist, controls.measureHips].forEach((el) => {
  el.addEventListener("change", () => drawPreview());
});

controls.applyMeasurementsBtn.addEventListener("click", applyMeasurements);
controls.addShapeBtn.addEventListener("click", addShape);
controls.addDetailBtn.addEventListener("click", addDetail);
controls.deleteLayerBtn.addEventListener("click", deleteLayer);
controls.layerNameInput.addEventListener("change", commitLayerName);
controls.layerNameInput.addEventListener("blur", commitLayerName);
controls.shapeSelect.addEventListener("change", onShapeSelectChange);
controls.addPointBtn.addEventListener("click", addPoint);
controls.removePointBtn.addEventListener("click", removePoint);
controls.generatePatternBtn.addEventListener("click", generatePattern);
controls.downloadPreviewBtn.addEventListener("click", downloadPreview);
controls.downloadPatternBtn.addEventListener("click", downloadPatternSVG);
controls.resetShapeBtn.addEventListener("click", resetShape);
controls.seamAllowance.addEventListener("input", generatePattern);
controls.sleeveLength.addEventListener("input", generatePattern);
controls.openPatternDesignerBtn.addEventListener("click", openPatternDesigner);
controls.closePatternDesignerBtn.addEventListener("click", closePatternDesigner);
controls.uploadPatternBtn.addEventListener("click", () => controls.patternImageInput.click());
controls.patternImageInput.addEventListener("change", uploadPatternImage);
controls.clearPatternBtn.addEventListener("click", clearPattern);
controls.applyDrawnPatternBtn.addEventListener("click", savePatternDrawing);
controls.patternBrushBtn.addEventListener("click", () => {
  state.patternTool = "brush";
});
controls.patternEraserBtn.addEventListener("click", () => {
  state.patternTool = "eraser";
});
controls.clearPatternDrawBtn.addEventListener("click", clearPatternDrawing);
controls.savePatternDrawBtn.addEventListener("click", savePatternDrawing);

draftCanvas.addEventListener("pointerdown", onPointerDown);
draftCanvas.addEventListener("pointermove", onPointerMove);
draftCanvas.addEventListener("pointerup", onPointerUp);
draftCanvas.addEventListener("pointerleave", onPointerUp);
controls.patternDrawCanvas.addEventListener("pointerdown", startPatternDrawing);
controls.patternDrawCanvas.addEventListener("pointermove", drawOnPatternCanvas);
controls.patternDrawCanvas.addEventListener("pointerup", stopPatternDrawing);
controls.patternDrawCanvas.addEventListener("pointerleave", stopPatternDrawing);
controls.patternDesignerModal.addEventListener("click", (event) => {
  if (event.target === controls.patternDesignerModal) closePatternDesigner();
});

initPatternDrawCanvas();
populateShapeSelect();
drawDraftShape();
drawPreview();
generatePattern();
