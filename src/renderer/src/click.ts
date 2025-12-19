interface CursorClick {
  x: number;
  y: number;
  button?: string;
  timeMs?: number;
}

let clickModeEnabled = true;

async function setupCanvas() {

  const canvas = document.getElementById('click-layer') as HTMLCanvasElement;

  if (!canvas) return null;



  // Get overlay window bounds via IPC

  const overlayBounds = await window.api.invoke<{ x:number, y:number, width:number, height:number }>('overlay:get-bounds');

  if (!overlayBounds) return null;



  const dpr = window.devicePixelRatio || 1;



  // Canvas matches overlay window, scaled for DPR

  canvas.width = overlayBounds.width * dpr;

  canvas.height = overlayBounds.height * dpr;

  canvas.style.width = `${overlayBounds.width}px`;

  canvas.style.height = `${overlayBounds.height}px`;



  const ctx = canvas.getContext('2d');

  

  if (!ctx) return null;



  ctx.lineCap = 'round';

  ctx.lineJoin = 'round';

  ctx.lineWidth = 3;







  return { canvas, ctx, overlayBounds, dpr };

}

const scaleFactor = window.devicePixelRatio || 1;

// Map screen click to canvas coordinates

function mapScreenToCanvas(pos: CursorClick, overlayBounds: {x:number,y:number,width:number,height:number}) {

  return {

    x: pos.x - overlayBounds.x,

    y: pos.y - overlayBounds.y

  };

}

// Safe ripple: redraw whole canvas each frame, no ctx.scale, uses DPR in sizes
function triggerRipple(ctx: CanvasRenderingContext2D, xPx: number, yPx: number, dpr: number) {
  console.log('[DEBUG] triggerRipple at device px', xPx, yPx, 'dpr', dpr);
  const maxRadiusPx = 40 * dpr;
  const waveCount = 2;
  const duration = 400;
  let startTime: number | null = null;

  function frame(now: number) {
    if (startTime === null) startTime = now;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    console.log('[DEBUG] frame', { elapsed, progress });

    // Clear full canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw waves
    for (let i = 0; i < waveCount; i++) {
      const waveProgress = progress - i * 0.15;
      if (waveProgress < 0) continue;

      const radius = waveProgress * maxRadiusPx;
      const alpha = Math.max(0, (1 - waveProgress) * 0.9);

      ctx.save();
      ctx.beginPath();
      ctx.arc(xPx, yPx, radius, 0, Math.PI * 2);
      ctx.lineWidth = 10 * dpr; // scale line width for DPR
      ctx.strokeStyle = `rgba(255,0,0,${alpha})`;
      ctx.stroke();
      ctx.restore();
    }

    // Center dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(xPx, yPx, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,0,0,0.9)';
    ctx.fill();
    ctx.restore();

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      console.log('[DEBUG] ripple done');
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    }
  }

  requestAnimationFrame(frame);
}

// Main
(async () => {
  console.log('[DEBUG] ripple renderer init');
  const setup = await setupCanvas();
  if (!setup) return;

  const { ctx, overlayBounds, dpr } = setup;

  window.api?.onCursorClick((_, pos: CursorClick) => {
    console.log('[DEBUG] onCursorClick', pos);
    if (!clickModeEnabled) {
      console.log('[DEBUG] clickModeEnabled is false');
      return;
    }
    const p = mapScreenToCanvas(pos, overlayBounds);
    // Bounds guard (avoid drawing off-canvas)
    if (
      p.x < 0 || p.y < 0 ||
      p.x > ctx.canvas.width || p.y > ctx.canvas.height
    ) {
      console.warn('[DEBUG] mapped point out of canvas', p, 'canvas', { w: ctx.canvas.width, h: ctx.canvas.height });
      return;
    }
    triggerRipple(ctx, p.x, p.y, dpr);
  });

  window.api?.onDrawingToggle((_, enabled: boolean) => {
    clickModeEnabled = !enabled;
    console.log('[DEBUG] onDrawingToggle, clickModeEnabled:', clickModeEnabled);
  });
})();