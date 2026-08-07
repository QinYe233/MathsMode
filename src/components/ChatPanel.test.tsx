import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  it('渲染历史消息与输入框', () => {
    render(
      <ChatPanel
        messages={[{ role: 'user', content: 'x^2 的零点？' }]}
        loading={false}
        onSend={() => {}}
      />,
    );
    expect(screen.getByText('x^2 的零点？')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/输入数学问题/)).toBeInTheDocument();
  });

  it('发送消息触发 onSend', async () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} loading={false} onSend={onSend} />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求导');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(onSend).toHaveBeenCalledWith('求导');
  });

  it('加载中显示状态', () => {
    render(
      <ChatPanel
        messages={[{ role: 'user', content: 'hi' }]}
        loading
        onSend={() => {}}
      />,
    );
    expect(screen.getByText(/思考中/)).toBeInTheDocument();
  });

  it('空状态展示富文本示例（加粗 + 公式）', () => {
    render(<ChatPanel messages={[]} loading={false} onSend={() => {}} />);
    expect(screen.getByText('示例', { selector: 'strong' })).toBeInTheDocument();
    expect(document.querySelector('.katex')).not.toBeNull();
  });

  it('设置按钮有可访问名称', () => {
    render(
      <ChatPanel messages={[]} loading={false} onSend={() => {}} onOpenSettings={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /AI 设置/ })).toBeInTheDocument();
  });

  it('非法手动输入函数显示红色错误且不调用 onAddFunction', async () => {
    const onAddFunction = vi.fn();
    render(
      <ChatPanel
        messages={[]}
        loading={false}
        onSend={() => {}}
        onAddFunction={onAddFunction}
      />,
    );
    const input = screen.getByPlaceholderText(/手动输入函数/);
    await userEvent.type(input, 'abc');
    await userEvent.keyboard('{Enter}');
    expect(onAddFunction).not.toHaveBeenCalled();
    expect(screen.getByText(/表达式无法计算/)).toBeInTheDocument();
    expect(input.className).toContain('invalid');
    await userEvent.clear(input);
    await userEvent.type(input, 'x^2');
    await userEvent.keyboard('{Enter}');
    expect(onAddFunction).toHaveBeenCalledWith('x^2');
  });

  it('loading 且最后一条为 assistant 时显示流式光标', () => {
    render(
      <ChatPanel
        messages={[{ id: 'a1', role: 'assistant', content: '逐步求解…' }]}
        loading
        onSend={() => {}}
      />,
    );
    expect(document.querySelector('.streaming-cursor')).toBeInTheDocument();
  });

  it('loading 但最后一条是 user 时不显示流式光标', () => {
    render(
      <ChatPanel
        messages={[{ id: 'u1', role: 'user', content: '求导' }]}
        loading
        onSend={() => {}}
      />,
    );
    expect(document.querySelector('.streaming-cursor')).not.toBeInTheDocument();
  });

  it('hover assistant 消息出现复制按钮并复制全文', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(
      <ChatPanel
        messages={[{ id: 'a1', role: 'assistant', content: '**结论**' }]}
        loading={false}
        onSend={() => {}}
        onOpenSettings={() => {}}
        onRetry={() => {}}
      />,
    );
    await user.hover(screen.getByText('结论'));
    await user.click(screen.getByRole('button', { name: '复制消息' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('**结论**');
  });

  it('最后一条 assistant 消息显示重试按钮且点击触发 onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatPanel
        messages={[{ id: 'a1', role: 'assistant', content: 'x' }]}
        loading={false}
        onSend={() => {}}
        onOpenSettings={() => {}}
        onRetry={onRetry}
      />,
    );
    await user.hover(screen.getByText('x'));
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('用户消息不显示操作按钮', () => {
    render(
      <ChatPanel
        messages={[{ id: 'u1', role: 'user', content: 'hi' }]}
        loading={false}
        onSend={() => {}}
        onOpenSettings={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(document.querySelector('.bubble-actions')).not.toBeInTheDocument();
  });

  it('assistant 消息的函数 chip 可点击并触发 onHighlight', async () => {
    const onHighlight = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatPanel
        messages={[
          {
            id: 'a1',
            role: 'assistant',
            content: '见函数',
            functions: [{ id: 'f1', expr: 'x^2 - 2x - 3' }],
          },
        ]}
        loading={false}
        onSend={() => {}}
        onOpenSettings={() => {}}
        onHighlight={onHighlight}
      />,
    );
    await user.click(screen.getByRole('button', { name: /x\^2 - 2x - 3/ }));
    expect(onHighlight).toHaveBeenCalledWith('x^2 - 2x - 3');
  });
});
