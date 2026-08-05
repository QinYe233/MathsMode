import { describe, expect, it } from 'vitest';
import { analyzeMonotonic } from './monotonic';
import { inferDomain } from './domain';
import { findAllRoots } from './roots';
import { makeEvaluator, derivativeExpr } from '../mathUtil';

const analyze = (expr: string) => {
  const f = makeEvaluator(expr);
  const domain = inferDomain(expr);
  const fpExpr = derivativeExpr(expr);
  const fprime = makeEvaluator(fpExpr);
  const critical = findAllRoots(fprime, -1000, 1000);
  return analyzeMonotonic(fprime, f, critical, domain);
};

describe('analyzeMonotonic', () => {
  it('二次函数：先减后增，极值在 x=1', () => {
    const { segments, extrema } = analyze('x^2 - 2x - 3');
    expect(segments.map((s) => `${s.interval}:${s.trend}`)).toEqual([
      '(−∞, 1):dec',
      '(1, +∞):inc',
    ]);
    expect(extrema).toHaveLength(1);
    expect(extrema[0].type).toBe('min');
    expect(Math.abs(extrema[0].x - 1) < 1e-4).toBe(true);
    expect(Math.abs(extrema[0].y + 4) < 1e-4).toBe(true);
  });
  it('x^3 - 3x：两段增中间减，极大极小各一', () => {
    const { segments, extrema } = analyze('x^3 - 3x');
    expect(segments.map((s) => s.trend)).toEqual(['inc', 'dec', 'inc']);
    expect(extrema.some((e) => e.type === 'max')).toBe(true);
    expect(extrema.some((e) => e.type === 'min')).toBe(true);
  });
  it('1/x 两段都递减', () => {
    const { segments } = analyze('1/x');
    expect(segments.map((s) => s.trend)).toEqual(['dec', 'dec']);
  });
  it('常数函数为 const', () => {
    const { segments } = analyze('3');
    expect(segments).toEqual([{ interval: '(−∞, +∞)', trend: 'const' }]);
  });
  it('sin 在 (π/2, 3π/2) 递减', () => {
    const { segments } = analyze('sin(x)');
    expect(segments.some((s) => s.trend === 'dec' && s.interval.includes('1.5708'))).toBe(true);
  });
});
