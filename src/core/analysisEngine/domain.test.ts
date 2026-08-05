import { describe, expect, it } from 'vitest';
import { inferDomain, inDomain, parseDomainString, fmtInterval } from './domain';

describe('inferDomain', () => {
  it('多项式为全体实数', () => {
    expect(fmtInterval(inferDomain('x^2 - 2x - 3'))).toEqual(['(−∞, +∞)']);
  });
  it('分式排除分母零点', () => {
    expect(fmtInterval(inferDomain('1/x'))).toEqual(['(−∞, 0)', '(0, +∞)']);
  });
  it('对数要求真数大于零', () => {
    expect(fmtInterval(inferDomain('log(x)'))).toEqual(['(0, +∞)']);
  });
  it('平方根要求被开方数非负', () => {
    expect(fmtInterval(inferDomain('sqrt(1 - x^2)'))).toEqual(['[−1, 1]']);
  });
  it('正切排除极点', () => {
    const ivs = inferDomain('tan(x)');
    expect(ivs.every((iv) => Math.abs(Math.cos((iv.lo + iv.hi) / 2)) > 0.5)).toBe(true);
    expect(ivs[0].lo).toBeLessThan(-1.5);
  });
});

describe('inDomain', () => {
  it('区间判定', () => {
    const ivs = inferDomain('1/x');
    expect(inDomain(-1, ivs)).toBe(true);
    expect(inDomain(0, ivs)).toBe(false);
    expect(inDomain(1, ivs)).toBe(true);
  });
});

describe('parseDomainString', () => {
  it('解析并集字符串', () => {
    const ivs = parseDomainString('(-inf, -1) ∪ (1, inf)');
    expect(ivs).not.toBeNull();
    expect(fmtInterval(ivs!)).toEqual(['(−∞, −1)', '(1, +∞)']);
  });
  it('非法字符串返回 null', () => {
    expect(parseDomainString('haha')).toBeNull();
  });
});
