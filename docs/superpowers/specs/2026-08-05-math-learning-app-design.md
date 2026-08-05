# 数学学习助手 — 设计文档

日期：2026-08-05
状态：已确认

## 1. 目标

一个本地运行的 Web 数学学习应用：
- AI（OpenAI 兼容 API）解答数学问题，支持 LaTeX 输入与渲染
- 当问题涉及函数时，自动在右侧面板画出函数图像，并显示可靠计算的函数特性（单调性、奇偶性、极值、零点、渐近线、周期、定义域）

面向高中数学，UI 为中文，深色主题。

## 2. 已确认的决策

| 决策点 | 结论 |
|--------|------|
| AI 后端 | OpenAI 兼容 API（自定义 baseURL + API Key + 模型名） |
| 输入方式 | 文本框 + LaTeX |
| 函数发现 | AI 识别函数（结构化输出）→ 前端本地计算特性 |
| 数学范围 | 高中数学（幂/指对/三角/多项式/分式） |
| 布局 | 左右分栏：左聊天、右图像+特性卡片 |
| 技术形态 | Vite + React + TS 单页应用，本地运行 |

## 3. 总体架构

```
Vite + React + TS 单页应用（本地运行）
├── 聊天区 ChatPanel          KaTeX 渲染、流式回复、手动函数输入
├── 图像与特性面板 GraphPanel  function-plot 画图 + 特性卡片
├── 核心模块
│   ├── aiClient             OpenAI 兼容 /v1/chat/completions，SSE 流式
│   ├── structuredParser     从 AI 回复提取函数定义（分级兜底）
│   ├── analysisEngine       纯函数：表达式+定义域 → 特性结论
│   └── historyStore         localStorage 会话持久化
└── 辅助：SettingsModal（API 配置）、HistorySidebar（会话列表）
```

数据流：用户提问 → aiClient 调 API → structuredParser 提取函数 → analysisEngine 算特性 → GraphPanel 画图 + 特性卡片。

模块边界：analysisEngine 为纯函数、不依赖 React，可独立单测。

## 4. AI 结构化输出协议

system prompt 要求 AI 在解答末尾附加 JSON 注释块：

```json
<!-- MATH_FUNCTIONS -->
{"functions": [{"id": "f", "expr": "x^2 - 2x - 3", "domain": "(-inf, inf)"}]}
<!-- /MATH_FUNCTIONS -->
```

- `expr`：mathjs 兼容表达式（x 自变量；sin/cos/tan/log/exp/abs/sqrt/pow）
- `domain`：可选，默认全体实数；支持区间并集如 `(a,b] ∪ [c,d)`
- 支持多函数（比较题）

structuredParser 解析策略（分级兜底）：
1. 匹配完整 JSON 块 → 解析
2. 失败 → 正则扫描 `f(x)=...`、`y=...` 提取
3. 失败 → 视为无函数，仅文字解答，不崩溃

分析不依赖 AI：手动输入框输入的表达式同样走分析引擎。

## 5. 特性分析引擎

返回结构：

```ts
interface FunctionAnalysis {
  expression: string;
  domain: Interval[];                                      // 定义域
  parity: 'odd' | 'even' | 'neither';                      // 奇偶性
  monotonic: { interval: string; trend: 'inc' | 'dec' | 'const' }[]; // 单调区间
  extrema: { x: number; y: number; type: 'max' | 'min' }[];         // 极值点
  asymptotes: { type: 'vertical' | 'horizontal' | 'oblique'; value: string }[]; // 渐近线
  period?: number;                                         // 周期
  zeroPoints: number[];                                    // 零点
  summary: string;                                         // 中文摘要
}
```

计算方法（符号求导 + 数值验证结合，mathjs 求导）：

| 特性 | 方法 |
|------|------|
| 定义域 | AI domain 优先；否则检查分母≠0、log 真数>0、sqrt≥0、tan 无定义点 |
| 奇偶性 | 定义域对称 + 数值采样 f(x) vs f(-x) / f(x) vs -f(-x)；偶结构符号验证 |
| 单调性 | 符号求导 f'(x)，求驻点（数值求根：二分 + 网格扫描 + 特殊型直接解），按区间内 f' 符号判定 |
| 极值 | 驻点两侧 f' 符号变化判定 max/min |
| 零点 | f(x)=0 数值求根（二分 + 网络扫描 + 一次/二次直接解） |
| 渐近线 | 垂直：定义域缺口两侧极限发散；水平：x→±∞ 极限；斜：f(x)/x→k 且 f(x)-kx→b |
| 周期 | sin/cos→2π、tan→π 及复合系数换算；一般函数数值相关性检测（受限） |
| 绘图视野 | 根据极值/零点/渐近线自动选区间 |

精度：双精度 + 容差，二分 200 次迭代；恒号情形符号判定，不依赖采样。

兜底：任何一步失败 → 跳过该特性，卡片显示 "—"，不影响画图。

## 6. 界面

聊天区（左）：
- LaTeX 输入 + KaTeX 实时预览
- 消息内公式 KaTeX 渲染，流式显示
- 手动函数输入框 `f(x)=x^2-2x-3`，输入即画

图像与特性面板（右）：
- function-plot：滚轮缩放、拖动平移、悬停坐标、自动视野
- 多函数不同颜色，图例可点击显隐
- 特性卡片顺序：定义域 → 奇偶性 → 单调区间（↑↓）→ 极值点 → 零点 → 渐近线 → 周期
- 可折叠 "AI 文字总结" 卡片

设置弹窗：API Base URL（默认 https://api.openai.com/v1）、API Key、模型名（默认 gpt-4o-mini）、流式开关。Key 存 localStorage。

历史侧栏：会话列表 + 新建/删除，localStorage 持久化。

主题：深色。

## 7. 错误处理

- API 错误（Key 无效/网络/限流）→ 聊天区错误条 + 重试按钮
- 解析失败 → 仅文字解答，面板提示"未识别到函数，可手动输入"
- 表达式非法 → 输入框红框提示
- 分析失败 → 卡片 "—"
- 历史损坏 → 自动重置空会话

## 8. 测试（Vitest）

- analysisEngine：≥20 用例（二次/绝对值/分式/对数/三角/无定义点），重点单调区间与极值
- structuredParser：完整 JSON / 正则兜底 / 无函数
- aiClient：mock fetch 验证请求格式与错误映射
- 组件冒烟：渲染、输入→发送（React Testing Library）

## 9. 技术清单

Vite + React 18 + TS、mathjs、function-plot、KaTeX、localStorage、Vitest。
