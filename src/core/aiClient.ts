import type { AISettings } from '../types';

export const SYSTEM_PROMPT = `你是一位资深高中数学老师。请用中文解答学生的数学问题，步骤清晰，适当使用 LaTeX 公式（$...$ 行内，$$...$$ 独立成行）。

如果题目涉及函数（或你推导出需要画出函数图像辅助理解），在解答的最末尾附加如下 JSON 注释块（不含任何其他内容）：
<!-- MATH_FUNCTIONS -->
{"functions": [{"id": "f", "expr": "表达式", "domain": "(-inf, inf)"}]}
<!-- /MATH_FUNCTIONS -->

规则：
- expr 必须是 mathjs 兼容表达式，自变量为 x。支持 + - * / ^ 幂运算、括号、sin cos tan log（自然对数）exp sqrt abs 与常数 pi。
- 例：f(x)=x²-2x-3 写作 "x^2 - 2x - 3"；f(x)=1/(x-1) 写作 "1/(x - 1)"。
- domain 可选，默认全体实数；有特殊定义域时给出区间并集，如 "(-inf, -1) ∪ (1, inf)"，inf 表示无穷。
- 多个函数（如比较题）就输出多个对象。
- 题目不涉及函数时，不要输出该块。`;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

export async function* streamChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings: AISettings,
): AsyncGenerator<string> {
  const url = `${normalizeBase(settings.baseUrl)}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: settings.stream,
        temperature: 0.3,
      }),
    });
  } catch {
    throw new ApiError('网络错误，请检查网络连接或 Base URL 设置');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    throw new ApiError(detail ? `API 错误 (${res.status})：${detail}` : `API 错误 (${res.status})`, res.status);
  }

  if (!settings.stream) {
    const data = await res.json();
    yield data?.choices?.[0]?.message?.content ?? '';
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new ApiError('响应流不可用');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') yield delta;
      } catch {
        /* skip malformed chunk */
      }
    }
  }
}
