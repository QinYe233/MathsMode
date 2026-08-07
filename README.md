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

## 架构

```
src/
├── App.tsx               # 顶层布局：会话侧栏 + 聊天 + 绘图抽屉 + 设置弹窗
├── components/           # 界面组件
│   ├── ChatPanel.tsx     # 聊天面板（消息流、输入框、空状态示例）
│   ├── MessageBubble.tsx # 消息气泡：assistant 走 Markdown+KaTeX 管线，user 纯文本+KaTeX
│   ├── DrawerPanel.tsx   # 函数图像抽屉（GraphPanel / PropertyCard）
│   └── HistorySidebar.tsx / SettingsModal.tsx
├── hooks/useChat.ts      # 会话状态：发送/重试/流式追加/错误处理（send 支持 appendUser 选项）
├── core/                 # 纯逻辑层（可单测）
│   ├── aiClient.ts       # OpenAI 兼容 API 客户端：SSE 流式、120s 超时/中止
│   ├── structuredParser.ts # MATH_FUNCTIONS 元数据提取 + 表达式归一化（上标/√/绝对值/全角）
│   ├── analysisEngine.ts # 函数分析（定义域/奇偶性/单调性/极值/零点/渐近线）
│   ├── mathUtil.ts / historyStore.ts / settingsStore.ts
└── styles/global.css
```

## 测试

```bash
npm run test         # 全部单测（Vitest + jsdom + Testing Library）
npm run test:watch   # 监听模式
```

覆盖点：富文本渲染（`MessageBubble.test.tsx`）、Markdown 解析与表达式归一化（`structuredParser.test.ts`）、流式与超时（`aiClient.test.ts`）、重试不重复消息（`useChat.test.tsx`）、完整交互流程（`App.test.tsx`）等 154 个用例。

> 注：`src/test/setup.ts` 对 MathML 元素做了 `display:none` 补丁——jsdom 的 `getComputedStyle` 在 KaTeX 的 MathML 输出上会崩溃（jsdom#3464），补丁语义与 katex.min.css 一致。

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
