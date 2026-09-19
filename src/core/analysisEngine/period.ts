import { ConstantNode, parse } from 'mathjs';
import type { Interval } from '../../types';
import { inDomain } from './domain';

export interface PeriodResult {
  /** 最小正周期；未检出为 undefined */
  period?: number;
  /**
   * 是否只能给出**数值验证**的周期（而非解析求解）。
   *
   * 缺陷 W5：旧实现把数值兜底的结果与解析结果同等输出，用户无法分辨
   * 「三角函数的严格周期」与「在某段采样上表现像周期」。
   */
  uncertain?: boolean;
}

export function analyzePeriod(
  expr: string,
  f: (x: number) => number,
  domain: Interval[],
): PeriodResult {
  const trig = collectTrig(expr);
  if (trig.length > 0 && !hasXOutsideTrig(expr)) {
    let period: number | undefined;
    for (const [name, arg] of trig) {
      const a = linearCoeff(arg);
      if (a === undefined || a === 0) return {};
      const base = name === 'tan' ? Math.PI : 2 * Math.PI;
      const T = base / Math.abs(a);
      period = period === undefined ? T : lcmApprox(period, T);
      if (period === undefined) return {};
    }
    if (period === undefined) return {};

    // 解析值可能**偏大**：三角外的变换会缩短周期而解析式看不出来。
    // 实测 `abs(sin(x))` 的周期是 π，但按 sin 的参数算得 2π。
    //
    // 关键：必须**从最小的候选开始**试。周期有「整数倍仍是周期」的性质，
    // 若从 T 开始向上试，会立刻命中 T 而返回一个偏大的值
    // （这正是本节第一版实现的错误）。
    for (const divisor of [16, 12, 8, 6, 5, 4, 3, 2, 1]) {
      const candidate = period / divisor;
      if (candidate < 1e-3) break; // 过小无意义，且易被数值巧合命中
      if (isPeriod(f, candidate, domain)) return { period: candidate };
    }
    // 连 T 本身都不成立说明解析假设失效（例如含取整、分段），退回数值兜底
    return numericFallback(f, domain);
  }

  return numericFallback(f, domain);
}

/**
 * 数值兜底：候选周期表**显著扩展**（缺陷 W5：旧表只有 8 个值，
 * 3、π/3、π/4、π/6 等常见周期永远无法被识别）。
 * 命中即标记 `uncertain`，如实告知用户该值来自采样验证。
 */
function numericFallback(f: (x: number) => number, domain: Interval[]): PeriodResult {
  const P = Math.PI;
  const candidates = [
    2 * P, P, (2 / 3) * P, P / 2, P / 3, P / 4, P / 6,
    6, 4, 3, 2, 1.5, 1, 0.5, 0.25,
  ];
  for (const T of candidates) {
    if (isPeriod(f, T, domain)) return { period: T, uncertain: true };
  }
  return {};
}

/**
 * 判断「三角函数之外是否还有 x」。
 *
 * 缺陷 W5：解析失败时旧实现返回 `false`（语义为「未发现外部 x」），
 * 会误导调用方走解析分支。改为返回 `true`——**保守地认为无法确认**，
 * 从而退回数值兜底，而不是基于未解析成功的表达式下结论。
 */
function hasXOutsideTrig(expr: string): boolean {
  let root: any;
  try {
    root = parse(expr);
  } catch {
    return true;
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

/**
 * 数值周期判定（缺陷 W5）。
 *
 * 采样范围从旧的 `[-10, 10)` 步长 `0.7`（30 点）加密到 `[-12, 12)` 步长 `0.4`
 * （60 点），要求至少 15 个有效点才敢确认——旧实现只需 10 个。
 * 采样过稀容易把「在某段上恰好重复」误判为周期。
 */
function isPeriod(f: (x: number) => number, T: number, domain: Interval[]): boolean {
  const lo = -12;
  const step = 0.4;
  const count = 60;
  let checked = 0;
  for (let i = 0; i < count; i++) {
    const x = lo + i * step;
    if (!inDomain(x, domain) || !inDomain(x + T, domain)) continue;
    const a = f(x);
    const b = f(x + T);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    checked++;
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    if (Math.abs(a - b) > 1e-6 * scale) return false;
  }
  return checked >= 15;
}
