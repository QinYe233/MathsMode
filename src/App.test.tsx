import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('初始收起：显示边缘标签，无右侧面板', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /函数图像/ })).toBeInTheDocument();
    expect(document.querySelector('.drawer-panel')).toBeNull();
  });

  it('点击标签展开抽屉显示空态', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
    expect(document.querySelector('.drawer-panel')).not.toBeNull();
  });

  it('完整流程：提问 → 回复 → 抽屉自动展开 + 函数卡片出现', async () => {
    mockedStream.mockImplementation(async function* () {
      yield '由题可得：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3"}]}\n<!-- /MATH_FUNCTIONS -->';
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求单调区间');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText(/由题可得/)).toBeInTheDocument();
    expect(await screen.findByText('奇偶性')).toBeInTheDocument();
    expect(screen.getByText('非奇非偶')).toBeInTheDocument();
    expect(document.querySelector('.drawer-panel')).not.toBeNull();
  });

  it('API 报错显示错误横幅与重试', async () => {
    mockedStream.mockImplementation(async function* () {
      throw new Error('API 错误 (401)：Invalid API key');
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '你好');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect((await screen.findAllByText(/Invalid API key/)).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(mockedStream).toHaveBeenCalledTimes(2);
  });

  it('抽屉关闭时仍可打开设置', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '⚙' }));
    expect(document.querySelector('.modal')).not.toBeNull();
  });

  it('抽屉宽度从 localStorage 恢复', async () => {
    localStorage.setItem('mathmate.drawer.v1', '500');
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    const app = document.querySelector('.app') as HTMLElement;
    expect(app.style.gridTemplateColumns).toBe('44px 1fr 500px');
  });
});
