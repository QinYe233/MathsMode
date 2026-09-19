import { parse } from 'mathjs';
import type { MathNode } from 'mathjs';
import type { Interval } from '../../types';
import { normalizeExpr } from './normalize';
import { makeEvaluator } from './compile';
import { findAllRoots } from './roots';
import { probeDomainStatus, boundedProbe } from './interval';

/**
 * 定义域推断。
 *
 * ## 为什么有「函数定义域表」
 *
 * 旧实现（`analysisEngine/domain.ts`）用手写的 `if (name === 'sqrt') ... else if ...`
 * 逐个判断函数。这种写法**每漏一个函数就产出一个错误答案**，且无任何提示。
 * 实测缺陷 E2：`asin(x)` / `acos(x)` 定义域被算成 `(−∞, +∞)`。
 *
 * 现改为**声明式表**：把「函数 → 参数约束」集中在一处（`FUNCTION_DOMAIN_TABLE`），
 * 遍历时查表。新增函数只需加一行，不再散落在分支里。
 *
 * 同时引入**白名单**：已知处处有定义的函数（`KNOWN_TOTAL_FUNCTIONS`）与未知函数
 * 区分开。未知函数不再被静默当作「全体实数」，而是被记录下来
 * （`collectConstraintsDetailed().unknown`），供上层决定是否降低结论置信度。
 */

export const INF = Number.POSITIVE_INFINITY;

const WIN_LO = -1000;
const WIN_HI = 1000;

/** 子表达式必须满足的约束种类 */
export type ConstraintKind = 'geq' | 'gt' | 'neq';

export interface Constraint {
  /** 需满足约束的子表达式（mathjs 表达式串） */
  sub: string;
  kind: ConstraintKind;
  /** 来源函数/运算，便于调试与提示 */
  from: string;
}

/**
 * 函数定义域表：函数名 → 参数约束。
 *
 * `args` 为各参数位置的约束（`null` 表示该位置无约束）。
 * 约束以参数表达式字符串形式返回，由 `evalSub` 求值/分区。
 */
const FUNCTION_DOMAIN_TABLE: Record<
  string,
  (args: string[]) => Constraint[]
> = {
  // ── 平方根类：被开方数 ≥ 0 ──────────────────────────────
  sqrt: (a) => [{ sub: a[0], kind: 'geq', from: 'sqrt' }],

  // ── 对数类：真数 > 0（底数为常量时无需额外约束）──────────
  log: (a) => {
    const out: Constraint[] = [{ sub: a[0], kind: 'gt', from: 'log' }];
    // log(x, b)：底数必须是常量且 b > 0、b ≠ 1；此处仅在能判定为常量时校验
    if (a.length >= 2) {
      const b = Number(a[1]);
      if (Number.isFinite(b) && !(b > 0 && b !== 1)) {
        out.push({ sub: '0', kind: 'gt', from: 'log:base' }); // 恒不满足 → 空定义域
      }
    }
    return out;
  },
  ln: (a) => [{ sub: a[0], kind: 'gt', from: 'ln' }],
  log2: (a) => [{ sub: a[0], kind: 'gt', from: 'log2' }],
  log10: (a) => [{ sub: a[0], kind: 'gt', from: 'log10' }],

  // ── 反三角函数 ────────────────────────────────────────
  // 缺陷 E2：旧实现完全没识别这几个，定义域被算成全体实数
  asin: (a) => [
    { sub: `(${a[0]}) + 1`, kind: 'geq', from: 'asin' }, //  u ≥ −1
    { sub: `1 - (${a[0]})`, kind: 'geq', from: 'asin' }, //  u ≤  1
  ],
  acos: (a) => [
    { sub: `(${a[0]}) + 1`, kind: 'geq', from: 'acos' },
    { sub: `1 - (${a[0]})`, kind: 'geq', from: 'acos' },
  ],
  /** asec(u) / acsc(u)：|u| ≥ 1，等价于 u² − 1 ≥ 0 */
  asec: (a) => [{ sub: `(${a[0]})^2 - 1`, kind: 'geq', from: 'asec' }],
  acsc: (a) => [{ sub: `(${a[0]})^2 - 1`, kind: 'geq', from: 'acsc' }],

  // ── 三角函数的零点（极点来自分母）──────────────────────
  tan: (a) => [{ sub: `cos(${a[0]})`, kind: 'neq', from: 'tan' }],
  sec: (a) => [{ sub: `cos(${a[0]})`, kind: 'neq', from: 'sec' }],
  csc: (a) => [{ sub: `sin(${a[0]})`, kind: 'neq', from: 'csc' }],
  cot: (a) => [{ sub: `sin(${a[0]})`, kind: 'neq', from: 'cot' }],
};

/**
 * 已知在 ℝ 上处处有定义的函数——显式声明，避免被误判为「未知函数」。
 * 这是**白名单**：只有在这里或表中出现过的函数才被认为「域已知」。
 */
const KNOWN_TOTAL_FUNCTIONS = new Set([
  'sin', 'cos', 'exp', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh',
  'abs', 'sign', 'floor', 'ceil', 'round', 'cbrt', 'expm1', 'log1p',
  'atan2', 'hypot', 'min', 'max', 'pow',
]);

export interface ConstraintCollection {
  constraints: Constraint[];
  /** 遇到但表中没有、也不在全域白名单里的函数名 */
  unknown: string[];
}

/**
 * 从表达式 AST 收集定义域约束。
 *
 * 支持 `:domain=[...]` 绘图指令后缀（function-plot 语法），会被剥离后再解析。
 */
export function collectConstraintsDetailed(expr: string): ConstraintCollection {
  const out: Constraint[] = [];
  const unknown: string[] = [];

  // 剥离 function-plot 的 domain 绘图指令，它不是数学表达式的一部分
  const mathExpr = stripPlotDomainDirective(normalizeExpr(expr));

  let node: MathNode;
  try {
    node = parse(mathExpr);
  } catch {
    return { constraints: out, unknown };
  }

  const walk = (n: any) => {
    if (n.type === 'FunctionNode') {
      const name = String(n.fn?.name ?? '').toLowerCase();
      const args: string[] = (n.args ?? []).map((x: any) => x.toString());

      const rule = FUNCTION_DOMAIN_TABLE[name];
      if (rule) {
        out.push(...rule(args));
      } else if (!KNOWN_TOTAL_FUNCTIONS.has(name)) {
        unknown.push(name);
      }
      n.args?.forEach(walk);
      return;
    }

    if (n.type === 'OperatorNode') {
      if (n.op === '/' && n.args?.[1]) {
        out.push({ sub: n.args[1].toString(), kind: 'neq', from: 'divide' });
      } else if (n.op === '^' && n.args?.[1]) {
        const base = n.args[0];
        const expNode = n.args[1];
        if (expNode.type === 'ConstantNode') {
          const e = Number(expNode.value);
          if (Number.isFinite(e)) {
            if (e < 0) {
              // x^(-n)：底数不能为 0
              out.push({ sub: base.toString(), kind: 'neq', from: 'negative-power' });
            } else if (!Number.isInteger(e)) {
              // x^0.5 等非整数幂：底数必须 ≥ 0（实数范围内）
              out.push({ sub: base.toString(), kind: 'geq', from: 'fractional-power' });
            }
          }
        } else {
          // 指数非常量（如 x^y）：无法静态判定，记为不确定
          unknown.push(`^(${expNode.toString()})`);
        }
      }
      n.args?.forEach(walk);
      return;
    }

    n.forEach?.(walk);
  };

  walk(node);
  return { constraints: out, unknown };
}

/** 仅需约束列表时的便捷入口 */
export function collectConstraints(expr: string): Constraint[] {
  return collectConstraintsDetailed(expr).constraints;
}

/**
 * 剥离 function-plot 的 `:domain=[...]` 绘图指令后缀。
 * 例：`x^2 :domain=[-5,5]` → `x^2`
 */
function stripPlotDomainDirective(expr: string): string {
  return expr.replace(/:domain\s*=\s*\[[^\]]*\]\s*$/i, '').trim();
}

export function inferDomain(expr: string, domainStr?: string): Interval[] {
  const inferred = inferDomainExact(expr);
  if (!domainStr) return inferred;

  const declared = parseDomainString(domainStr);
  if (!declared) return inferred;

  // 缺陷 W2：此前是「声明值可解析就直接返回」，完全不与表达式核对。
  // AI 若写出过宽的定义域（例如给 log(x-4) 声明 (-inf, inf)），
  // 后续所有特性都会建立在错误定义域上且无从察觉。
  // 现改为**取交集**：声明值可以收窄（如 AI 指出题目限定 x>0），
  // 但绝不能放宽到表达式本身无定义的区域。
  const both = intersectIntervals(declared, inferred);
  return both;
}

/**
 * 表达式**自身**蕴含的定义域（不考虑外部声明）。
 *
 * 与 `inferDomain(expr)` 的区别：后者在提供 `domainStr` 时会取交集。
 * 本函数用于「声明值与推导值是否一致」的判定。
 */
export function inferDomainExact(expr: string): Interval[] {
  const { constraints } = collectConstraintsDetailed(expr);
  if (constraints.length === 0) {
    return [{ lo: -INF, hi: INF, loOpen: true, hiOpen: true }];
  }  let valid: Interval[] = [{ lo: -INF, hi: INF, loOpen: true, hiOpen: true }];
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
    // 线性解析解：覆盖落在 [-1000,1000] 搜索窗口之外的线性边界。
    // 缺陷修复：旧实现只在 neq 分支使用它，导致 sqrt(x-2000)、log(x-2000)
    // 这类「边界在窗口外」的不等式约束没有任何分区点，
    // 于是被 signOf(±2000) 探针误判为「全负」→ 误报空定义域 / 全体实数。
    const analytic = analyticLinearRoot(c.sub);
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
      // 尾区间 [p_last, +∞)：探针必须在 p_last **右侧**，否则大边界
      // （如 sqrt(x-3000) 的 x=3000）会被固定探针 x=2000 误判为不成立。
      const last = points[points.length - 1];
      const tailProbe = Math.max(2000, last + Math.max(1, Math.abs(last)) * 1e-3 + 1);
      if (signOf(evalSub, tailProbe) > 0) {
        regions.push({ lo: last, hi: INF, loOpen: !closed, hiOpen: true });
      }
    }
    valid = intersectIntervals(valid, regions);
  }
  // 独立交叉校验（缺陷 E2 的兜底）：用区间算术验证每个候选区间是否真的「处处无定义」。
  // 这是单向的——只**排除**被证明完全落在定义域之外的区间，绝不用它声称某处**有**定义。
  // 价值：即使函数定义域表漏了一个函数（这正是 E2 的成因），这里仍能兜住。
  return dropEntirelyOutsideDomain(normalizeExpr(expr), valid);
}

/**
 * 判定 AI/外部声明的定义域是否与表达式**自身**蕴含的定义域一致。
 *
 * 一致性口径：声明值必须是推导值的**子集**（收窄是对的——题目可能限定 x>0），
 * 但**不得包含**任何表达式无定义的点（放宽是错的）。
 *
 * 返回 `true` 表示「声明值过宽、已被交集收窄」，上层应提示用户。
 * 声明值无法解析时返回 `false`（此时按推导值处理，不算冲突）。
 */
export function domainMismatch(expr: string, domainStr?: string): boolean {
  if (!domainStr) return false;
  const declared = parseDomainString(domainStr);
  if (!declared) return false;
  const inferred = inferDomainExact(expr);
  // 交集后若丢失了声明值中的部分区间，说明声明值过宽
  const narrowed = intersectIntervals(declared, inferred);
  return !sameCoverage(declared, narrowed);
}

/** 两组区间的覆盖是否等价（用于判定交集是否真的收窄了） */
function sameCoverage(a: Interval[], b: Interval[]): boolean {
  if (a.length !== b.length) return false;
  const key = (iv: Interval) =>
    `${iv.lo},${iv.hi},${iv.loOpen ? 'o' : 'c'},${iv.hiOpen ? 'o' : 'c'}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((k, i) => k === sb[i]);
}

/**
 * 丢弃「被区间算术证明整段无定义」的候选区间。
 *
 * 可靠性依据：包络为空集 ⇒ 该区间内不存在任何可计算的实数点。
 * 对**部分**有定义的区间，包络非空，因此不会被误删——只会收紧，不会放宽。
 *
 * `probeDomainStatus` 自带自校验，会区分「真的无定义」与「工具不支持该运算」
 * （如非整数幂），避免把 `x^0.5` 这类表达式误删。
 */
function dropEntirelyOutsideDomain(expr: string, intervals: Interval[]): Interval[] {
  return intervals.filter((iv) => {
    const probe = boundedProbe(iv.lo, iv.hi);
    if (!probe) return true; // 无法探测则保留（保守）
    return probeDomainStatus(expr, probe.lo, probe.hi) !== 'outside';
  });
}

function signOf(evalSub: (x: number) => number, x: number): number {
  const v = evalSub(x);
  return Number.isFinite(v) && v > 0 ? 1 : -1;
}

/**
 * 解线性子表达式的零点，覆盖落在 [-1000,1000] 搜索窗口之外的边界。
 *
 * 这是缺陷修复的关键：旧实现只对 `neq` 约束使用解析解，且只识别很窄的写法。
 * 于是 `sqrt(x-2000)`、`log(x-2000)` 这类**不等式约束**在窗口内找不到任何分区点，
 * 随后 `signOf(-2000)` 探针把整条数轴判为「负」，
 * 结果要么误报「无定义」（sqrt 分支），要么把边界当成 ±∞ 输出。
 *
 * 支持形式（mathjs `toString()` 之后的常见形态）：
 * - `x`、`(x)`
 * - `x-2000`、`x+3`
 * - `2*x-6`、`-3*x+1`、`x*2`、`2x`
 *
 * 无法判定时返回 `null`（交由数值扫描处理）。
 */
function analyticLinearRoot(sub: string): number | null {
  let t = sub.replace(/\s+/g, '');
  // 剥掉 mathjs 为分式分母等加的外层括号
  while (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1);

  if (t === 'x' || t === '-x') return 0;

  // P1: a*x 或 ax（系数可省 / 隐式乘法）+ 可选常数项 —— x-2000、2*x-6、-3x+1
  let m = t.match(/^(-?\d*(?:\.\d+)?)(?:\*)?x([+-]\d+(?:\.\d+)?)?$/);
  if (m) {
    const cs = m[1];
    const a = cs === '' ? 1 : cs === '-' ? -1 : parseFloat(cs);
    if (a !== 0) return -(m[2] ? parseFloat(m[2]) : 0) / a;
  }

  // P2: x*a + 可选常数项 —— x*2-6
  m = t.match(/^x\*(-?\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?$/);
  if (m) {
    const a = parseFloat(m[1]);
    if (a !== 0) return -(m[2] ? parseFloat(m[2]) : 0) / a;
  }

  // P3: b ± a*x —— 1-2*x
  m = t.match(/^(-?\d+(?:\.\d+)?)([+-])(\d*(?:\.\d+)?)\*x$/);
  if (m) {
    const b = parseFloat(m[1]);
    const a = m[3] === '' ? 1 : parseFloat(m[3]);
    if (a !== 0) return m[2] === '+' ? -b / a : b / a;
  }

  // P4: b ± x —— 3000-x
  m = t.match(/^(-?\d+(?:\.\d+)?)([+-])x$/);
  if (m) {
    const b = parseFloat(m[1]);
    return m[2] === '-' ? b : -b;
  }

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
