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
  highlightedExpr?: string | null;
}

export function GraphPanel({ analyses, vectors, onClear, onAddVector, highlightedExpr }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [resetKey, setResetKey] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [vecInput, setVecInput] = useState('');
  const [vecError, setVecError] = useState<string | null>(null);
  const [focused, setFocused] = useState<{ expr: string; x: number } | null>(null);
  const viewBoxRef = useRef<{ x: [number, number]; y: [number, number] } | null>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);

  const total = analyses.length + vectors.length;

  // 十字坐标轴：把 x/y 轴移到原点处交叉（含缩放/拖拽后的重定位）
  const repositionAxes = (svg: Element, vb: { x: [number, number]; y: [number, number] }, w: number, h: number) => {
    const sx = (v: number) => ((v - vb.x[0]) / (vb.x[1] - vb.x[0])) * w;
    const sy = (v: number) => h - ((v - vb.y[0]) / (vb.y[1] - vb.y[0])) * h;
    // 缩放/拖拽后 origin 位置 = 初始原点位置经过 zoom transform（k*x+t）
    const zr = svg.querySelector('.zoom-and-drag') as Element & { __zoom?: { k: number; x: number; y: number } } | null;
    const t = zr?.__zoom ?? { k: 1, x: 0, y: 0 };
    const ox = sx(0) * t.k + t.x;
    const oy = sy(0) * t.k + t.y;
    svg.querySelector('g.x.axis')?.setAttribute('transform', `translate(0,${oy})`);
    svg.querySelector('g.y.axis')?.setAttribute('transform', `translate(${ox},0)`);
    // 轴标签跟随轴：x 在横轴中段下方、y 在纵轴中段左侧
    const xl = svg.querySelector('text.x.axis-label');
    if (xl) {
      xl.setAttribute('x', String(w / 2));
      xl.setAttribute('y', String(oy + 18));
      xl.setAttribute('text-anchor', 'middle');
    }
    const yl = svg.querySelector('text.y.axis-label');
    if (yl) {
      yl.setAttribute('x', String(ox - 12));
      yl.setAttribute('y', String(h / 2));
      yl.setAttribute('text-anchor', 'end');
      yl.setAttribute('transform', `rotate(-90,${ox - 12},${h / 2})`);
    }
  };

  // hover 图例时给对应曲线加高亮 class（function-plot 结构：svg > g.function）
  const highlightCurve = (idx: number, on: boolean) => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const fns = svg.querySelectorAll('g.function');
    fns[idx]?.classList.toggle('curve-highlight', on);
  };

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
    if (total === 0) {
      setHidden({});
      setFocused(null);
    }
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
            label: v.name || '',
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
          ...(focused
            ? visible
                .filter((a) => a.expression === focused.expr)
                .flatMap((a) => {
                  const ext = a.extrema.find((e) => Math.abs(e.x - focused.x) < 1e-6);
                  const y = ext ? ext.y : 0;
                  if (focused.x > viewBox.x[0] && focused.x < viewBox.x[1] && y > viewBox.y[0] && y < viewBox.y[1]) {
                    return [{ x: focused.x, y, text: 'focus' }];
                  }
                  return [];
                })
            : []),
        ],
      });
      viewBoxRef.current = viewBox;
      sizeRef.current = { w: width, h: height };
      const svg = el.querySelector('svg');
      if (svg) repositionAxes(svg, viewBox, width, height);
    } catch {
      /* 画图失败不崩溃 */
    }
  }, [analyses, vectors, hidden, resetKey, size, total, focused]);

  // 缩放/拖拽/双击后 function-plot 会重绘轴回边缘，跟随重定位回原点
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // d3 zoom 的 handler 会 stopImmediatePropagation 阻断普通事件监听；
    // 用 MutationObserver 观察轴 transform 变化（缩放/拖拽/双击重绘都会触发），
    // debounce 后在稳定时把轴重定位回原点交叉处。
    let timer: number | undefined;
    const reposition = () => {
      const svg = el.querySelector('svg');
      const vb = viewBoxRef.current;
      const sz = sizeRef.current;
      if (!svg || !vb || !sz) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => repositionAxes(svg, vb, sz.w, sz.h), 120);
    };
    const mo = new MutationObserver(reposition);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['transform'] });
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

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
        <div className="graph-legend">
          {analyses.map((a, i) => (
            <button
              key={a.expression + '-' + i}
              className={`legend-btn ${hidden[a.expression] ? 'off' : ''}${highlightedExpr === a.expression ? ' lit' : ''}`}
              style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}
              onClick={() => setHidden((h) => ({ ...h, [a.expression]: !h[a.expression] }))}
              onMouseEnter={() => highlightCurve(i, true)}
              onMouseLeave={() => highlightCurve(i, false)}
            >
              <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
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
              <span
                className="legend-dot"
                style={{ background: COLORS[(analyses.length + i) % COLORS.length] }}
              />
              {v.name ? `${v.name}=(${v.x},${v.y})` : `(${v.x},${v.y})`}
            </button>
          ))}
        </div>
        <div className="graph-actions">
          <button className="legend-btn zoom" onClick={() => setResetKey((k) => k + 1)} title="重置视野">
            重置视野
          </button>
          <button className="legend-btn danger" onClick={onClear} disabled={total === 0} title="清空所有函数和向量">
            清空绘图
          </button>
        </div>
      </div>
      {vectorInputRow}
      <div
        className="graph-plot"
        ref={containerRef}
        onDoubleClick={() => setResetKey((k) => k + 1)}
        title="滚轮缩放 · 双击重置视野"
      />
      <div className="property-list">
        {analyses.map((a, i) => (
          <PropertyCard
            key={a.expression + '-' + i}
            analysis={a}
            onFocus={(x) =>
              setFocused((f) =>
                f && f.expr === a.expression && f.x === x ? null : { expr: a.expression, x },
              )
            }
          />
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
