import { makeEvaluator, derivativeExpr } from '../mathUtil';
import { rationalize } from 'mathjs';
import { findAllRoots } from './roots';
import { inferDomain, fmtInterval, domainMismatch } from './domain';
import type { Interval } from '../../types';
import { analyzeParity } from './parity';
import { analyzeMonotonic } from './monotonic';
import type { MonotonicSegment, Extremum } from '../../types';
import { analyzeAsymptotes } from './asymptotes';
import { analyzePeriod } from './period';
import type { PeriodResult } from './period';
import type { FunctionAnalysis, FunctionDef, Asymptote, Parity } from '../../types';
import { formatMonotonicSegment, formatExtremum, truncateList } from './summary';

export function analyzeFunction(def: FunctionDef): FunctionAnalysis {
  const expr = def.expr.trim();
  const raw = makeEvaluator(expr);
  const f = (x: number) => (Number.isFinite(raw(x)) ? raw(x) : NaN);

  const domain = safe(() => inferDomain(expr, def.domain), [
    { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true },
  ]);
  // 缺陷 W2：AI 声明的定义域若过宽（含表达式无定义的点），已由 inferDomain
  // 取交集收窄；这里记录该事实，供 UI 提示用户，避免用户以为声明值被原样采纳。
  const domainNarrowed = safe(() => domainMismatch(expr, def.domain), false);
  const parity = safe(() => analyzeParity(f, domain), 'neither' as Parity);
  const periodResult = safe(() => analyzePeriod(expr, f, domain), {} as PeriodResult);
  const period = periodResult.period;

  // 周期函数：仅在主周期 [0, T) 内求临界点/零点（性质每周期重复），
  // 否则全区间扫描会产生成百上千个极值/零点（如 sin(x) 在 [-1000,1000] 有 636 个）。
  const scanLo = period !== undefined ? 0 : -1000;
  const scanHi = period !== undefined ? period : 1000;
  const dropRight = (roots: number[]) => roots.filter((r) => r < scanHi - 1e-9);
  // 周期函数不做窗口外放宽：它在主周期内已完整表征，放宽会灌入大量重复零点
  const allowWiden = period === undefined;
  // 记录本次分析**实际**扫描到的半径（自适应放宽会把它扩大到 1e4 / 1e6）。
  // 必须如实反馈给 UI，否则 E3 的「扫描范围内」标注会与实际不符。
  let effectiveRange = Math.abs(scanHi);

  const findRoots = (g: (x: number) => number) => {
    const { roots, range } = findRootsAdaptive(expr, g, scanLo, scanHi, allowWiden);
    effectiveRange = Math.max(effectiveRange, range);
    return roots;
  };

  let monotonic: MonotonicSegment[] = [];
  let extrema: Extremum[] = [];
  const fpExpr = derivativeExpr(expr);
  if (fpExpr) {
    const rawp = makeEvaluator(fpExpr);
    const fprime = (x: number) => (Number.isFinite(rawp(x)) ? rawp(x) : NaN);
    const critical = safe(() => dropRight(findRoots(fprime)), []);
    const mono = safe(() => analyzeMonotonic(fprime, f, critical, domain), {
      segments: [],
      extrema: [],
    });
    monotonic = mono.segments;
    extrema = mono.extrema;
  }

  const zeroPoints = safe(
    () =>
      findRoots(f)
        // 用**实际**扫描半径过滤，而不是固定的基础窗口 scanHi。
        // 之前这里残留 `z < scanHi - 1e-9`，会在自适应放宽后把新找到的根
        // 原地丢掉（实测 `x^2-4000000` 只报 −2000、漏掉 +2000）。
        .filter((z) => z <= effectiveRange + 1e-9)
        .filter((z) => {
          // 用「局部尺度」而非固定 1e-4 判定残差：窗口放宽后根附近的函数值
          // 可能达到数百量级，固定阈值会把真根误杀（缺陷 E4 的收敛判据修正）。
          const scale = Math.max(1, Math.abs(f(z - 1e-6)), Math.abs(f(z + 1e-6)));
          return Math.abs(f(z)) <= 1e-6 * scale;
        }),
    [],
  );
  // 极点扫描窗口与零点/极值同源，并跟随自适应放宽后的实际范围
  const asymptotes = safe(
    () => analyzeAsymptotes(f, domain, { lo: -effectiveRange, hi: effectiveRange }),
    [] as Asymptote[],
  );

  const summary = buildSummary(parity, monotonic, extrema, asymptotes, period, zeroPoints, domain);
  return {
    expression: expr,
    domain,
    parity,
    monotonic,
    extrema,
    asymptotes,
    period,
    zeroPoints,
    summary,
    // 显式带出**实际**扫描窗口：数值搜索只在有限区间内进行，
    // 它是内部实现细节而非数学边界（缺陷 E3）。
    // 自适应放宽后这里会相应变为 ±1e4 / ±1e6，UI 据此标注才与实际相符。
    scanWindow: { lo: scanLo === 0 ? 0 : -effectiveRange, hi: effectiveRange },
    domainNarrowed,
    // 缺陷 W5：数值兜底得到的周期与解析求解的周期可信度不同，需如实标注
    periodUncertain: periodResult.uncertain,
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * 自适应求根（缺陷 E4 余下部分）。
 *
 * `findAllRoots` 只能在给定窗口内搜索，窗口外的根会被**静默丢弃**
 * （实测：`(x-2000)*(x-1)` 在默认窗口内只报告 `x=1`）。
 *
 * 采用**由粗到精的两遍扫描**，比「只看窗口外两点符号」更可靠：
 * 1. **粗扫**：在整个宽域 `±WIDE` 上用较大步长找符号跳变区间；
 * 2. **精扫**：只对跳变区间调用高分辨率 `findAllRoots`，并只补充落到基础窗口之外的根。
 *
 * 为什么不能只看 `f(-WIDE)` 与 `f(+WIDE)` 是否异号：`x^2 - 4000000` 在 ±1e6
 * 处**同为正**，却有 ±2000 两个零点——只看两端会漏掉偶数个窗口外根。
 *
 * 常规开销可忽略：`x^2-2x-3`、`(x^2+1)/x` 在宽域粗扫中无符号跳变，粗扫成本约
 * 2000 次求值（相对精扫的 2000 点 + 切点二次遍历属小量）。
 *
 * **不适用于周期函数**：`sin(x)` 处处跳变，会灌入成千上万个周期内的零点
 * （实测由 2 个变成 466 个）。周期函数只在主周期内求根并标注「每周期重复」，
 * 故调用方对周期情形传 `widen = false`。
 */
function findRootsAdaptive(
  expr: string,
  f: (x: number) => number,
  lo: number,
  hi: number,
  widen: boolean,
): { roots: number[]; range: number } {
  const base = findAllRoots(f, lo, hi);
  const baseRange = Math.abs(hi);
  if (!widen) return { roots: base, range: baseRange };

  // **多项式**才有可靠的自适应窗口：用 Cauchy 根界
  //   R = 1 + max|cᵢ/cₙ|
  // 这是严格的数学上界——所有实根必落在 [−R, R] 内，因此扫描该范围是**有依据的**，
  // 而不是「猜一个更大的窗口」。
  //
  // 非多项式（sin/cos/log/分数幂…）无法给出这种上界，**不做放宽**：
  // 与其用启发式乱扫（曾导致 x^2-2x-3 的分析耗时 65 s），不如保持基础窗口，
  // 并通过 `scanWindow` 如实告知用户搜索范围（E3 已提供该信息）。
  const bound = polynomialRootBound(expr);
  if (bound === null || bound <= baseRange) return { roots: base, range: baseRange };

  return { roots: findAllRoots(f, -bound, bound), range: bound };
}

/** 自适应放大的上限。
 *
 * 取值权衡（实测）：Cauchy 根界对大系数多项式会给出很大的数
 * （`x^2-4000000` 的界是 4e6），若照此全分辨率扫描，单次分析会从 ~60 ms
 * 膨胀到 **52 s**（实测），完全不可接受。
 *
 * 因此把放宽半径限制在 `MAX_ROOT_BOUND`：以基础窗口 2 倍的代价覆盖
 * ±1e3～±2e3 量级的根（如 `x^2-4000000` 的 ±2000），这是高中范围内
 * 最常见的「远根」情形。更远的根（>2e3）**不做猜测式扫描**——
 * 其搜索范围通过 `scanWindow` 如实告知用户，必要时可由 AI 提供 `domain`。
 */
const MAX_ROOT_BOUND = 2000;

/**
 * 用 Cauchy 根界求多项式实根的扫描半径上界。
 *
 * 对 p(x) = c₀ + c₁x + … + cₙxⁿ（cₙ ≠ 0），所有实根满足
 *   |x| ≤ 1 + max_{i<n} |cᵢ / cₙ|
 *
 * 非多项式（`rationalize` 抛错）或次数为 0 时返回 `null`。
 */
function polynomialRootBound(expr: string): number | null {
  let coeffs: number[];
  try {
    // mathjs 的 rationalize 会精确提取多项式系数（升幂序）；
    // 遇到 sin/ln 等未解函数调用或非整数指数会抛错，正是我们要的「非多项式」信号。
    const r = rationalize(expr, {}, true) as { coefficients: number[] };
    coeffs = r.coefficients.map(Number);
  } catch {
    return null;
  }
  if (!Array.isArray(coeffs) || coeffs.length <= 1) return null;
  if (!coeffs.every((c) => Number.isFinite(c))) return null;

  const lead = coeffs[coeffs.length - 1];
  if (lead === 0) return null;
  let maxRatio = 0;
  for (let i = 0; i < coeffs.length - 1; i++) {
    maxRatio = Math.max(maxRatio, Math.abs(coeffs[i] / lead));
  }
  const bound = 1 + maxRatio;
  if (!Number.isFinite(bound)) return null;
  return Math.min(bound, MAX_ROOT_BOUND);
}

/**
 * 多项式根界的说明（见 `polynomialRootBound` 与 `MAX_ROOT_BOUND`）。
 *
 * 非多项式（`sin` / `log` / 分数幂…）无法给出严格的根上界，因此**不做放宽**：
 * 与其用启发式乱扫（曾实测把 `x^2-2x-3` 的分析拖到 65 s），不如保持基础窗口，
 * 并通过 `scanWindow` 如实告知用户搜索范围（E3 已提供该信息）。
 */

function buildSummary(
  parity: Parity,
  monotonic: MonotonicSegment[],
  extrema: Extremum[],
  asymptotes: Asymptote[],
  period: number | undefined,
  zeroPoints: number[],
  domain: Interval[],
): string {
  const parts: string[] = [];
  parts.push(`定义域：${domain.map(fmtInterval).join(' ∪ ')}`);
  parts.push(`奇偶性：${parity === 'odd' ? '奇函数' : parity === 'even' ? '偶函数' : '非奇非偶'}`);
  const suffix = period !== undefined ? '（每周期重复）' : '';
  if (monotonic.length) {
    // 与 PropertyCard 共用同一套措辞（缺陷 E3：两处各自实现必然漂移）
    const items = monotonic.map((s) => formatMonotonicSegment(s, { suffix }));
    const text =
      items.length <= 6
        ? items.join('，')
        : `${items.slice(0, 6).join('，')}…共 ${monotonic.length} 个区间`;
    parts.push(`单调性：${text}`);
  }
  if (extrema.length) {
    const items = extrema.map((e) => formatExtremum(e, suffix));
    const text =
      items.length <= 6
        ? items.join('，')
        : `${items.slice(0, 6).join('，')}…共 ${extrema.length} 个`;
    parts.push(`极值：${text}`);
  }
  if (zeroPoints.length) {
    // 零点同样需要截断（缺陷 W6：此前只有 monotonic/extrema 有截断保护）
    const items = truncateList(
      zeroPoints.map((z) => `x = ${round(z)}`),
      zeroPoints.length,
      '',
    );
    parts.push(`零点：${items.join('、')}${suffix}`);
  }
  if (asymptotes.length) {
    parts.push(`渐近线：${asymptotes.map((a) => a.value).join('，')}`);
  }
  if (period !== undefined) {
    parts.push(`最小正周期：${round(period)}`);
  }
  return parts.join('；') + '。';
}

function round(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
