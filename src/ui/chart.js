import { SCENARIOS, REAGENTS, SPECIES_LABELS } from '../chem/scenarios.js';
import { sampleCurve, chartRange } from '../chem/curve.js';

const SERIES_COLORS = ['#4a2a3a', '#3f7d6e'];
const INK = '#2b2420';
const MUTED = '#7a6d5d';
const LINE = '#b9a98c';

export function createChart(canvas) {
  const ctx = canvas.getContext('2d');
  let cacheKey = '';
  let curve = null;
  let pending = null;
  let scheduled = false;

  function draw(s) {
    if (!ctx) return;
    const sc = SCENARIOS[s.scenarioId];
    const { reagent, fixedReagent } = sc.sweep;
    const fixed = s.added[fixedReagent];
    const x = s.added[reagent];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 180;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px "JetBrains Mono", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = MUTED;

    if (fixed <= 0) {
      ctx.fillText(`Thêm ${REAGENTS[fixedReagent].label} vào cốc để xem đồ thị`, 8, h / 2);
      return;
    }

    const xMax = chartRange(s.scenarioId, fixed, x);
    const key = `${s.scenarioId}|${fixed}|${xMax}`;
    if (key !== cacheKey) {
      cacheKey = key;
      curve = sampleCurve(s.scenarioId, fixed, xMax);
    }
    const yMax = Math.max(...curve.points.flatMap((p) => sc.chartSeries.map((k) => p.values[k]))) * 1.15 || 1;
    const pad = { l: 40, r: 8, t: 28, b: 22 };
    const X = (v) => pad.l + (v / xMax) * (w - pad.l - pad.r);
    const Y = (v) => h - pad.b - (v / yMax) * (h - pad.t - pad.b);

    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.lineTo(w - pad.r, h - pad.b);
    ctx.stroke();
    ctx.fillText(`n(${REAGENTS[reagent].label}) →`, Math.max(pad.l, w - pad.r - 90), h - 6);
    ctx.fillText(yMax.toFixed(3), 2, pad.t + 4);
    ctx.fillText('0', pad.l - 10, h - pad.b + 12);

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = LINE;
    for (const m of curve.markers) {
      ctx.beginPath();
      ctx.moveTo(X(m.x), pad.t);
      ctx.lineTo(X(m.x), h - pad.b);
      ctx.stroke();
      ctx.fillText(`T=${m.T}`, X(m.x) + 3, pad.t + 10);
    }
    ctx.setLineDash([]);

    sc.chartSeries.forEach((k, i) => {
      ctx.strokeStyle = SERIES_COLORS[i % SERIES_COLORS.length];
      ctx.fillStyle = SERIES_COLORS[i % SERIES_COLORS.length];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      curve.points.forEach((p, j) => (j ? ctx.lineTo(X(p.x), Y(p.values[k])) : ctx.moveTo(X(p.x), Y(p.values[k]))));
      ctx.stroke();

      // Draw series label with clean subscript rendering
      const labelText = (SPECIES_LABELS[k] || k).replace(/₂/g, '2').replace(/₃/g, '3').replace(/₄/g, '4');
      const tokens = labelText.split(/([0-9]+)/);
      let curX = pad.l + i * 110;
      const baseF = '10px "JetBrains Mono", system-ui, sans-serif';
      const subF = '8px "JetBrains Mono", system-ui, sans-serif';
      for (const t of tokens) {
        if (!t) continue;
        if (/^[0-9]+$/.test(t)) {
          ctx.font = subF;
          ctx.fillText(t, curX, 14);
          curX += ctx.measureText(t).width;
        } else {
          ctx.font = baseF;
          ctx.fillText(t, curX, 12);
          curX += ctx.measureText(t).width;
        }
      }

      ctx.beginPath();
      ctx.arc(X(x), Y(s.beaker.species[k]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return {
    draw(s) {
      pending = s;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (pending) draw(pending);
      });
    },
  };
}
