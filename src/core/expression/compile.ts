import { compile, derivative } from 'mathjs';
import type { EvalFunction } from 'mathjs';

/**
 * 编译表达式为数值求值器。
 *
 * 语义约定（勿改，已被测试固定）：
 * - 编译失败（语法错误）→ 返回恒为 `NaN` 的函数，不抛错
 * - 求值抛错（如定义域外）→ 返回 `NaN`
 * - **除零返回 `±Infinity`，不吞成 `NaN`**（绘图与分析依赖它识别极点）
 */
export function makeEvaluator(expr: string): (x: number) => number {
  let compiled: EvalFunction;
  try {
    compiled = compile(expr);
  } catch {
    return () => NaN;
  }
  return (x: number) => {
    try {
      const v = compiled.evaluate({ x });
      const n = Number(v);
      return Number.isNaN(n) ? NaN : n;
    } catch {
      return NaN;
    }
  };
}

/** 编译是否成功（用于区分「语法错误」与「定义域外」） */
export function canCompile(expr: string): boolean {
  try {
    compile(expr);
    return true;
  } catch {
    return false;
  }
}

/** 符号求导；失败返回空字符串（调用方以此判断「不可导」） */
export function derivativeExpr(expr: string): string {
  try {
    return derivative(expr, 'x').toString();
  } catch {
    return '';
  }
}
