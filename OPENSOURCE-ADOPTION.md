# MathMate 开源项目适配评估与重构建议

> ⚠️ **项目已于 2026-09-19 归档，停止维护。** 本文档为归档时的调研记录，不再更新。
> 归档说明见 **[ARCHIVED.md](ARCHIVED.md)**。
> 注：本报告 §2.1 曾把「区间算术」列为求根/极点的主要手段，**该判断在实施阶段被实测推翻**（详见 `PROJECT-STATUS.md` §13.5）。

> 编制日期：2026-09-18
> 依据：[DEFECT-AUDIT.md](DEFECT-AUDIT.md) 的 26 项缺陷（Error 5 / Warning 11 / Note 10）
> 结论来源：**全部经本机实测**（npm registry / GitHub API / 依赖树探针 / 运行时行为验证），非文档推断
> 前置说明：本报告按「系统性 / 架构性 / 算法性」三级分类，并逐项给出**采纳 / 参考 / 不采纳**与理由

---

## 0. 核心实测发现（决定了全部结论）

在给出项目清单前，必须先公布四项**改变了推荐方向**的实测结果。

### 0.1 🔴 你的依赖树里**已经有**区间算术了

```
mathmate@0.1.0
`-- function-plot@1.25.4
  `-- interval-arithmetic-eval@0.5.3
    `-- interval-arithmetic@1.1.3   ← 已安装，24 KB，BSL-1.0
```

`interval-arithmetic` 是 **`function-plot` 自带的传递依赖**，且 function-plot 自身就用它做区间求值。
**这意味着：本报告原本要推荐「照抄 graphest 自己实现 200–300 行区间算术」，现在完全不需要——机器已经有了。**

### 0.2 ⚠️ 但它的数学语义**不是** graphest 那种「保证正确」

我实测了它在我具体缺陷上的行为，结果**有喜有忧**，必须如实说明：

| 测试 | 实测返回 | 判定 |
|------|---------|------|
| `sqrt(x)` on `x∈[-4,-1]` | `lo=+Inf, hi=-Inf, isEmpty=true` | ✅ **确定性证明整段无定义** |
| `log(x)` on `x∈[-5,-1]` | `isEmpty=true` | ✅ 同上 |
| `acos(x)` on `x∈[2,3]` | `isEmpty=true` | ✅ 同上 |
| **`asin(x)` on `x∈[-5,5]`** | `lo=-1.5708, hi=1.5708, isEmpty=false` | ❌ **错！** 应含无定义段 |
| **`sqrt(x)` on `x∈[-1,4]`** | `lo=0, hi=2.0, isEmpty=false` | ❌ **只取有效部分**，不报告 `[-1,0)` 无定义 |
| `1/(x-5)` on `x∈[4,6]` | `lo=-Inf, hi=+Inf` | ⚠️ 区间包络效应，无法定位极点 |
| `1/(x-5)` on `x∈[4,4.9]` | `lo=-10, hi=-1` | ✅ **确定性证明无极点** |
| `x^2-4` on `x∈[-1,1]` | `lo=-4, hi=-3`（不含 0） | ✅ **确定性证明无零点** |
| `x^0.5` | 抛错，提示改用 `nthRoot` | ⚠️ 非整数幂不支持 |

**结论（务必据此调整预期）**：
- ✅ 它是优秀的**排除/剪枝/证伪**工具：能证明「这段区间一定没有零点/一定无定义」
- ❌ 它**不能**替代 graphest 的 Tupper 算法：对**部分有效区间**会静默只算有效部分（unsound），**无法**发现 E2 那类定义域漏判
- ❌ 它**不能定位极点**（只能证伪），所以 W1 的根治仍需要一个递归细分策略配合

### 0.3 ⚠️ nerdamer-prime 很强，但有一条**致命陷阱**

实测结果（本机安装 v1.5.0 后逐项验证，已卸载）：

| 能力 | 实测 | 对你有用吗 |
|------|------|-----------|
| `solve('(x-2000)*(x-1)')` → `[2000, 1]` | ✅ **精确** | ✅ **直接解决 E4**（数值扫描丢根） |
| `solve('x^3-3000x')` → `[0, ±10√30]` | ✅ 精确符号解 | ✅ 强于数值求根 |
| `solve('x^2+1')` → `[i, -i]` | ⚠️ **返回复数根** | ❌ 高中场景只需实根，**必须过滤，否则给错答案** |
| **`solve('log(x-4)')` → `[5]`** | ❌ **错得离谱**（log 无实根；x=5 时 log(1)=0 是另一回事） | ❌ **不可无条件信任** |
| `solve('sin(x)')` | ⚠️ 返回 22 个截断有理数近似 | ❌ 周期函数应报通解形式 |
| `diff('abs(x)')` → `abs(x)^(-1)*x` | ⚠️ 数学上不准（x=0 不可导） | ⚠️ 需校验 |
| `nerdamer.domainOf / assume / solveInequalities` | **`undefined`（不存在）** | ❌ **对 E2（定义域）零帮助** |
| `nerdamer('\\frac{1}{x-5}')` → `"frac"` | ❌ 不解析 LaTeX | ❌ 对 E5 无帮助 |
| 模块级全局状态（`nerdamer('x')` 每次写入全局） | ⚠️ 并发不安全 | ⚠️ React 并发渲染下有顺序风险 |

**结论**：nerdamer 是**「精确求根的增强件」，不是「定义域推断的解药」**，且必须配**实根过滤 + 结果校验**才能用。

### 0.4 ⚠️ MathLive 的体积与 N1 正面冲突

`mathlive@0.110.0` **unpacked 5.6 MB**，且自带数学字体。而你当前已有 **5.32 MB** MapleMono 字体（缺陷 N1）。
→ 直接引入会**加重**首屏体积问题。**必须先测包体再决定**，不能盲上。

---

## 1. 项目清单与三级分类

图例：**✅ 采纳** · **🔶 参考（读源码/借思路，不引依赖）** · **❌ 不采纳**

### 一级 · 系统性增强 / 替换

> 定义：替换整个技术栈或核心子系统；影响面最大、风险最高

| 项目 | ★ | 许可 | 最近提交 | 结论 | 理由 |
|------|---|---|---------|------|------|
| [**arnog/mathlive**](https://github.com/arnog/mathlive) | 2158 | MIT | 2026-09-11 | **✅ 采纳（有条件）** | `<math-field>` 800+ LaTeX 命令、虚拟键盘、屏幕阅读器友好；**根治 E5**、顺带 W9。**条件：先测包体增量，与 N1 字体优化合并评估** |
| [**unageek/graphest**](https://github.com/unageek/graphest) | 151 | MIT | 2026-09-02 | **❌ 不整体替换**<br>🔶 **算法参考** | Rust + Tauri 桌面应用，替换 = 重写整个 app。但它的 Tupper 算法是 E2/E4/W1 的正解方向 → 归入三级参考 |
| [**together-science/nerdamer-prime**](https://github.com/together-science/nerdamer-prime) | 60 | MIT | 2026-09-04 | **❌ 不整体替换**<br>✅ **局部采纳** | 无法替换 mathjs（无 LaTeX、无定义域、有全局状态）。仅作**符号求根增强**，且需实根过滤 + 校验 |
| [**cortex-js/compute-engine**](https://github.com/cortex-js/compute-engine) | 475 | MIT | 2026-09-18 | **❌ 不采纳** | 其 `domain` 是**类型域**（`Pi`→`TranscendentalNumbers`），**不是实变函数定义域**；换掉 mathjs 成本高、收益不确定；42.8 MB unpacked |
| [**josdejong/mathjs**](https://github.com/josdejong/mathjs) | 15074 | Apache-2.0 | 2026-09-13 | **❌ 不替换** | 你已在用；无需换。仅注意**上游已 v15，你是 v13**（升级属独立议题） |
| [**jsxgraph/jsxgraph**](https://github.com/jsxgraph/jsxgraph) | 1449 | **LGPL-3.0** | 2026-09-18 | **❌ 不采纳** | **LGPL-3.0 合规负担** + 与现有 function-plot 功能重复 |
| [**HycJack/geogebra**](https://github.com/HycJack/geogebra)（镜像） | — | GPL | — | **❌ 不采纳** | GPL 传染性 + 体量巨大 + 与「本地轻量 + AI 驱动」定位冲突 |
| **Desmos**（闭源） | — | 专有 | — | **❌ 不采纳** | 闭源、需 API key、需联网 → 与**离线优先的 Tauri 定位**直接冲突 |
| [google/mathsteps](https://github.com/google/mathsteps) | 2159 | Apache-2.0 | **2023-06 归档** | **❌ 不采纳** | 已归档停更 |
| [davidedc/Algebrite](https://github.com/davidedc/Algebrite) | 1002 | MIT | npm **2021** | **❌ 不采纳** | npm 侧 5 年未发版 |

**系统性层小结：仅 1 个采纳项（MathLive，且有条件）；1 个算法参考（graphest）。**
理由：MathMate 的**核心价值是本地 `analysisEngine` + AI 编排**，这两块没有现成项目能替你——它们不是通用件。

### 二级 · 架构性增强 / 替换

> 定义：不改技术栈，改**内部结构与渲染范式**；中等风险、中等收益

| 来源 | 做法 | 结论 | 对应缺陷 |
|------|------|------|---------|
| 自研（借鉴 compute-engine 的库化组织） | 抽 `src/core/expression/`（`normalize` / `compile` / `domain` / `validate`），`mathUtil` 退化为 re-export | **✅ 采纳** | **E1 + E5 + 循环依赖** 三合一根治 |
| [function-plot 官方 web-workers 设计文档](https://github.com/mauriciopoppe/function-plot/blob/master/design/web-workers.md) | `analysisEngine` 已是纯函数 → 移入 Worker | **✅ 采纳** | **W11** 主线程冻结 |
| [interval-arithmetic](https://github.com/mauriciopoppe/interval-arithmetic)（**已在依赖树**） | 用 `compile().eval()` + `isEmpty` 做定义域/零点**剪枝** | **✅ 采纳** | **E1 + E4 + W1** 的排除逻辑 |
| [ChristopherChudzicki/math3d-react](https://github.com/ChristopherChudzicki/math3d-react)（★279, MPL-2.0） | 声明式 React SVG 渲染，替代 `d3.select` 命令式改 DOM | **🔶 参考**（读架构，不引依赖） | **W10** 索引漂移 |
| [cortex-js/compute-engine](https://github.com/cortex-js/compute-engine) | 声明式「知识库 + 遍历」范式 | **🔶 参考**（架构范式） | **E2** 的根治思路 |
| 自研 | 统一 `PropertyCard` 与 `buildSummary` 的表述格式化函数 | **✅ 采纳** | **E3**（卡片与总结矛盾） |

### 三级 · 算法性增强 / 替换

> 定义：替换单个算法实现；风险最低、可独立验证、收益明确

| 项目 / 算法 | 出处 | 结论 | 对应缺陷 | 实测依据 |
|------------|------|------|---------|---------|
| **声明式函数定义域表** | 借鉴 compute-engine 的 domain knowledge base 范式 | **✅ 采纳** | **E2** | compute-engine 无现成实变定义域 → 必须自建表 |
| **区间算术剪枝**（`isEmpty` 判定） | 已在依赖树的 `interval-arithmetic` | **✅ 采纳** | **E1 + E4 + W1** | §0.2 实测：`sqrt/log/acos` 整段无定义可确定性判定 |
| **区间算术零点排除** | 同上 | **✅ 采纳** | **E4** | 实测 `x^2-4` on `[-1,1]` 值域 `[-4,-3]` 不含 0 → 确定无根 |
| **符号精确求根** | nerdamer-prime `solve` | **✅ 采纳（需过滤）** | **E4** | 实测 `(x-2000)(x-1)`→`[2000,1]`；但 `x^2+1`→复数根、`log(x-4)`→错解 |
| **Tupper 区间细分算法** | [Graphest](https://github.com/unageek/graphest) / [Tupper SIGGRAPH 2001](http://www.dgp.toronto.edu/~mooncake/papers/SIGGRAPH2001_Tupper.pdf) | **🔶 参考** | **E2 + E4 + W1、W3/W4/W5** | graphest README 自述"Never gives an incorrect result" |
| **奇偶性采样策略** | 自研（当前仅 10 点且全 x≥0.5） | **✅ 采纳** | **W4** | 实测当前实现样本区间偏斜 |
| **内置导数曲线渲染** | [function-plot](https://github.com/mauriciopoppe/function-plot) `derivative` 数据类 | **✅ 采纳** | 教学增强（非缺陷） | 官方 README 示例 |
| **TeX → mathjs 转换** | [davidtranhq/tex-math-parser](https://github.com/davidtranhq/tex-math-parser)（★36, MIT） | **🔶 备选** | **E5** | 若不用 MathLive，可作为 LaTeX→mathjs 的兜底 |
| [seehiong/swift-calc](https://github.com/seehiong/swift-calc)（★66, MIT） | 同技术栈（React+TS+Math.js，123 测试） | **🔶 参考** | 测试组织 | 用于对照测试基线 |
| function-plot `derivative` / `graphType` 扩展 | 你已在用 | **🔶 参考** | — | 你已实现自定义 `vector` 图元，可复用该模式 |

---

## 2. 关于「clone 整个项目下来替换」的可行性判定

你问到是否可以直接 clone 整个项目做适配替换。**我的判定是：对绝大多数候选不可行，只有 1 个真正可行。**

| 候选 | 能否整包替换 | 判定依据 |
|------|-------------|---------|
| **MathLive** | **✅ 可行** | 它是**库**（web component），不是应用。可 npm 安装、渐进替换你现有的输入框 + KaTeX 管线，无需重写业务逻辑 |
| graphest | ❌ 不可行 | 是**完整 Rust 桌面应用**；替换 = 放弃你的 AI 编排 + analysisEngine，等于重写项目 |
| nerdamer-prime | ❌ 不可行 | 是**数学库**，不是应用；且无 LaTeX、无定义域、有全局状态 |
| compute-engine | ❌ 不可行 | 是**数学库**；换掉 mathjs 需重写全部求值/求导路径，而它并不提供你要的实变定义域 |
| JSXGraph / GeoGebra | ❌ 不可行 | 体量巨大、许可受限、与现有绘图栈重复 |
| math3d-react | ❌ 不可行 | 是 **3D 绘图应用**（MPL-2.0）；但**架构思路**可参考 |
| swift-calc / Math-Graph-Calculator 等 | ❌ 不可行 | 是**完整应用**，且技术定位不同（普通计算器 vs AI 辅导） |

**根本原因**：MathMate 的项目特异性集中在两处——**① AI 驱动的函数提取与编排（`structuredParser` + `useChat`）**、**② 本地函数特性分析引擎（`analysisEngine`）**。这两块**在开源世界里没有可直接替换的通用件**，必须自研。其余部分（绘图、渲染、输入）才是可以用库替换的。

---

## 3. 健壮性评估与重构裁决

你授权我「若当前项目健壮性不足，则允许重构」。以下是**基于实测的裁决**。

### 3.1 现状评估

| 维度 | 实测 | 评价 |
|------|------|------|
| 代码规模 | 28 个非测试文件 / 3009 行 | **小**，完全可控 |
| 测试 | 19 文件 / 170 用例全绿 | **良好**，且覆盖了 analysisEngine 每个模块 |
| 架构边界 | `analysisEngine` 纯函数、零 React 依赖 | **优秀** |
| 构建 | tsc 严格通过 / vite 4.31s | **健康** |
| 结构缺陷 | ① `mathUtil` ↔ `analysisEngine` 双向依赖<br>② `collectConstraints` 硬编码、已漏 4+ 函数<br>③ 手动输入与 AI 链路各自实现归一化 | **3 处局部结构性缺陷** |

### 3.2 裁决：**需要重构，但只需局部重构，不是整体重构**

**理由**：
- 3000 行 + 170 测试**不足以也不应该**触发整体重构——整体重写会丢弃这 170 个测试积累的回归保护，风险远大于收益
- 但缺陷 ①②③ **都是结构性的**：逐条打补丁（如只补 `asin`/`acos`）会**再次遗漏** `asec`/`acsc`/分数幂等——这正是 E2 的成因。**必须改结构才能终止「漏一个函数就错一个」的循环**
- `analysisEngine` 已是纯函数 → 抽 `core/expression/` 是**低风险机械重构**，且有测试护城河

### 3.3 建议的重构范围（最小必要集）

```
新增  src/core/expression/
        ├── normalize.ts    统一归一化（合并 structuredParser.normalizeExpr + 手动输入的缺失部分）
        ├── compile.ts      统一编译/求值（现 mathUtil.makeEvaluator）
        ├── domain.ts       定义域推断（自 analysisEngine/domain.ts 迁入，函数定义域表驱动）
        ├── validate.ts     表达式校验（新，替代 validateExpression 的 5 点采样）
        └── interval.ts     区间算术封装（包装已在依赖树的 interval-arithmetic）

调整  src/core/mathUtil.ts        → 退化为 re-export（保持现有 15 个测试不变）
      src/core/analysisEngine/    → 从 expression/ 引入，消除双向依赖
      package.json                → 显式声明 interval-arithmetic（当前是隐式传递依赖）
```

**关键点：对外 API 保持兼容** → 现有 170 个测试**应当全部继续通过**，这是重构正确性的判据。

---

## 4. 采纳清单汇总（按实施顺序）

### 第一批 · 零新增依赖，立即可做

| # | 做法 | 来源 | 修缺陷 | 风险 |
|---|------|------|--------|------|
| 1 | 抽 `core/expression/`（含统一 `normalize`） | 自研 + compute-engine 组织范式 | E1, E5, 循环依赖 | 低（有 170 测试护城河） |
| 2 | 建 `FUNCTION_DOMAIN_TABLE` 声明式定义域表 | 借鉴 compute-engine knowledge base | **E2** | 低 |
| 3 | 用 `interval-arithmetic` 做定义域/零点**剪枝** | **已在依赖树** | E1, E4, W1 | 低（仅做排除，不做判定） |
| 4 | `PropertyCard` 与 `buildSummary` 共用格式化函数 | 自研 | E3 | 低 |
| 5 | 加 ErrorBoundary + 删死依赖/死 CSS | 自研 | W7, W9 | 低 |
| 6 | 显式声明 `interval-arithmetic` 依赖 | — | 隐式依赖风险 | 低 |

### 第二批 · 需配套测试

| # | 做法 | 来源 | 修缺陷 | 风险 |
|---|------|------|--------|------|
| 7 | nerdamer-prime 符号求根（**必须加实根过滤 + 结果校验**） | nerdamer-prime | E4 | 中（§0.3 陷阱） |
| 8 | `analysisEngine` 移入 Web Worker | function-plot web-workers 设计 | W11 | 中 |
| 9 | 定义域/零点输出截断（同 monotonic/extrema） | 自研 | W6 | 低 |
| 10 | 奇偶性采样策略重写 | 自研 | W4 | 低 |

### 第三批 · 需先测包体

| # | 做法 | 来源 | 修缺陷 | 风险 |
|---|------|------|--------|------|
| 11 | MathLive `<math-field>` 替换手动输入框 | arnog/mathlive | **E5** | **中高**（5.6 MB，与 N1 冲突） |
| 12 | 评估 MathLive `<math-span>` 替换 KaTeX + 删 `rehype-katex` | arnog/mathlive | W9 | 中高（同上） |

### 第四批 · 架构范式参考（非阻塞）

| # | 做法 | 来源 | 修缺陷 |
|---|------|------|--------|
| 13 | 声明式 React SVG 渲染替代命令式 DOM | math3d-react | W10 |
| 14 | 递归区间细分（Tupper 算法）替代硬编码窗口 | Graphest / SIGGRAPH 2001 | E2, E4, W1, W3 |
| 15 | 采纳 function-plot `derivative` 曲线 | function-plot | 教学增强 |

### 明确不采纳

❌ Algebrite（停更 5 年）· ❌ mathsteps（已归档）· ❌ JSXGraph（LGPL-3.0）· ❌ GeoGebra（GPL + 体量）· ❌ Desmos（闭源 + 需联网）· ❌ compute-engine 整体替换 mathjs · ❌ graphest 整体替换 · ❌ 各 ★0–66 的个人 Tauri 数学应用

---

## 5. 风险与限制（必须知晓）

1. **`interval-arithmetic` 的 soundness 缺口**（§0.2）：它对**部分有效区间**会静默只算有效部分。**不可**用它替代 E2 的定义域推理，只能作**排除**用。这是本报告最重要的限制。
2. **nerdamer 的错解**（§0.3）：`solve('log(x-4)')`→`[5]` 是错解，`x^2+1`→复数根。**必须**加实根过滤与数值回代校验。
3. **MathLive 体积**：5.6 MB unpacked + 自带字体，与 N1 正面冲突。**未测包体前不得引入。**
4. **依赖显式化**：`interval-arithmetic` 目前是 `function-plot` 的传递依赖。直接使用它而**不在 `package.json` 声明**，会在 function-plot 升级时静默断裂 → **必须显式声明**。
5. **nerdamer 全局状态**：其 API 每次调用都写入模块级全局，在 React 并发渲染下存在顺序风险；若采纳需隔离实例或串行化。
6. **上游版本差**：你的 mathjs 是 v13，上游已 v15；function-plot 你是 1.23，上游 1.25.4。升级属**独立议题**，不在本报告建议范围内。

---

## 6. 本次调研的验证记录

| 验证项 | 方法 | 结果 |
|--------|------|------|
| 依赖树区间算术 | `npm ls interval-arithmetic` | ✅ 确认经 function-plot→interval-arithmetic-eval 传递引入 |
| 区间算术能力边界 | 写入 `probe_interval*.mjs` 实测 40+ 用例 | ✅ 得出 §0.2 结论（含 2 处 unsound） |
| nerdamer 能力边界 | `npm install --no-save` 后实测 6 组 31 项 | ✅ 得出 §0.3 结论（含错解发现） |
| 项目元数据 | GitHub API + npm registry 实时查询 | ✅ 星标/许可/提交日期/体积均为实测 |
| 环境复原 | 删除全部探针文件 + `npm install` 复原 | ✅ `package.json`/`package-lock.json` **零改动** |
| 回归 | `npm test` | ✅ **19 文件 / 170 用例全绿** |

**探针文件已全部删除**（`probe_interval.mjs`、`probe_interval2.mjs`、`probe_nerd.cjs`），`node_modules` 已复原（nerdamer-prime 已卸载）。
`git status` 仅含文档改动：`M PLAN.md`、`M PLAN-UI.md`、`M README.md`、`?? PROJECT-STATUS.md`、`?? DEFECT-AUDIT.md`、`?? OPENSOURCE-ADOPTION.md`。**源码零改动。**

---

## 7. 一句话结论

> **不需要 clone 任何项目来替换你的应用。** 最高价值的三件事全部**零新增依赖或极低成本**：① 抽 `core/expression/` 终结「漏一个函数就错一个」；② 建声明式函数定义域表修 E2；③ 用**已经在依赖树里**的 `interval-arithmetic` 做排除剪枝修 E1/E4/W1。
> 唯一值得引入的新库是 **MathLive**（修 E5），但**必须先测包体**——它与你的字体体积问题（N1）正面冲突。
> **重构建议：只做局部重构（`core/expression/`），不做整体重构。** 判据是现有 170 个测试必须继续全绿。
