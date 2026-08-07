import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../types';

const assistant = (content: string): ChatMessage => ({ role: 'assistant', content });
const user = (content: string): ChatMessage => ({ role: 'user', content });

function katexEls(): Element[] {
  return Array.from(document.querySelectorAll('.md-content .katex'));
}

describe('MessageBubble 富文本渲染', () => {
  describe('LaTeX 公式', () => {
    it('行内 $x^2$ 渲染为 KaTeX，且不泄露原文标记', () => {
      render(<MessageBubble message={assistant('求 $x^2$ 的极值')} />);
      expect(katexEls().length).toBeGreaterThan(0);
      expect(document.body.textContent).not.toContain('$x^2$');
      expect(screen.getByText(/求/)).toBeInTheDocument();
    });

    it('块级 $$...$$ 渲染为 display 公式', () => {
      render(<MessageBubble message={assistant('对称轴：\n$$\nx = \\frac{-b}{2a}\n$$')} />);
      expect(document.querySelector('.katex-display')).not.toBeNull();
    });

    it('\(...\) 行内公式同样渲染', () => {
      render(<MessageBubble message={assistant('令 \\(x^2=4\\) 求解')} />);
      expect(katexEls().length).toBeGreaterThan(0);
    });

    it('\[...\] 块级公式渲染为 display', () => {
      render(<MessageBubble message={assistant('\\[ \\int_0^1 x \\, dx \\]')} />);
      expect(document.querySelector('.katex-display')).not.toBeNull();
    });

    it('中文夹杂公式正确分段', () => {
      render(<MessageBubble message={assistant('求 $x^2$ 的极值，再求 $x^3$ 的零点')} />);
      expect(katexEls().length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/求/)).toBeInTheDocument();
      expect(screen.getByText(/的极值/)).toBeInTheDocument();
    });

    it('渲染失败的公式回退为纯文本，不出现 katex-error 红字', () => {
      render(<MessageBubble message={assistant('我花了$5，买了$3 的东西')} />);
      expect(document.querySelector('.katex-error')).toBeNull();
      expect(document.body.textContent).toContain('我花了');
    });

    it('语法损坏的公式（$\\frac{}$）回退为原文', () => {
      render(<MessageBubble message={assistant('公式：$\\frac{}$ 有误')} />);
      expect(document.querySelector('.katex-error')).toBeNull();
      expect(document.body.textContent).toContain('公式：');
    });
  });

  describe('Markdown', () => {
    it('加粗 **文字** 渲染为 strong', () => {
      render(<MessageBubble message={assistant('这是**重点**内容')} />);
      const strong = document.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('重点');
    });

    it('无序列表渲染为 li', () => {
      render(<MessageBubble message={assistant('- 第一步\n- 第二步')} />);
      expect(document.querySelectorAll('li')).toHaveLength(2);
    });

    it('标题 # 渲染为 h1', () => {
      render(<MessageBubble message={assistant('# 解题过程')} />);
      expect(document.querySelector('h1')?.textContent).toBe('解题过程');
    });

    it('GFM 表格渲染为 table/th/td', () => {
      render(<MessageBubble message={assistant('| x | y |\n|---|---|\n| 1 | 2 |')} />);
      expect(document.querySelector('table')).not.toBeNull();
      expect(document.querySelector('th')?.textContent).toBe('x');
      expect(document.querySelector('td')?.textContent).toBe('1');
    });

    it('引用 > 渲染为 blockquote', () => {
      render(<MessageBubble message={assistant('> 注意符号方向')} />);
      expect(document.querySelector('blockquote')?.textContent).toContain('注意符号方向');
    });

    it('行内代码与代码块渲染', () => {
      render(
        <MessageBubble
          message={assistant('运行 ``js 代码`` 前先看\n\n```js\nconst x = 1\n```')}
        />,
      );
      expect(document.querySelectorAll('code').length).toBeGreaterThanOrEqual(2);
      expect(document.querySelector('pre')).not.toBeNull();
    });

    it('软换行保留为换行（remark-breaks）', () => {
      render(<MessageBubble message={assistant('第一行\n第二行')} />);
      expect(document.querySelectorAll('br').length).toBeGreaterThan(0);
    });
  });

  describe('安全与元数据', () => {
    it('原始 HTML 不渲染为元素（防 XSS）', () => {
      render(<MessageBubble message={assistant('这是<script>alert(1)</script>内容')} />);
      expect(document.querySelector('script')).toBeNull();
      expect(screen.getByText(/这是/)).toBeInTheDocument();
      expect(screen.getByText(/内容/)).toBeInTheDocument();
    });

    it('javascript: 链接被拦截', () => {
      render(<MessageBubble message={assistant('[点我](javascript:alert(1))')} />);
      const a = document.querySelector('a');
      expect(a).not.toBeNull();
      expect(a?.getAttribute('href') ?? '').not.toContain('javascript:');
    });

    it('MATH_FUNCTIONS 元数据块不显示给用户', () => {
      render(
        <MessageBubble
          message={assistant(
            '解答如下：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2"}]}\n<!-- /MATH_FUNCTIONS -->',
          )}
        />,
      );
      expect(document.body.textContent).toContain('解答如下');
      expect(document.body.textContent).not.toContain('MATH_FUNCTIONS');
      expect(document.body.textContent).not.toContain('"functions"');
    });

    it('流式中间态（块未闭合）也不泄露 JSON', () => {
      render(
        <MessageBubble
          message={assistant('解答：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f"}]}')}
        />,
      );
      expect(document.body.textContent).toContain('解答：');
      expect(document.body.textContent).not.toContain('"functions"');
    });
  });

  describe('用户消息保持原样', () => {
    it('不渲染 markdown，只渲染公式，保留换行', () => {
      render(<MessageBubble message={user('**加粗** $x^2$\n第二行')} />);
      expect(document.querySelector('strong')).toBeNull();
      expect(document.querySelectorAll('.bubble.user .katex').length).toBeGreaterThan(0);
      expect(document.body.textContent).toContain('**加粗**');
      expect(document.body.textContent).toContain('第二行');
    });

    it('用户消息支持 \(...\) 行内公式', () => {
      render(<MessageBubble message={user('令 \\(x=2\\)')} />);
      expect(document.querySelectorAll('.bubble.user .katex').length).toBeGreaterThan(0);
    });

    it('用户消息中的坏公式不显示红字', () => {
      render(<MessageBubble message={user('价格是$5，买了$3')} />);
      expect(document.querySelector('.katex-error')).toBeNull();
    });
  });
});
