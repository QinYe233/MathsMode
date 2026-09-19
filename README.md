# 数学学习助手 (MathMate)

> **⚠️ 本项目已归档，停止维护（2026-09-19）。** 不再接受新功能、缺陷修复、依赖更新或 issue。
>
> - 归档说明、状态快照、**已知开放项**与自行构建指引见 **[ARCHIVED.md](ARCHIVED.md)**
> - 许可证为 **MIT**，归档不改变许可 —— 仍可自由使用、修改、分发
> - ⚠️ 归档后依赖漏洞库仍会增长而无人升级，长期使用请自行重跑 `npm audit` / `cargo audit`

一个面向高中数学的桌面应用：AI 解答数学问题，自动识别其中的函数并绘制图像、计算函数特性。基于 React + TypeScript + Vite 构建，并通过 Tauri 2 打包为 Windows 桌面应用。

> 项目当前状态、已实测数据与已知问题见 **[PROJECT-STATUS.md](PROJECT-STATUS.md)**（单一事实来源）。
> 缺陷清单、复现证据与修复方案见 **[DEFECT-AUDIT.md](DEFECT-AUDIT.md)**（Error 5 / Warning 11 / Note 10）。

## 特性

- **AI 解答**：OpenAI 兼容 API，支持 SSE 流式输出，120s 超时与中断处理
- **富文本回复**：Markdown（标题/加粗/列表/表格/引用/代码块 + 语法高亮）+ LaTeX 公式（`$...$`、`$$...$$`、`\(...\)`、`\[...\]`），自动剥离绘图元数据块
- **函数绘图**：基于 function-plot 的多函数对比、图例显隐、滚轮缩放、拖动平移、双击重置视野、悬停坐标
- **特性分析**：定义域、奇偶性、单调区间、极值、零点、渐近线、周期——由本地 `analysisEngine` 数值计算，不依赖 AI
- **手动输入**：表达式可直接画图，与 AI 识别结果走同一条分析链路
- **平面向量**：输入 `a=(3,2)` 以箭头绘制，与函数曲线共存（自定义 function-plot `vector` 图元）
- **会话管理**：多会话新建/切换/删除，localStorage 持久化
- **桌面打包**：Tauri 2，NSIS 安装包

## 界面布局

三列 grid：会话侧栏（展开 260px / 收起 44px）+ 聊天区 + 可拖拽抽屉面板（300–720px，宽度持久化）。抽屉收起时显示右侧竖向「函数图像」标签；分析结果从无到有时自动展开。

## 数据流

```
提问 → aiClient（SSE 流式）
     → structuredParser 提取函数（MATH_FUNCTIONS JSON 块 → 正则兜底 → 表达式归一化）
     → analysisEngine 计算特性（纯函数，不依赖 React）
     → GraphPanel 绘图 + PropertyCard 特性卡片
```

AI 被要求将函数以 JSON 注释块附在解答末尾：

```json
<!-- MATH_FUNCTIONS -->
{"functions": [{"id": "f", "expr": "x^2 - 2x - 3", "domain": "(-inf, inf)"}]}
<!-- /MATH_FUNCTIONS -->
```

`expr` 为 mathjs 兼容表达式；`domain` 可选。解析失败时降级为正则扫描 `f(x)=...` / `y=...`；再失败则视为无函数，仅显示文字解答，不崩溃。

## 富文本渲染管线

AI 回复经 `react-markdown` + `remark-gfm` + `remark-math` + `remark-breaks` + `rehype-highlight` 渲染，`rehype-sanitize` 防 XSS（schema 已扩展以保留 KaTeX MathML 与高亮类名）。Markdown 插件只负责把公式解析为 `<code class="language-math ...">` 节点，真正的 KaTeX 渲染在 `MessageBubble` 的 `components.code` 分支中调用 `katex.renderToString` 完成（**未使用 `rehype-katex`**，该依赖已移除）。渲染失败的公式回退为纯文本；流式输出经 `useDeferredValue` 优化。用户消息保持原样（纯文本 + KaTeX），不渲染 Markdown。详见 `src/components/MessageBubble.tsx`。

## 技术栈

- React 18 + TypeScript 5.9
- Vite 8（Rolldown 内核）
- Tauri 2（桌面壳，仅 Windows NSIS 目标）
- mathjs 15（求导/求值）、function-plot + d3-selection（绘图）、KaTeX（公式）
- Vitest 5 + Testing Library（jsdom，21 文件 / 215 用例）

> Node 要求：`^22.12.0 || >=24.0.0`。

## 开发

```bash
npm install
npm run dev          # 启动 Vite 开发服务器 (http://localhost:5173)
npm run test         # 运行测试（vitest run）
npm run test:watch   # 监听模式
npm run build        # 类型检查（tsc 严格）并构建
npm run tauri dev    # 以 Tauri 桌面应用方式运行
npm run tauri build  # 打包 Windows NSIS 安装包
```

### 构建产物

`npm run tauri build` 产出：

| 产物 | 大小 |
|------|------|
| `src-tauri/target/release/mathmate.exe` | 13.44 MB |
| `src-tauri/target/release/bundle/nsis/MathMate_0.1.0_x64-setup.exe` | 6.91 MB |

实测：前端 Vite 8 构建 ~0.5 s，Rust release 编译 ~1m32s（增量 ~37s）。详见 `PROJECT-STATUS.md` §16。

### 字体

界面字体为 Maple Mono CN，经 `scripts/subset_font.py` 子集化并转换为 woff2：

| 文件 | 体积 |
|------|------|
| `src/assets/fonts/MapleMono-CN-Regular.woff2` | **1.66 MB**（`@font-face` 首选） |
| `src/assets/fonts/MapleMono-CN-Regular.ttf` | 5.07 MB（回退） |

woff2 相比 TTF **减少 67.4%**。字体是首屏必然加载的资源，因此这一项直接决定首屏体积。

重新生成（不需要原始全量字体，直接由现有 TTF 转换即可）：

```bash
python scripts/subset_font.py                      # TTF → woff2
python scripts/subset_font.py --src <全量字体路径>  # 重新子集化 + 转换
```

源字体路径通过 `--src` 或环境变量 `MAPLE_MONO_SRC` 提供，脚本内**不再硬编码本机路径**。

### 构建产物与懒加载

绘图模块（function-plot / d3，179 kB）经 `React.lazy` 动态导入，位于独立 chunk，打开抽屉后才加载。**注意**：`vite.config.ts` 刻意不为 function-plot / d3 配置 `manualChunks` 分组——一旦分组，组件树会被提升进主 chunk，懒加载失效。

函数特性分析在 **Web Worker** 中执行（`analysis.worker-*.js`），避免流式结束后主线程被冻结数百毫秒；Worker 不可用时自动回退主线程并逐函数让出事件循环。详见 [PROJECT-STATUS.md](PROJECT-STATUS.md) §12。

### 持续集成

`.github/workflows/ci.yml` 在两个 job 中执行：

- **verify**：`npm ci` → `tsc --noEmit` → `npm test` → `npm run build` → `npm audit`
- **rust-audit**：`rustsec/audit-check@v2` 审计 Tauri 侧的 Rust 依赖

```bash
# 本地复核依赖安全（两侧都需覆盖）
npm audit --registry=https://registry.npmjs.org   # 镜像源不支持 advisories 接口
cd src-tauri && cargo audit                        # 需要 cargo install cargo-audit
```

两侧当前均为 **0 漏洞**。Rust 侧的忽略项逐条登记在 `src-tauri/.cargo/audit.toml`（附理由）。

## Contributors

- [QinYe233](https://github.com/QinYe233)

## 许可证

[MIT](LICENSE)
