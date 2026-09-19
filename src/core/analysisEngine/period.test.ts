import { describe, expect, it } from 'vitest';
import { analyzePeriod } from './period';
import { inferDomain } from './domain';
import { makeEvaluator } from '../mathUtil';

const analyze = (expr: string) => {
  const f = makeEvaluator(expr);
  return analyzePeriod(expr, f, inferDomain(expr));
};

describe('analyzePeriod', () => {
  it('sin(x) → 2π（解析求解）', () => {
    const r = analyze('sin(x)');
    expect(Math.abs(r.period! - 2 * Math.PI) < 1e-6).toBe(true);
    // 解析分支不应标记为「不确定」
    expect(r.uncertain).toBeFalsy();
  });
  it('cos(2x) → π（解析求解）', () => {
    const r = analyze('cos(2x)');
    expect(Math.abs(r.period! - Math.PI) < 1e-6).toBe(true);
    expect(r.uncertain).toBeFalsy();
  });
  it('tan(x) → π（解析求解）', () => {
    const r = analyze('tan(x)');
    expect(Math.abs(r.period! - Math.PI) < 1e-6).toBe(true);
    expect(r.uncertain).toBeFalsy();
  });
  it('sin(x) + sin(3x) → 2π（最小公倍数，解析求解）', () => {
    const r = analyze('sin(x) + sin(3x)');
    expect(Math.abs(r.period! - 2 * Math.PI) < 1e-6).toBe(true);
    expect(r.uncertain).toBeFalsy();
  });
  it('非周期函数不给出周期', () => {
    expect(analyze('x^2').period).toBeUndefined();
  });
  it('x + sin(x) 非纯周期组合不给出周期', () => {
    expect(analyze('x + sin(x)').period).toBeUndefined();
  });
  it('纯三角组合仍给出周期 sin(x)+cos(2x)', () => {
    const r = analyze('sin(x) + cos(2x)');
    expect(Math.abs(r.period! - 2 * Math.PI) < 1e-6).toBe(true);
    expect(r.uncertain).toBeFalsy();
  });

  // 回归：缺陷 W5 —— 旧候选周期表只有 8 个值，π/3、3 等周期无法识别；
  // 且解析分支会给出**偏大**的周期（三角外的变换看不出来）。
  describe('周期解析与数值兜底（W5 回归）', () => {
    it('abs(sin(x)) 的周期是 π（解析值 2π 需向下修正）', () => {
      const r = analyze('abs(sin(x))');
      expect(r.period).toBeDefined();
      expect(Math.abs(r.period! - Math.PI) < 1e-6).toBe(true);
    });

    it('sin(x)^2 的周期是 π', () => {
      const r = analyze('sin(x)^2');
      expect(r.period).toBeDefined();
      expect(Math.abs(r.period! - Math.PI) < 1e-6).toBe(true);
    });

    it('候选表扩展到 π/3：sin(6x) 的周期', () => {
      const r = analyze('sin(6x)');
      expect(r.period).toBeDefined();
      expect(Math.abs(r.period! - Math.PI / 3) < 1e-6).toBe(true);
    });
  });
});
