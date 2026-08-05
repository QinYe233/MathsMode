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

export function validateExpression(expr: string): string | null {
  let compiled: EvalFunction;
  try {
    compiled = compile(expr);
  } catch {
    return '表达式语法错误';
  }
  let allNaN = true;
  for (const x of [0, 1, -1, 2, 0.5]) {
    let v: number;
    try {
      v = Number(compiled.evaluate({ x }));
    } catch {
      continue;
    }
    if (!Number.isNaN(v)) {
      allNaN = false;
      break;
    }
  }
  if (allNaN) return '表达式无法计算，请检查写法（如 x^2、1/(x-1)、sin(x)）';
  return null;
}

export function derivativeExpr(expr: string): string {
  try {
    return derivative(expr, 'x').toString();
  } catch {
    return '';
  }
}
