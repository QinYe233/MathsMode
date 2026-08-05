import { Fragment, ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ChatMessage } from '../types';

const TOKEN_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`bubble ${message.role}`}>
      {renderRichText(message.content)}
      {message.error && <div className="bubble-error">请求失败，请检查 API 配置后重试</div>}
    </div>
  );
}

function renderRichText(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(content)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{content.slice(last, m.index)}</span>);
    const tex = (m[1] ?? m[2]).trim();
    const html = katex.renderToString(tex, { displayMode: Boolean(m[1]), throwOnError: false });
    parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(<span key={key++}>{content.slice(last)}</span>);
  if (parts.length === 0) parts.push(<Fragment key="e" />);
  return parts;
}
