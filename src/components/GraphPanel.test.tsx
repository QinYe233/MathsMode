import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphPanel } from './GraphPanel';
import { analyzeFunction } from '../core/analysisEngine';
import type { VectorDef } from '../types';

vi.mock('function-plot', () => ({
  default: vi.fn(),
  registerGraphType: vi.fn(),
}));

import functionPlot from 'function-plot';
const mockedPlot = vi.mocked(functionPlot);

const V: VectorDef[] = [{ id: 'v1', name: 'a', x: 3, y: 2 }];

describe('GraphPanel', () => {
  it('无函数时显示空状态', () => {
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
  });

  it('有函数时调用 functionPlot 并展示特性卡片', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    expect(mockedPlot).toHaveBeenCalled();
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data!.length).toBe(1);
    expect(screen.getByText('奇偶性')).toBeInTheDocument();
    expect(screen.getByText('非奇非偶')).toBeInTheDocument();
    expect(screen.getByText('定义域')).toBeInTheDocument();
  });

  it('展示极值与零点标注', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.annotations!.length).toBeGreaterThanOrEqual(3); // min + 2 zeros
  });

  it('向量以 vector 图元传入 functionPlot 且 skipTip', () => {
    render(<GraphPanel analyses={[]} vectors={V} onClear={() => {}} onAddVector={() => null} />);
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data).toContainEqual({ vector: [3, 2], color: '#2563eb', graphType: 'vector', skipTip: true, label: 'a' });
    expect(screen.getByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
  });

  it('向量图例可隐藏：点击后不再传入 vector 图元', async () => {
    render(<GraphPanel analyses={[]} vectors={V} onClear={() => {}} onAddVector={() => null} />);
    await userEvent.click(screen.getByRole('button', { name: 'a=(3,2)' }));
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data!.some((d: { graphType?: string }) => d.graphType === 'vector')).toBe(false);
  });

  it('向量输入非法时显示行内错误', async () => {
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} onAddVector={() => '格式应为 a=(3,2)'} />);
    const input = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(input, 'a=(x,2)');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText(/格式应为/)).toBeInTheDocument();
  });

  it('向量输入合法时回调 onAddVector 并清空输入框', async () => {
    const onAddVector = vi.fn(() => null);
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} onAddVector={onAddVector} />);
    const input = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(input, 'b=(1,-2.5)');
    await userEvent.keyboard('{Enter}');
    expect(onAddVector).toHaveBeenCalledWith('b=(1,-2.5)');
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/格式应为/)).toBeNull();
  });

  it('空内容时清空按钮禁用', () => {
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    expect(screen.getByRole('button', { name: /清空绘图/ })).toBeDisabled();
  });

  it('有内容时点击清空回调触发', async () => {
    const onClear = vi.fn();
    render(
      <GraphPanel
        analyses={[analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' })]}
        vectors={V}
        onClear={onClear}
        onAddVector={() => null}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /清空绘图/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('清空后重新添加同表达式不再保持隐藏', async () => {
    const { rerender } = render(
      <GraphPanel
        analyses={[analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' })]}
        vectors={[]}
        onClear={() => {}}
        onAddVector={() => null}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'x^2 - 2x - 3' }));
    rerender(
      <GraphPanel
        analyses={[analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' })]}
        vectors={[]}
        onClear={() => {}}
        onAddVector={() => null}
      />,
    );
    // 图例处于隐藏态
    expect(screen.getByRole('button', { name: 'x^2 - 2x - 3' }).className).toContain('off');
    rerender(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    rerender(
      <GraphPanel
        analyses={[analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' })]}
        vectors={[]}
        onClear={() => {}}
        onAddVector={() => null}
      />,
    );
    expect(screen.getByRole('button', { name: 'x^2 - 2x - 3' }).className).not.toContain('off');
  });

  it('图例按钮带颜色圆点', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    expect(screen.getByText('x^2 - 2x - 3').querySelector('.legend-dot')).toBeInTheDocument();
  });

  it('hover 图例给对应曲线加高亮 class', async () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    const user = userEvent.setup();
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    // function-plot 被 mock，往 .graph-plot 容器塞一个模拟 svg 结构
    const plot = document.querySelector('.graph-plot')!;
    const svg = document.createElement('div');
    svg.innerHTML = '<svg><g class="function"><path class="line" /></g></svg>';
    plot.appendChild(svg);
    const btn = screen.getByText('x^2 - 2x - 3');
    await user.hover(btn);
    expect(svg.querySelector('g.function')?.classList.contains('curve-highlight')).toBe(true);
    await user.unhover(btn);
    expect(svg.querySelector('g.function')?.classList.contains('curve-highlight')).toBe(false);
    svg.remove();
  });

  it('双击画布触发重绘（重置视野）', async () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    const user = userEvent.setup();
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    const before = mockedPlot.mock.calls.length;
    await user.dblClick(document.querySelector('.graph-plot')!);
    expect(mockedPlot.mock.calls.length).toBeGreaterThan(before);
  });

  it('聚焦极值后在图上生成 focus 标注', async () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    const user = userEvent.setup();
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} onAddVector={() => null} />);
    await user.click(screen.getByText(/极小值/));
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.annotations!.some((ann: any) => ann.text === 'focus')).toBe(true);
  });
});
