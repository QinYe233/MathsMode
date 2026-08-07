import { Fragment, ReactNode, useDeferredValue } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Element, Text } from 'hast';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
import type { ChatMessage } from '../types';
import { stripMathBlocks } from '../core/structuredParser';

/* ---------- 工具 ---------- */

// 默认 schema 会把 code 的 className 裁成只留 language-*，并把 hljs 高亮的
// span 类（hljs-keyword 等）与 math 标记（math-inline/math-display）全部剥掉；
// 显式放行这几类，公式分支判断与语法高亮才能正常工作。
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [['className', /^language-/, 'math-inline', 'math-display', 'hljs']],
    span: [['className', /^hljs-/]],
  },
};

const isElement = (node: unknown): node is Element =>
  typeof node === 'object' && node !== null && (node as { type?: unknown }).type === 'element';

async function copyText(t: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    /* 剪贴板不可用（权限/jsdom）时静默 */
  }
}

// 从 hast code 节点递归收集文本（含 hljs 注入的 span）
function codeText(node: Element | undefined): string {
  if (!node) return '';
  const walk = (n: unknown): string => {
    if (!isElement(n)) return '';
    return n.children
      .map((c) => (c.type === 'text' ? (c as Text).value : walk(c)))
      .join('');
  };
  return walk(node);
}

/* ---------- 公式渲染（components.code 的 language-math 分支） ---------- */

// react-markdown v10 不调用 components.math：remark-math 节点经 mdast-util-math
// 变成 <code class="language-math math-inline|math-display">，只能在此分支手动渲染。
function MathRender({ className, tex }: { className: string; tex: string }) {
  const display = className.includes('math-display');
  const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false });
  const ok = !html.includes('katex-error');
  return (
    <span
      className={`katex-copy${display ? ' katex-copy-display' : ''}`}
      title="点击复制公式"
      onClick={() => copyText(tex.trim())}
    >
      {ok ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        // 渲染失败保留原文，不显示红字
        <span className="katex-fallback">{tex}</span>
      )}
    </span>
  );
}

/* ---------- Markdown 组件 ---------- */

const markdownComponents: Components = {
  // 链接新窗口打开，避免打断阅读
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isMath =
      typeof className === 'string' &&
      (className.includes('language-math math-inline') ||
        className.includes('language-math math-display'));
    if (isMath) return <MathRender className={className} tex={String(children)} />;
    return <code className={className}>{children}</code>;
  },
  // 代码块：语言标签 + 复制按钮（math 的 pre 保持原样，由 code 组件渲染公式）
  pre: ({ node, children }) => {
    const codeEl = (node?.children ?? []).find(isElement) as Element | undefined;
    const cls = codeEl?.properties?.className;
    const isMath = Array.isArray(cls) && cls.includes('language-math');
    if (isMath) return <pre>{children}</pre>;
    const lang = Array.isArray(cls)
      ? cls.find((c): c is string => typeof c === 'string' && c.startsWith('language-'))?.slice(9)
      : undefined;
    return (
      <div className="code-block">
        <div className="code-head">
          <span className="code-lang">{lang || 'text'}</span>
          <button
            className="code-copy"
            onClick={() => copyText(codeText(codeEl).trim())}
            aria-label="复制代码"
            title="复制代码"
          >
            ⧉
          </button>
        </div>
        <pre>{children}</pre>
      </div>
    );
  },
};

/* ---------- 用户消息：纯文本 + KaTeX（保持原样，不处理 Markdown） ---------- */

const USER_TOKEN_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

// remark-math 只认 $ / $$；LLM 常用 \(...\) / \[...\]，先归一化
function normalizeMathDelimiters(content: string): string {
  return content
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner: string) => `$${inner}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner: string) => `\n\n$$\n${inner}\n$$\n\n`);
}

function renderUserContent(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  const normalized = normalizeMathDelimiters(content);
  USER_TOKEN_RE.lastIndex = 0;
  while ((m = USER_TOKEN_RE.exec(normalized)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{normalized.slice(last, m.index)}</span>);
    const tex = (m[1] ?? m[2]).trim();
    const html = katex.renderToString(tex, { displayMode: Boolean(m[1]), throwOnError: false, strict: false });
    if (html.includes('katex-error')) {
      // 渲染失败保留原文，不显示红字
      parts.push(<span key={key++}>{m[0]}</span>);
    } else {
      parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    }
    last = m.index + m[0].length;
  }
  if (last < normalized.length) parts.push(<span key={key++}>{normalized.slice(last)}</span>);
  if (parts.length === 0) parts.push(<Fragment key="e" />);
  return parts;
}

/* ---------- 气泡 ---------- */

export function MessageBubble({
  message,
  streaming,
  onCopy,
  onRetry,
  retryable,
}: {
  message: ChatMessage;
  streaming?: boolean;
  onCopy?: (text: string) => void;
  onRetry?: () => void;
  retryable?: boolean;
}) {
  return (
    <div className={`bubble ${message.role === 'assistant' ? 'ai' : 'user'}`}>
      {message.role === 'assistant' ? (
        <MarkdownBody content={message.content} />
      ) : (
        renderUserContent(message.content)
      )}
      {streaming && <span className="streaming-cursor" aria-hidden="true" />}
      {message.role === 'assistant' && (onCopy || retryable) && (
        <div className="bubble-actions">
          {onCopy && (
            <button
              className="bubble-action"
              onClick={() => onCopy(message.content)}
              aria-label="复制消息"
              title="复制消息"
            >
              ⧉
            </button>
          )}
          {retryable && onRetry && (
            <button
              className="bubble-action"
              onClick={onRetry}
              aria-label="重试"
              title="重试"
            >
              ↻
            </button>
          )}
        </div>
      )}
      {message.error && <div className="bubble-error">请求失败，请检查 API 配置后重试</div>}
    </div>
  );
}

function MarkdownBody({ content }: { content: string }) {
  // 流式输出时避免每个 token 都做一次完整 markdown 解析
  const deferred = useDeferredValue(content);
  const clean = normalizeMathDelimiters(stripMathBlocks(deferred));
  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[
          [rehypeHighlight, { detect: false }],
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={markdownComponents}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}

// 供 ChatPanel 复用的剪贴板工具
export { copyText };
