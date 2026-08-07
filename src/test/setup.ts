import '@testing-library/jest-dom';

// jsdom 的 getComputedStyle 在 MathML 元素（KaTeX 的 <math> 子树）上会崩溃：
// https://github.com/jsdom/jsdom/issues/3464 —— MathMLElement 没有 .style。
// 真实应用中 katex.min.css 把 .katex-mathml 设为 display:none（仅作无障碍朗读），
// 这里在测试环境模拟同样的语义，避免 getByRole 等查询在遍历 DOM 时崩溃。
const realGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((elt: Element) => {
  if (elt.namespaceURI === 'http://www.w3.org/1998/Math/MathML') {
    return { display: 'none', visibility: 'hidden' } as CSSStyleDeclaration;
  }
  return realGetComputedStyle(elt);
}) as typeof window.getComputedStyle;
