import type { ReactNode } from 'react';
import type { FunctionAnalysis } from '../types';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  formatMonotonicSegment,
  formatExtremumMath,
  truncateList,
  PARITY_TEXT,
} from '../core/analysisEngine/summary';

interface Row {
  label: string;
  value: string;
  focus?: number; // 存在则该行可点击聚焦（图上标点）
}

// 值字符串内嵌 $...$ 公式片段，此处分段渲染成 KaTeX
function ValueWithMath({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const segs = text.split(/(\$[^$]+\$)/g);
  segs.forEach((seg, i) => {
    if (!seg) return;
    if (seg.startsWith('$') && seg.endsWith('$') && seg.length > 2) {
      const tex = seg.slice(1, -1);
      const html = katex.renderToString(tex, { throwOnError: false, strict: false });
      parts.push(<span key={i} dangerouslySetInnerHTML={{ __html: html }} />);
    } else {
      parts.push(<span key={i}>{seg}</span>);
    }
  });
  return <>{parts}</>;
}

export function PropertyCard({
  analysis,
  onFocus,
}: {
  analysis: FunctionAnalysis;
  onFocus?: (x: number) => void;
}) {
  // 扫描窗口：数值搜索的有限范围，不是数学边界（缺陷 E3）
  const scan =
    analysis.scanWindow &&
    Number.isFinite(analysis.scanWindow.lo) &&
    Number.isFinite(analysis.scanWindow.hi)
      ? analysis.scanWindow
      : undefined;

  const rows: Row[] = [];
  rows.push({
    label: '定义域',
    // 截断：tan(x) 的定义域有 637 个区间，不截断会淹没整个卡片（缺陷 W6）
    value:
      truncateList(
        analysis.domain.map(fmt),
        analysis.domain.length,
        '个区间',
      ).join(' ∪ ') || '—',
  });
  rows.push({ label: '奇偶性', value: PARITY_TEXT[analysis.parity] });
  // 缺陷 W2：AI 声明的定义域若与表达式不符（过宽），此处已按交集收窄，需明确提示
  if (analysis.domainNarrowed) {
    rows.push({
      label: '定义域提示',
      value: 'AI 给出的定义域包含无定义点，已按表达式修正',
    });
  }
  rows.push({
    label: '单调性',
    value: analysis.monotonic.length
      ? truncateList(
          // 与 AI 文字总结共用 formatMonotonicSegment（缺陷 E3）
          analysis.monotonic.map((s) =>
            formatMonotonicSegment(s, {
              suffix: analysis.period !== undefined ? '（每周期重复）' : '',
              scan,
              withArrow: true,
            }),
          ),
          analysis.monotonic.length,
          '个区间',
        ).join('；')
      : '—',
  });
  rows.push({
    label: '极值',
    focus: analysis.extrema[0]?.x,
    value: analysis.extrema.length
      ? truncateList(
          analysis.extrema.map(formatExtremumMath),
          analysis.extrema.length,
          '个',
        ).join('；')
      : '—',
  });
  rows.push({
    label: '零点',
    value: analysis.zeroPoints.length
      ? truncateList(
          analysis.zeroPoints.map((z) => r3(z)),
          analysis.zeroPoints.length,
          '个',
        ).join('、')
      : '—',
  });
  rows.push({
    label: '渐近线',
    value: analysis.asymptotes.length ? analysis.asymptotes.map((a) => a.value).join('；') : '无',
  });
  rows.push({
    label: '周期',
    value: analysis.period !== undefined ? `T = $${r3(analysis.period)}$` : '无',
  });

  return (
    <div className="property-card">
      <div className="property-card-head">
        <span className="property-card-fn">f(x) = {analysis.expression}</span>
      </div>
      {rows.map((row) => (
        <div
          className={`property-row${row.focus !== undefined && onFocus ? ' focusable' : ''}`}
          key={row.label}
          onClick={
            row.focus !== undefined && onFocus ? () => onFocus(row.focus as number) : undefined
          }
          title={row.focus !== undefined && onFocus ? '点击在图上标记此极值' : undefined}
        >
          <span className="property-label">{row.label}</span>
          <span className="property-value">
            <ValueWithMath text={row.value} />
          </span>
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
  // 数学语境用 U+2212 减号（如 y=−4），与 ∞ 排版一致
  return String(Math.round(x * 1000) / 1000).replace('-', '−');
}
