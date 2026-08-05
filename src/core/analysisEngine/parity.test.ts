import { describe, expect, it } from 'vitest';
import { analyzeParity } from './parity';
import { inferDomain } from './domain';

const domain = (expr: string) => inferDomain(expr);

describe('analyzeParity', () => {
  it('偶函数', () => {
    expect(analyzeParity((x) => x * x, domain('x^2'))).toBe('even');
  });
  it('奇函数', () => {
    expect(analyzeParity((x) => x * x * x, domain('x^3'))).toBe('odd');
  });
  it('非奇非偶', () => {
    expect(analyzeParity((x) => x * x - 2 * x - 3, domain('x^2 - 2x - 3'))).toBe('neither');
  });
  it('定义域不对称 → neither（sqrt(x)）', () => {
    expect(analyzeParity((x) => Math.sqrt(x), domain('sqrt(x)'))).toBe('neither');
  });
  it('奇函数分式（1/x）', () => {
    expect(analyzeParity((x) => 1 / x, domain('1/x'))).toBe('odd');
  });
  it('正弦为奇函数', () => {
    expect(analyzeParity(Math.sin, domain('sin(x)'))).toBe('odd');
  });
  it('余弦为偶函数', () => {
    expect(analyzeParity(Math.cos, domain('cos(x)'))).toBe('even');
  });
});
