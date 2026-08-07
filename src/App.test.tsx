import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

vi.mock('./core/aiClient', () => ({
  streamChat: vi.fn(),
  ApiError: class ApiError extends Error {},
}));
vi.mock('function-plot', () => ({ default: vi.fn(), registerGraphType: vi.fn() }));
vi.mock('./core/analysisEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./core/analysisEngine')>();
  return { ...mod, analyzeFunction: vi.fn(mod.analyzeFunction) };
});

import { streamChat } from './core/aiClient';
import { analyzeFunction } from './core/analysisEngine';
const mockedStream = vi.mocked(streamChat);
const mockedAnalyze = vi.mocked(analyzeFunction);

function analysis(expression: string, summary: string) {
  return {
    expression,
    domain: [],
    parity: 'neither' as const,
    monotonic: [],
    extrema: [],
    asymptotes: [],
    zeroPoints: [],
    summary,
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'mathmate.settings.v1',
    JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'sk-test', model: 'm', stream: false }),
  );
  mockedStream.mockReset();
  mockedAnalyze.mockClear(); // 保留包装的真实实现，仅清调用记录
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
    // DrawerPanel 为懒加载组件，需等待异步加载完成
    expect(await screen.findByText(/未识别到函数/)).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /AI 设置/ }));
    expect(document.querySelector('.modal')).not.toBeNull();
  });

  it('抽屉宽度从 localStorage 恢复', async () => {
    localStorage.setItem('mathmate.drawer.v1', '500');
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    const app = document.querySelector('.app') as HTMLElement;
    expect(app.style.gridTemplateColumns).toBe('260px 1fr 500px');
  });

  it('向量输入后出现图例，非法输入显示错误，修改输入清除错误', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    const vecInput = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(vecInput, 'a=(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
    await userEvent.type(vecInput, 'bad');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText(/格式应为/)).toBeInTheDocument();
    await userEvent.type(vecInput, 'x');
    expect(screen.queryByText(/格式应为/)).toBeNull();
  });

  it('无名向量显示坐标图例', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    await userEvent.type(screen.getByPlaceholderText(/回车添加/), '(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: '(3,2)' })).toBeInTheDocument();
  });

  it('同名向量替换旧向量', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    const vecInput = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(vecInput, 'a=(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
    await userEvent.type(vecInput, 'a=(5,5)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'a=(5,5)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'a=(3,2)' })).toBeNull();
  });

  it('无名同名坐标向量替换；无名不覆盖命名向量', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    const vecInput = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(vecInput, '(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: '(3,2)' })).toBeInTheDocument();
    await userEvent.type(vecInput, '(3,2)');
    await userEvent.keyboard('{Enter}');
    await userEvent.type(vecInput, 'a=(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '(3,2)' }).length).toBe(1);
  });

  it('无名同名坐标输入不删除已有命名向量', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    const vecInput = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(vecInput, 'a=(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
    await userEvent.type(vecInput, '(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: '(3,2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
  });

  it('清空绘图清空函数与向量', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    await userEvent.type(screen.getByPlaceholderText(/手动输入函数/), 'x^2');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'x^2' })).toBeInTheDocument();
    const vecInput = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(vecInput, 'a=(3,2)');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /清空绘图/ }));
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'x^2' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'a=(3,2)' })).toBeNull();
  });

  it('清空后重新提问可恢复分析曲线', async () => {
    mockedStream.mockImplementation(async function* () {
      yield '由题可得：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3"}]}\n<!-- /MATH_FUNCTIONS -->';
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求单调区间');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText('奇偶性')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /清空绘图/ }));
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '再来一次');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText('奇偶性')).toBeInTheDocument();
  });

  it('同表达式重新分析后属性面板刷新（新分析对象生效）', async () => {
    mockedAnalyze.mockReturnValueOnce(analysis('x^2', '第一次总结')).mockReturnValueOnce(
      analysis('x^2', '第二次总结'),
    );
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    const input = screen.getByPlaceholderText(/手动输入函数/);
    await userEvent.type(input, 'x^2');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('第一次总结')).toBeInTheDocument();
    await userEvent.type(input, 'x^2');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('第二次总结')).toBeInTheDocument();
  });
});
