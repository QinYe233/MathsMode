import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamChat } from './aiClient';

const settings = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  stream: true,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sseResponse = (chunks: string[]) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
};

afterEach(() => vi.restoreAllMocks());

describe('streamChat', () => {
  it('流式模式：逐段产出内容', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    );
    const out: string[] = [];
    for await (const piece of streamChat([{ role: 'user', content: 'hi' }], settings)) {
      out.push(piece);
    }
    expect(out).toEqual(['你', '好']);
  });

  it('非流式模式：一次性产出', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '完整回答' } }] }),
      ),
    );
    const out: string[] = [];
    for await (const piece of streamChat([{ role: 'user', content: 'hi' }], { ...settings, stream: false })) {
      out.push(piece);
    }
    expect(out).toEqual(['完整回答']);
  });

  it('HTTP 错误抛出 ApiError 且带状态码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Invalid API key' } }, 401)),
    );
    await expect(
      (async () => {
        for await (const _ of streamChat([{ role: 'user', content: 'hi' }], settings)) {
          /* noop */
        }
      })(),
    ).rejects.toMatchObject({ status: 401, name: 'ApiError' });
  });

  it('网络失败抛出 ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      (async () => {
        for await (const _ of streamChat([{ role: 'user', content: 'hi' }], settings)) {
          /* noop */
        }
      })(),
    ).rejects.toMatchObject({ name: 'ApiError' });
  });

  it('请求体包含 system prompt 与消息', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: '' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    for await (const _ of streamChat([{ role: 'user', content: 'x^2 的零点' }], { ...settings, stream: false })) {
      /* noop */
    }
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('x^2 的零点');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });
});
