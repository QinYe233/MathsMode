import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphPanel } from './GraphPanel';
import { analyzeFunction } from '../core/analysisEngine';

vi.mock('function-plot', () => ({
  default: vi.fn(),
}));

import functionPlot from 'function-plot';
const mockedPlot = vi.mocked(functionPlot);

describe('GraphPanel', () => {
  it('无函数时显示空状态', () => {
    render(<GraphPanel analyses={[]} />);
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
  });

  it('有函数时调用 functionPlot 并展示特性卡片', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} />);
    expect(mockedPlot).toHaveBeenCalled();
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data!.length).toBe(1);
    expect(screen.getByText('奇偶性')).toBeInTheDocument();
    expect(screen.getByText('非奇非偶')).toBeInTheDocument();
    expect(screen.getByText('定义域')).toBeInTheDocument();
  });

  it('展示极值与零点标注', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} />);
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.annotations!.length).toBeGreaterThanOrEqual(3); // min + 2 zeros
  });
});
