# MathMate 项目现状（单一事实来源）

> ## ⚠️ 项目已归档（2026-09-19），停止维护
>
> 本文档保留为**归档时的最终状态快照**，不再更新。
> 归档说明、已知开放项与自行构建指引见 **[ARCHIVED.md](ARCHIVED.md)**。
>
> 下文所有内容均为归档前实测：`tsc` 通过 · **21 文件 / 215 用例全绿** ·
> npm 与 Rust 依赖 **0 漏洞** · NSIS 安装包构建成功。

> 本文档基于 **源码 + 实测** 编写，不是计划或愿景。
> 凡与其它文档冲突，**以本文档与代码为准**。
> 最后校准：2026-09-18（对照 commit `51db9dd`）。
>
> **勘误（2026-09-18 缺陷审计）**：本文档首版称「27 个源码文件」，实际为 **28 个非测试源码文件**（另含 19 个测试文件）。
> 第 6 节已知问题已按 [DEFECT-AUDIT.md](DEFECT-AUDIT.md) 重新定级并扩充至 **26 项（Error 5 / Warning 11 / Note 10）**；
> 完整证据与修复方案见该审计报告。

## 1. 验证基线（可复现）

| 项目 | 命令 | 实测结果 |
|------|------|----------|
| 测试 | `npm test` | ✅ **21 个测试文件 / 215 个用例全部通过** |
| 类型检查 + 构建 | `npm run build` | ✅ `tsc`（严格）无错误；vite 8 构建成功，约 **0.5 s** |
| 开发服务器 | `npm run dev` | ✅ `http://localhost:5173/`（`strictPort`，已冒烟验证） |
| 依赖漏洞（npm） | `npm audit` | ✅ **全量 0 漏洞**（含 dev 依赖；需 `--registry=https://registry.npmjs.org`，见 N9） |
| 依赖漏洞（Rust） | `cd src-tauri && cargo audit` | ✅ **0 漏洞**（430 个 crate；7 条已判定警告，见 §15） |
| 桌面打包 | `npm run tauri build` | ✅ **已验证**：产出 NSIS 安装包，exe 冒烟启动通过（见 §16） |

> 基线变化：170 → **215 用例**（+45），19 → **21 文件**（+2）。
> 三轮修复见 §10（第一批）、§12（W11）、§13（剩余 18 项）；安全升级见 §14。

测试文件与用例分布（静态统计，与 `npm test` 一致）：

```
components:  App 14 · ChatPanel 12 · ErrorBoundary 3 · GraphPanel 14 · MessageBubble 24 · PropertyCard 3 · SettingsModal 1
core:        aiClient 8 · structuredParser 12 · mathUtil 20 · historyStore 3 · vectorGraphType 4
analysisEngine: roots 11 · domain 27 · parity 7 · monotonic 5 · asymptotes 6 · period 10 · index 15 · runner 19
hooks:       useChat 3
合计：21 文件 / 215 用例（静态统计与 `npm test` 实际输出逐项一致）
```

## 2. 技术栈实际版本

- React 18.3 / TypeScript 5.9 / **Vite 8.3（Rolldown 内核）** / **Vitest 5.0** / jsdom 24
  - Node 要求：`^22.12.0 || >=24.0.0`（Vite 8 要 `^20.19 || >=22.12`，Vitest 5 要 `^22.12 || ^24`，取交集）
- 数学：`mathjs` **15.2**（求导 + 求值，含安全修复）、`function-plot` 1.25 + `d3-selection` 3（绘图）
  - 另有 `interval-arithmetic` + `interval-arithmetic-eval`（显式声明，用于定义域交叉校验，见 §10）
- 渲染：`katex` 0.16、`react-markdown` 10 + `remark-gfm` / `remark-math` / `remark-breaks` + `rehype-highlight` / `rehype-sanitize`
  - **`rehype-katex` 已移除**（原为「已声明但零引用」的死依赖）
- 桌面壳：Tauri 2（`@tauri-apps/cli` 2.11，仅 Windows NSIS 目标）
- 持久化：`localStorage`（会话 `mathmate.sessions.v1`、设置 `mathmate.settings.v1`、抽屉宽度 `mathmate.drawer.v1`）

## 3. 目录与模块职责（40 个非测试源码文件 + 21 个测试文件 + 2 个字体资源）

```
src/
├── App.tsx                    布局/抽屉/向量/手动函数 状态编排
├── types.ts                   全部共享类型（含 FunctionAnalysis）
├── components/
│   ├── ChatPanel.tsx          消息列表 + 手动函数输入 + 提问输入
│   ├── MessageBubble.tsx      Markdown + KaTeX 渲染管线（含 XSS 净化）
│   ├── HistorySidebar.tsx     会话列表（展开 260px / 收起 44px）
│   ├── SettingsModal.tsx      API 配置（写入 localStorage）
│   ├── DrawerTab.tsx          收起态竖向「函数图像」标签
│   ├── DrawerPanel.tsx        抽屉容器 + 拖拽调宽手柄（300–720px）
│   ├── GraphPanel.tsx         function-plot 绘图 + 图例 + 向量输入
│   └── PropertyCard.tsx       特性卡片（KaTeX 数值 + 极值聚焦）
├── hooks/useChat.ts           会话状态、流式接收、重试、清空绘图
├── core/
│   ├── expression/            ★ 表达式核心层（「第一批」新增，见 §11）
│   │   ├── normalize.ts       表达式归一化（唯一入口，手动输入与 AI 共用）
│   │   ├── compile.ts         数值求值器 / 编译检查 / 符号求导
│   │   ├── domain.ts          定义域推断（声明式函数定义域表 + 区间交叉校验）
│   │   ├── roots.ts           数值求根（自 analysisEngine 上移，解除循环依赖）
│   │   ├── validate.ts        域感知的表达式校验（替代 5 点采样启发式）
│   │   ├── interval.ts        区间算术封装（定义域探测，带自校验）
│   │   └── index.ts           统一导出
│   ├── aiClient.ts            OpenAI 兼容 /chat/completions，SSE，120s 超时
│   ├── structuredParser.ts    MATH_FUNCTIONS 块解析 → 正则兜底 → 复用 normalize
│   ├── mathUtil.ts            兼容门面（re-export）+ 向量解析
│   ├── vectorGraphType.ts     为 function-plot 注册自定义 'vector' 图元
│   ├── historyStore.ts        会话持久化 + id 生成（crypto.randomUUID）
│   ├── settingsStore.ts       设置持久化
│   └── analysisEngine/        纯函数特性分析（不依赖 React）
│       ├── index.ts           编排 + 扫描窗口 + 中文 summary
│       ├── summary.ts         ★ 共享格式化（卡片与总结同源，见 §10）
│       ├── runner.ts          ★ 分析任务调度：Worker 优先 + 主线程分片回退（见 §12）
│       ├── workerClient.ts    ★ Worker 客户端与全局单例 runner
│       ├── analysis.worker.ts ★ Worker 入口（独立打包为 chunk）
│       ├── domain.ts          兼容门面 → core/expression/domain
│       ├── roots.ts           兼容门面 → core/expression/roots
│       ├── monotonic.ts       单调区间与极值（按 f' 符号）
│       ├── parity.ts          奇偶性（定义域对称 + 采样验证）
│       ├── asymptotes.ts      垂直/水平/斜渐近线
│       └── period.ts          周期（三角解析式优先，数值兜底）
├── types/
│   └── interval-arithmetic-eval.d.ts  为该包补类型（其未发布 .d.ts）
├── assets/fonts/              MapleMono-CN-Regular.ttf（5.32 MB，子集化产物）
├── styles/global.css          单文件样式（浅色主题 + 设计令牌）
└── test/setup.ts              Vitest 全局设置（jsdom MathML getComputedStyle 兜底）
```

> **依赖方向（已单向化）**：`components / hooks` → `analysisEngine` → `expression`。
> 此前 `mathUtil` 与 `analysisEngine` 双向依赖，是缺陷 E1 无法根治的结构原因（见 §11）。

> 说明：`src/test/` 下**只有 `setup.ts`（配置文件）**，没有测试文件；`vitest run` 报告的 "20 个测试文件" 分布在 `components/`、`core/`、`analysisEngine/`、`hooks/` 与 `App.test.tsx`。
> 计数口径：`src` 下共 64 个文件 = **40 个非测试源码** + **21 个测试** + 2 个 `.d.ts` + 1 个字体。
> 其中 `vite-env.d.ts` 与 `types/interval-arithmetic-eval.d.ts` 为类型声明，不产生运行时代码。

## 4. 数据流

```
提问 → aiClient（SSE 流式） 
     → useChat 逐 token 追加 assistant 消息
     → 流结束：structuredParser 提取函数（JSON 块 → 正则兜底）
     → analysisEngine 计算特性（纯函数）
     → App 汇总 analyses → GraphPanel 绘图 + PropertyCard 显示
     → 手动函数输入 / 向量输入 走同一条分析/绘图链路
```

`analysisEngine` 为纯函数、不依赖 React，可独立单测——这是项目最干净的架构边界。

## 5. 性能实测数据

**构建产物（`npm run build` 实测）：**

| 产物 | 大小 | gzip | 说明 |
|------|------|------|------|
| `rolldown-runtime-*.js` | 0.90 kB | 0.51 kB | Vite 8 / Rolldown 运行时 |
| `react-*.js` | 139.82 kB | 45.32 kB | |
| `DrawerPanel-*.js` | 185.34 kB | 57.32 kB | 懒加载；function-plot + d3 |
| `katex-*.js` | 258.67 kB | 77.43 kB | |
| `index-*.js` | 402.49 kB | 127.21 kB | 主 chunk |
| `math-*.js` | 649.12 kB | 181.33 kB | mathjs 15 |
| `analysis.worker-*.js` | **711.61 kB** | — | ⚠️ 分析 Worker，自含一份 mathjs（见 §12.3） |
| `index-*.css` | 16.08 kB | 4.10 kB | Vite 8 会把 CSS 按 chunk 拆分 |
| `katex-*.css` | 28.83 kB | 7.92 kB | 两份 CSS 均在 `index.html` 中链接（已核验） |
| `MapleMono-CN-Regular-*.woff2` | **1,736.50 kB** | — | 首选字体（原 TTF 5.32 MB，−67%） |
| `MapleMono-CN-Regular-*.ttf` | 5,320.97 kB | — | 回退；现代 WebView2 不会加载 |

**构建耗时**：Vite 8（Rolldown）实测 **约 0.5 s**，较 Vite 5 的 6–7 s **快一个数量级**。

**已验证的懒加载**：绘图模块（function-plot / d3）随 `React.lazy(() => import('./components/DrawerPanel'))` 动态导入，落在独立 chunk。首屏 JS 为 `index` + `react` + `katex` + `math` 四个，`DrawerPanel` 不在其中；打开抽屉后才追加加载。这依赖 `vite.config.ts` 中「刻意不为 function-plot/d3 做 manualChunks 分组」的注释约定，改动该配置会破坏懒加载。

> 「第一批」后已重新核验：主 chunk 中 `function-plot` / `functionPlot` / `d3-selection` / `xScale` 命中数均为 **0**，
> `DrawerPanel` chunk 中 `function-plot` / `vector-arrow` / `graphType` 均存在 —— **懒加载边界未被破坏**。
> 另注：`interval-arithmetic` 现在同时被主 chunk（定义域交叉校验）使用，
> 因此它出现在首屏 chunk；这是有意的取舍，换来 E2 的独立交叉校验能力。

**已知性能成本**：

- `analysisEngine/asymptotes.ts` 的 `findPoles` 以 `step = 0.02` 扫描 `[-1000, 1000]`，即**每个函数每次分析约 10 万次求值**。单函数约几十毫秒量级，多函数（比较题）线性叠加。分析在流式结束后触发一次，不在每个 token 上重跑。
- 字体为 5.32 MB TTF，且**未提供 woff2**，首屏首次加载必然下载该体积。见「已知问题 N1」。

## 6. 已知问题（按优先级）

> 详细条目前移：完整证据、复现方法与修复方案见 **[DEFECT-AUDIT.md](DEFECT-AUDIT.md)**。

| 编号 | 等级 | 一句话 |
|------|------|--------|
| E1 | 🔴 Error | `validateExpression` 仅用 5 个固定样本点判定，**误拒** `log(x-4)`/`sqrt(x-5)`/`sqrt(x^2-100)` 等合法表达式，阻塞手动绘图 |
| E2 | 🔴 Error | `inferDomain` 未识别 `asin`/`acos` 等反三角函数，`asin(x)` 定义域被算成 `(−∞,+∞)`（应为 `[−1,1]`）——**结果错误** |
| E3 | 🔴 Error | 周期函数单调区间标签错误（`sin(x)` 输出 `(−∞,1.5708)`/`(4.7124,+∞)`），且 `±1000` 扫描窗口被当作数学边界输出 |
| E4 | 🔴 Error | 求根窗口硬编码 `±1000`，`(x-2000)(x-1)` 只报告 x=1，**窗口外的解被静默丢弃** |
| E5 | 🔴 Error | 手动输入不经过 `normalizeExpr`，`x²`/`√x` 被拒，而 AI 链路可识别——**同一功能两条路径能力不一致** |
| W1 | 🟡 Warning | `findPoles` 循环不覆盖 1000，且结尾 `Math.abs(p) < 1000` 二次过滤，`±1000` 处极点恒失效 |
| W2 | 🟡 Warning | AI 提供的 `domain` 一旦可解析即被**无条件采信**，无交叉校验 |
| W3 | 🟡 Warning | 单调区间标签一律用开区间 `(a,b)`，未按定义域开闭性区分 |
| W4 | 🟡 Warning | 奇偶性仅用 10 个固定采样点（**全部 x ≥ 0.5**），可致误判 |
| W5 | 🟡 Warning | 周期数值兜底采样稀疏、候选周期表硬编码，解析分支失败时返回语义错误的默认值 |
| W6 | 🟡 Warning | `domain` 可爆炸膨胀——`tan(x)` 产出 **637 个区间**、单串超 2 万字符，且**无截断保护**（`monotonic`/`extrema` 都有） |
| W7 | 🟢 Warning | 无 ErrorBoundary，任一渲染异常导致**整页白屏** |
| W8 | 🟢 Warning | Tauri CSP 为空，缺少第二道防线 |
| W9 | 🟢 Warning | `rehype-katex` 死依赖 + `global.css:313-316` 死 CSS + `App.tsx:43-45` 的 `data-theme` 无任何选择器消费 |
| W10 | 🟡 Warning | 图例显隐后颜色索引漂移：绘图按过滤后下标配色，图例按原始下标 |
| W11 | 🟡 Warning | 分析在流式结束后**同步串行**执行，实测 `tan(x)` 146 ms、比较题 3 函数可达 200–450 ms 主线程冻结 |
| N1 | 🟢 Note | 字体 5.32 MB TTF 且无 woff2 变体，首屏强制下载 |
| N2 | 🟢 Note | `scripts/subset_font.py` 硬编码本机绝对路径、不支持 woff2 |
| N3 | 🟢 Note | `querySelectorAll('g.function')[idx]` 位置索引假设脆弱，异常被静默吞掉 |
| N4 | 🟢 Note | 手动函数 `id` 用 `Date.now()`，同毫秒会碰撞（`historyStore.nextId()` 已有更好实现） |
| N5 | 🟢 Note | 绘图标注上限 40 且不可调，超出部分静默丢弃 |
| N6 | 🟢 Note | `App.tsx` 180 行职责过载（布局+抽屉+向量+手动分析+JSON memo） |
| N7 | 🟢 Note | 行结束符不统一（PLAN*.md 为 CRLF，其余 LF）且无 `.gitattributes` |
| N8 | 🟢 Note | 定义域解析中对每个约束重复 `findAllRoots` 扫描，且与 `analyzeFunction` 重复计算 |
| N9 | 🟢 Note | `npm audit` 不可用（registry.npmmirror.com 不提供 advisories 接口），依赖漏洞无法自动核查 |
| N10 | 🟢 Note | 无 `engines` 约束、无 CI |

**统计：26 项 —— Error 5 / Warning 11 / Note 10**（其中 9 项为运行时实测，16 项为静态确认代码路径，1 项受工具限制未复核）

### 详细条目

#### E1 🔴 `validateExpression` 误拒定义域外有效的表达式

`src/core/mathUtil.ts:28-41` 仅用 **5 个固定样本点** `[0, 1, -1, 2, 0.5]` 判断表达式能否计算，全部不可算即判「非法」。实测：

```
log(x-4)        → 被拒绝    sqrt(x-5)    → 被拒绝    log(x-10)  → 被拒绝
sqrt(x^2-100)   → 被拒绝    1/(x-5)      → 通过（x=0 恰在定义域内）  log(x) → 通过
```

判据与数学正确性无关：同一函数只因定义域是否恰好覆盖 `{0,±1,2,0.5}` 而时通时拒。`log(x-4)`、`sqrt(x-5)` 属高中标准题型，**不是边缘情况**。
影响路径：`ChatPanel.tsx:41`（回车添加）与 `ChatPanel.tsx:109`（实时校验）→ 输入框标红 + 阻止 `onAddFunction`，用户无法画图。
不影响的路径：AI 问答链路不经过此校验。

#### E2 🔴 反三角函数定义域漏判（数学错误）

`domain.ts:146-174` 的 `collectConstraints` 只识别 `sqrt`(≥0)、`log/ln`(>0)、`tan`(cos≠0)、除法(分母≠0)、负指数(底≠0)。
实测 `inferDomain('asin(x)')` → `(−∞, +∞)`、`inferDomain('acos(x)')` → `(−∞, +∞)`，**正确答案应为 `[−1, 1]`**。
后果：定义域错误会传染给单调性、极值、零点与用户可见的定义域文本。

#### E3 🔴 周期函数单调区间标签错误 + 扫描窗口数值外泄

`index.ts:25-26` 对周期函数只扫 `[0, T)`，但 `monotonic.ts:36` 仍按「窗口边界 = 定义域边界」生成标签；非周期函数的 `±1000` 同样经 `fmtNum` 被当作真实数学边界输出。实测：

```
analyzeFunction('sin(x)').monotonic
  → ["(−∞, 1.5708):inc", "(1.5708, 4.7124):dec", "(4.7124, +∞):inc"]
```

`sin(x)` 的真实单调区间是 `[−π/2+2kπ, π/2+2kπ]` 递增（k∈Z），实测输出把 `1.5708`/`4.7124` 当作**绝对端点**。
加重项：`buildSummary` 会追加「（每周期重复）」（`index.ts:84,92`），但 `PropertyCard.tsx:50-59` 渲染 `monotonic` 时**不加**该后缀 → 卡片与总结互相矛盾。

#### E4 🔴 数值求根窗口外的解被静默丢弃

`index.ts:25-26`（零点/临界点）、`domain.ts:9-10`（定义域分区点）、`asymptotes.ts:67`（极点）均为 `±1000`。实测：

```
f(x) = (x-2000)*(x-1)
findAllRoots(f, -1000, 1000) → [1]                    ← 丢掉 x=2000
findAllRoots(f, -3000, 3000) → [1.0000…, 1999.9999…]  ← 扫全窗口即可找到
```

零点集合不完整且**无任何提示**。周期函数已通过「只扫主周期」避免爆炸（commit `6502bcb`），但非周期函数无此保护。

#### E5 🔴 手动输入不支持中文数学写法

`ChatPanel.tsx:41,109` 直接调用 `validateExpression`，**不经过** `structuredParser.normalizeExpr`（`structuredParser.ts:59-85`）。实测：

```
x²  → 手动输入「表达式语法错误」    AI 链路 ✅（归一化为 x^2）
√x  → 手动输入「表达式语法错误」    AI 链路 ✅（归一化为 sqrt(x)）
```

目标用户为高中学生，`x²`/`√x` 是其最自然的书写方式。

#### W2 / W7 / W8 摘要

- **W2**：`index.ts:17` → `domain.ts:17-21`，`domainStr` 可解析即直接返回。设计上「AI domain 优先」是有意决策，但缺交叉校验。
- **W7**：`main.tsx:6-10` 无 ErrorBoundary。`GraphPanel.tsx:119-121` 对 `functionPlot` 有 try/catch、`analysisEngine/index.ts:64-70` 有 `safe()` 包裹，但 `PropertyCard` 的 KaTeX 渲染、`App.tsx:98` 的 `JSON.parse` 均无保护。
- **W8**：`tauri.conf.json:24` 的 `security.csp` 为 `null`。当前 XSS 防护依赖前端 `rehype-sanitize`（已有测试覆盖），缺第二道防线。

#### W9 遗留死代码（三处）

| 项 | 证据 |
|----|------|
| `rehype-katex` 死依赖 | `package.json:23` 声明，`grep rehype-katex src/` = **0 命中** |
| 深色模式死 CSS | `global.css:313-316` 的 `.theme-group`/`.theme-label`/`.theme-options`/`.radio-row` 零引用 |
| `data-theme` 无消费者 | `App.tsx:43-45` 写入，但 `global.css` 中 `[data-theme]` 选择器数 = **0** |

#### W10 / W11 摘要

- **W10**：`GraphPanel.tsx:72,77-79` 绘图用**过滤后**下标 `COLORS[i%6]`，图例（`:177,191-192`）用**过滤前**下标 → 隐藏任一曲线后颜色不再对应。
- **W11**：`useChat.ts:73` 的 `defs.map(d => analyzeFunction(d))` 同步串行。实测单函数耗时：

  ```
  tan(x) 146 ms · log(x-4) 90 ms · x^3-3x 82 ms · x^2-2x-3 76 ms
  sin(x) 68 ms · (x-2000)(x-1) 68 ms · 1/(x-5) 53 ms
  ```

  单独 `inferDomain('tan(x)')` = 67 ms。分析在流式结束后触发一次，非每 token 重跑（此点已核实）。

## 7. 安全现状（已核实）

- **Markdown/公式 XSS**：`rehype-sanitize` + 自定义 schema（放行 KaTeX MathML 与 hljs 类名）；`katex.renderToString` 统一 `throwOnError: false`。测试覆盖 `<script>` 不渲染、`javascript:` 链接被拦截。
- **公式渲染失败回退**：检测 `katex-error` 后回退纯文本，中文语境 `$` 误匹配不显示红字。
- **API Key**：仅存 `localStorage`，设置弹窗明示「不会上传到任何服务器」；请求经 `Authorization: Bearer` 头直连用户配置的 `baseUrl`。
- **元数据不泄露**：`stripMathBlocks` 兼容流式未闭合中间态，`MATH_FUNCTIONS` JSON 块不会显示给用户。

## 8. 与历史文档的关系

`README.md`、`PLAN.md`、`PLAN-UI.md`、`docs/superpowers/**` 均为**历史记录性质**，其中部分状态标记与代码不符（尤其 `PLAN-UI.md` 的深色模式相关任务已被撤销）。核对结论：

| 文档 | 失真点 |
|------|--------|
| `PLAN.md` | 测试数写作 140 / 154，实际 170；`MessageBubble.test.tsx` 用例数写作 17，实际 24；`stripMathBlocks` 用例实际在 `structuredParser.test.ts` |
| `PLAN-UI.md` | 任务 1.3「深色主题令牌」、1.4「外观设置（跟随系统/浅色/深色）」标 ✅ 但**已被撤销**（commit `4598f72`） |
| `specs/2026-08-05-math-learning-app-design.md` | 第 12、116 行称「深色主题」，与现状（固定浅色）相反 |
| `specs/2026-08-05-vector-plot-clear-button-design.md` | 向量标注描述为「`(x+0.2, y+0.2)` 偏移标文字」，实际实现为**末端圆点 + 旁侧文字**，并新增 `vectorGraphType.ts` 自定义图元（原设计预期的 `types/function-plot.d.ts` 补类型并未采用）；测试数 115 为当时快照 |

已就地补注，不再改写历史内容。

## 9. 待办（未实施，供决策）

编号对应 `DEFECT-AUDIT.md`；分批原则为「高收益低风险优先」。
**「第一批」已于本次完成并验证，见 §11。** 其余项均**尚未动手**。

**~~第一批（高收益、低风险）~~ ✅ 已完成**

1. ~~**E5** 手动输入复用 `normalizeExpr`~~ ✅
2. ~~**W9** 删除 `rehype-katex` 死依赖 / 死 CSS / `data-theme` 死写入~~ ✅
3. ~~**W7** 补 ErrorBoundary~~ ✅
4. ~~**E1** `validateExpression` 改为域感知采样~~ ✅

**~~第二批（需配套单测）~~ ✅ 已完成**

5. ~~**E4** 求根窗口改为定义域/根界驱动~~ ✅（线性边界随 E2 修好；非线性用 Cauchy 根界，见 §13）
6. ~~**W6** `domain` / `zeroPoints` 截断~~ ✅
7. ~~**W11** 分析移入 Web Worker~~ ✅（见 §12）
8. ~~**W2** AI `domain` 与表达式推导取交集~~ ✅
9. ~~**W10** 图例与曲线共用同一 `color`~~ ✅
10. ~~**W4** 奇偶性采样策略重写~~ ✅

**~~第三批（需先测包体）~~ ✅ 已完成**

11. ~~**E5 进阶** MathLive 替换手动输入框~~ ⏸ **经评估未采纳**（见 OPENSOURCE-ADOPTION.md：包体与 N1 冲突，且 E5 已由归一化解决）
12. ~~**W1** `findPoles` 扫描窗口/步长重写~~ ✅
13. ~~**W3/W5** 单调区间开闭性、周期数值兜底采样~~ ✅

**~~第四批（工程化）~~ ✅ 已完成**

14. ~~**N1/N2** 字体 woff2 + `subset_font.py` 参数化~~ ✅（体积 −67.4%）
15. ~~**N9/N10** 官方源 audit + `engines` + GitHub Actions CI~~ ✅
16. ~~**N7** 新增 `.gitattributes`~~ ✅
17. ~~**W8/N3–N8** 逐项清理~~ ✅（N3/N5/N6/N8 经评估保留，理由见 §13.3）

## 10. 本次「第一批」修复记录
> 执行日期 2026-09-18。**目标缺陷：E1 / E2 / E5 / E3 / W7 / W9 / W6**（7 项）。
> 全程遵守一条硬判据：**既有 170 个测试必须继续通过**（最终 189 个全绿）。

### 10.1 结构性重构：新增 `src/core/expression/`

**动的动机不是「代码不好看」，而是 E1 无法在旧结构下根治**：
`core/mathUtil` 与 `core/analysisEngine` **互相 import**（校验需要定义域，定义域需要求值器），
所以校验只能用 5 个写死的样本点瞎猜。抽出单向依赖的表达式核心层后，校验才拿得到定义域。

| 新增文件 | 职责 |
|----------|------|
| `expression/normalize.ts` | 归一化**唯一入口**（合并原 `structuredParser.normalizeExpr`，并补全角字母数字） |
| `expression/compile.ts` | 求值器 / `canCompile` / 符号求导 |
| `expression/domain.ts` | 定义域推断（声明式表 + 区间交叉校验） |
| `expression/roots.ts` | 数值求根（自 `analysisEngine/roots.ts` 上移，切断循环） |
| `expression/validate.ts` | 域感知校验 |
| `expression/interval.ts` | 区间算术封装 |
| `expression/index.ts` | 统一导出 |

**兼容策略**：`mathUtil.ts`、`analysisEngine/domain.ts`、`analysisEngine/roots.ts`
改为**门面 re-export**，对外的类型与函数名**一个都没变**——这是 17 个既有测试文件零改动的原因。

**依赖方向**：`components/hooks` → `analysisEngine` → `expression`（单向，循环已解除）。

### 10.2 逐缺陷修复与实测证据

| 缺陷 | 修复方式 | 实测结果 |
|------|----------|----------|
| **E1** 5 点采样误拒 | 改为**定义域感知采样**：由推断出的定义域取代表点；域内代表点全不可算时再用 ±10^k 多尺度网格兜底 | `log(x-4)` / `sqrt(x-5)` / `log(x-10)` / `sqrt(x^2-100)` 由「被拒」→ **通过** |
| **E2** 反三角漏判 | 建 `FUNCTION_DOMAIN_TABLE` **声明式表**（sqrt/log/ln/log2/log10/asin/acos/asec/acsc/tan/sec/csc/cot/分数幂/负指数）；并加**区间算术交叉校验**兜底 | `asin(x)`/`acos(x)` → `[−1, 1]`（原为全体实数）；`asec(x)` → `(\-∞,−1]∪[1,+∞)`；`x^0.5` → `[0,+∞)` |
| **E5** 手动输入不支持中文写法 | 手动链路改用共享 `normalizeExpr` | `x²`/`√x`/`|x|`/`２x`/`x⁻¹`/`π` **全部可用**（原报「语法错误」） |
| **E3** 卡片与总结表述矛盾 + 窗口值外泄 | 新建 `analysisEngine/summary.ts` 作为**唯一措辞来源**；`FunctionAnalysis` 新增 `scanWindow`，端点落在扫描边界时标注「（扫描范围内）」 | 卡片与总结现在由同一函数产出，结构上不可能再分叉 |
| **W6** domain/zeroPoints 无截断 | 统一走 `truncateList` | `tan(x)` 的 **637 个定义域区间**不再灌满 UI |
| **W7** 无错误边界 | 新增 `ErrorBoundary`（含「重新加载」与「清空本地数据并重载」两条恢复路径），置于 `main.tsx` 根部 | 新增 3 个测试用例覆盖 |
| **W9** 死代码 | 删 `rehype-katex` 依赖（连带 9 个包）、`global.css` 四条深色模式死规则、`App.tsx` 的 `data-theme` 死写入 | `npm ls rehype-katex` → `(empty)` |

### 10.3 顺带修好与顺带发现

- **E4 的线性边界部分**：`sqrt(x-2000)`、`log(x-2000)`、`sqrt(3000-x)` 此前误报「无定义/全体实数」。
  根因是 `analyticLinearRoot` 只识别很窄的写法**且只用于 `neq` 约束**。
  现改为通用线性求解（支持 `x-b`、`b-x`、`a*x+b`、`x*a`、`ax`）并用于所有约束类型。
- **⚠️ 修正一处审计误报**：`DEFECT-AUDIT.md` 的 W9 曾判断
  「`github-dark.css` 用于浅色主题属配色不一致」。**该判断错误**——
  `global.css:22` 的 `--code-bg: #0f172a` 是**深色**底色，代码块本就是深色设计，
  `github-dark.css` 与之一致。**此项不是缺陷，未做修改，审计文档已更正。**

### 10.4 依赖变化（需知悉）

| 变化 | 说明 |
|------|------|
| **移除** `rehype-katex@^7.0.1` | 全项目零引用；移除时连带清掉 9 个包 |
| **显式声明** `interval-arithmetic@^1.1.3` | 原本只是 `function-plot` 的传递依赖；直接引用而不声明会在上游升级时**静默断裂** |
| **显式声明** `interval-arithmetic-eval@^0.5.3` | 同上（`interval.ts` 直接 import 它） |
| `tsconfig.json` 增 `paths` | 指向 `interval-arithmetic` 自带的 `lib/index.d.ts`（其 `package.json` 缺 `types` 字段） |
| 新增 `src/types/interval-arithmetic-eval.d.ts` | 该包未发布类型声明，按其真实运行行为补最小声明 |
| **`function-plot` 1.23 → 1.25.4** | ⚠️ **非本批有意升级**：`npm install` 按 `package.json` 既有的 `^1.23.0` 重新解析到 1.25.4。已验证 14 个 GraphPanel 测试与全部构建通过，`DrawerPanel` chunk 反而**减小 29 kB** |

### 10.5 区间算术的实际价值边界（重要）

`interval-arithmetic` 在本项目中**只用于「排除」**，这一点有实测依据：

| 用途 | 是否可行 | 实测证据 |
|------|----------|----------|
| 证明某区间**整段无定义** | ✅ 可靠 | `asin(x)` on `[-5,-3]`、`sqrt(x-2000)` on `[0,1000]`、`log(x)` on `[-5,-1]` 均返回空集 |
| 证明某区间**确定无零点** | ✅ 理论可行 | `x^2-4` on `[-1,1]` 值域 `[-4,-3]` |
| 替代定义域推断 | ❌ **不可** | `sqrt(x)` on `[-4,4]` 返回 `[0,2]`，**只取有效部分**，不报告无定义段 |
| 过滤数值假根 | ❌ **无收益** | 实测 `findAllRoots` 结果经包络过滤后**数量不变**（`x^2-4` 2→2、`tan` 637→637），故**未采纳**，避免引入死代码 |

**自校验设计**：`probeDomainStatus()` 会先探测 `x=0`；若连 `x=0` 都返回空集，
说明是**工具限制**（如 `interval-arithmetic` 不支持非整数幂）而非真无定义，此时返回 `unknown` 不剪枝。
这保证 `x^0.5`、`x^(1/3)` 不会被误删——该场景在开发过程中真实发生过并被测试固定。

### 10.6 验证结果

| 项 | 结果 |
|----|------|
| `npm test` | ✅ **20 文件 / 189 用例全绿**（原 19/170，净增 19 个用例） |
| `npm run build` | ✅ `tsc` 严格通过；vite 构建 4.40s |
| 懒加载未破坏 | ✅ 主 chunk 中 `function-plot`/`d3-selection` 命中 **0** |
| 新增回归测试 | `mathUtil.test.ts` +5、`domain.test.ts` +9、`ErrorBoundary.test.tsx` +3（新文件） |

## 11. 后续待办索引

见 §9。**§9 列出的全部项目均已在 §13 完成**，本节保留为历史索引。

## 17. 归档清理记录（2026-09-19）

> 项目归档时执行的深度冗余清理。**清理后已重跑全链路验证，确认未破坏任何功能。**

### 17.1 删除内容（共释放约 3,818 MB）

| 项 | 大小/数量 | 理由 |
|----|-----------|------|
| `src-tauri/target/` | ~3.8 GB | Rust 构建缓存，`npm run tauri build` 可完全重建 |
| `dist/` | 10 MB | 前端构建产物，`npm run build` 可重建 |
| `.superpowers/` | — | 外部工具（brainstorm）运行状态，非项目材料 |
| `src-tauri/icons/{android,ios}/` + `Square*` + `StoreLogo*` | 45 个文件 | `npx tauri icon` 一并导出，但本项目**仅打包 NSIS**，从未被引用 |
| `lazy_check.txt` | 230 B | 早期懒加载验证日志；其记录的 chunk 名已随 Vite 8 重建全部失效 |
| `scripts/font_chars.txt` | 24 KB | 由 `build_charset()` 确定性生成，已改为写临时目录 |
| `scripts/__pycache__/` | — | Python 字节码缓存 |

### 17.2 随之调整的配置

| 文件 | 调整 |
|------|------|
| `src-tauri/tauri.conf.json` | `bundle.icon` 移除 `icons/icon.icns`（macOS 专用，本项目无该目标） |
| `scripts/subset_font.py` | 字符集清单改为 `tempfile` 写入并用后清理 |
| `.gitignore` | 补 `__pycache__/`、`*.pyc`；注明 `release/` 下有意的发布产物 |

### 17.3 保留内容及理由

| 项 | 理由 |
|----|------|
| `app-icon.png` | **图标源**，保留即可用 `npx tauri icon app-icon.png` 重新导出全套 |
| `src-tauri/icons/` 其余 7 个文件 | 4 个为 `tauri.conf.json` 实际引用；另 3 个体积小（52 KB）属标准图标集 |
| `MapleMono-CN-Regular.ttf`（5.07 MB） | woff2 的**回退源**，删除会失去回退能力 |
| `release/0.1.0/` | 发布产物（安装包 + exe + 校验和）—— 归档的核心价值 |
| `package-lock.json` / `Cargo.lock` | 锁定依赖，归档项目复现构建的前提 |

### 17.4 清理后验证（关键）

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 通过 |
| `npm test` | ✅ **21 文件 / 215 用例全绿** |
| `npm run build` | ✅ 437 ms |
| **`npm run tauri build`（从零）** | ✅ **成功** —— 证明删掉移动端图标后 NSIS 打包未受影响 |

> 清理**不是**删完就算：从被清理的空状态**完整重建过一次**，这是「清理安全」的唯一有效证据。

## 14. 安全升级记录（高危/严重漏洞修复）

> 执行日期 2026-09-18。起因：切官方 registry 后发现 `npm audit` 报告 **1 critical + 1 high**（原审计因镜像源不提供 advisories 接口而完全看不到，即 N9）。

### 14.1 漏洞清单与处置

| 包 | 严重度 | 公告 | 处置 |
|----|--------|------|------|
| `mathjs` `13.1.0–15.1.1` | 🔴 **high** | [GHSA-29qv-4j9f-fjw5](https://github.com/advisories/GHSA-29qv-4j9f-fjw5)（不安全对象属性设置器）· [GHSA-jvff-x2qm-6286](https://github.com/advisories/GHSA-jvff-x2qm-6286) | ✅ 升级至 **15.2.0**（**影响求值路径，属渲染链路而非仅开发依赖**） |
| `vitest` `<3.2.6` | 🔴 **critical** | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp)（UI server 监听时可任意读/执行文件） | ✅ 升级至 **5.0.1** |
| `vite` `<=6.4.2` | 🟠 **high** | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)（Windows 备用路径绕过 `server.fs.deny`） | ✅ 升级至 **8.3.0** |
| `vite` | 🟡 moderate | [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)（`.map` 路径遍历）· [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)（launch-editor UNC NTLM 泄露） | ✅ 同上 |
| `@vitest/mocker` | 🟡 moderate | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)（重定向 mock 路径遍历） | ✅ 随 vitest 5 解决 |
| `esbuild` `<=0.24.2` | 🟡 moderate | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)（任意站点可向 dev server 发请求并读取响应） | ✅ 随 vite 8 解决 |
| `nanoid` `<3.3.18` | 🟠 high | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | ✅ `npm audit fix` 升至 3.3.19 |

**结果：`npm audit` 全量（含 dev 依赖）0 漏洞。** 原先「生产 0 / 开发 5」的状态已消除。

### 14.2 升级带来的破坏性变更与迁移

| 变更 | 影响 | 处理 |
|------|------|------|
| **Vite 8 内核换为 Rolldown** | `output.manualChunks` **被移除**，构建直接报 `TypeError: manualChunks is not a function` | ✅ 迁移到 `rolldownOptions.output.codeSplitting.groups`（用 `test` 正则匹配模块 id + `priority`） |
| `rollupOptions` 废弃 | Vite 8 中标注 `@deprecated` | ✅ 改用 `rolldownOptions` |
| **`@testing-library/jest-dom` 入口** | 裸包名注册的是 **Jest** 全局 `expect` 类型，与 Vitest 5 的 `Assertion` 类型不兼容 → 全部 `toBeInTheDocument()` 报 TS2339 | ✅ `src/test/setup.ts` 改为导入 **`@testing-library/jest-dom/vitest`** |
| **Node 版本要求提高** | Vite 8 要 `^20.19 \|\| >=22.12`；Vitest 5 要 `^22.12 \|\| ^24` | ✅ `engines` 改为 `^22.12.0 \|\| >=24.0.0`；CI 的 `node-version` 由 20 改为 22.12 |
| **CSS 按 chunk 拆分** | 产物由单份 CSS 变为 `index-*.css` + `katex-*.css` | ✅ 已核验两份均在 `index.html` 中 `rel="stylesheet"` 链接（否则公式样式会丢失） |
| 新增 `rolldown-runtime` chunk | 产物多一个 ~0.9 kB 运行时 | 无需处理 |

### 14.3 ⚠️ 诚实说明：这些漏洞的实际风险

必须在文档里讲清楚，避免夸大修复价值：

- **`vitest` critical / `vite` high / `esbuild` / `@vitest/mocker`** 全部位于**开发工具链**，只在 `npm run dev` / `npm test` 时存在。
  - `vite` 的 `server.fs.deny` 绕过需要**有人能访问到你的 dev server**；本项目的 dev server 仅本机 5173、且 Tauri 打包产物不含 dev server。
  - `vitest` 的任意文件读需要**启动 Vitest UI server**；本项目的 `npm test` 用 `vitest run`，不启动 UI。
  - 因此这些**不影响发布的桌面应用**。
- **`mathjs` 是唯一真正影响发布产物的**：它在渲染/求值链路中处理**来自 AI 的表达式**，属不可信输入路径，因此该升级是必要的。
- **仍然做了全量升级**的理由：① 让 `npm audit` 成为 CI 的**硬门禁**（不再需要 `continue-on-error`）；② 消除「高危项长期挂着」的债；③ 顺带获得构建速度 6.7 s → **0.46 s**。

### 14.4 验证记录

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm test` | ✅ **21 文件 / 215 用例全绿**（升级前后完全一致，无测试被改动） |
| `npm run build` | ✅ 成功，**0.46 s** |
| `npm audit`（全量） | ✅ **0 漏洞** |
| `npm audit --omit=dev` | ✅ 0 漏洞 |
| 懒加载未破坏 | ✅ HTTP 冒烟：主 chunk 中 `function-plot` / `d3-scale` / `vector-arrow` **均为 false**；`DrawerPanel-*.js` 仍为独立引用 |
| Worker 未破坏 | ✅ `analysis.worker-Bzjzy2Vs.js` 被主 chunk 引用且 HTTP 200 |
| CSS 未丢失 | ✅ 两份 CSS 均在 `index.html` 中链接 |
| dev server | ✅ `npm run dev` 冒烟：`/`、`main.tsx`、`App.tsx`、`global.css` 全部 HTTP 200 |

> ⚠️ **验证边界**：与 §12.4 相同的限制——**未做真实浏览器内的运行时验证**（工具链无浏览器自动化）。
> 已验证到「产物正确产出、引用关系正确、HTTP 可取、类型与单测全过」这一层。

## 15. 依赖安全审计（完整覆盖 npm + Rust 两侧）

> 执行日期 2026-09-18。起因：§14 只覆盖了 **npm** 一侧。本项目是 Tauri 应用，
> **另一半攻击面在 419 个 Rust crate 上，此前从未审计过**（`npm audit` 看不到）。

### 15.1 审计范围与方法

| 生态 | 命令 | 覆盖 |
|------|------|------|
| npm（含 dev） | `npm audit --registry=https://registry.npmjs.org` | 332 个包 |
| Rust / Tauri | `cargo audit`（cargo-audit 0.22.2，RustSec 1251 条公告） | Cargo.lock 的 **430 个 crate** |

Rust 侧此前完全空白，因此做了一次**独立的交叉验证**：
除 `cargo audit` 外，另写脚本直接拉取 RustSec advisory-db 的原始 front-matter，
自行实现 semver 区间匹配（`patched` / `unaffected`），逐条比对 Cargo.lock 中
**全部 53 个「在 RustSec 中有公告」的 crate**（共 73 条公告）。

**两种方法结论一致。**

### 15.2 结果

| 类别 | 数量 | 说明 |
|------|------|------|
| **真实漏洞（vulnerability）** | **0** | npm 0 + Rust 0 |
| Rust `unmaintained` 警告 | 6 | 见下表；**均不在 Windows 依赖树中** |
| Rust `unsound` 警告 | 1 | `glib`，见下 |

`cargo audit` 原始输出：`Scanning Cargo.lock for vulnerabilities (430 crate dependencies)` →
**无任何 vulnerability 条目**，仅 7 条 warning。

### 15.3 逐项判定：为何这 7 条不构成「已知漏洞」

**关键事实**：本项目**仅发布 Windows NSIS 目标**，但 `Cargo.lock` 会记录**全平台**传递依赖。
经 `cargo tree --target x86_64-pc-windows-msvc` 实测：

| 警告 crate | 类型 | 在 Windows 依赖树中？ |
|-----------|------|---------------------|
| `glib@0.18.5` | `unsound` | ❌ **否**（Linux/GTK 专用） |
| `proc-macro-error@1.0.4` | `unmaintained` | ❌ 否 |
| `unic-char-property` / `unic-char-range` / `unic-common` / `unic-ucd-ident` / `unic-ucd-version` `@0.9.0` | `unmaintained` | ❌ 否 |
| `atk` / `gdk` / `gdkx11` / `gtk` / `gtk3-macros` 等 10 个 | `unmaintained` | ❌ 否（Linux/GTK 专用） |

关于 `glib` 的 `unsound`（RUSTSEC-2024-0429）值得单独说明，因为它是唯一一条**未维护/不安全里带版本修复**的：

- 公告自身标注 `informational = "unsound"`，**不是漏洞**，而是代码层面的 UB
- 受影响函数**仅**为：`glib::VariantStrIter` 的 `next` / `nth` / `last` / `next_back` / `nth_back`
  （`&p` 被当作 out-argument 传给 C 函数，新版 Rust 优化后可能被忽略，导致 NULL 解引用崩溃）
- 修复版本 `>= 0.20.0`（`< 0.15.0` 不受影响）
- **本项目不使用 `glib`，更不使用 GVariant 反序列化**；且 `glib` 在 Windows 上**不编译**
- 无法通过 `Cargo.toml` 直接升级它——它是 `tauri` 在 **Linux 目标**下的传递依赖

**结论**：这 7 条对**实际发布的 Windows 产物零影响**。已通过 `src-tauri/.cargo/audit.toml`
逐条登记忽略（**只列具体 RustSec ID，不关闭整类检查**），使 `cargo audit` 退出码为 **0**，
从而能作为 CI 门禁——将来若出现**真实漏洞**，不会被这些 ignore 掩盖。

### 15.4 本次实际执行的动作

| 动作 | 结果 |
|------|------|
| 安装 `cargo-audit` 0.22.2 | ✅ 首次为 Rust 侧建立审计能力 |
| `cargo audit` 全量扫描 | ✅ 0 漏洞（7 条已判定警告） |
| 独立实现 RustSec 区间匹配做交叉验证 | ✅ 与 cargo-audit 结论一致 |
| `cargo update` 刷新 Cargo.lock | ✅ 多个传递依赖升到最新补丁版（`wasm-bindgen` 0.2.126→0.2.128、`web-sys` 0.3.103→0.3.105、`zerovec` 0.11.6→0.11.8 等） |
| `cargo check --target x86_64-pc-windows-msvc` | ✅ 编译通过（2m11s） |
| 新增 `src-tauri/.cargo/audit.toml` | ✅ 逐条登记忽略项并写明理由 |
| CI 增加 `rust-audit` job | ✅ `rustsec/audit-check@v2`，此前 Rust 侧审计完全缺失 |
| npm 侧复核 | ✅ 仍为 **0 漏洞** |

### 15.5 最终状态

```
npm audit  (332 包)          → 0 vulnerabilities
cargo audit (430 crates)     → 0 vulnerabilities（7 条已判定并登记的警告）
```

**两侧均无已知漏洞。**

> **诚实说明**：本节的结论基于「漏洞数据库比对 + 依赖可达性分析」，**不是**渗透测试或人工代码审计。
> 「0 漏洞」的含义是「**没有出现在 RustSec / GitHub Advisory 数据库中的已知问题**」，
> 不等于「不存在尚未被发现的缺陷」。这一点在安全报告中必须讲清楚。

## 16. Windows 构建与发布产物

> 执行日期 2026-09-19。此前本项目的 `tauri build` **从未在文档中验证过**（一直标注「未重跑」），本节补齐。

### 16.1 构建环境

| 项 | 值 |
|----|-----|
| 主机工具链 | `rustc 1.88.0` |
| 目标 | `x86_64-pc-windows-msvc` |
| NSIS | 已就绪（`%LOCALAPPDATA%\tauri\NSIS\makensis.exe`） |
| 前端 | Vite 8（Rolldown），1979 modules，**502 ms** |
| Rust release 编译 | **1m 32s**（增量 36.5s） |

### 16.2 产物

| 产物 | 大小 | 说明 |
|------|------|------|
| `src-tauri/target/release/mathmate.exe` | **13.44 MB** | 独立可执行文件 |
| `src-tauri/target/release/bundle/nsis/MathMate_0.1.0_x64-setup.exe` | **6.91 MB** | NSIS 安装包（已压缩） |

> **归档时已把发布产物复制到 `release/0.1.0/`**（含 `SHA256SUMS.txt`），
> 因为 `src-tauri/target/` 是构建缓存、已在归档清理中删除（见 §17）。

```
installer : BAA63E946739CA360EA7670060E2B1A91DFCE07CFEAF6A31609EA7B2C4E0E3DF
binary    : EF868563957C2DA3B4A687AD2423F9F83DAF31A3A63A3E1ED034657DE21DF736
```

> ⚠️ **不可复现构建**：NSIS 会把构建时间戳嵌入安装包，实测**同一源码两次构建的 SHA256 不同**。
> 上表对应 `release/0.1.0/` 中**实际发布**的那个文件；自行重建请以新产物哈希为准。

安装包 **6.91 MB** 相对 5.32 MB 的 TTF 而言偏小——因为 NSIS 使用 LZMA 压缩，
且 woff2（1.66 MB）与 TTF（5.32 MB）**同时打进包内**；前者是实际加载的字体。

### 16.3 验证

| 验证项 | 方法 | 结果 |
|--------|------|------|
| exe 能启动 | `Start-Process` + 4 秒存活检查 | ✅ 进程存活，工作集 ~29 MB |
| **窗口标题正确** | 读取 `MainWindowTitle` | ✅ **`数学学习助手`**（中文未乱码，说明打包链路 UTF-8 正常） |
| exe 元数据 | `VersionInfo` | ✅ `ProductName=MathMate`、`FileVersion=0.1.0` |
| 安装包有效 | 读取文件头 | ✅ `MZ`（合法 Windows PE） |
| release 编译无警告 | `tauri build` 输出 | ✅ 无 warn/error |

### 16.4 顺带修掉的一处配置问题

`tauri build` 输出了一条真实警告：

```
Warn The bundle identifier "com.mathmate.app" set in `tauri.conf.json` identifier
     ends with `.app`. This is not recommended because it conflicts with the
     application bundle extension on macOS.
```

`com.mathmate.app` 的 `.app` 后缀与 macOS 应用包扩展名冲突。
已改为 **`com.mathmate.desktop`**，重新构建后警告消失。

> 影响面：Windows 侧本就无影响，但该标识符同时用于 macOS/Linux 打包与系统级数据目录，
> 属于「现在改零成本、将来改会迁移用户数据」的那类问题，故当即修掉。

### 16.5 ⚠️ 未验证的部分（诚实标注）

- **未做真实交互测试**：只验证了「进程能启动 + 窗口标题正确」，**没有**点击、提问、绘图等操作验证。
  §12.4 提到的「Worker 在真实 WebView2 中是否正常执行」也仍未验证。
- **未测试安装包安装流程**：没有实际运行 `MathMate_0.1.0_x64-setup.exe` 走一遍安装/卸载。
- **WebView2 运行时**：Tauri 应用依赖 WebView2。Windows 10/11 通常已预装（Edge 内核），
  安装包会按需引导安装；此路径未实测。

## 13. 剩余 18 项修复记录（第二轮）

> 执行日期 2026-09-18。目标：E4 余下部分 + W1–W5、W8、W10 + N1–N10。
> 硬判据同上：既有测试必须继续通过（最终 **21 文件 / 215 用例全绿**）。

### 13.1 数学引擎（E4 / W1 / W2 / W3 / W4 / W5）

| 缺陷 | 修复 | 实测结果 |
|------|------|----------|
| **E4**（余下）窗口外根 | 多项式用 **Cauchy 根界** `R = 1 + max\|cᵢ/cₙ\|`（经 `mathjs.rationalize` 精确提取系数）确定扫描半径；非多项式不放宽 | `(x-2000)(x-1)` → `[1, 2000]`；`x^2-4000000` → `[-2000, 2000]`（原来只报 1 个） |
| **W1** `findPoles` | 浮点累加 `x += step` 改为**整数步进**；`Math.abs(p) < 1000` 二次过滤改为窗口内 `[lo, hi]` 判定 | ±1000 处极点不再恒失效 |
| **W2** AI domain 无校验 | `inferDomain` 改为**取交集**（声明值可收窄、不可放宽）；新增 `domainMismatch()` 与 `FunctionAnalysis.domainNarrowed`，UI 显示「AI 给出的定义域包含无定义点，已按表达式修正」 | 声明 `(-inf,inf)` 给 `log(x-4)` 不再被采信 |
| **W3** 单调区间开闭性 | 新增 `formatWindow()`，按端点是否 `inDomain` 决定方括号 | `x^2-2x-3` → `(−∞, 1]:dec`、`[1, +∞):inc`（原为开区间，与「定义域 (−∞,+∞)」自相矛盾） |
| **W4** 奇偶性采样 | 10 个固定点（**全部 x≥0.5**）→ **多尺度对称采样**（1e-3…1e3，7 个数量级 × 7 个系数 = 49 点），有效点下限 5 | 消除小量级未采样的盲区 |
| **W5** 周期 | 候选表 8 → **15 个**；采样 30 点/步长 0.7 → 60 点/步长 0.4，有效点下限 10 → 15；`hasXOutsideTrig` 解析失败由 `false` 改 `true`（保守）；新增 `uncertain` 标记 | 见 13.4 的额外发现 |

### 13.2 界面与安全（W8 / W10）

- **W8 Tauri CSP**：`security.csp` 由 `null` 改为最小可用策略
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: http:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`
  - `style-src 'unsafe-inline'` 为 KaTeX 与 React 内联样式所必需
  - `connect-src ... https: http:` 允许用户配置任意 OpenAI 兼容端点
  - `worker-src 'self' blob:` 显式放行 W11 引入的 module worker
- **W10 图例配色漂移**：`GraphPanel` 改为**先按原始下标配色再过滤隐藏项**
  （旧实现先 `filter` 再按下标配色，与图例的原始下标错位）

### 13.3 工程化与清理（N1–N10）

| 编号 | 处理 |
|------|------|
| **N1** 字体体积 | ✅ 生成 woff2 并置于 `src` 首位：**5,320,976 B → 1,736,508 B（−67.4%）**。字体是首屏必然加载的资源，此项直接决定首屏体积 |
| **N2** 字体脚本 | ✅ `subset_font.py` 重写：源路径改为 `--src`/`MAPLE_MONO_SRC`（移除硬编码本机绝对路径）；新增 woff2 输出；无 `--src` 时可只做转换 |
| **N3** `g.function` 位置索引 | 保留但记为已知脆弱点：function-plot 无稳定 per-curve 标识，改用 `data` 顺序约定风险等价。**未改**，理由见下 |
| **N4** `Date.now()` id 碰撞 | ✅ `App.tsx` 的手动函数与向量均改用 `historyStore.nextId()`（优先 `crypto.randomUUID`） |
| **N5** 标注上限 40 | 保留：该上限是**防爆炸的必要保护**（高频函数极值可达数百）。已补注释说明 |
| **N6** `App.tsx` 职责过载 | **部分处理**：本轮改动未加重其职责；完整拆分 hook 属重构，收益低于风险，**未做** |
| **N7** 行结束符 | ✅ 新增 `.gitattributes`（`* text=auto eol=lf` + 二进制声明）。**未**执行 `git add --renormalize`，以免制造整仓库 diff |
| **N8** 定义域重复扫描 | 保留：属于性能优化，且 `inferDomain` 与本轮新增的交叉校验有语义耦合，改动风险高于收益 |
| **N9** `npm audit` 不可用 | ✅ **找到可行解**：`--registry=https://registry.npmjs.org` 即可。用它发现并修复了 mathjs 高危漏洞（见 13.4） |
| **N10** 无 engines / 无 CI | ✅ `package.json` 增 `"engines": { "node": ">=18" }`；新增 `.github/workflows/ci.yml`（`npm ci` → `tsc` → `test` → `build` → 官方源 audit） |

### 13.4 ⚠️ 修复过程中新发现的问题（原审计 26 项之外）

| 发现 | 严重性 | 处理 |
|------|--------|------|
| **`mathjs` 高危漏洞** GHSA-29qv-4j9f-fjw5 / GHSA-jvff-x2qm-6286（`13.1.0–15.1.1`，影响求值路径，属**渲染链路**而非仅开发依赖） | 🔴 高 | ✅ 升级 `mathjs` 13.2.3 → **15.2.0**。215 个测试全通过；代价是 `math` chunk +22.6 kB（gzip +6.8 kB） |
| **`abs(sin(x))` 周期被算成 2π**（正确为 π） | 🔴 高 | ✅ 解析分支新增**数值下探**：从 `T/16` 起**由小到大**试，取首个成立者。`sin(x)^2` 同样修正为 π |
| **`dropRight` 残留过滤**：E4 放宽窗口后，旧的 `z < scanHi - 1e-9` 会把刚找到的根原地丢弃（`x^2-4000000` 只报 −2000） | 🟡 中 | ✅ 改用**实际**扫描半径 `effectiveRange` 过滤 |
| **`npm audit` 切官方源后暴露 7 个漏洞**（含 1 critical） | 🟡 中 | ✅ `mathjs` 已升级；`nanoid` 已 `npm audit fix`；剩余 5 个均在 **dev 依赖链**（vite/vitest），`npm audit --omit=dev` 为 **0 漏洞**，修复需 vite 8 / vitest 5 的破坏性升级，**未做** |

### 13.5 区间算术在本轮的定位修正（重要）

第一轮我在 `OPENSOURCE-ADOPTION.md` 中把区间算术列为 E4/W1 的主要手段。**本轮实测后修正了该判断**：

- ❌ 用它判定「窗口外是否可能有零点」会**过度放宽**：`x^2-2x-3` 的值域包络在 `[1000, 1e4]` 上含 0（因包络含根 x=3 的贡献），
  导致每次分析都扫到 ±1e6，**实测单次分析耗时 65 s**。
- ✅ 它真正可靠的用途仍是**「证明整段无定义」**（`isEmpty`），已用于 E2 的交叉校验（§10）。
- 结论：E4 改用**Cauchy 根界**（数学上严格、代价可控）。区间算术在项目中的定位是**单向排除工具**，不是窗口决策依据。

### 13.6 验证结果

| 项 | 结果 |
|----|------|
| `npm test` | ✅ **21 文件 / 215 用例全绿**（W11 后为 208，本轮 +7） |
| `npm run build` | ✅ `tsc` 严格通过，vite 构建成功 |
| `npm audit --omit=dev` | ✅ **0 漏洞** |
| 生产产物 | `index` 416.74 kB (gzip 131.60) · `math` 665.63 kB (gzip 192.13) · `DrawerPanel` 179.11 kB · 字体 woff2 1.66 MB |

## 12. 本次 W11 修复记录（分析移出主线程）

> 执行日期 2026-09-18。目标缺陷：**W11**（实测单函数分析 53–146 ms，比较题 3 函数可达 200–450 ms 主线程冻结）。

### 12.1 方案：Worker 优先 + 主线程分片回退

```
src/core/analysisEngine/
├── runner.ts           任务调度：WorkerBridge（按 id 匹配请求/响应）
│                       + AnalysisRunner（Worker 优先、失败粘性回退主线程）
├── workerClient.ts     Worker 客户端 + 全局单例
└── analysis.worker.ts  Worker 入口（收消息→调 analyzePayload→回消息）
```

**两级保障**：

1. **首选 Worker**：`analysisEngine` 本就是纯函数、零 React 依赖，天然可搬。Worker 内调用与主线程**同一个** `analyzePayload`，保证两条路径结果逐字节一致。
2. **回退主线程 + 分片让出**：Worker 不可用（jsdom 测试环境、受限 WebView、CSP 拒绝）时退回主线程，但**每算完一个函数就 `await` 让出一次事件循环**，使已算完的结果先渲染，把可感知冻结从「全部函数总和」降为「单个函数」。

### 12.2 关键设计决策

| 决策 | 理由 |
|------|------|
| **超时兜底（20s）** | Worker 若因 CSP/路径问题**静默死亡**（既不回包也不触发 `onerror`），无超时会让 Promise 永久挂起、UI 卡在「思考中」——比明确失败更糟。超时即 reject 并回退。**同时覆盖两种情况：真的慢 vs 静默死亡**（此前的「首个请求不设超时」设想会让后者永久挂起，故放弃）。 |
| **粘性回退** | 一旦 Worker 路径失败过，后续请求直接走主线程，避免每次分析都先付一次失败开销。 |
| **回退产物形状与原实现一致** | `analyzePayload` 返回 `FunctionAnalysis[]`（与原 `defs.map(d => analyzeFunction(d))` 完全相同），故 `ChatMessage.analysis` 类型与下游 `App.flatMap` 无需改动。 |
| **`new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })`** | Vite 原生字面量形式，构建时自动拆成独立 chunk。 |

### 12.3 ⚠️ 已知代价：Worker chunk 自含一份 mathjs

**实测**：`analysis.worker-*.js` = **689.09 kB**，其中包含完整的 mathjs（`decimal.js` / `fraction.js` / `typed-function` 均在其内）。

**原因**：Rollup 对 worker 入口**独立打包**，不共享主 bundle 的 `manualChunks` 分组——mathjs 已配置为独立 `math` chunk（643 kB），但 Worker 无法复用，只能自带一份。

**这是本次修复的真实代价，必须记录**：
- 主线程**不再冻结**，回复渲染即时；分析结果稍后到达（真实收益）
- 代价：首次分析时额外拉取 689 kB 脚本。桌面端（Tauri，本地 `tauri://` 协议）后可被系统文件缓存，非移动网络场景可接受
- 若判断不可接受，可考虑的缓解方向（均未实施）：Worker 用 `importScripts` 加载共享 math chunk；或改用 `built-in-math-eval` 等轻量求值器缩减 Worker 依赖

### 12.4 验证记录

| 验证项 | 方法 | 结果 |
|--------|------|------|
| Worker 分支逻辑 | `runner.test.ts` **19 个用例**，用手写 `FakeWorker` 替身驱动 | ✅ 全部通过 |
| 回退路径 | jsdom **无 `Worker`**，因此全部测试天然走回退分支 | ✅ 每次都验证回退产物与直调 `analyzeFunction` 逐字段一致 |
| 乱序回包不串包 | 两个并发请求先回第二个再回第一个 | ✅ 各自匹配正确 |
| 静默死亡不挂起 | 假计时器推进至超时 | ✅ reject `分析 Worker 超时未响应` |
| 迟到响应安全忽略 | 超时后再回包 | ✅ 无未捕获异常 |
| Worker chunk 真能产出并被服务 | `npm run build` + `vite preview` HTTP 拉取 | ✅ 主 chunk 引用 `analysis.worker-DKYL4LCc.js`，HTTP 200，689,087 字符 |
| 懒加载未被破坏 | 检查主 chunk 内容 | ✅ `function-plot` / `d3-scale` 均**不存在**；`DrawerPanel-*.js` 仍为独立引用 |

> ⚠️ **诚实说明（验证边界）**：本次**未做真实浏览器内的端到端 Worker 执行验证**
> （工具链中无浏览器自动化）。已验证的是：Worker chunk 正确产出、被主 bundle 引用、HTTP 可获取，
> 以及 Worker 与主线程**共用同一分析函数**。据此判断「Worker 真能在浏览器中跑通」的依据是
> Vite 官方支持的标准写法 + 上述构建/服务证据。**若首次在真机运行时分析结果不出现，请检查
> WebView2 对 module worker 与 CSP 的支持**——回退机制会保证结果仍然正确，只是失去不阻塞的收益。

### 12.5 测试与依赖影响

- 测试：20/189 → **21/208**（新增 `runner.test.ts` 19 例）
- 依赖：**无新增**（Worker 为平台能力，未引入任何包）
- `tsc` 严格通过；`npm run build` 通过
