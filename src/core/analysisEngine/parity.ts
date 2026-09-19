import type { Interval } from '../../types';
import type { Parity } from '../../types';
import { inDomain } from './domain';

/**
 * 奇偶性判定（缺陷 W4 修复）。
 *
 * 旧实现用**固定 10 个点** `[0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 15]`：
 * 全部 `x ≥ 0.5`，**完全没采样小量级区域**，且样本量固定。
 * 高频或窄带函数可能在少数点上「碰巧」满足 `f(x)=f(−x)` 或 `f(x)=−f(−x)`
 * 而被误判为偶/奇函数。
 *
 * 现改为**多尺度对称采样**：覆盖 1e-3 ～ 1e3 共 12 个数量级，
 * 每个量级取若干代表点，使「碰巧」在多个尺度上同时成立的概率极低。
 * 判定仍是数值性的（不存在有限采样的完备判据），但鲁棒性显著提高。
 */

/** 每个尺度的采样系数（避免落在整数格点上产生系统性巧合） */
const SCALE_COEFFS = [0.37, 0.71, 1.13, 1.79, 2.53, 3.97, 6.31];
/** 数量级范围 1e-3 … 1e3 */
const EXPONENTS = [-3, -2, -1, 0, 1, 2, 3];

/** 相对容差：数值求值本身的误差量级 */
const REL_TOL = 1e-6;

function samplePoints(): number[] {
  const pts: number[] = [];
  for (const e of EXPONENTS) {
    const base = Math.pow(10, e);
    for (const c of SCALE_COEFFS) {
      const v = Math.round(c * base * 1e6) / 1e6;
      if (v > 0 && Number.isFinite(v)) pts.push(v);
    }
  }
  return pts;
}

export function analyzeParity(f: (x: number) => number, domain: Interval[]): Parity {
  if (!isSymmetric(domain)) return 'neither';

  let even = true;
  let odd = true;
  let checked = 0;

  for (const x of samplePoints()) {
    if (!inDomain(x, domain) || !inDomain(-x, domain)) continue;
    const fx = f(x);
    const fmx = f(-x);
    if (!Number.isFinite(fx) || !Number.isFinite(fmx)) continue;
    checked++;

    // 逐点用自身量级归一：避免大值点掩盖小值点的差异
    const scale = Math.max(1, Math.abs(fx), Math.abs(fmx));
    const tol = REL_TOL * scale;

    if (Math.abs(fx - fmx) > tol) even = false; // 非偶
    if (Math.abs(fx + fmx) > tol) odd = false; // 非奇
    // 两者都已被否定即可提前退出（与旧实现一致，省去剩余求值）
    if (!even && !odd) return 'neither';
  }

  // 有效点太少时不敢下结论（例如定义域极窄），保守判为非奇非偶
  if (checked < 5) return 'neither';
  if (even) return 'even';
  if (odd) return 'odd';
  return 'neither';
}

function isSymmetric(domain: Interval[]): boolean {
  const canon = (iv: Interval) => `${fmtK(iv.lo)},${fmtK(iv.hi)},${iv.loOpen},${iv.hiOpen}`;
  const keyOf = (iv: Interval) => {
    const k1 = canon(iv);
    const k2 = canon({ lo: -iv.hi, hi: -iv.lo, loOpen: iv.hiOpen, hiOpen: iv.loOpen });
    return k1 < k2 ? k1 : k2;
  };
  const set = new Set(domain.map(keyOf));
  return domain.every((iv) => set.has(keyOf(iv)));
}

function fmtK(x: number): string {
  if (x === Number.POSITIVE_INFINITY) return 'inf';
  if (x === Number.NEGATIVE_INFINITY) return '-inf';
  return String(Math.round(x * 1e6) / 1e6);
}
