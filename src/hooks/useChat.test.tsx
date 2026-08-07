import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from './useChat';

vi.mock('../core/aiClient', () => ({
  streamChat: vi.fn(),
  ApiError: class ApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));
vi.mock('../core/analysisEngine', () => ({
  analyzeFunction: (d: { id: string; expr: string }) => ({
    expression: d.expr,
    domain: [],
    parity: 'neither' as const,
    monotonic: [],
    extrema: [],
    asymptotes: [],
    zeroPoints: [],
    summary: '',
  }),
}));

import { streamChat } from '../core/aiClient';
const mockedStream = vi.mocked(streamChat);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'mathmate.settings.v1',
    JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'sk-test', model: 'm', stream: false }),
  );
  mockedStream.mockReset();
});

describe('useChat', () => {
  it('发送消息后生成用户与助手消息，且 id 唯一', async () => {
    mockedStream.mockImplementation(async function* () {
      yield '回复内容';
    });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.send('你好');
    });
    expect(result.current.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    const ids = result.current.messages.map((m) => m.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it('重试不再追加重复用户消息，且新助手消息带新 id', async () => {
    mockedStream
      .mockImplementationOnce(async function* () {
        throw new Error('API 错误 (500)');
      })
      .mockImplementationOnce(async function* () {
        yield '好的';
      });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.send('求导');
    });
    expect(result.current.messages.filter((m) => m.role === 'user')).toHaveLength(1);
    await act(async () => {
      await result.current.retry();
    });
    const users = result.current.messages.filter((m) => m.role === 'user');
    expect(users).toHaveLength(1);
    expect(users[0].content).toBe('求导');
    const assistants = result.current.messages.filter((m) => m.role === 'assistant');
    expect(assistants).toHaveLength(2); // 失败提示 + 成功回复
    expect(assistants[0].error).toBe(true);
    expect(assistants[1].content).toBe('好的');
    expect(new Set(result.current.messages.map((m) => m.id)).size).toBe(3);
  });

  it('历史 localStorage 消息无 id 时不影响（兼容旧数据）', async () => {
    // 预置旧格式会话（无 id）
    localStorage.setItem(
      'mathmate.sessions.v1',
      JSON.stringify([
        {
          id: 's1',
          title: '旧会话',
          createdAt: 1,
          messages: [{ role: 'user', content: '旧问题' }],
        },
      ]),
    );
    const { result } = renderHook(() => useChat());
    expect(result.current.messages[0].content).toBe('旧问题');
  });
});
