import type { FunctionDef } from '../types';
import { normalizeExpr } from './expression/normalize';

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

// 归一化实现已统一到 core/expression/normalize（修复缺陷 E5：
// 此前手动输入框完全没有归一化，导致 x²、√x 被拒）。
// 此处仅保留转发，避免同一逻辑存在两份实现而再次分叉。
export { normalizeExpr };
