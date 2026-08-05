import type { FunctionDef } from '../types';

const BLOCK_RE = /<!--\s*MATH_FUNCTIONS\s*-->([\s\S]*?)<!--\s*\/MATH_FUNCTIONS\s*-->/;
const FN_RE = /(?:f|g|h)\s*\(\s*x\s*\)\s*=\s*([0-9a-zA-Z+\-*/^().\s]{1,80})/g;

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
    fallback.push({ id: `f${count + 1}`, expr: normalizeExpr(m[1].trim()) });
    count++;
  }
  return fallback;
}

function normalizeExpr(expr: string): string {
  return expr
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/\s+/g, '');
}
