const base = document.getElementById("base-layer") as HTMLCanvasElement;
const preview = document.getElementById("preview-layer") as HTMLCanvasElement;

const bctx = base.getContext("2d")!;
const pctx = preview.getContext("2d")!;

type Tool = "rectangle" | "arrow" | "freeArrow";

let drawingEnabled = false;
let currentTool: Tool = "rectangle";
let isDrawing = false;
let startX = 0, startY = 0;

/** smoothing for freeArrow */
let lastPoint = { x: 0, y: 0 };
const smoothingFactor = 0.3;
const minDistance = 2;

/** store all drawn items (for undo) */
type Path = {
  tool: Tool;
  points: { x: number; y: number }[];
};

let paths: Path[] = [];

/* ================================
   Canvas resize (Hi-DPI safe)
================================ */
function resize() {
  const dpr = window.devicePixelRatio || 1;

  [base, preview].forEach(c => {
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    c.style.width = `${window.innerWidth}px`;
    c.style.height = `${window.innerHeight}px`;

    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "red";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  });
}
resize();
window.addEventListener("resize", resize);

/* ================================
   Electron preload wait
================================ */
function waitForAPI(): Promise<typeof window.api> {
  return new Promise(resolve => {
    const i = setInterval(() => {
      if (window.api) {
        clearInterval(i);
        resolve(window.api);
      }
    }, 10);
  });
}

/* ================================
   Smoothing helper
================================ */
function addSmoothedPoint(
  x: number,
  y: number,
  path: { x: number; y: number }[]
) {
  if (path.length === 0) {
    path.push({ x, y });
    lastPoint = { x, y };
    return;
  }

  const dx = x - lastPoint.x;
  const dy = y - lastPoint.y;
  if (Math.hypot(dx, dy) < minDistance) return;

  const smoothed = {
    x: lastPoint.x + dx * smoothingFactor,
    y: lastPoint.y + dy * smoothingFactor
  };

  path.push(smoothed);
  lastPoint = smoothed;
}

/* ================================
   Init
================================ */
(async () => {
  const api = await waitForAPI();

  api.onDrawingToggle((_, enabled) => {
    drawingEnabled = enabled;
    api.sendMouse(enabled);
    if (!enabled) clearAll();
  });

  api.onToolSet((_, tool) => {
    currentTool = tool as Tool;
  });

  api.onDrawingUndo(undo);
  api.onDrawingClear(clearAll);

  preview.addEventListener("mousedown", e => {
    if (!drawingEnabled) return;

    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;

    lastPoint = { x: startX, y: startY };

    // create a new path for EVERY tool
    paths.push({
      tool: currentTool,
      points: [{ x: startX, y: startY }]
    });
  });

  preview.addEventListener("mousemove", e => {
    if (!isDrawing) return;

    pctx.clearRect(0, 0, preview.width, preview.height);

    const path = paths[paths.length - 1];

    if (currentTool === "freeArrow") {
      addSmoothedPoint(e.clientX, e.clientY, path.points);
      drawFreeArrow(pctx, path.points, false);
    } else {
      drawShape(
        pctx,
        currentTool,
        startX,
        startY,
        e.clientX,
        e.clientY
      );
    }
  });

  window.addEventListener("mouseup", e => {
    if (!isDrawing) return;

    isDrawing = false;
    pctx.clearRect(0, 0, preview.width, preview.height);

    const path = paths[paths.length - 1];

    if (currentTool === "freeArrow") {
      drawFreeArrow(bctx, path.points, true);
    } else {
      path.points.push({ x: e.clientX, y: e.clientY });
      drawShape(
        bctx,
        currentTool,
        startX,
        startY,
        e.clientX,
        e.clientY
      );
    }
  });
})();

/* ================================
   Drawing helpers
================================ */
function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: Tool,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.beginPath();

  if (tool === "rectangle") {
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  if (tool === "arrow") {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    drawArrowhead(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }]);
    return;
  }

  ctx.stroke();
}

function drawFreeArrow(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  final: boolean
) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 2; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  const p1 = points[points.length - 2];
  const p2 = points[points.length - 1];
  ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
  ctx.stroke();

  if (final) drawArrowhead(ctx, points);
}

function drawArrowhead(ctx: CanvasRenderingContext2D, points: {x:number,y:number}[], tipLength = 15){
  if(points.length < 2) return;

  const len = points.length;
  const tip = points[len-1];
  const prev = points[len-2];

  // Direction of the last segment
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const angle = Math.atan2(dy, dx);

  // Project the tip forward so the arrowhead point is beyond the line end
  const forwardX = tip.x + (tipLength * 0.2) * Math.cos(angle);
  const forwardY = tip.y + (tipLength * 0.2) * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(forwardX, forwardY); // true tip of arrow
  ctx.lineTo(forwardX - tipLength*Math.cos(angle - Math.PI/6), forwardY - tipLength*Math.sin(angle - Math.PI/6));
  ctx.lineTo(forwardX - tipLength*Math.cos(angle + Math.PI/6), forwardY - tipLength*Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

/* ================================
   Undo / Clear (FIXED)
================================ */
function undo() {
  paths.pop();
  bctx.clearRect(0, 0, base.width, base.height);

  paths.forEach(p => {
    const pts = p.points;

    if (p.tool === "freeArrow") {
      drawFreeArrow(bctx, pts, true);
    } else if (pts.length === 2) {
      drawShape(bctx, p.tool, pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    }
  });
}

function clearAll() {
  paths = [];
  bctx.clearRect(0, 0, base.width, base.height);
  pctx.clearRect(0, 0, preview.width, preview.height);
}
