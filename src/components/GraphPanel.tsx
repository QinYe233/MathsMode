import { useEffect, useRef, useState } from 'react';
import functionPlot from 'function-plot';
import type { FunctionAnalysis } from '../types';
import { PropertyCard } from './PropertyCard';

const COLORS = ['#4da3ff', '#ffb454', '#57d98a', '#ff6b6b', '#c678dd', '#5ccfe6'];

export function GraphPanel({ analyses }: { analyses: FunctionAnalysis[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<{ x: [number, number]; y: [number, number] } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || analyses.length === 0) return;
    const width = el.clientWidth || 400;
    const height = Math.max(el.clientHeight || 340, 260);
    const visible = analyses.filter((a) => !hidden[a.expression]);
    const viewBox = view ?? autoView(analyses);
    try {
      functionPlot({
        target: el,
        width,
        height,
        grid: true,
        disableZoom: false,
        tip: { xLine: true, yLine: true },
        xAxis: { domain: viewBox.x, label: 'x' },
        yAxis: { domain: viewBox.y, label: 'y' },
        data: visible.map((a, i) => ({
          fn: a.expression,
          color: COLORS[i % COLORS.length],
          graphType: 'polyline',
        })),
        annotations: visible.flatMap((a, i) => {
          const inView = (x: number, y: number) =>
            x > viewBox.x[0] && x < viewBox.x[1] && y > viewBox.y[0] && y < viewBox.y[1];
          const anns = a.extrema
            .filter((e) => inView(e.x, e.y))
            .map((e) => ({ x: e.x, y: e.y, text: e.type === 'min' ? 'min' : 'max' }));
          a.zeroPoints.forEach((z) => {
            if (inView(z, 0)) anns.push({ x: z, y: 0, text: '0' });
          });
          a.asymptotes.forEach((as) => {
            if (as.type === 'vertical') {
              const x = parseFloat(as.value.slice(4));
              if (x > viewBox.x[0] && x < viewBox.x[1]) {
                anns.push({
                  x,
                  y: viewBox.y[0] + (viewBox.y[1] - viewBox.y[0]) * 0.15,
                  text: '渐近线',
                });
              }
            }
          });
          void i;
          return anns;
        }),
      });
    } catch {
      /* 画图失败不崩溃 */
    }
  }, [analyses, hidden, view]);

  if (analyses.length === 0) {
    return <div className="graph-empty">未识别到函数，可在左侧手动输入，如 f(x)=x^2 - 2x - 3</div>;
  }

  return (
    <div className="graph-panel">
      <div className="graph-toolbar">
        {analyses.map((a, i) => (
          <button
            key={a.expression}
            className={`legend-btn ${hidden[a.expression] ? 'off' : ''}`}
            style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}
            onClick={() => setHidden((h) => ({ ...h, [a.expression]: !h[a.expression] }))}
          >
            {a.expression}
          </button>
        ))}
        <button className="legend-btn zoom" onClick={() => setView(null)} title="重置视野">
          重置视野
        </button>
      </div>
      <div className="graph-plot" ref={containerRef} />
      <div className="property-list">
        {analyses.map((a) => (
          <PropertyCard key={a.expression} analysis={a} />
        ))}
      </div>
    </div>
  );
}

function autoView(analyses: FunctionAnalysis[]): { x: [number, number]; y: [number, number] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const a of analyses) {
    a.zeroPoints.forEach((z) => {
      if (Math.abs(z) < 1e4) xs.push(z);
    });
    a.extrema.forEach((e) => {
      if (Math.abs(e.x) < 1e4 && Math.abs(e.y) < 1e6) {
        xs.push(e.x);
        ys.push(e.y);
      }
    });
  }
  const pad = (v: number) => (Math.abs(v) > 20 ? Math.abs(v) * 1.2 : 5);
  const x0 = xs.length ? Math.min(...xs) : -10;
  const x1 = xs.length ? Math.max(...xs) : 10;
  const y0 = ys.length ? Math.min(...ys) : -10;
  const y1 = ys.length ? Math.max(...ys) : 10;
  const xc = (x0 + x1) / 2;
  const yc = (y0 + y1) / 2;
  const xr = Math.max(pad(x1 - x0), Math.abs(x0), Math.abs(x1), 5);
  const yr = Math.max(pad(y1 - y0), Math.abs(y0), Math.abs(y1), 5);
  const clamp = (v: number) => Math.max(5, Math.min(v, 50));
  return {
    x: [xc - clamp(xr), xc + clamp(xr)],
    y: [yc - clamp(yr), yc + clamp(yr)],
  };
}
