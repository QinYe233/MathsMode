import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

vi.mock('./core/aiClient', () => ({
  streamChat: vi.fn(),
  ApiError: class ApiError extends Error {},
}));
vi.mock('function-plot', () => ({ default: vi.fn() }));

import { streamChat } from './core/aiClient';
const mockedStream = vi.mocked(streamChat);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'mathmate.settings.v1',
    JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'sk-test', model: 'm', stream: false }),
  );
  mockedStream.mockReset();
});

describe('App', () => {
  it('完整流程：提问 → 回复 → 函数卡片出现', async () => {
    mockedStream.mockImplementation(async function* () {
      yield '由题可得：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3"}]}\n<!-- /MATH_FUNCTIONS -->';
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求单调区间');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText(/由题可得/)).toBeInTheDocument();
    expect(await screen.findByText('奇偶性')).toBeInTheDocument();
    expect(screen.getByText('非奇非偶')).toBeInTheDocument();
  });

  it('API 报错显示错误条，点击重试重新请求', async () => {
    mockedStream.mockImplementation(async function* () {
      throw new Error('API 错误 (401)：Invalid API key');
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '你好');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    const matches = await screen.findAllByText(/Invalid API key/);
    expect(matches.length).toBeGreaterThan(0);
    expect(mockedStream).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /重试/ }));
    await waitFor(() => expect(mockedStream).toHaveBeenCalledTimes(2));
  });
});
