/**
 * 表达式工具（兼容门面）。
 *
 * 实现已迁至 `core/expression/`。本文件保留原有 API 与导入路径，
 * 使既有调用方与 15 个既有测试无需改动。
 *
 * 新代码请直接从 `core/expression` 导入。
 */
export { makeEvaluator, derivativeExpr, validateExpression } from './expression';

/**
 * 解析向量输入。支持三种写法：
 * - `a=(3,2)` / `AB = (-3, 2.5)`（带名，名字 1–2 个字母）
 * - `(3,2)`（无名带括号）
 * - `-3,2`（无名裸坐标）
 */
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
