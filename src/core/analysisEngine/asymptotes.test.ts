import { describe, expect, it } from 'vitest';
import { analyzeAsymptotes } from './asymptotes';
import { inferDomain } from './domain';
import { makeEvaluator } from '../mathUtil';

const analyze = (expr: string) => {
  const f = makeEvaluator(expr);
  return analyzeAsymptotes(f, inferDomain(expr));
};

describe('analyzeAsymptotes', () => {
  it('1/x：垂直 x=0 与水平 y=0', () => {
    const as = analyze('1/x');
    expect(as.some((a) => a.type === 'vertical' && a.value.includes('0'))).toBe(true);
    expect(as.some((a) => a.type === 'horizontal' && a.value.includes('0'))).toBe(true);
  });
  it('1/(x-2)：垂直 x=2', () => {
    const as = analyze('1/(x - 2)');
    expect(as.some((a) => a.type === 'vertical' && a.value.includes('2'))).toBe(true);
  });
  it('log(x)：垂直 x=0', () => {
    const as = analyze('log(x)');
    expect(as.some((a) => a.type === 'vertical')).toBe(true);
  });
  it('(x^2+1)/x：斜渐近线 y=x', () => {
    const as = analyze('(x^2 + 1)/x');
    const obl = as.find((a) => a.type === 'oblique');
    expect(obl).toBeDefined();
    expect(obl!.value.replace(/\s+/g, '').startsWith('y=x')).toBe(true);
  });
  it('二次函数无渐近线', () => {
    expect(analyze('x^2 - 2x - 3')).toEqual([]);
  });
  it('tan 有垂直渐近线', () => {
    const as = analyze('tan(x)');
    expect(as.some((a) => a.type === 'vertical')).toBe(true);
  });
});
