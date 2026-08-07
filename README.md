# 数学学习助手 (MathMate)

一个面向数学学习的桌面应用，支持函数绘图、公式渲染与交互式探索。基于 React + TypeScript + Vite 构建，并通过 Tauri 打包为跨平台桌面应用。

## 特性

- 函数图像绘制与多函数对比（基于 function-plot）
- 数学表达式解析与计算（mathjs）
- 公式渲染（KaTeX）
- 富文本聊天：AI 回复支持 Markdown（标题/加粗/列表/表格/代码块）+ LaTeX 公式（`$...$`、`$$...$$`、`\(...\)`、`\[...\]`），自动剥离绘图元数据块
- 矢量输入与可视化

## 富文本渲染管线

AI 回复经 `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` 渲染，`rehype-sanitize` 防 XSS（schema 已扩展以保留 KaTeX MathML）；渲染失败的公式自动回退为纯文本；流式输出经 `useDeferredValue` 优化。详见 `src/components/MessageBubble.tsx`。

## 技术栈

- React 18 + TypeScript
- Vite 5
- Tauri 2（桌面壳）
- Vitest + Testing Library（测试）

## 开发

```bash
npm install
npm run dev          # 启动 Vite 开发服务器
npm run test         # 运行测试
npm run build        # 类型检查并构建
npm run tauri dev    # 以 Tauri 桌面应用方式运行
```

## Contributors

- [QinYe233](https://github.com/QinYe233)

## 许可证

[MIT](LICENSE)
