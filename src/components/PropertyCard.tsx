import type { FunctionAnalysis, MonotonicSegment } from '../types';

const TREND_LABEL: Record<MonotonicSegment['trend'], string> = {
  inc: '递增 ↑',
  dec: '递减 ↓',
  const: '不变 →',
};

const PARITY_LABEL = { odd: '奇函数', even: '偶函数', neither: '非奇非偶' } as const;

export function PropertyCard({ analysis }: { analysis: FunctionAnalysis }) {
  const rows: { label: string; value: string }[] = [];
  rows.push({
    label: '定义域',
    value: analysis.domain.map(fmt).join(' ∪ ') || '—',
  });
  rows.push({ label: '奇偶性', value: PARITY_LABEL[analysis.parity] });
  rows.push({
    label: '单调性',
    value: analysis.monotonic.length
      ? truncate(
          analysis.monotonic.map((s) => `${s.interval} ${TREND_LABEL[s.trend]}`),
          analysis.monotonic.length,
          '个区间',
        ).join('；')
      : '—',
  });
  rows.push({
    label: '极值',
    value: analysis.extrema.length
      ? truncate(
          analysis.extrema.map((e) => `x=${r3(e.x)} ${e.type === 'min' ? '最小' : '最大'} y=${r3(e.y)}`),
          analysis.extrema.length,
          '个',
        ).join('；')
      : '—',
  });
  rows.push({
    label: '零点',
    value: analysis.zeroPoints.length ? analysis.zeroPoints.slice(0, 12).map(r3).join('、') : '—',
  });
  rows.push({
    label: '渐近线',
    value: analysis.asymptotes.length ? analysis.asymptotes.map((a) => a.value).join('；') : '无',
  });
  rows.push({
    label: '周期',
    value: analysis.period !== undefined ? `T = ${r3(analysis.period)}` : '无',
  });

  return (
    <div className="property-card">
      {rows.map((row) => (
        <div className="property-row" key={row.label}>
          <span className="property-label">{row.label}</span>
          <span className="property-value">{row.value}</span>
        </div>
      ))}
      <details className="property-summary">
        <summary>AI 文字总结</summary>
        <p>{analysis.summary}</p>
      </details>
    </div>
  );
}

function fmt(iv: { lo: number; hi: number; loOpen: boolean; hiOpen: boolean }): string {
  const num = (x: number) =>
    x === Number.POSITIVE_INFINITY ? '+∞' : x === Number.NEGATIVE_INFINITY ? '−∞' : r3(x);
  return `${iv.loOpen ? '(' : '['}${num(iv.lo)}, ${num(iv.hi)}${iv.hiOpen ? ')' : ']'}`;
}

function r3(x: number): string {
  return String(Math.round(x * 1000) / 1000);
}

function truncate(items: string[], total: number, unit: string): string[] {
  if (items.length <= 6) return items;
  return [...items.slice(0, 6), `等 ${total} ${unit}`];
}
