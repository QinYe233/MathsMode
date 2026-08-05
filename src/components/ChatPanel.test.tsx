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
});
