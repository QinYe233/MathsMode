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
    const x1 = side * 1e8;
    const x2 = side * 1e12;
    const f1 = f(x1);
    const f2 = f(x2);
    if (!Number.isFinite(f1) || !Number.isFinite(f2)) continue;
    if (Math.abs(f1 - f2) < 1e-4 && Math.abs(f1) < 1e6) {
      out.push({ type: 'horizontal', value: `y = ${round(f1)}` });
      continue;
    }
    const k1 = f1 / x1;
    const k2 = f2 / x2;
    if (Number.isFinite(k1) && Number.isFinite(k2) && Math.abs(k1 - k2) < 1e-8 && Math.abs(k1) < 1e3) {
      const b = f2 - k2 * x2;
      if (Number.isFinite(b) && Math.abs(b) < 1e8) {
        out.push({ type: 'oblique', value: formatOblique(k1, b) });
      }
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
