import { describe, expect, it } from 'vitest';
import { extractFunctions } from './structuredParser';

describe('extractFunctions', () => {
  it('解析完整 MATH_FUNCTIONS 块', () => {
    const reply = `解答如下：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3", "domain": "(-inf, inf)"}]}\n<!-- /MATH_FUNCTIONS -->`;
    const defs = extractFunctions(reply);
    expect(defs).toHaveLength(1);
    expect(defs[0].expr).toBe('x^2-2x-3');
    expect(defs[0].domain).toBe('(-inf, inf)');
  });

  it('解析多函数块', () => {
    const reply = `<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2"}, {"id": "g", "expr": "x + 1"}]}\n<!-- /MATH_FUNCTIONS -->`;
    expect(extractFunctions(reply)).toHaveLength(2);
  });

  it('块损坏时用正则兜底提取 f(x)=', () => {
    const reply = `因为 f(x)=x^2-2x-3 且 g(x)=x+1，所以…`;
    const defs = extractFunctions(reply);
    expect(defs.length).toBeGreaterThanOrEqual(1);
    expect(defs[0].expr.replace(/\s+/g, '')).toBe('x^2-2x-3');
  });

  it('无函数时返回空数组', () => {
    expect(extractFunctions('这是一道概率题，不涉及函数。')).toEqual([]);
  });

  it('Unicode 符号归一化（× ÷ − π）', () => {
    const reply = `<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 − 3×x ÷ 2 + π"}]}\n<!-- /MATH_FUNCTIONS -->`;
    const defs = extractFunctions(reply);
    expect(defs[0].expr).toBe('x^2-3*x/2+pi');
  });
});
