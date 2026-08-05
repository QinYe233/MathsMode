import { compile, derivative, EvalFunction } from 'mathjs';

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

export function derivativeExpr(expr: string): string {
  try {
    return derivative(expr, 'x').toString();
  } catch {
    return '';
  }
}
