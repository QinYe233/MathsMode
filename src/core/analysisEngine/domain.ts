import { parse } from 'mathjs';
import { findAllRoots } from './roots';
import { makeEvaluator } from '../mathUtil';
import type { Interval } from '../../types';

export const INF = Number.POSITIVE_INFINITY;

const WIN_LO = -1000;
const WIN_HI = 1000;
const PROBE = 2000;

interface Constraint {
  sub: string;
  kind: 'geq' | 'gt' | 'neq';
}

export function inferDomain(expr: string, domainStr?: string): Interval[] {
  if (domainStr) {
    const parsed = parseDomainString(domainStr);
    if (parsed) return parsed;
  }
  const constraints = collectConstraints(expr);
  if (constraints.length === 0) {
    return [allReals()];
  }
  let valid: Interval[] = [allReals()];
  for (const c of constraints) {
    const evalSub = makeEvaluator(c.sub);
    const roots = findAllRoots(evalSub, WIN_LO, WIN_HI, { gridPoints: 4000 });
    const regions = c.kind === 'neq' ? neqRegions(roots) : signRegions(c.kind, evalSub, roots);
    valid = mergeIntervals(intersectIntervals(valid, mergeIntervals(regions)));
  }
  return valid;
}

function allReals(): Interval {
  return { lo: -INF, hi: INF, loOpen: true, hiOpen: true };
}

// neq：排除子表达式零点。单个根时极点唯一且可见，域可安全延拓到 ±∞；
// 多个根时窗口外可能还有未见的极点，域只报告搜索窗口内已确认的部分。
function neqRegions(roots: number[]): Interval[] {
  if (roots.length === 0) return [allReals()];
  if (roots.length === 1) {
    return [
      { lo: -INF, hi: roots[0], loOpen: true, hiOpen: true },
      { lo: roots[0], hi: INF, loOpen: true, hiOpen: true },
    ];
  }
  const regions: Interval[] = [];
  regions.push({ lo: WIN_LO, hi: roots[0], loOpen: true, hiOpen: true });
  for (let i = 0; i + 1 < roots.length; i++) {
    regions.push({ lo: roots[i], hi: roots[i + 1], loOpen: true, hiOpen: true });
  }
  regions.push({ lo: roots[roots.length - 1], hi: WIN_HI, loOpen: true, hiOpen: true });
  return regions;
}

// gt/geq：按根切分区间并探测符号，仅保留满足约束的区间。
// geq 在根处取等号成立，故端点闭合；gt 端点开。
function signRegions(kind: 'geq' | 'gt', evalSub: (x: number) => number, roots: number[]): Interval[] {
  const closed = kind === 'geq';
  const probe = (x: number): number => {
    const v = evalSub(x);
    return Number.isFinite(v) ? v : NaN;
  };
  const positive = (x: number): boolean => probe(x) > 0;
  const regions: Interval[] = [];
  if (positive(-PROBE)) {
    regions.push({ lo: -INF, hi: roots[0] ?? INF, loOpen: true, hiOpen: !closed });
  }
  for (let i = 0; i < roots.length; i++) {
    const a = roots[i];
    const b = roots[i + 1] ?? INF;
    const mid = Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : Number.isFinite(a) ? a + 1 : a - 1;
    if (positive(mid)) {
      regions.push({ lo: a, hi: b, loOpen: !closed, hiOpen: !closed });
    }
  }
  if (positive(PROBE)) {
    regions.push({
      lo: roots.length ? roots[roots.length - 1] : -INF,
      hi: INF,
      loOpen: !closed,
      hiOpen: true,
    });
  }
  return regions;
}

// 合并相邻或重叠区间（含去重），如 (-∞, 0] 与 [0, +∞) 并成 (-∞, +∞)。
function mergeIntervals(ivs: Interval[]): Interval[] {
  if (ivs.length < 2) return ivs;
  const sorted = [...ivs].sort((a, b) => a.lo - b.lo || Number(a.loOpen) - Number(b.loOpen));
  const out: Interval[] = [];
  let cur: Interval = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    const overlap = n.lo < cur.hi || (n.lo === cur.hi && (!n.loOpen || !cur.hiOpen));
    if (!overlap) {
      out.push(cur);
      cur = { ...n };
      continue;
    }
    if (n.hi > cur.hi) {
      cur.hi = n.hi;
      cur.hiOpen = n.hiOpen;
    } else if (n.hi === cur.hi) {
      cur.hiOpen = cur.hiOpen || n.hiOpen;
    }
    if (n.lo === cur.lo) {
      cur.loOpen = cur.loOpen && n.loOpen;
    }
  }
  out.push(cur);
  return out;
}

function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) {
    for (const y of b) {
      const lo = Math.max(x.lo, y.lo);
      const hi = Math.min(x.hi, y.hi);
      if (lo > hi || (lo === hi && (x.loOpen || y.loOpen || x.hiOpen || y.hiOpen))) continue;
      const loOpen = x.lo > y.lo ? x.loOpen : y.lo > x.lo ? y.loOpen : x.loOpen || y.loOpen;
      const hiOpen = x.hi < y.hi ? x.hiOpen : y.hi < x.hi ? y.hiOpen : x.hiOpen || y.hiOpen;
      out.push({ lo, hi, loOpen, hiOpen });
    }
  }
  return out;
}

export function inDomain(x: number, domain: Interval[]): boolean {
  return domain.some(
    (iv) =>
      (iv.loOpen ? x > iv.lo : x >= iv.lo) && (iv.hiOpen ? x < iv.hi : x <= iv.hi),
  );
}

function collectConstraints(expr: string): Constraint[] {
  const out: Constraint[] = [];
  let node: any;
  try {
    node = parse(expr);
  } catch {
    return out;
  }
  const walk = (n: any) => {
    if (n.type === 'FunctionNode') {
      const name = String(n.fn?.name ?? '').toLowerCase();
      if (name === 'sqrt' && n.args?.[0]) out.push({ sub: n.args[0].toString(), kind: 'geq' });
      if ((name === 'log' || name === 'ln') && n.args?.[0]) out.push({ sub: n.args[0].toString(), kind: 'gt' });
      if (name === 'tan' && n.args?.[0]) out.push({ sub: `cos(${n.args[0].toString()})`, kind: 'neq' });
      n.args?.forEach(walk);
    } else if (n.type === 'OperatorNode' && n.op === '/' && n.args?.[1]) {
      out.push({ sub: n.args[1].toString(), kind: 'neq' });
      n.args.forEach(walk);
    } else {
      n.forEach?.(walk);
    }
  };
  walk(node);
  return out;
}

export function parseDomainString(s: string): Interval[] | null {
  const parts = s.split('∪').map((p) => p.trim());
  const out: Interval[] = [];
  for (const part of parts) {
    const m = part.match(/^([\[(])\s*([^,\]]+)\s*,\s*([^)\]]+)\s*([\])])$/);
    if (!m) return null;
    const loStr = m[2];
    const hiStr = m[3];
    const lo = loStr === '-inf' || loStr === '-∞' ? -INF : parseFloat(loStr);
    const hi = hiStr === 'inf' || hiStr === '∞' ? INF : parseFloat(hiStr);
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    out.push({ lo, hi, loOpen: m[1] === '(', hiOpen: m[4] === ')' });
  }
  return out.length ? out : null;
}

export function fmtNum(x: number): string {
  if (x === -INF) return '−∞';
  if (x === INF) return '+∞';
  const v = Math.round(x * 1e4) / 1e4;
  return v < 0 ? '−' + String(-v) : String(v);
}

export function fmtInterval(iv: Interval): string;
export function fmtInterval(iv: Interval[]): string[];
export function fmtInterval(iv: Interval | Interval[]): string | string[] {
  if (Array.isArray(iv)) return iv.map((i) => fmtInterval(i));
  return `${iv.loOpen ? '(' : '['}${fmtNum(iv.lo)}, ${fmtNum(iv.hi)}${iv.hiOpen ? ')' : ']'}`;
}
