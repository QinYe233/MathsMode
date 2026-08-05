import { describe, expect, it } from 'vitest';
import { makeEvaluator, derivativeExpr, validateExpression } from './mathUtil';

describe('makeEvaluator', () => {
  it('计算多项式取值', () => {
    const f = makeEvaluator('x^2 - 2x - 3');
    expect(f(0)).toBe(-3);
    expect(f(1)).toBe(-4);
    expect(f(-1)).toBe(0);
  });
  it('非法输入返回 NaN 而不是抛错', () => {
    const f = makeEvaluator('log(x)');
    expect(f(-1)).toBeNaN();
  });
  it('除零返回 Infinity（不吞掉）', () => {
    const f = makeEvaluator('1/x');
    expect(f(0)).toBe(Infinity);
  });
});

describe('derivativeExpr', () => {
  it('符号求导', () => {
    expect(derivativeExpr('x^3')).toContain('3');
    expect(derivativeExpr('x^3')).toContain('x');
  });
  it('无法求导时返回空字符串', () => {
    expect(derivativeExpr('???')).toBe('');
  });
});

describe('validateExpression', () => {
  it('合法表达式返回 null', () => {
    expect(validateExpression('x^2 - 2x - 3')).toBeNull();
    expect(validateExpression('log(x)')).toBeNull();
  });
  it('非法表达式返回中文错误消息', () => {
    expect(validateExpression('abc')).not.toBeNull();
    expect(validateExpression('x^^2')).not.toBeNull();
  });
});
