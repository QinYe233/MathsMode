import { normalizeForValidation } from './normalize';
import { canCompile, makeEvaluator } from './compile';
import { inferDomain } from './domain';
import type { Interval } from '../../types';

/**
 * 表达式校验。
 *
 * ## 为什么重写
 *
 * 旧实现（`mathUtil.validateExpression`）用**固定 5 个样本点** `[0, 1, -1, 2, 0.5]`
 * 判断表达式能否计算，5 点全不可算即判「非法」。这与数学正确性无关——
 * 任何定义域不覆盖这 5 个点的表达式都会被误拒。实测缺陷 E1：
 *
 * ```
 * log(x-4)       → 被误拒      sqrt(x-5)     → 被误拒
 * log(x-10)      → 被误拒      sqrt(x^2-100) → 被误拒
 * 1/(x-5)        → 侥幸通过（因 x=0 恰在定义域内）
 * ```
 *
 * ## 新策略：归一化 → 编译 → 定义域感知采样
 *
 * 1. **归一化**（修复 E5）：`x²`、`√x`、全角字符先转成 mathjs 语法，
 *    使手动输入与 AI 识别链路能力一致。
 * 2. **编译**：失败即为语法错误——这是唯一确定的拒绝理由。
 * 3. **定义域外采样点被排除**：只在该表达式「可能可算」的点上求值，
 *    不再因为恰好采到定义域外而误拒。
 * 4. **末位兜底**：若域内代表点全部不可算，再用多尺度网格
 *    （±10^k, k=−3…6）扫描一遍，杜绝窄定义域被漏判。
 *
 * 返回值：`null` 表示合法；否则为中文错误消息。
 */
export function validateExpression(expr: string): string | null {
  const raw = expr.trim();
  if (!raw) return '请输入表达式';

  const normalized = normalizeForValidation(raw);

  if (!canCompile(normalized)) {
    return '表达式语法错误';
  }

  const evalAt = makeEvaluator(normalized);
  // 定义域推断本身可能失败（防御性：数学引擎出现意外时不要让校验崩掉）
  let domain: Interval[] = [];
  try {
    domain = inferDomain(normalized);
  } catch {
    domain = [{ lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true }];
  }

  // 定义域为空：表达式语法正确，但在实数范围内无定义
  if (domain.length === 0) {
    return '该表达式在实数范围内无定义';
  }

  for (const x of sampleCandidates(domain)) {
    if (Number.isFinite(evalAt(x))) return null;
  }

  // 兜底：多尺度网格（覆盖窄定义域，如 sqrt(x-5)、log(x-10)）
  for (const x of fallbackGrid()) {
    if (Number.isFinite(evalAt(x))) return null;
  }

  return '表达式无法计算，请检查写法（如 x^2、1/(x-1)、sin(x)）';
}

/**
 * 基于定义域生成采样点。
 *
 * 这是修复 E1 的关键：采样点**由定义域决定**，而不是写死 5 个数。
 * 无穷端用多尺度（1e4 / 1e8 / 1e12）抽样，兼顾大数量级定义域
 * （如 `log(x-2000)`）与普通定义域。
 */
function sampleCandidates(domain: Interval[]): number[] {
  const pts: number[] = [];
  const push = (x: number) => {
    if (Number.isFinite(x) && !pts.some((p) => Math.abs(p - x) < 1e-12)) pts.push(x);
  };

  for (const iv of domain) {
    const { lo, hi, loOpen, hiOpen } = iv;
    const loFin = Number.isFinite(lo);
    const hiFin = Number.isFinite(hi);

    if (loFin) {
      // 开端点向内取一个相对步长，保证落在区间内部
      const eps = Math.max(1e-6, Math.abs(lo) * 1e-9);
      push(loOpen ? lo + eps : lo);
      push(lo + 1);
    }
    if (hiFin) {
      const eps = Math.max(1e-6, Math.abs(hi) * 1e-9);
      push(hiOpen ? hi - eps : hi);
      push(hi - 1);
    }
    if (!loFin && !hiFin) {
      push(0);
      push(1);
      push(-1);
      push(0.5);
      push(2);
    } else if (loFin && hiFin && hi > lo) {
      push((lo + hi) / 2);
    } else if (!loFin && hiFin) {
      push(hi - 1e4);
      push(hi - 1e8);
    } else if (loFin && !hiFin) {
      push(lo + 1e4);
      push(lo + 1e8);
    }
  }
  return pts;
}

/**
 * 多尺度兜底网格：±10^k（k = −3…6）与若干小数/整数点。
 * 用于定义域推断不完整时仍能找到可算点（宁可放过，不可误杀）。
 */
function fallbackGrid(): number[] {
  const xs: number[] = [0.5, 1, -1, 2, -2, 0.25, 0.1, 5, 10, -10, 100, -100];
  for (let k = -3; k <= 6; k++) {
    const v = Math.pow(10, k);
    xs.push(v, -v);
  }
  return xs;
}
