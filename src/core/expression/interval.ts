/**
 * 区间算术封装（基于 `interval-arithmetic`，已经是 function-plot 的传递依赖）。
 *
 * ## 用途与边界（重要，勿夸大）
 *
 * 区间算术给出表达式在一个区间上的**值域包络**：
 * - `isEmpty` 为真 ⇒ 该区间**完全落在定义域之外**（可靠的确定判据）
 * - 值域不含 0 ⇒ 该区间内**确定没有零点**（可靠的剪枝判据）
 *
 * 但它**不能**用来替代定义域推断：
 * 实测 `sqrt(x)` 在 `[-4, 4]` 上返回 `[0, 2]`（只取有效部分），
 * 并不报告 `[-4, 0)` 无定义。`asin` 同理。因此本模块只提供
 * **排除 / 剪枝**能力，绝不用它「证明」某处有定义。
 *
 * 详见 OPENSOURCE-ADOPTION.md §0.2。
 */
import IntervalArithmetic from 'interval-arithmetic';
import compileInterval, { type IntervalEvaluator } from 'interval-arithmetic-eval';
import { normalizeExpr } from './normalize';

export interface NumericInterval {
  lo: number;
  hi: number;
}

/** 判断区间是否为空集（`interval-arithmetic` 用 lo > hi 表示空集） */
export function isEmptyInterval(iv: NumericInterval): boolean {
  return !(iv.lo <= iv.hi);
}

/**
 * 编译表达式为区间求值器；表达式不可解析时返回 `null`。
 *
 * 注意：`interval-arithmetic-eval` 只支持**整数**幂（非整数幂会抛错并返回空区间），
 * 因此 `x^0.5` 这类表达式会被它判为空——这属于工具限制，**不代表定义域为空**。
 * 调用方必须把「空」当作「无信息」而不是「无定义」。
 */
export function compileIntervalEvaluator(expr: string): IntervalEvaluator | null {
  try {
    return compileInterval(normalizeExpr(expr)) as IntervalEvaluator;
  } catch {
    return null;
  }
}

/**
 * 计算表达式在 [lo, hi] 上的值域包络。
 *
 * 返回 `null` 表示「无法给出有效包络」（编译失败、含不支持的运算等）——
 * 调用方应视作「无信息」，而不是「区间无定义」。
 */
export function evalInterval(
  expr: string,
  lo: number,
  hi: number,
): NumericInterval | null {
  const ev = compileIntervalEvaluator(expr);
  if (!ev) return null;
  return evalWith(ev, lo, hi);
}

/** 用已编译的求值器计算值域包络（避免重复编译） */
export function evalWith(
  ev: IntervalEvaluator,
  lo: number,
  hi: number,
): NumericInterval | null {
  try {
    const raw = ev.eval({ x: { lo, hi } });
    if (!raw || typeof raw.lo !== 'number' || typeof raw.hi !== 'number') return null;
    const iv = { lo: raw.lo, hi: raw.hi };
    // 空集 ⇒ 无信息（可能只是工具不支持该运算），不作为「无定义」结论
    if (isEmptyInterval(iv)) return null;
    return iv;
  } catch {
    return null;
  }
}

/**
 * 区间是否**完全落在定义域之外**（可靠的排除判据）。
 *
 * 只在「拿到明确空集」时返回 true；抛错/NaN/无信息一律返回 false。
 * 实测有效场景：`asin(x)` 在 `[-5,-3]`、`sqrt(x-2000)` 在 `[0,1000]`、
 * `log(x)` 在 `[-5,-1]` 均判为 true——即使约束表漏判也能兜住。
 *
 * ⚠️ 单独使用不安全：`interval-arithmetic` 不支持非整数幂，
 * `x^0.5` 会返回空集——那是**工具限制**而非「无定义」。
 * 请优先使用 `probeDomainStatus`，它带自校验。
 */
export function isEntirelyOutsideDomain(expr: string, lo: number, hi: number): boolean {
  const ev = compileIntervalEvaluator(expr);
  if (!ev) return false;
  return rawIsEmpty(ev, lo, hi);
}

/** 区间求值是否得到「明确空集」（区别于抛错 / 非数值） */
function rawIsEmpty(
  ev: IntervalEvaluator,
  lo: number,
  hi: number,
): boolean {
  try {
    const raw = ev.eval({ x: { lo, hi } });
    return (
      !!raw && typeof raw.lo === 'number' && typeof raw.hi === 'number' && isEmptyInterval(raw)
    );
  } catch {
    return false;
  }
}

/**
 * 定义域探测（带自校验，可安全用于剪枝）。
 *
 * 判据分三步：
 * 1. 区域包络非空 ⇒ `defined`（该区间内确实存在可计算的点）
 * 2. 区域包络为空，但**已知合法点**（x=0）也为空 ⇒ `unknown`
 *    ——说明是工具限制（如非整数幂），不可据此判定无定义
 * 3. 区域包络为空而 x=0 正常 ⇒ `outside`（**证明**该区间整段无定义）
 *
 * 返回 `outside` 才可安全剪枝。
 */
export function probeDomainStatus(
  expr: string,
  lo: number,
  hi: number,
): 'defined' | 'outside' | 'unknown' {
  const ev = compileIntervalEvaluator(expr);
  if (!ev) return 'unknown';

  if (!rawIsEmpty(ev, lo, hi)) return 'defined';

  // 自校验：x=0 对实数函数通常是合法点；若连它都为空，说明是工具限制
  const zeroIsEmpty = rawIsEmpty(ev, 0, 0);
  return zeroIsEmpty ? 'unknown' : 'outside';
}

/**
 * 在给定区间内取一个有代表性的**有界**子区间，用于探测「是否整段无定义」。
 *
 * 无法构造有限子区间时（区间本身就是退化的）返回 `null`。
 */
export function boundedProbe(
  lo: number,
  hi: number,
  width = 100,
): NumericInterval | null {
  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    if (!(hi > lo)) return null;
    return { lo, hi };
  }
  if (!Number.isFinite(lo) && Number.isFinite(hi)) {
    const p = hi - width;
    return Number.isFinite(p) ? { lo: p, hi } : null;
  }
  if (Number.isFinite(lo) && !Number.isFinite(hi)) {
    const p = lo + width;
    return Number.isFinite(p) ? { lo, hi: p } : null;
  }
  // 双向无穷：取原点附近
  return { lo: -width, hi: width };
}

/** 供类型检查用的再导出（运行时不使用） */
export type { IntervalEvaluator };
export { IntervalArithmetic };
