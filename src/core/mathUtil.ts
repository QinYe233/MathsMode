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

export function parseVector(
  input: string,
): { name: string; x: number; y: number } | { error: string } {
  const s = input.trim();
  const num = '(-?\\d+(?:\\.\\d+)?)';
  const named = new RegExp(`^([a-zA-Z]{1,2})\\s*=\\s*\\(\\s*${num}\\s*,\\s*${num}\\s*\\)$`);
  const anonParen = new RegExp(`^\\(\\s*${num}\\s*,\\s*${num}\\s*\\)$`);
  const anonBare = new RegExp(`^${num}\\s*,\\s*${num}$`);
  const m = named.exec(s) ?? anonParen.exec(s) ?? anonBare.exec(s);
  if (!m) return { error: '格式应为 a=(3,2)，坐标支持负号和小数' };
  const x = parseFloat(m[m.length - 2]);
  const y = parseFloat(m[m.length - 1]);
  const name = named.test(s) ? m[1] : '';
  return { name, x, y };
}
