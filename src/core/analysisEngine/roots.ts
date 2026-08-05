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

  const push = (r: number) => {
    if (!Number.isFinite(r)) return;
    if (roots.some((p) => Math.abs(p - r) < 1e-6)) return;
    roots.push(r);
  };

  const verify = (r: number): boolean => {
    const eps = 1e-6;
    const scale = Math.max(1, Math.abs(f(r + eps)), Math.abs(f(r - eps)));
    const val = Math.abs(f(r));
    return val <= tolerance * scale * 10;
  };

  let prevX = lo;
  let prevY = f(lo);
  for (let i = 1; i <= gridPoints; i++) {
    const x = lo + ((hi - lo) * i) / gridPoints;
    const y = f(x);
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
        if (converged && verify((a + b) / 2)) push((a + b) / 2);
      }
    } else if (Number.isFinite(y) && y === 0) {
      push(x);
    }
    prevX = x;
    prevY = y;
  }

  let cluster: number[] = [];
  const flushCluster = () => {
    if (cluster.length === 0) return;
    const c = cluster[Math.floor(cluster.length / 2)];
    const w = Math.max((hi - lo) / gridPoints, 1e-3);
    let a = c - w;
    let b = c + w;
    for (let k = 0; k < 120; k++) {
      const m1 = a + (b - a) / 3;
      const m2 = b - (b - a) / 3;
      if (Math.abs(f(m1)) < Math.abs(f(m2))) b = m2;
      else a = m1;
    }
    const r = (a + b) / 2;
    if (verify(r)) push(r);
    cluster = [];
  };

  for (let i = 0; i <= gridPoints; i++) {
    const x = lo + ((hi - lo) * i) / gridPoints;
    const y = f(x);
    if (Number.isFinite(y) && Math.abs(y) < 1e-4) cluster.push(x);
    else flushCluster();
  }
  flushCluster();

  roots.sort((p, q) => p - q);
  return roots;
}
