# MathMate 项目现状

> 已归档，停止维护（2026-09-19）。归档说明见 [ARCHIVED.md](ARCHIVED.md)。
> 本文档记录归档时的技术状态。与其它文档冲突时以本文档与代码为准。

## 1. 验证基线

| 项 | 命令 | 结果 |
|---|---|---|
| 测试 | `npm test` | 21 文件 / 215 用例全绿 |
| 类型检查 + 构建 | `npm run build` | tsc 严格无错，约 0.5s |
| 开发服务器 | `npm run dev` | `http://localhost:5173/` |
| 依赖漏洞 npm | `npm audit --registry=https://registry.npmjs.org` | 0 |
| 依赖漏洞 Rust | `cd src-tauri && cargo audit` | 0（430 crate） |
| 桌面打包 | `npm run tauri build` | 成功，NSIS 安装包 6.91 MB |

用例分布：

```
components   App 14 · ChatPanel 12 · ErrorBoundary 3 · GraphPanel 14
             MessageBubble 24 · PropertyCard 3 · SettingsModal 1
core         aiClient 8 · structuredParser 12 · mathUtil 20
             historyStore 3 · vectorGraphType 4
analysisEngine  roots 11 · domain 27 · parity 7 · monotonic 5
             asymptotes 6 · period 10 · index 15 · runner 19
hooks        useChat 3
```

## 2. 技术栈

| | |
|---|---|
| 前端 | React 18.3 · TypeScript 5.9 · Vite 8.3（Rolldown）· Vitest 5.0 · jsdom 24 |
| 数学 | mathjs 15.2（求导/求值）· function-plot 1.25 · d3-selection 3 · interval-arithmetic 1.1 |
| 渲染 | KaTeX 0.16 · react-markdown 10 · remark-math/gfm/breaks · rehype-highlight/sanitize |
| 桌面 | Tauri 2（`@tauri-apps/cli` 2.11，仅 Windows NSIS） |
| 持久化 | localStorage：`mathmate.sessions.v1` · `mathmate.settings.v1` · `mathmate.drawer.v1` |

Node 要求 `^22.12.0 || >=24.0.0`。

## 3. 模块结构

依赖方向：`components / hooks` → `analysisEngine` → `expression`（单向）。

```
src/
├── App.tsx                     布局 / 抽屉 / 向量 / 手动函数 编排
├── types.ts                    共享类型
├── components/
│   ├── ChatPanel.tsx           消息列表 + 函数输入 + 提问输入
│   ├── MessageBubble.tsx       Markdown + KaTeX 渲染
│   ├── ErrorBoundary.tsx       根部错误边界
│   ├── GraphPanel.tsx          function-plot 绘图 + 图例 + 向量输入
│   ├── PropertyCard.tsx        特性卡片
│   ├── DrawerPanel.tsx         抽屉容器 + 拖拽调宽
│   ├── DrawerTab.tsx           收起态标签
│   ├── HistorySidebar.tsx      会话列表
│   └── SettingsModal.tsx       API 配置
├── hooks/useChat.ts            会话状态 / 流式接收 / 重试
├── core/
│   ├── expression/             表达式核心层
│   │   ├── normalize.ts        归一化（手动输入与 AI 共用）
│   │   ├── compile.ts          求值器 / 编译检查 / 求导
│   │   ├── domain.ts           定义域推断 + 区间交叉校验
│   │   ├── roots.ts            数值求根
│   │   ├── validate.ts         表达式校验
│   │   └── interval.ts         区间算术封装
│   ├── analysisEngine/         纯函数特性分析，不依赖 React
│   │   ├── index.ts            编排 + 扫描窗口 + 中文总结
│   │   ├── summary.ts          格式化（卡片与总结同源）
│   │   ├── runner.ts           Worker 调度 + 主线程回退
│   │   ├── workerClient.ts     Worker 单例
│   │   ├── analysis.worker.ts  Worker 入口
│   │   ├── roots.ts / domain.ts  门面 → core/expression
│   │   ├── parity.ts · monotonic.ts · asymptotes.ts · period.ts
│   ├── aiClient.ts             OpenAI 兼容 /chat/completions，SSE
│   ├── structuredParser.ts     MATH_FUNCTIONS 解析 → 正则兜底
│   ├── mathUtil.ts             门面 + 向量解析
│   ├── vectorGraphType.ts      function-plot 自定义 'vector' 图元
│   ├── historyStore.ts · settingsStore.ts
├── types/interval-arithmetic-eval.d.ts
├── assets/fonts/               woff2 + ttf
└── test/setup.ts
```

## 4. 数据流

```
提问 → aiClient（SSE 流式）
     → structuredParser 提取函数
     → analysisEngine 计算特性（Web Worker）
     → GraphPanel 绘图 + PropertyCard 特性卡片
```

AI 需在解答末尾附函数元数据块；解析失败降级为正则扫描；再失败只显示文字解答。

```json
<!-- MATH_FUNCTIONS -->
{"functions": [{"id": "f", "expr": "x^2 - 2x - 3", "domain": "(-inf, inf)"}]}
<!-- /MATH_FUNCTIONS -->
```

## 5. 构建产物

| 产物 | 大小 | gzip |
|---|---|---|
| `rolldown-runtime-*.js` | 0.90 kB | 0.51 kB |
| `react-*.js` | 139.82 kB | 45.32 kB |
| `DrawerPanel-*.js` | 185.34 kB | 57.32 kB |
| `katex-*.js` | 258.67 kB | 77.43 kB |
| `index-*.js` | 402.49 kB | 127.21 kB |
| `math-*.js` | 649.12 kB | 181.33 kB |
| `analysis.worker-*.js` | 711.61 kB | — |
| `index-*.css` | 16.08 kB | 4.10 kB |
| `katex-*.css` | 28.83 kB | 7.92 kB |
| `MapleMono-CN-Regular-*.woff2` | 1,736.50 kB | — |
| `MapleMono-CN-Regular-*.ttf` | 5,320.97 kB | — |

前端构建约 0.5s；Rust release 首次约 1m45s，增量约 37s。

**懒加载**：function-plot / d3 随 `React.lazy(import('./components/DrawerPanel'))` 进入独立 chunk，打开抽屉才加载。主 chunk 中不含 `function-plot` / `d3-selection`（已核验）。这一行为依赖 `vite.config.ts` 不为 function-plot / d3 配置 chunk 分组——一旦分组，组件树会被提升进主 chunk。

**性能代价**：

- `analysis.worker-*.js` 711 kB，自含一份 mathjs。Rollup 对 worker 入口独立打包，无法复用主 bundle 的 math 分组。
- `findPoles` 以 `step = 0.02` 扫描 `[-1000, 1000]`，每函数每次分析约 10 万次求值。分析在流式结束后触发一次。

## 6. 安全

- **Markdown/公式 XSS**：`rehype-sanitize` + 自定义 schema（放行 KaTeX MathML 与 hljs 类名）；`katex.renderToString` 统一 `throwOnError: false`。测试覆盖 `<script>` 不渲染、`javascript:` 链接被拦截。
- **公式渲染失败**：检测 `katex-error` 后回退纯文本。
- **API Key**：仅存 localStorage，经 `Authorization: Bearer` 直连用户配置的 `baseUrl`。
- **元数据不泄露**：`stripMathBlocks` 兼容流式未闭合中间态，`MATH_FUNCTIONS` 块不显示给用户。
- **CSP**：`src-tauri/tauri.conf.json` 已配置最小可用策略。
- **依赖**：npm 与 Rust 两侧审计均为 0。Rust 侧忽略项登记在 `src-tauri/.cargo/audit.toml`（均为 Windows 不编译的 Linux/GTK 传递依赖）。

## 7. 已修复缺陷

审计出 26 项（Error 5 / Warning 11 / Note 10），全部处理。

**Error**

| 编号 | 问题 | 修复 |
|---|---|---|
| E1 | 校验仅用 5 个固定样本点，误拒 `log(x-4)`/`sqrt(x-5)`/`sqrt(x^2-100)` | 改为定义域感知采样 + 多尺度兜底 |
| E2 | `asin(x)`/`acos(x)` 定义域被算成全体实数 | 声明式函数定义域表 + 区间算术交叉校验 |
| E3 | 周期函数单调区间标签错误；扫描窗口被当作数学边界输出 | 卡片与总结共用 `formatWindow`；新增 `scanWindow` 标注 |
| E4 | `(x-2000)(x-1)` 只报 x=1，窗口外根被静默丢弃 | 多项式用 Cauchy 根界自适应扩窗 |
| E5 | 手动输入不支持 `x²`/`√x`，与 AI 链路不一致 | 手动链路复用 `normalizeExpr` |

**Warning**

| 编号 | 问题 | 修复 |
|---|---|---|
| W1 | `findPoles` 循环不覆盖 1000，结尾过滤使 ±1000 处恒失效 | 改整数步进 + 窗口内判定 |
| W2 | AI 的 `domain` 一旦可解析即无条件采信 | 与表达式推导取交集，`domainNarrowed` 提示 |
| W3 | 单调区间一律用开区间，与定义域矛盾 | 按端点是否 `inDomain` 决定括号 |
| W4 | 奇偶性仅 10 个样本点且全部 x ≥ 0.5 | 多尺度对称采样（49 点） |
| W5 | 周期候选表仅 8 个值；解析失败默认值语义错误 | 候选表扩至 15 个 + 解析值数值下探；修正 `abs(sin(x))` 周期 2π→π |
| W6 | `domain` 无截断，`tan(x)` 的 637 个区间灌入 UI | 统一 `truncateList` |
| W7 | 无错误边界，组件抛错即白屏 | 新增 `ErrorBoundary` |
| W8 | Tauri CSP 为空 | 配置最小可用 CSP |
| W9 | `rehype-katex` 死依赖 + 死 CSS + `data-theme` 无消费者 | 全部移除 |
| W10 | 图例与曲线颜色索引错位 | 先按原始下标配色再过滤 |
| W11 | 分析同步串行，主线程冻结 200–450 ms | 移入 Web Worker，含超时兜底与主线程回退 |

**Note**

| 编号 | 问题 | 修复 |
|---|---|---|
| N1 | 字体 5.32 MB TTF 无 woff2 | 生成 woff2，降至 1.66 MB |
| N2 | `subset_font.py` 硬编码本机路径、不支持 woff2 | 改为 `--src` 参数 + woff2 输出 |
| N3 | `g.function` 位置索引脆弱 | 保留（无更优替代，风险等价） |
| N4 | `Date.now()` 生成 id 可能碰撞 | 改用 `nextId()` |
| N5 | 标注上限 40 不可调 | 保留（防极值爆炸的必要保护） |
| N6 | `App.tsx` 分工未拆 | 保留（收益低于回归风险） |
| N7 | 行结束符不统一，无 `.gitattributes` | 新增 `.gitattributes` |
| N8 | 定义域存在重复扫描 | 保留（与交叉校验耦合） |
| N9 | `npm audit` 因镜像源不可用 | 改用官方 registry |
| N10 | 无 `engines`、无 CI | 补齐，新增 `.github/workflows/ci.yml` |

## 8. 遗留问题

不会再修，列出以免误用。

**未验证**：

- Web Worker 在真实 WebView2 中是否正常执行。若被拒绝会自动回退主线程，结果仍正确。
- Tauri CSP 的运行时影响。单元测试覆盖不到。
- 真实交互流程与安装包安装/卸载流程。

**有意保留**：见上表 N3 / N5 / N6 / N8。

**环境限制**：

- 依赖审计需用官方源（镜像源不实现 advisories 接口）；Rust 侧需先 `cargo install cargo-audit`。
- 字体重新子集化需要原始全量字体。
- NSIS 安装包不可复现构建（嵌入时间戳），同一源码两次构建哈希不同。

## 9. 历史文档

| 文件 | 性质 |
|---|---|
| `ARCHIVED.md` | 归档说明 |
| `OPENSOURCE-ADOPTION.md` | 开源项目调研 |
| `docs/superpowers/**` | 设计快照与实施计划，已就地补注勘误 |
