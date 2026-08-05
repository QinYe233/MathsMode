import { describe, expect, it } from 'vitest';
import { findAllRoots } from './roots';

const within = (xs: number[], targets: number[], tol = 1e-5) => {
  for (const t of targets) {
    expect(xs.some((x) => Math.abs(x - t) < tol)).toBe(true);
  }
};

describe('findAllRoots', () => {
  it('二次函数两根', () => {
    const f = (x: number) => x * x - 2 * x - 3;
    const roots = findAllRoots(f, -100, 100);
    within(roots, [-1, 3]);
    expect(roots.every((r) => Math.abs(f(r)) < 1e-4)).toBe(true);
  });
  it('切点根（x^2 在 0）', () => {
    const f = (x: number) => x * x;
    const roots = findAllRoots(f, -100, 100);
    within(roots, [0]);
  });
  it('正切根有界（x^3 - x）', () => {
    const f = (x: number) => x * x * x - x;
    const roots = findAllRoots(f, -100, 100);
    within(roots, [-1, 0, 1]);
  });
  it('无根返回空数组（x^2+1）', () => {
    expect(findAllRoots((x) => x * x + 1, -100, 100)).toEqual([]);
  });
  it('不把极点当根（1/x）', () => {
    const f = (x: number) => 1 / x;
    expect(findAllRoots(f, -100, 100)).toEqual([]);
  });
  it('sin 的多个根且不重复', () => {
    const roots = findAllRoots(Math.sin, -10, 10);
    within(roots, [-3 * Math.PI, -2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI, 3 * Math.PI]);
    expect(roots.length).toBe(7);
  });
});
