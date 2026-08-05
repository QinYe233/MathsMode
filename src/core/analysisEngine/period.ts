import { ConstantNode, parse } from 'mathjs';
import type { Interval } from '../../types';
import { inDomain } from './domain';

export function analyzePeriod(
  expr: string,
  f: (x: number) => number,
  domain: Interval[],
): number | undefined {
  const trig = collectTrig(expr);
  if (trig.length > 0 && !hasXOutsideTrig(expr)) {
    let period: number | undefined;
    for (const [name, arg] of trig) {
      const a = linearCoeff(arg);
      if (a === undefined || a === 0) return undefined;
      const base = name === 'tan' ? Math.PI : 2 * Math.PI;
      const T = base / Math.abs(a);
      period = period === undefined ? T : lcmApprox(period, T);
      if (period === undefined) return undefined;
    }
    return period;
  }
  const candidates = [2 * Math.PI, Math.PI, (2 / 3) * Math.PI, Math.PI / 2, 4, 2, 1, 0.5];
  for (const T of candidates) {
    if (isPeriod(f, T, domain)) return T;
  }
  return undefined;
}

function hasXOutsideTrig(expr: string): boolean {
  let root: any;
  try {
    root = parse(expr);
  } catch {
    return false;
  }
  const stripped = root.transform((n: any) => {
    if (n.type === 'FunctionNode') {
      const name = String(n.fn?.name ?? '').toLowerCase();
      if (name === 'sin' || name === 'cos' || name === 'tan') {
        return new ConstantNode(0);
      }
    }
    return n;
  });
  let found = false;
  const walk = (n: any) => {
    if (found) return;
    if (n.type === 'SymbolNode' && n.name === 'x') {
      found = true;
      return;
    }
    n.forEach?.(walk);
  };
  walk(stripped);
  return found;
}

function collectTrig(expr: string): [string, string][] {
  const out: [string, string][] = [];
  let node: any;
  try {
    node = parse(expr);
  } catch {
    return out;
  }
  const walk = (n: any) => {
    if (n.type === 'FunctionNode') {
      const name = String(n.fn?.name ?? '').toLowerCase();
      if ((name === 'sin' || name === 'cos' || name === 'tan') && n.args?.[0]) {
        out.push([name, n.args[0].toString()]);
      }
      n.args?.forEach(walk);
    } else {
      n.forEach?.(walk);
    }
  };
  walk(node);
  return out;
}

function linearCoeff(arg: string): number | undefined {
  try {
    const n: any = parse(arg);
    const getX = (node: any): number | undefined => {
      if (node.type === 'SymbolNode') return node.name === 'x' ? 1 : undefined;
      if (node.type === 'OperatorNode' && node.op === '*') {
        const [l, r] = node.args;
        const lv = l.type === 'ConstantNode' ? Number(l.value) : undefined;
        const rv = r.type === 'SymbolNode' && r.name === 'x' ? 1 : undefined;
        if (lv !== undefined && rv !== undefined) return lv;
        const lv2 = l.type === 'SymbolNode' && l.name === 'x' ? 1 : undefined;
        const rv2 = r.type === 'ConstantNode' ? Number(r.value) : undefined;
        if (lv2 !== undefined && rv2 !== undefined) return rv2;
      }
      return undefined;
    };
    if (n.type === 'OperatorNode' && (n.op === '+' || n.op === '-')) {
      const a = getX(n.args[0]);
      const b = getX(n.args[1]);
      if (a !== undefined && b === undefined) return a;
      if (a === undefined && b !== undefined) return n.op === '+' ? b : -b;
      if (a !== undefined && b !== undefined) return n.op === '+' ? a + b : a - b;
      return undefined;
    }
    return getX(n);
  } catch {
    return undefined;
  }
}

function lcmApprox(a: number, b: number): number | undefined {
  for (let m = 1; m <= 30; m++) {
    for (let n = 1; n <= 30; n++) {
      if (Math.abs(m * a - n * b) < 1e-6 * Math.max(m * a, n * b)) {
        return m * a;
      }
    }
  }
  return undefined;
}

function isPeriod(f: (x: number) => number, T: number, domain: Interval[]): boolean {
  let checked = 0;
  for (let i = 0; i < 30; i++) {
    const x = -10 + i * 0.7;
    if (!inDomain(x, domain) || !inDomain(x + T, domain)) continue;
    const a = f(x);
    const b = f(x + T);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    checked++;
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    if (Math.abs(a - b) > 1e-6 * scale) return false;
  }
  return checked >= 10;
}
