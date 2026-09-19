# 开源项目调研

> 已归档，停止维护（2026-09-19）。归档说明见 [ARCHIVED.md](ARCHIVED.md)。
> 调研日期 2026-09-18，数据取自 GitHub API 与 npm registry 实时查询。

## 1. 关键实测发现

调研过程中有四项实测结果改变了推荐方向，先行列出。

### 1.1 `interval-arithmetic` 已在依赖树中

```
mathmate@0.1.0
`-- function-plot@1.25.4
  `-- interval-arithmetic-eval@0.5.3
    `-- interval-arithmetic@1.1.3   （24 KB，BSL-1.0）
```

它是 function-plot 的传递依赖，function-plot 自身就用它做区间求值。原本计划参考 graphest 自行实现区间算术，实测后确认不需要。

### 1.2 但它的语义不是「保证正确」

| 测试 | 返回 | 判定 |
|---|---|---|
| `sqrt(x)` on `[-4,-1]` | `isEmpty=true` | 确定性证明整段无定义 |
| `log(x)` on `[-5,-1]` | `isEmpty=true` | 同上 |
| `acos(x)` on `[2,3]` | `isEmpty=true` | 同上 |
| `asin(x)` on `[-5,5]` | `[-1.5708, 1.5708]` | **错**，应含无定义段 |
| `sqrt(x)` on `[-1,4]` | `[0, 2.0]` | **只取有效部分**，不报告 `[-1,0)` 无定义 |
| `1/(x-5)` on `[4,4.9]` | `[-10, -1]` | 证明无极点 |
| `1/(x-5)` on `[4,6]` | `[-Inf, +Inf]` | 包络效应，无法定位极点 |
| `x^2-4` on `[-1,1]` | `[-4, -3]` | 证明无零点 |
| `x^0.5` | 抛错 | 不支持非整数幂 |

**结论**：可用于**排除/证伪**（证明某区间无零点、无定义），不能替代定义域推断——对部分有效区间会静默只算有效部分。也不能定位极点。

实施阶段还发现一个陷阱：它对非整数幂返回空集，若直接用于剪枝会误删 `x^0.5` 这类合法定义域。故封装层做了自校验（先探测 x=0，若也为空则判为工具限制，不剪枝）。

### 1.3 `nerdamer-prime` 可用于精确求根，但必须过滤

| 能力 | 实测 |
|---|---|
| `solve('(x-2000)*(x-1)')` | `[2000, 1]` 精确 |
| `solve('x^3-3000x')` | `[0, ±10√30]` 精确符号解 |
| `solve('x^2+1')` | `[i, -i]` **返回复数根，需过滤** |
| `solve('log(x-4)')` | `[5]` **错解** |
| `solve('sin(x)')` | 22 个截断有理数近似 |
| `diff('abs(x)')` | `abs(x)^(-1)*x`，x=0 不可导 |
| `nerdamer.domainOf / assume / solveInequalities` | **不存在**（`undefined`） |
| `nerdamer('\\frac{1}{x-5}')` | `"frac"`，不解析 LaTeX |

**结论**：是「精确求根增强件」，不是「定义域解药」。必须配实根过滤 + 数值回代校验。另有模块级全局状态，React 并发渲染下有顺序风险。

### 1.4 MathLive 体积与字体优化冲突

`mathlive@0.110.0` unpacked 5.6 MB，自带数学字体。而项目当时已有 5.32 MB 的 MapleMono 字体（缺陷 N1）。直接引入会加重首屏体积。

## 2. 项目清单

图例：**采纳** · **参考**（读源码/借思路，不引依赖）· **不采纳**

### 2.1 系统性增强 / 替换

| 项目 | ★ | 许可 | 结论 |
|---|---|---|---|
| [arnog/mathlive](https://github.com/arnog/mathlive) | 2158 | MIT | 参考。`<math-field>` 支持 800+ LaTeX 命令、虚拟键盘、屏幕阅读器。可根治 E5，但与字体体积冲突，需先测包体 |
| [unageek/graphest](https://github.com/unageek/graphest) | 151 | MIT | 不整体替换（是完整 Rust 桌面应用）。其 Tupper 算法是 E2/E4/W1 的参考方向 |
| [together-science/nerdamer-prime](https://github.com/together-science/nerdamer-prime) | 60 | MIT | 不整体替换。仅作符号求根增强，见 §1.3 |
| [cortex-js/compute-engine](https://github.com/cortex-js/compute-engine) | 475 | MIT | 不采纳。其 `domain` 是**类型域**（`Pi`→`TranscendentalNumbers`），不是实变函数定义域。42.8 MB unpacked |
| [josdejong/mathjs](https://github.com/josdejong/mathjs) | 15074 | Apache-2.0 | 不替换，已在用（后升级至 15.2） |
| [jsxgraph/jsxgraph](https://github.com/jsxgraph/jsxgraph) | 1449 | LGPL-3.0 | 不采纳。许可负担 + 与 function-plot 重复 |
| GeoGebra / Desmos | — | GPL / 专有 | 不采纳。许可或联网要求与离线优先的 Tauri 定位冲突 |
| [google/mathsteps](https://github.com/google/mathsteps) | 2159 | Apache-2.0 | 不采纳，2023-06 已归档 |
| [davidedc/Algebrite](https://github.com/davidedc/Algebrite) | 1002 | MIT | 不采纳，npm 侧 5 年未发版 |

系统性层只有 MathLive 一个参考项。原因是项目的核心价值在本地分析引擎与 AI 编排，这两块没有现成的通用件可替换。

### 2.2 架构性增强

| 做法 | 来源 | 结论 | 对应缺陷 |
|---|---|---|---|
| 抽 `src/core/expression/`，`mathUtil` 退化为 re-export | 自研，借鉴 compute-engine 的库化组织 | 采纳 | E1 + E5 + 循环依赖 |
| 分析移入 Web Worker | function-plot 官方 web-workers 设计文档 | 采纳 | W11 |
| 区间算术做定义域/零点剪枝 | interval-arithmetic | 采纳 | E1 + E4 + W1 |
| 声明式 React SVG 渲染替代命令式 DOM | math3d-react（★279, MPL-2.0） | 参考 | W10 |
| 声明式「知识库 + 遍历」范式 | compute-engine | 参考 | E2 |
| 卡片与总结共用格式化函数 | 自研 | 采纳 | E3 |

### 2.3 算法性增强

| 算法 | 结论 | 对应缺陷 |
|---|---|---|
| 声明式函数定义域表 | 采纳 | E2 |
| 区间算术排除（`isEmpty`） | 采纳 | E1 + E4 + W1 |
| 符号精确求根（需实根过滤） | 采纳 | E4 |
| Tupper 区间细分（[SIGGRAPH 2001](http://www.dgp.toronto.edu/~mooncake/papers/SIGGRAPH2001_Tupper.pdf) / Graphest） | 参考 | E2 + E4 + W1 |
| 奇偶性多尺度采样 | 采纳 | W4 |
| function-plot 内置 `derivative` 曲线 | 采纳 | 教学增强 |
| [tex-math-parser](https://github.com/davidtranhq/tex-math-parser)（★36, MIT） | 备选 | E5 |

## 3. 整包替换的可行性

| 候选 | 可行 | 依据 |
|---|---|---|
| MathLive | 可行 | 是库（web component），可渐进替换输入与渲染，无需重写业务 |
| graphest | 不可行 | 是完整 Rust 应用，替换等于放弃 AI 编排与分析引擎 |
| nerdamer / compute-engine | 不可行 | 是数学库；且都不提供实变函数定义域 |
| JSXGraph / GeoGebra | 不可行 | 体量、许可、功能重复 |
| math3d-react | 不可行 | 是 3D 绘图应用，只能借架构 |

项目特异性集中在 `structuredParser` + `useChat`（AI 编排）与 `analysisEngine`（特性分析），两者没有可直接替换的通用件。绘图、渲染、输入这些外围环节才可以用库替换。

## 4. 重构范围

评估结论是**局部重构**，不整体重写。依据：代码约 3000 行、170 个测试，整体重写会丢弃这些回归保护；但三处结构缺陷（`mathUtil` ↔ `analysisEngine` 双向依赖、`collectConstraints` 硬编码、手动输入与 AI 链路各自实现归一化）必须改结构才能终止「漏一个函数就错一个」的循环。

实际执行范围：

```
新增  src/core/expression/
        normalize.ts   归一化（手动输入与 AI 共用）
        compile.ts     编译求值
        domain.ts      定义域推断（声明式函数表驱动）
        validate.ts    表达式校验
        roots.ts       求值求根
        interval.ts    区间算术封装

调整  mathUtil.ts             → re-export 门面
      analysisEngine/         → 从 expression/ 引入，消除双向依赖
      package.json            → 显式声明 interval-arithmetic
```

对外 API 保持兼容，既有测试全部继续通过。

## 5. 实施结果

| 批次 | 内容 | 结果 |
|---|---|---|
| 一 | 抽 `core/expression/`、声明式定义域表、区间算术剪枝、共用格式化、ErrorBoundary、删死依赖 | 完成 |
| 二 | 分析移入 Worker、定义域/零点截断、奇偶性采样重写 | 完成 |
| 三 | MathLive 替换输入框 | **未采纳**。语法层已由归一化解法 E5，引入 5.6 MB 与字体优化冲突 |
| 四 | 声明式 SVG 渲染、Tupper 算法、function-plot `derivative` 曲线 | 未实施 |

E4 最终未采用 nerdamer，改用 **Cauchy 根界**（`mathjs.rationalize` 取系数），因 nerdamer 有错解与全局状态问题，而 Cauchy 根界是严格的数学上界且代价可控。

## 6. 限制

1. **`interval-arithmetic` 的 soundness 缺口**：对部分有效区间静默只算有效部分，不可用于定义域推理，只能排除。
2. **nerdamer 的错解**：`solve('log(x-4)')`→`[5]`。若采用必须加实根过滤与回代校验。
3. **MathLive 体积**：5.6 MB unpacked，与字体优化冲突。
4. **依赖显式化**：`interval-arithmetic` 是传递依赖，直接使用必须在 `package.json` 声明，否则上游升级时会静默断裂。
