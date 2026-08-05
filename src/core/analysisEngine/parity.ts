import type { Interval } from '../../types';
import type { Parity } from '../../types';
import { inDomain } from './domain';

export function analyzeParity(f: (x: number) => number, domain: Interval[]): Parity {
  if (!isSymmetric(domain)) return 'neither';
  const points = [0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 15];
  let even = true;
  let odd = true;
  let checked = 0;
  for (const x of points) {
    if (!inDomain(x, domain) || !inDomain(-x, domain)) continue;
    const fx = f(x);
    const fmx = f(-x);
    if (!Number.isFinite(fx) || !Number.isFinite(fmx)) continue;
    checked++;
    const scale = Math.max(1, Math.abs(fx), Math.abs(fmx));
    if (Math.abs(fx - fmx) > 1e-6 * scale) even = false;
    if (Math.abs(fx + fmx) > 1e-6 * scale) odd = false;
    if (!even && !odd) return 'neither';
  }
  if (checked === 0) return 'neither';
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
