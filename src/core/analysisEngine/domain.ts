import { parse } from 'mathjs';
import type { MathNode } from 'mathjs';
import { findAllRoots } from './roots';
import { makeEvaluator } from '../mathUtil';
import type { Interval } from '../../types';

export const INF = Number.POSITIVE_INFINITY;

const WIN_LO = -1000;
const WIN_HI = 1000;

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
    return [{ lo: -INF, hi: INF, loOpen: true, hiOpen: true }];
  }
  let valid: Interval[] = [{ lo: -INF, hi: INF, loOpen: true, hiOpen: true }];
  for (const c of constraints) {
    const evalSub = makeEvaluator(c.sub);
    // 分区点 = 子表达式零点 ∪ 子表达式极点（即 1/sub 的零点）∪ 线性解析解：
    // 极点是符号跳变点，不分区会得到错误区间（如 sqrt(1/x) 会把负数误收进来）
    const roots = findAllRoots(evalSub, WIN_LO, WIN_HI, { gridPoints: 4000 });
    const poles = findAllRoots(
      (x) => {
        const v = evalSub(x);
        return v === 0 ? 0 : 1 / v;
      },
      WIN_LO,
      WIN_HI,
      { gridPoints: 4000 },
    );
    // neq 约束用解析解覆盖窗口外的线性极点（如 1/(x-2000)）
    const analytic = c.kind === 'neq' ? analyticLinearRoot(c.sub) : null;
    const points = dedupeSorted([
      ...roots,
      ...poles,
      ...(analytic === null ? [] : [analytic]),
    ]);

    if (c.kind === 'neq') {
      valid = intersectIntervals(valid, neqRegions(points));
      continue;
    }

    const closed = c.kind === 'geq';
    const regions: Interval[] = [];
    if (points.length === 0) {
      // 无分区点：整个数轴符号一致，按窗口外探针判定
      if (signOf(evalSub, 2000) > 0) {
        regions.push({ lo: -INF, hi: INF, loOpen: true, hiOpen: true });
      }
    } else {
      if (signOf(evalSub, -2000) > 0) {
        regions.push({ lo: -INF, hi: points[0], loOpen: true, hiOpen: !closed });
      }
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i];
        const b = points[i + 1];
        const mid = (a + b) / 2;
        if (signOf(evalSub, mid) > 0) {
          regions.push({ lo: a, hi: b, loOpen: !closed, hiOpen: !closed });
        }
      }
      if (signOf(evalSub, 2000) > 0) {
        regions.push({ lo: points[points.length - 1], hi: INF, loOpen: !closed, hiOpen: true });
      }
    }
    valid = intersectIntervals(valid, regions);
  }
  return valid;
}

function signOf(evalSub: (x: number) => number, x: number): number {
  const v = evalSub(x);
  return Number.isFinite(v) && v > 0 ? 1 : -1;
}

function analyticLinearRoot(sub: string): number | null {
  // mathjs toString 会给分式分母加括号：1/(x-2000) 的分母是 "(x - 2000)"
  let t = sub.replace(/\s+/g, '');
  if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1);
  if (t === 'x') return 0;
  let m = t.match(/^x([+-]\d+(?:\.\d+)?)$/);
  if (m) return -parseFloat(m[1]);
  m = t.match(/^([+-]?\d+(?:\.\d+)?)\*x([+-]\d+(?:\.\d+)?)?$/);
  if (m) return m[2] ? -parseFloat(m[2]) / parseFloat(m[1]) : 0;
  return null;
}

function dedupeSorted(xs: number[]): number[] {
  const sorted = xs.filter(Number.isFinite).sort((p, q) => p - q);
  const out: number[] = [];
  for (const x of sorted) {
    if (out.length === 0 || Math.abs(x - out[out.length - 1]) > 1e-6) out.push(x);
  }
  return out;
}

// neq：排除孤立点。多分区点（如 tan 的众多极点）时尾部裁剪到搜索窗口
// （窗口外是否还有极点不可验证，保守起见不声称 ±∞）；
// 单个分区点时允许 ±∞ 尾部——线性解析解保证了窗口外无其他零点。
function neqRegions(points: number[]): Interval[] {
  const regions: Interval[] = [];
  let prev = -INF;
  const clipTail = points.length > 1;
  for (let i = 0; i < points.length; i++) {
    const r = points[i];
    const lo = clipTail && i === 0 ? Math.max(prev, WIN_LO) : prev;
    regions.push({ lo, hi: r, loOpen: true, hiOpen: true });
    prev = r;
  }
  regions.push({ lo: prev, hi: clipTail ? WIN_HI : INF, loOpen: true, hiOpen: true });
  return regions;
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
    (iv) => (iv.loOpen ? x > iv.lo : x >= iv.lo) && (iv.hiOpen ? x < iv.hi : x <= iv.hi),
  );
}

function collectConstraints(expr: string): Constraint[] {
  const out: Constraint[] = [];
  let node: MathNode;
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
    } else if (n.type === 'OperatorNode' && n.op === '^' && n.args?.[1] && n.args[1].type === 'ConstantNode') {
      const exp = Number(n.args[1].value);
      if (exp < 0) out.push({ sub: n.args[0].toString(), kind: 'neq' });
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
  const r = Math.round(x * 1e4) / 1e4;
  return String(r === 0 ? 0 : r).replace('-', '−');
}

export function fmtInterval(iv: Interval | Interval[]): string[] {
  const list = Array.isArray(iv) ? iv : [iv];
  return list.map((x) => `${x.loOpen ? '(' : '['}${fmtNum(x.lo)}, ${fmtNum(x.hi)}${x.hiOpen ? ')' : ']'}`);
}
