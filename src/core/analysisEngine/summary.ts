import type { MonotonicSegment, Extremum } from '../../types';

/**
 * 函数特性的共享格式化。
 *
 * ## 为什么需要这个模块
 *
 * 此前 `PropertyCard`（特性卡片）与 `analysisEngine/index.buildSummary`（AI 文字总结）
 * **各自**实现了一套单调性/极值措辞，两者必然会漂移。实测缺陷 E3：
 * `buildSummary` 对周期函数会追加「（每周期重复）」，而 `PropertyCard` **不加**——
 * 同一个函数，卡片与总结给出互相矛盾的表述。
 *
 * 现把措辞集中到本模块，两处输出同一份文本，从结构上消除再次分叉的可能。
 */

/** 列表截断阈值：超过则显示前 N 项 + 「…共 M 个」 */
export const TRUNCATE_AT = 6;

/** 默认扫描窗口（非周期函数）——与 analysisEngine 的 scanLo/scanHi 保持一致 */
export const DEFAULT_SCAN_LO = -1000;
export const DEFAULT_SCAN_HI = 1000;

/** 单调性的短标签（文字总结用） */
const TREND_TEXT: Record<MonotonicSegment['trend'], string> = {
  inc: '递增',
  dec: '递减',
  const: '不变',
};

/** 单调性的长标签（特性卡片用，带箭头） */
const TREND_TEXT_ARROW: Record<MonotonicSegment['trend'], string> = {
  inc: '递增 ↑',
  dec: '递减 ↓',
  const: '不变 →',
};

const PARITY_TEXT = { odd: '奇函数', even: '偶函数', neither: '非奇非偶' } as const;

export interface ScanWindow {
  lo: number;
  hi: number;
}

/** 把区间端点字符串解析成数值（支持 −∞ / +∞） */
function endValue(s: string): number {
  if (s.includes('∞')) return s.includes('+') ? Infinity : -Infinity;
  return parseFloat(s.replace('−', '-'));
}

/**
 * 判断单调区间的某个端点是否**只是扫描窗口边界**，而非真实的数学边界。
 *
 * 缺陷 E3：扫描窗口 `[-1000, 1000]` 被 `fmtNum` 当成真实边界输出，
 * 用户会看到 `(1000, +∞)` 这种「函数在 1000 之后还单调递增」的错误断言。
 */
function touchesScanBound(endStr: string, scan: ScanWindow): boolean {
  const v = endValue(endStr);
  if (!Number.isFinite(v)) return false;
  return Math.abs(v - scan.lo) < 1e-6 || Math.abs(v - scan.hi) < 1e-6;
}

/**
 * 渲染单调区间片段。
 *
 * @param suffix 追加说明（周期函数传「（每周期重复）」）
 * @param scan   扫描窗口；区间端点落在窗口边界时追加「扫描范围内」以澄清
 * @param withArrow 是否使用带箭头的长标签（特性卡片用）
 */
export function formatMonotonicSegment(
  s: MonotonicSegment,
  options: { suffix?: string; scan?: ScanWindow; withArrow?: boolean } = {},
): string {
  const { suffix = '', scan, withArrow = false } = options;
  const label = withArrow ? TREND_TEXT_ARROW[s.trend] : TREND_TEXT[s.trend];

  const m = s.interval.match(/^[\[(](.+),\s*(.+?)[\])]$/);
  const clipped =
    scan && m ? touchesScanBound(m[1], scan) || touchesScanBound(m[2], scan) : false;

  return `${s.interval} 上${label}${suffix}${clipped ? '（扫描范围内）' : ''}`;
}

/** 渲染极值片段 */
export function formatExtremum(e: Extremum, suffix = ''): string {
  const kind = e.type === 'min' ? '最小值' : '最大值';
  return `x=${round4(e.x)} 处${kind} ${round4(e.y)}${suffix}`;
}

/** 渲染极值片段（特性卡片用，带 $ 公式片段） */
export function formatExtremumMath(e: Extremum): string {
  const kind = e.type === 'min' ? '极小' : '极大';
  return `${kind}值 $x=${round3(e.x)}, y=${round3(e.y)}$`;
}

/**
 * 截断列表：超过 `TRUNCATE_AT` 项时保留前 N 项并追加「…共 M 个」。
 *
 * 缺陷 W6 的一部分：`monotonic` / `extrema` 原本有截断，而 `domain` / `zeroPoints`
 * 没有，导致 `tan(x)` 的 637 个定义域区间直接灌进 UI。现统一走本函数。
 */
export function truncateList(items: string[], total: number, unit: string): string[] {
  if (items.length <= TRUNCATE_AT) return items;
  return [...items.slice(0, TRUNCATE_AT), `…共 ${total} 个${unit}`];
}

export { TREND_TEXT, TREND_TEXT_ARROW, PARITY_TEXT };

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
