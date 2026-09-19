# 文档索引

> ⚠️ **项目已于 2026-09-19 归档，停止维护**（见根目录 [`ARCHIVED.md`](../ARCHIVED.md)）。
> 本目录下全部为**归档前的历史文档**，仅作追溯用途，请勿据此判断现状。

> 本目录下的文档为**历史记录**（设计快照与实施计划），部分内容与当前代码不符，均已就地标注。
> **当前状态的单一事实来源是根目录的 [`PROJECT-STATUS.md`](../PROJECT-STATUS.md)。**

## 阅读顺序建议

1. [`../README.md`](../README.md) — 项目是什么、怎么跑
2. [`../PROJECT-STATUS.md`](../PROJECT-STATUS.md) — **当前已验证状态、性能数据、已知问题、待办**
3. [`../DEFECT-AUDIT.md`](../DEFECT-AUDIT.md) — **缺陷审计（Error/Warning/Note）与修复方案**
4. 本目录的历史文档 — 需要了解「为什么这样设计/实现」时查阅

## 文档状态一览

| 文档 | 性质 | 与代码的一致性 |
|------|------|----------------|
| `specs/2026-08-05-math-learning-app-design.md` | 基础设计快照 | ⚠️ 有失真：称「深色主题」（已撤销为固定浅色）；「LaTeX 输入实时预览」未实现；右面板已升级为抽屉 |
| `specs/2026-08-05-ui-theme-drawer-tauri-design.md` | 增量设计快照 | ✅ 基本一致（grid 列宽与 DrawerTab 位置已更正） |
| `specs/2026-08-05-vector-plot-clear-button-design.md` | 增量设计快照 | ⚠️ 向量标注方案与实现不同（见下） |
| `plans/2026-08-05-math-learning-app.md` | 15 任务实施计划 | ✅ 已实施；测试估算偏低、深色主题项已撤销 |
| `plans/2026-08-05-light-theme-drawer-tauri.md` | 3 项改造计划 | ✅ 已实施 |
| `plans/2026-08-05-vector-plot-clear-button.md` | 向量/清空计划 | ⚠️ 代码块中的 annotations 方案未采用 |

> 说明：各文件内的 `- [ ]` 复选框是计划模板的**任务拆解**，未随实施勾选；完成情况请以文件顶部的 `Status` 状态头为准。

> 行结束符：`PLAN.md` 与 `PLAN-UI.md` 为 CRLF，其余为 LF。仓库现已加入 `.gitattributes`（`* text=auto eol=lf`）统一策略。

## 向量绘图的实现差异（易踩坑）

设计文档写的是用 function-plot 的 `annotations` 在箭头旁偏移标注文字：

```ts
// 设计稿（未采用）
const tx = v.x + 0.25, ty = v.y + 0.25;
anns.push({ x: tx, y: ty, text: `${v.name}(${v.x},${v.y})` });
```

**实际实现**（`src/core/vectorGraphType.ts`）注册了自定义图元：

- `line.vector-arrow` — 从原点出发的箭杆
- `polygon.vector-head` — 箭头三角（长 12，按方向计算张角）
- `circle.vector-dot` — 末端实心圆点（`r = 3.5`），精确落在数据点
- `text.vector-label` — 旁侧文字，`x2 ± 8`，`text-anchor` 随左右侧切换，**零偏移锚定**

对应测试 `src/core/vectorGraphType.test.ts`（4 个用例）。

## 主题演进（易踩坑）

```
深色主题（基础设计文档第 1/6 节）
   → 改为浅色主题（ui-theme-drawer-tauri 增量设计）✅
   → 再度加回「跟随系统/浅色/深色」（PLAN-UI.md 任务 1.3 / 1.4）✅
   → 整体撤销（commit 4598f72）❌ 现为固定浅色
```

因此 `PLAN-UI.md` 中任务 1.3 / 1.4 虽标 ✅，实际已作废。`global.css` 中的深色模式遗留死样式已删除。
