import { describe, expect, it } from 'vitest';
import { makeEvaluator, derivativeExpr, validateExpression, parseVector } from './mathUtil';

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

describe('parseVector', () => {
  it('解析带名向量 a=(3,2)', () => {
    expect(parseVector('a=(3,2)')).toEqual({ name: 'a', x: 3, y: 2 });
  });

  it('解析带名向量（空格、负号、小数）', () => {
    expect(parseVector('AB = (-3, 2.5)')).toEqual({ name: 'AB', x: -3, y: 2.5 });
  });

  it('解析无名向量 (3,2)', () => {
    expect(parseVector('(3,2)')).toEqual({ name: '', x: 3, y: 2 });
  });

  it('解析无名裸坐标 -3,2', () => {
    expect(parseVector('-3,2')).toEqual({ name: '', x: -3, y: 2 });
  });

  it('拒绝缺少逗号', () => {
    expect(parseVector('(3 2)')).toHaveProperty('error');
  });

  it('拒绝非数字分量', () => {
    expect(parseVector('a=(x,2)')).toHaveProperty('error');
    expect(parseVector('a=(3,)')).toHaveProperty('error');
  });

  it('拒绝多余字符', () => {
    expect(parseVector('a=(3,2);')).toHaveProperty('error');
    expect(parseVector('a=3,2')).toHaveProperty('error'); // 带名必须带括号
  });

  it('拒绝超过 2 字符的名字', () => {
    expect(parseVector('abc=(3,2)')).toHaveProperty('error');
  });
});
