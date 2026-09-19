/**
 * 数值求根（网格扫描 + 二分 + 切点检测）。
 *
 * 从 `analysisEngine/roots.ts` 迁入 `core/expression/`：定义域推断依赖它，
 * 而定义域推断又需要落在表达式核心层，否则会形成
 * `mathUtil ↔ analysisEngine` 的循环依赖。
 */

export interface RootOptions {
  tolerance?: number;
  gridPoints?: number;
}

const DEFAULTS: Required<RootOptions> = { tolerance: 1e-9, gridPoints: 2000 };

export function findAllRoots(
  f: (x: number) => number,
  lo: number,
  hi: number,
  options?: RootOptions,
): number[] {
  const { tolerance, gridPoints } = { ...DEFAULTS, ...options };
  const roots: number[] = [];

  // 去重阈值 1e-6：小于该间距的两个真实根会被合并（罕见，接受为已知限制）
  const push = (r: number) => {
    if (!Number.isFinite(r)) return;
    if (roots.some((p) => Math.abs(p - r) < 1e-6)) return;
    roots.push(r);
  };

  const localScale = (r: number): number => {
    let s = 1;
    for (const d of [1e-6, -1e-6]) {
      const v = Math.abs(f(r + d));
      if (Number.isFinite(v)) s = Math.max(s, v);
    }
    return s;
  };

  // 穿越根校验：二分保证 |r - 根| <= tolerance/2，残差受斜率*容差约束，
  // 用局部尺度放宽到 1e-3 倍，避免陡峭斜率的真根被误拒（斜率 1000 也通过）。
  const verifyCrossing = (r: number): boolean => {
    return Math.abs(f(r)) <= localScale(r) * 1e-3;
  };

  // 切点根校验：|f| 的最小值必须真正触零（浮点精度内），
  // 仅“逼近零”的函数（如 x^2 + 5e-9）不算根。
  const verifyTangency = (r: number): boolean => {
    return Math.abs(f(r)) <= 1e-9 * Math.max(1, localScale(r));
  };

  const step = (hi - lo) / gridPoints;
  let prevX = lo;
  let prevY = f(lo);
  let finiteCount = 0;
  let zeroCount = 0;
  for (let i = 1; i <= gridPoints; i++) {
    const x = lo + step * i;
    const y = f(x);
    if (Number.isFinite(y)) {
      finiteCount++;
      if (y === 0) zeroCount++;
    }
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      if (prevY === 0) push(prevX);
      else if (y === 0) push(x);
      else if (prevY * y < 0) {
        let a = prevX;
        let b = x;
        let fa = prevY;
        let converged = false;
        for (let k = 0; k < 200; k++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (!Number.isFinite(fm)) break;
          if (fm === 0) {
            a = b = m;
            converged = true;
            break;
          }
          if (fa * fm < 0) {
            b = m;
          } else {
            a = m;
            fa = fm;
          }
          if (b - a < tolerance) {
            converged = true;
            break;
          }
        }
        if (converged && verifyCrossing((a + b) / 2)) push((a + b) / 2);
      }
    }
    prevX = x;
    prevY = y;
  }

  // 恒为零的函数处处是根，无意义——直接返回空
  if (finiteCount > 0 && zeroCount === finiteCount) return [];

  // 切点检测：对每个同号网格区间，中点 |f| 若小于两端点，则可能是
  // 局部极小触碰零（如 (x-0.05)^2，根不在网格点上也能发现）。
  let prevX2 = lo;
  let prevY2 = f(lo);
  for (let i = 1; i <= gridPoints; i++) {
    const x = lo + step * i;
    const y = f(x);
    if (Number.isFinite(prevY2) && Number.isFinite(y)) {
      const m = (prevX2 + x) / 2;
      const fm = f(m);
      if (Number.isFinite(fm) && Math.abs(fm) < Math.min(Math.abs(prevY2), Math.abs(y))) {
        const r = refineMin(f, prevX2, x);
        if (verifyTangency(r)) push(r);
      }
    }
    prevX2 = x;
    prevY2 = y;
  }

  roots.sort((p, q) => p - q);
  return roots;
}

function refineMin(f: (x: number) => number, a: number, b: number): number {
  for (let k = 0; k < 120; k++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (Math.abs(f(m1)) < Math.abs(f(m2))) b = m2;
    else a = m1;
  }
  return (a + b) / 2;
}
