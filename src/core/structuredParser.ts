import type { FunctionDef } from '../types';

const BLOCK_RE = /<!--\s*MATH_FUNCTIONS\s*-->([\s\S]*?)<!--\s*\/MATH_FUNCTIONS\s*-->/;

/**
 * 从展示文本中剥离 MATH_FUNCTIONS 元数据块。
 * 兼容流式中间态：块未闭合时（`$` 结尾分支）同样从标记处截断到文末。
 */
export function stripMathBlocks(content: string): string {
  return content.replace(
    /\n?<!--\s*MATH_FUNCTIONS\s*-->[\s\S]*?(?:<!--\s*\/MATH_FUNCTIONS\s*-->|$)/g,
    '',
  );
}
const FN_RE =
  /(?:f|g|h)\s*\(\s*x\s*\)\s*=\s*([0-9a-zA-Z+\-*/^().,\s√π±∞²³⁴⁵⁶⁷⁸⁹⁰¹⁻⁺]{1,80})|y\s*=\s*([^,\n]{1,80})/g;

export function extractFunctions(reply: string): FunctionDef[] {
  const block = reply.match(BLOCK_RE);
  if (block) {
    try {
      const data = JSON.parse(block[1].trim());
      if (data && Array.isArray(data.functions)) {
        const defs = data.functions.filter(
          (d: unknown) =>
            typeof (d as { expr?: unknown })?.expr === 'string' &&
            (d as { expr: string }).expr.trim().length > 0,
        );
        if (defs.length > 0) {
          return defs.map((d: { id?: string; expr: string; domain?: string }, i: number) => ({
            id: d.id ?? `f${i + 1}`,
            expr: normalizeExpr(d.expr),
            domain: typeof d.domain === 'string' ? d.domain : undefined,
          }));
        }
      }
    } catch {
      /* fall through to regex */
    }
  }

  const fallback: FunctionDef[] = [];
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = FN_RE.exec(reply)) !== null && count < 3) {
    const expr = (m[1] ?? m[2] ?? '').trim();
    if (!expr) continue;
    fallback.push({ id: `f${count + 1}`, expr: normalizeExpr(expr) });
    count++;
  }
  return fallback;
}

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

function normalizeExpr(expr: string): string {
  return expr
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
    // 全角数字/符号转半角
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .replace(/　/g, '')
    .replace(/\s+/g, '');
}
