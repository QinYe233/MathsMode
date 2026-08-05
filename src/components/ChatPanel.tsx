import { useState } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onAddFunction?: (expr: string) => void;
}

export function ChatPanel({ messages, loading, onSend, onAddFunction }: Props) {
  const [input, setInput] = useState('');
  const [funcInput, setFuncInput] = useState('');

  const submit = () => {
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            输入数学问题开始提问，例如：
            <br />
            「求 f(x)=x²-2x-3 的单调区间和极值」
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && <div className="bubble ai bubble-thinking">思考中…</div>}
      </div>
      <div className="chat-input-area">
        {onAddFunction && (
          <div className="func-input-row">
            <span className="func-input-label">f(x)=</span>
            <input
              className="func-input"
              value={funcInput}
              placeholder="手动输入函数，如 x^2 - 2x - 3（回车即画图）"
              onChange={(e) => setFuncInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && funcInput.trim()) {
                  onAddFunction(funcInput.trim());
                  setFuncInput('');
                }
              }}
            />
          </div>
        )}
        <textarea
          className="chat-input"
          value={input}
          placeholder="输入数学问题，支持 $LaTeX$ 公式…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="chat-actions">
          <button className="btn primary" onClick={submit} disabled={loading || !input.trim()}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
