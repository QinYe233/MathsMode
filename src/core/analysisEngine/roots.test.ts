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
  it('陡峭斜率根不被误拒（100x-1 在 0.01）', () => {
    const f = (x: number) => 100 * x - 1;
    const roots = findAllRoots(f, -100, 100);
    within(roots, [0.01]);
    expect(roots.every((r) => Math.abs(f(r)) < 1e-4)).toBe(true);
  });
  it('网格错位的切点根（(x-0.05)^2）', () => {
    const f = (x: number) => (x - 0.05) * (x - 0.05);
    const roots = findAllRoots(f, -100, 100);
    within(roots, [0.05]);
    expect(roots.every((r) => Math.abs(f(r)) < 1e-4)).toBe(true);
  });
  it('接近零但不触零的函数无根（x^2 + 5e-9）', () => {
    expect(findAllRoots((x) => x * x + 5e-9, -100, 100)).toEqual([]);
  });
  it('恒为零函数不报任何根', () => {
    expect(findAllRoots(() => 0, -100, 100)).toEqual([]);
  });
  it('根恰在左端点', () => {
    const roots = findAllRoots((x) => x + 100, -100, 100);
    within(roots, [-100]);
    expect(roots.every((r) => Math.abs(r + 100) < 1e-4)).toBe(true);
  });
});
