import type { Interval, Asymptote } from '../../types';

const EPS_BIG = 1e-6;
const EPS_TINY = 1e-12;

export function analyzeAsymptotes(f: (x: number) => number, domain: Interval[]): Asymptote[] {
  const out: Asymptote[] = [];

  for (const iv of domain) {
    if (Number.isFinite(iv.lo) && iv.loOpen && diverges(f, iv.lo, 1)) {
      out.push({ type: 'vertical', value: `x = ${round(iv.lo)}` });
    }
    if (Number.isFinite(iv.hi) && iv.hiOpen && diverges(f, iv.hi, -1)) {
      out.push({ type: 'vertical', value: `x = ${round(iv.hi)}` });
    }
  }

  for (const p of findPoles(f)) {
    if (!out.some((a) => a.type === 'vertical' && Math.abs(parseFloat(a.value.slice(4)) - p) < 1e-3)) {
      out.push({ type: 'vertical', value: `x = ${round(p)}` });
    }
  }

  for (const side of [1, -1] as const) {
    // 多个远点采样，判断 f 是否收敛到水平线或斜直线
    const xs = [1e8, 1e10, 1e12];
    const pts = xs.map((x) => {
      const v = f(side * x);
      return { x: x * side, v };
    });
    if (pts.some((p) => !Number.isFinite(p.v))) continue;
    // 水平渐近线：f 的远点取值彼此趋同
    const vs = pts.map((p) => p.v);
    if (
      Math.abs(vs[0] - vs[1]) < 1e-4 &&
      Math.abs(vs[1] - vs[2]) < 1e-4 &&
      Math.abs(vs[2]) < 1e6
    ) {
      out.push({ type: 'horizontal', value: `y = ${round(vs[2])}` });
      continue;
    }
    // 斜渐近线：k=f/x 稳定 且 截距 b=f−kx 收敛（振荡函数如 sin(x) 的 b 永不收敛，据此拒绝）
    const ks = pts.map((p) => p.v / p.x);
    if (Math.abs(ks[0] - ks[1]) >= 1e-8 || Math.abs(ks[1] - ks[2]) >= 1e-8 || Math.abs(ks[2]) >= 1e3) {
      continue;
    }
    const k = ks[2];
    const bs = pts.map((p) => p.v - k * p.x);
    if (Math.abs(bs[0] - bs[1]) < 1e-3 && Math.abs(bs[1] - bs[2]) < 1e-3 && Math.abs(bs[2]) < 1e8) {
      out.push({ type: 'oblique', value: formatOblique(k, bs[2]) });
    }
  }
  return out;
}

function diverges(f: (x: number) => number, c: number, dir: 1 | -1): boolean {
  const a = f(c + dir * EPS_BIG);
  const s = f(c + dir * EPS_TINY);
  if (!Number.isFinite(a) || !Number.isFinite(s)) return true;
  return Math.abs(s) > Math.abs(a) * 1.5 && Math.abs(s) > 1e-3;
}

function findPoles(f: (x: number) => number): number[] {
  const poles: number[] = [];
  const step = 0.02;
  let cluster: number[] = [];
  for (let x = -1000; x <= 1000; x += step) {
    const v = f(x);
    if (Number.isFinite(v) && Math.abs(v) > 1e4) cluster.push(x);
    else if (cluster.length) {
      poles.push(refinePole(f, cluster, step));
      cluster = [];
    }
  }
  if (cluster.length) poles.push(refinePole(f, cluster, step));
  return poles.filter((p) => Math.abs(p) < 1000);
}

function refinePole(f: (x: number) => number, cluster: number[], step: number): number {
  const c = cluster[Math.floor(cluster.length / 2)];
  let a = c - step;
  let b = c + step;
  for (let k = 0; k < 80; k++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (Math.abs(f(m1)) > Math.abs(f(m2))) a = m1;
    else b = m2;
  }
  const p = (a + b) / 2;
  const s = Math.abs(f(p - 1e-9)) + Math.abs(f(p + 1e-9));
  return s > 1e8 ? p : NaN;
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function formatOblique(k: number, b: number): string {
  const kStr = Math.abs(k - 1) < 1e-6 ? '' : `${round(k)}`;
  const bPart = Math.abs(b) < 1e-6 ? '' : `${b >= 0 ? '+' : '-'} ${round(Math.abs(b))}`;
  return `y = ${kStr}x${bPart ? ` ${bPart}` : ''}`.trim().replace(/\s+/g, ' ');
}
