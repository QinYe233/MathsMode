import { Fragment, ReactNode, useDeferredValue } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ChatMessage } from '../types';
import { stripMathBlocks } from '../core/structuredParser';

/* ---------- KaTeX / Markdown 渲染管线 ---------- */

// KaTeX 的 MathML 输出标签（默认 sanitize schema 不含它们，会剥掉公式并泄露原文）
const KATEX_TAGS = [
  'math', 'semantics', 'annotation', 'mrow', 'mspace', 'mstyle', 'mtable', 'mtd', 'mtr',
  'msqrt', 'mn', 'mo', 'mi', 'mtext', 'msup', 'msub', 'msubsup', 'mfrac', 'munder', 'mover',
  'munderover', 'mroot', 'mpadded', 'mphantom', 'menclose', 'merror', 'mfenced', 'mlabeledtr',
  'mlongdiv', 'mprescripts', 'none', 'mstack', 'mscarries', 'mscarry', 'msgroup', 'msline', 'msrow',
];

// 默认 schema + KaTeX 所需标签/属性（className、style、xmlns、encoding）
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...KATEX_TAGS])],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...new Set([...(defaultSchema.attributes?.['*'] ?? []), 'className', 'style'])],
    math: [...new Set([...(defaultSchema.attributes?.math ?? []), 'xmlns'])],
    annotation: [...new Set([...(defaultSchema.attributes?.annotation ?? []), 'encoding'])],
  },
};

const isElement = (node: unknown): node is Element =>
  typeof node === 'object' && node !== null && (node as { type?: unknown }).type === 'element';

// KaTeX 渲染失败的公式回退为纯文本，避免红字乱码（如中文语境误匹配的 $...$）
const rehypeKatexFallback: Plugin<[], Root> = () => (tree) => {
  const visit = (node: unknown): void => {
    if (!isElement(node)) return;
    const cls = node.properties?.className;
    if (Array.isArray(cls) && cls.includes('katex-error')) {
      const text = node.children
        .filter((c): c is Text => c.type === 'text')
        .map((c) => c.value)
        .join('');
      node.children = text ? [{ type: 'text', value: text }] : [];
      node.properties = { ...node.properties, className: cls.filter((c) => c !== 'katex-error') };
    }
    node.children.forEach((child) => visit(child));
  };
  tree.children.forEach((child) => visit(child));
};

const markdownComponents: Components = {
  // 链接新窗口打开，避免打断阅读
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
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

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`bubble ${message.role}`}>
      {message.role === 'assistant' ? (
        <MarkdownBody content={message.content} />
      ) : (
        renderUserContent(message.content)
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
          [rehypeKatex, { throwOnError: false, strict: false }],
          rehypeKatexFallback,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={markdownComponents}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}
