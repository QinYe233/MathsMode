import type { Interval, MonotonicSegment, Extremum } from '../../types';
import { INF, fmtNum } from './domain';

export function analyzeMonotonic(
  fprime: (x: number) => number,
  f: (x: number) => number,
  criticalPoints: number[],
  domain: Interval[],
): { segments: MonotonicSegment[]; extrema: Extremum[] } {
  const breakpoints = new Set<number>(criticalPoints.filter(Number.isFinite));
  for (const iv of domain) {
    if (Number.isFinite(iv.lo)) breakpoints.add(iv.lo);
    if (Number.isFinite(iv.hi)) breakpoints.add(iv.hi);
  }
  const sorted = [...breakpoints].sort((a, b) => a - b);
  const windows: [number, number][] = [];
  if (sorted.length === 0) windows.push([-INF, INF]);
  else {
    windows.push([-INF, sorted[0]]);
    for (let i = 0; i + 1 < sorted.length; i++) windows.push([sorted[i], sorted[i + 1]]);
    windows.push([sorted[sorted.length - 1], INF]);
  }

  const segments: MonotonicSegment[] = [];
  for (const [a, b] of windows) {
    if (!overlapsDomain(a, b, domain)) continue;
    const mid = finiteMid(a, b);
    const signs: number[] = [];
    for (const m of [mid, mid + 1e-3, mid - 1e-3]) {
      const v = fprime(m);
      if (Number.isFinite(v)) signs.push(v);
    }
    if (signs.length === 0) continue;
    const avg = signs.reduce((s, v) => s + v, 0) / signs.length;
    const trend: MonotonicSegment['trend'] = avg > 1e-8 ? 'inc' : avg < -1e-8 ? 'dec' : 'const';
    segments.push({ interval: `(${fmtNum(a)}, ${fmtNum(b)})`, trend });
  }

  const extrema: Extremum[] = [];
  for (const c of sorted) {
    if (!Number.isFinite(c) || !interiorOfDomain(c, domain)) continue;
    const left = fprime(c - 1e-4);
    const right = fprime(c + 1e-4);
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    const y = f(c);
    if (!Number.isFinite(y)) continue;
    if (left < -1e-8 && right > 1e-8) extrema.push({ x: c, y, type: 'min' });
    else if (left > 1e-8 && right < -1e-8) extrema.push({ x: c, y, type: 'max' });
  }
  return { segments, extrema };
}

function overlapsDomain(a: number, b: number, domain: Interval[]): boolean {
  return domain.some((iv) => {
    const lo = Math.max(a, iv.lo);
    const hi = Math.min(b, iv.hi);
    return lo < hi;
  });
}

function interiorOfDomain(c: number, domain: Interval[]): boolean {
  return domain.some((iv) => {
    const loOk = iv.loOpen ? c > iv.lo + 1e-9 : c >= iv.lo + 1e-9;
    const hiOk = iv.hiOpen ? c < iv.hi - 1e-9 : c <= iv.hi - 1e-9;
    return loOk && hiOk;
  });
}

function finiteMid(a: number, b: number): number {
  if (a === -INF && b === INF) return 0;
  if (a === -INF) return b - 1;
  if (b === INF) return a + 1;
  return (a + b) / 2;
}
