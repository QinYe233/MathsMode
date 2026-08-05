import { describe, expect, it } from 'vitest';
import { analyzePeriod } from './period';
import { inferDomain } from './domain';
import { makeEvaluator } from '../mathUtil';

const analyze = (expr: string) => {
  const f = makeEvaluator(expr);
  return analyzePeriod(expr, f, inferDomain(expr));
};

describe('analyzePeriod', () => {
  it('sin(x) → 2π', () => {
    expect(Math.abs(analyze('sin(x)')! - 2 * Math.PI) < 1e-6).toBe(true);
  });
  it('cos(2x) → π', () => {
    expect(Math.abs(analyze('cos(2x)')! - Math.PI) < 1e-6).toBe(true);
  });
  it('tan(x) → π', () => {
    expect(Math.abs(analyze('tan(x)')! - Math.PI) < 1e-6).toBe(true);
  });
  it('sin(x) + sin(3x) → 2π（最小公倍数）', () => {
    expect(Math.abs(analyze('sin(x) + sin(3x)')! - 2 * Math.PI) < 1e-6).toBe(true);
  });
  it('非周期函数返回 undefined', () => {
    expect(analyze('x^2')).toBeUndefined();
  });
});
