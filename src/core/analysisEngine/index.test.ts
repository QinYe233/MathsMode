import { describe, expect, it } from 'vitest';
import { analyzeFunction } from './index';

describe('analyzeFunction', () => {
  it('二次函数完整分析', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    expect(a.parity).toBe('neither');
    expect(a.monotonic.map((s) => `${s.interval}:${s.trend}`)).toEqual([
      '(−∞, 1):dec',
      '(1, +∞):inc',
    ]);
    expect(a.extrema).toHaveLength(1);
    expect(Math.abs(a.extrema[0].x - 1) < 1e-4).toBe(true);
    expect(a.zeroPoints.some((z) => Math.abs(z + 1) < 1e-4)).toBe(true);
    expect(a.zeroPoints.some((z) => Math.abs(z - 3) < 1e-4)).toBe(true);
    expect(a.asymptotes).toEqual([]);
    expect(a.period).toBeUndefined();
    expect(a.summary).toContain('单调');
  });

  it('1/x：奇函数、渐近线、无零点', () => {
    const a = analyzeFunction({ id: 'f', expr: '1/x' });
    expect(a.parity).toBe('odd');
    expect(a.asymptotes.some((x) => x.type === 'vertical')).toBe(true);
    expect(a.asymptotes.some((x) => x.type === 'horizontal')).toBe(true);
    expect(a.zeroPoints).toEqual([]);
  });

  it('sin(x)：奇函数、周期 2π，主周期内零点/极值（不会爆炸）', () => {
    const a = analyzeFunction({ id: 'f', expr: 'sin(x)' });
    expect(a.parity).toBe('odd');
    expect(Math.abs(a.period! - 2 * Math.PI) < 1e-6).toBe(true);
    // 周期函数只在主周期 [0, 2π) 内求根：sin 零点 0、π（共 2 个），无渐近线误判
    expect(a.zeroPoints.length).toBe(2);
    expect(a.extrema.length).toBe(2); // cos 临界点 π/2(极大)、3π/2(极小)
    expect(a.asymptotes).toEqual([]);
    expect(a.monotonic.length).toBeLessThan(6);
  });

  it('log(x)：定义域 (0, +∞)，单调递增', () => {
    const a = analyzeFunction({ id: 'f', expr: 'log(x)' });
    expect(a.parity).toBe('neither');
    expect(a.monotonic.every((s) => s.trend === 'inc')).toBe(true);
    expect(a.zeroPoints.some((z) => Math.abs(z - 1) < 1e-4)).toBe(true);
  });

  it('x^2：偶函数，极小值在 0', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2' });
    expect(a.parity).toBe('even');
    expect(a.extrema.some((e) => e.type === 'min' && Math.abs(e.x) < 1e-4)).toBe(true);
  });

  it('AI 提供定义域时使用之', () => {
    const a = analyzeFunction({ id: 'f', expr: '1/x', domain: '(0, inf)' });
    expect(a.domain).toHaveLength(1);
    expect(a.domain[0].lo).toBe(0);
    expect(a.parity).toBe('neither');
  });

  it('常量函数', () => {
    const a = analyzeFunction({ id: 'f', expr: '3' });
    expect(a.monotonic).toEqual([{ interval: '(−∞, +∞)', trend: 'const' }]);
    expect(a.parity).toBe('even');
    expect(a.zeroPoints).toEqual([]);
  });
});
