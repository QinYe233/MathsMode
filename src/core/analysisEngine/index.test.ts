import { describe, expect, it } from 'vitest';
import { analyzeFunction } from './index';

describe('analyzeFunction', () => {
  it('二次函数完整分析', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    expect(a.parity).toBe('neither');
    expect(a.monotonic.map((s) => `${s.interval}:${s.trend}`)).toEqual([
      '(−∞, 1]:dec',
      '[1, +∞):inc',
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

  // 回归：缺陷 E4 余下部分 —— 窗口外的根此前被静默丢弃
  describe('窗口外零点（E4 回归）', () => {
    it('(x-2000)(x-1) 两个零点都要报告', () => {
      const a = analyzeFunction({ id: 'f', expr: '(x - 2000)*(x - 1)' });
      expect(a.zeroPoints.some((z) => Math.abs(z - 1) < 1e-3)).toBe(true);
      expect(a.zeroPoints.some((z) => Math.abs(z - 2000) < 1e-3)).toBe(true);
    });

    it('x^2-4000000 的 ±2000 零点都要报告', () => {
      const a = analyzeFunction({ id: 'f', expr: 'x^2 - 4000000' });
      expect(a.zeroPoints.some((z) => Math.abs(z - 2000) < 1e-2)).toBe(true);
      expect(a.zeroPoints.some((z) => Math.abs(z + 2000) < 1e-2)).toBe(true);
    });

    it('不需要放宽的函数不额外增加零点（x^2-2x-3 仍为 2 个）', () => {
      const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
      expect(a.zeroPoints).toHaveLength(2);
    });

    it('周期函数不做窗口外放宽（sin 仍为主周期内 2 个零点）', () => {
      const a = analyzeFunction({ id: 'f', expr: 'sin(x)' });
      expect(a.zeroPoints).toHaveLength(2);
    });
  });
});
