/**
 * 表达式归一化：把「人所书写的数学」转成 mathjs 可解析的表达式。
 *
 * 设计要点（修复缺陷 E5）：
 * 本模块是**唯一**的归一化入口。此前 `structuredParser.normalizeExpr` 只作用于
 * AI 返回的表达式，手动输入框完全没有归一化，导致 `x²`、`√x` 被拒（E5）。
 * 现统一由本模块提供，两条链路共用。
 */

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

/** GB2312 全角数字/字母 → 半角（全角 A-Z a-z 0-9 连续区） */
function fullWidthToHalfWidth(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 归一化为 mathjs 兼容表达式。
 *
 * 处理的书写形式：
 * - Unicode 减号 `−–—` → `-`
 * - `×` → `*`，`÷` → `/`
 * - `π` → `pi`
 * - `√(x+1)` → `sqrt(x+1)`，`√x` → `sqrt(x)`
 * - `|x|` → `abs(x)`
 * - 上标 `x²` → `x^2`，`x⁻¹` → `x^-1`
 * - 全角 `（）＋－` 与全角数字字母 → 半角
 * - 全角空格与所有空白 → 移除
 *
 * 注意：移除全部空白意味着 `x y` 会变成 `xy`（mathjs 视为未定义符号）。
 * 这是既有行为，保持不变以避免影响 AI 链路。
 */
export function normalizeExpr(expr: string): string {
  return fullWidthToHalfWidth(expr)
    .replace(/[−–—]/g, '-') // Unicode 减号
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√\s*\(/g, 'sqrt(') // √(x+1) → sqrt(x+1)（保留右括号，嵌套安全）
    .replace(/√([a-zA-Z0-9])/g, 'sqrt($1)') // √x → sqrt(x)
    .replace(/\|([^|]+)\|/g, 'abs($1)') // |x| → abs(x)
    // 上标运行（可带 ⁻ ⁺）：x² → x^2；x⁻¹ → x^-1
    .replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => {
      const sign = m.startsWith('⁻') ? '-' : '';
      const digits = (m.startsWith('⁻') || m.startsWith('⁺') ? m.slice(1) : m)
        .split('')
        .map((c) => SUPERSCRIPT[c])
        .join('');
      return `^${sign}${digits}`;
    })
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .replace(/　/g, '')
    .replace(/\s+/g, '');
}

/**
 * 归一化但对空输入保持空串（避免 `''` 被误判为有效表达式）。
 * 供校验入口使用。
 */
export function normalizeForValidation(expr: string): string {
  return normalizeExpr(expr.trim());
}
