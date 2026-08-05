import { makeEvaluator, derivativeExpr } from '../mathUtil';
import { findAllRoots } from './roots';
import { inferDomain, fmtInterval } from './domain';
import type { Interval } from '../../types';
import { analyzeParity } from './parity';
import { analyzeMonotonic } from './monotonic';
import type { MonotonicSegment, Extremum } from '../../types';
import { analyzeAsymptotes } from './asymptotes';
import { analyzePeriod } from './period';
import type { FunctionAnalysis, FunctionDef, Asymptote, Parity } from '../../types';

export function analyzeFunction(def: FunctionDef): FunctionAnalysis {
  const expr = def.expr.trim();
  const raw = makeEvaluator(expr);
  const f = (x: number) => (Number.isFinite(raw(x)) ? raw(x) : NaN);

  const domain = safe(() => inferDomain(expr, def.domain), [
    { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true },
  ]);
  const parity = safe(() => analyzeParity(f, domain), 'neither' as Parity);

  let monotonic: MonotonicSegment[] = [];
  let extrema: Extremum[] = [];
  const fpExpr = derivativeExpr(expr);
  if (fpExpr) {
    const rawp = makeEvaluator(fpExpr);
    const fprime = (x: number) => (Number.isFinite(rawp(x)) ? rawp(x) : NaN);
    const critical = safe(() => findAllRoots(fprime, -1000, 1000), []);
    const mono = safe(() => analyzeMonotonic(fprime, f, critical, domain), {
      segments: [],
      extrema: [],
    });
    monotonic = mono.segments;
    extrema = mono.extrema;
  }

  const zeroPoints = safe(
    () => findAllRoots(f, -1000, 1000).filter((z) => Math.abs(f(z)) < 1e-4),
    [],
  );
  const asymptotes = safe(() => analyzeAsymptotes(f, domain), [] as Asymptote[]);
  const period = safe(() => analyzePeriod(expr, f, domain), undefined);

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
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

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
  if (monotonic.length) {
    const map = { inc: '递增', dec: '递减', const: '不变' } as const;
    const items = monotonic.map((s) => `${s.interval} 上${map[s.trend]}`);
    const text =
      items.length <= 6
        ? items.join('，')
        : `${items.slice(0, 6).join('，')}…共 ${monotonic.length} 个区间`;
    parts.push(`单调性：${text}`);
  }
  if (extrema.length) {
    const items = extrema.map(
      (e) => `x=${round(e.x)} 处${e.type === 'min' ? '最小值' : '最大值'} ${round(e.y)}`,
    );
    const text =
      items.length <= 6
        ? items.join('，')
        : `${items.slice(0, 6).join('，')}…共 ${extrema.length} 个`;
    parts.push(`极值：${text}`);
  }
  if (zeroPoints.length) {
    parts.push(`零点：x = ${zeroPoints.map((z) => round(z)).join('、')}`);
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
