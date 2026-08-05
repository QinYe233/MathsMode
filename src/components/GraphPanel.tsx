import { useEffect, useRef, useState } from 'react';
import functionPlot from 'function-plot';
import type { FunctionAnalysis, VectorDef } from '../types';
import { PropertyCard } from './PropertyCard';
import '../core/vectorGraphType';

const COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#ef4444', '#8b5cf6', '#06b6d4'];

interface Props {
  analyses: FunctionAnalysis[];
  vectors: VectorDef[];
  onClear: () => void;
  onAddVector: (input: string) => string | null;
}

export function GraphPanel({ analyses, vectors, onClear, onAddVector }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [resetKey, setResetKey] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [vecInput, setVecInput] = useState('');
  const [vecError, setVecError] = useState<string | null>(null);

  const total = analyses.length + vectors.length;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [analyses.length, vectors.length]);

  useEffect(() => {
    if (total === 0) setHidden({});
  }, [total]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || total === 0) return;
    const width = size?.w || el.clientWidth || 400;
    const height = Math.max(size?.h || el.clientHeight || 340, 260);
    const visible = analyses.filter((a) => !hidden[a.expression]);
    const visibleVectors = vectors.filter((v) => !hidden[`v:${v.id}`]);
    const viewBox = autoView(analyses, vectors);
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
        data: [
          ...visible.map((a, i) => ({
            fn: a.expression,
            color: COLORS[i % COLORS.length],
            graphType: 'polyline' as const,
          })),
          ...visibleVectors.map((v, i) => ({
            vector: [v.x, v.y] as [number, number],
            color: COLORS[(visible.length + i) % COLORS.length],
            graphType: 'vector' as const,
            skipTip: true,
          })),
        ] as never,
        annotations: [
          ...visible.flatMap((a) => {
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
                  anns.push({ x, y: viewBox.y[0] + (viewBox.y[1] - viewBox.y[0]) * 0.15, text: '渐近线' });
                }
              }
            });
            return anns;
          }),
          ...visibleVectors.flatMap((v) => {
            const tx = v.x + 0.25;
            const ty = v.y + 0.25;
            if (tx > viewBox.x[0] && tx < viewBox.x[1] && ty > viewBox.y[0] && ty < viewBox.y[1]) {
              return [{ x: tx, y: ty, text: v.name ? `${v.name}(${v.x},${v.y})` : `(${v.x},${v.y})` }];
            }
            return [];
          }),
        ],
      });
    } catch {
      /* 画图失败不崩溃 */
    }
  }, [analyses, vectors, hidden, resetKey, size, total]);

  const addVector = () => {
    const text = vecInput.trim();
    if (!text) return;
    const err = onAddVector(text);
    setVecError(err);
    if (!err) setVecInput('');
  };

  const vectorInputRow = (
    <>
      <div className="func-input-row vector-input-row">
        <span className="func-input-label">向量</span>
        <input
          className={`func-input${vecError ? ' invalid' : ''}`}
          value={vecInput}
          placeholder="a=(3,2)，回车添加"
          onChange={(e) => {
            setVecInput(e.target.value);
            if (vecError) setVecError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addVector();
          }}
        />
      </div>
      {vecError && <div className="func-input-error">{vecError}</div>}
    </>
  );

  if (total === 0) {
    return (
      <div className="graph-panel">
        <div className="graph-toolbar">
          <button className="legend-btn danger" onClick={onClear} disabled>
            清空绘图
          </button>
        </div>
        {vectorInputRow}
        <div className="graph-empty">
          未识别到函数或向量，可在左侧手动输入函数，或在下方输入向量，如 a=(3,2)
        </div>
      </div>
    );
  }

  return (
    <div className="graph-panel">
      <div className="graph-toolbar">
        {analyses.map((a, i) => (
          <button
            key={a.expression + '-' + i}
            className={`legend-btn ${hidden[a.expression] ? 'off' : ''}`}
            style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}
            onClick={() => setHidden((h) => ({ ...h, [a.expression]: !h[a.expression] }))}
          >
            {a.expression}
          </button>
        ))}
        {vectors.map((v, i) => (
          <button
            key={v.id}
            className={`legend-btn ${hidden[`v:${v.id}`] ? 'off' : ''}`}
            style={{
              borderColor: COLORS[(analyses.length + i) % COLORS.length],
              color: COLORS[(analyses.length + i) % COLORS.length],
            }}
            onClick={() => setHidden((h) => ({ ...h, [`v:${v.id}`]: !h[`v:${v.id}`] }))}
          >
            {v.name ? `${v.name}=(${v.x},${v.y})` : `(${v.x},${v.y})`}
          </button>
        ))}
        <button className="legend-btn zoom" onClick={() => setResetKey((k) => k + 1)} title="重置视野">
          重置视野
        </button>
        <button className="legend-btn danger" onClick={onClear} disabled={total === 0} title="清空所有函数和向量">
          清空绘图
        </button>
      </div>
      {vectorInputRow}
      <div className="graph-plot" ref={containerRef} />
      <div className="property-list">
        {analyses.map((a, i) => (
          <PropertyCard key={a.expression + '-' + i} analysis={a} />
        ))}
      </div>
    </div>
  );
}

function autoView(
  analyses: FunctionAnalysis[],
  vectors: VectorDef[],
): { x: [number, number]; y: [number, number] } {
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
  for (const v of vectors) {
    if (Math.abs(v.x) < 1e4) xs.push(v.x);
    if (Math.abs(v.y) < 1e6) ys.push(v.y);
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
