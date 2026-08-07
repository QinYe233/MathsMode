import { useState } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble, copyText } from './MessageBubble';
import { validateExpression } from '../core/mathUtil';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  error?: string | null;
  onSend: (text: string) => void;
  onRetry?: () => void;
  onAddFunction?: (expr: string) => void;
  onOpenSettings?: () => void;
}

export function ChatPanel({
  messages,
  loading,
  error,
  onSend,
  onRetry,
  onAddFunction,
  onOpenSettings,
}: Props) {
  const [input, setInput] = useState('');
  const [funcInput, setFuncInput] = useState('');
  const [funcError, setFuncError] = useState<string | null>(null);

  const submit = () => {
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  const addFunction = () => {
    const expr = funcInput.trim();
    if (!expr) return;
    const err = validateExpression(expr);
    if (err) {
      setFuncError(err);
      return;
    }
    setFuncError(null);
    onAddFunction?.(expr);
    setFuncInput('');
  };

  return (
    <div className="chat-panel">
      {onOpenSettings && (
        <div className="chat-head">
          <span>数学学习助手</span>
          <button className="icon-btn" onClick={onOpenSettings} aria-label="AI 设置" title="AI 设置">
            ⚙
          </button>
        </div>
      )}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-hint">输入数学问题开始提问，支持 Markdown 与公式：</div>
            <MessageBubble
              message={{
                role: 'assistant',
                content: '**示例**：求 $f(x)=x^2-2x-3$ 的单调区间和极值',
              }}
            />
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id ?? `${m.role}-${i}`}
            message={m}
            streaming={loading && i === messages.length - 1 && m.role === 'assistant'}
            onCopy={(t) => copyText(t)}
            retryable={
              onRetry != null && i === messages.length - 1 && m.role === 'assistant' && !m.error
            }
            onRetry={onRetry}
          />
        ))}
        {loading && <div className="bubble ai bubble-thinking">思考中…</div>}
      </div>
      <div className="chat-input-area">
        {error && (
          <div className="chat-error-banner">
            <span>⚠️ {error}</span>
            {onRetry && (
              <button className="btn" onClick={onRetry} disabled={loading}>
                重试
              </button>
            )}
          </div>
        )}
        {onAddFunction && (
          <div className="func-input-row">
            <span className="func-input-label">f(x)=</span>
            <input
              className={`func-input${funcError ? ' invalid' : ''}`}
              value={funcInput}
              placeholder="手动输入函数，如 x^2 - 2x - 3（回车即画图）"
              onChange={(e) => {
                setFuncInput(e.target.value);
                if (funcError) {
                  const err = validateExpression(e.target.value.trim());
                  setFuncError(err);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addFunction();
              }}
            />
          </div>
        )}
        {funcError && <div className="func-input-error">{funcError}</div>}
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
