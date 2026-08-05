# 设计文档：清空绘图按钮 + 平面向量绘图

日期：2026-08-05
状态：已确认

## 背景

用户提出两个新功能：

1. **清空函数绘图按钮**：图板（DrawerPanel → GraphPanel）提供一键清空所有已绘制的曲线。
2. **平面直角坐标系 · 向量表示**：用户在坐标系中手动输入向量（如 `a=(3,2)`），以箭头形式绘制，与函数曲线共存。

两个功能相互关联：清空按钮同时清空函数与向量。

## 功能 1：清空绘图按钮

### 交互

- 位置：GraphPanel 工具栏右端、「重置视野」按钮旁。
- 样式：沿用 `legend-btn`，红色调（`#ef4444`），无内容时 `disabled`。
- 点击直接清空，无二次确认——聊天文本仍保留，重新发送即可恢复分析，数据可再生。
- 清空后图板保持打开，显示空状态文案（现有 `graph-empty`）。

### 数据流

- `useChat` 新增 `clearPlot()`：返回新消息数组，剥离所有消息的 `analysis` 字段（保留 `content` / `functions` / `role`）。
- App 新增 `handleClear()`：`chat.clearPlot()` + `setManualAnalyses([])` + `setVectorDefs([])`。
- 传参链：App → DrawerPanel（`onClear`）→ GraphPanel（`onClear`）。
- 清空不持久化：刷新后历史会话恢复，曲线随历史消息重新出现——数据源是历史消息，此为可接受行为。
- 清空后不触发自动展开逻辑（计数 n→0，`prevAnalysesCount` 同步更新为 0，无 0→n 转换）。

## 功能 2：向量输入绘图

### 语法与校验

`mathUtil` 新增 `parseVector(input: string): { name: string; x: number; y: number } | { error: string }`：

- 合法形式（名字可省略）：
  - `a=(3,2)`、`a = (3, 2)`、`AB=(3,2)`
  - `(3,2)`、`-3,2`、`3, -2.5`
- 名字：1–2 个字母，可带可选 `=`；省略名字时 `name = ''`。
- 坐标：有符号十进制小数（支持负号、小数点、首尾空格）。
- 非法输入返回 `{ error: '格式应为 a=(3,2)，坐标支持负号和小数' }`。
- 分量不支持表达式 / 分数 / π / 两点式（范围外）。

### 数据模型

`types.ts` 新增：

```ts
export interface VectorDef {
  id: string;
  name: string;
  x: number;
  y: number;
}
```

### 状态

- App 新增 `vectorDefs: VectorDef[]` 状态与 `addVector(input)`：
  - `parseVector` 校验，失败返回错误信息（由 GraphPanel 显示）。
  - 去重：同名替换；`name === ''` 时同坐标替换。
  - `id` 生成沿用 `manual-${Date.now()}` 模式。
- 向量状态放 App 而非 GraphPanel：图板收起时 GraphPanel 卸载，放 App 保证收起再展开不丢数据。

### 绘制

- 同一 function-plot 实例，`data` 追加：

  ```ts
  { vector: [x, y], graphType: 'vector', color: COLORS[i % COLORS.length] }
  ```

  （function-plot 的 vector 图元从原点画箭头。）
- `annotations` 在箭头头部附近（`(x + 0.2, y + 0.2)` 偏移）标 `a(3,2)`；无名向量只标 `(3,2)`；仅当文字位置在视野内时标注。
- 若项目内 function-plot 类型定义（`src/types/function-plot.d.ts`）缺 vector 图元类型，需补充。

### 图例与隐藏

- 图例区每条向量一个按钮：文本 `a=(3,2)` 或 `(3,2)`，颜色同曲线循环，点击切换隐藏（复用 `legend-btn off` 样式）。
- 隐藏状态与函数分离：`hidden` 的 key 用 `v:${id}` 避免与函数表达式字符串冲突。
- 绘制 effect 中，向量同样参与 `visible` 过滤。

### 视野

- `autoView` 纳入向量端点 `(x, y)`（加入 `xs` / `ys` 计算），沿用现有 clamp ±50。
- 向量超出视野的部分按画布裁剪，属正常表现。

### 输入 UI

- GraphPanel 工具栏新增一行向量输入：
  - 标签「向量」
  - 输入框，placeholder `a=(3,2)，回车添加`
  - 回车添加；错误时输入框标红 + 行内错误文案（复用 `func-input invalid` / `func-input-error` 样式模式）
  - 添加成功后清空输入框

### 联动

- 自动展开：`prevAnalysesCount` 比较对象扩展为「分析 + 向量」总数（0→n 时展开图板）。
- 清空按钮同时清向量（见功能 1）。

## 组件改动

- `GraphPanel`：props 变为 `{ analyses, vectors, onClear }`；工具栏加向量输入行 + 清空按钮 + 向量图例。
- `DrawerPanel`：透传 `vectors` 与 `onClear`。
- `App`：新增 `vectorDefs` / `addVector` / `handleClear`；`prevAnalysesCount` 计数扩展。
- `useChat`：新增 `clearPlot()`。
- `mathUtil`：新增 `parseVector`。
- `types.ts`：新增 `VectorDef`。

## 测试

- `mathUtil.test`：`parseVector` 合法（带名/无名/负号/小数/空格/多字母名）与非法（非数字分量/缺少逗号/多余字符）用例。
- `App.test`：
  - 添加函数与向量后点击清空 → 图板空状态、`clearPlot` 剥离 analysis。
  - 清空按钮无内容时禁用。
- `GraphPanel.test`：
  - 向量图例渲染与隐藏切换。
  - 向量输入非法时显示行内错误。
  - mock function-plot 断言收到 `graphType: 'vector'` 数据。

## 范围外（YAGNI）

- 两点式向量（`AB: A(1,2) B(3,4)`）、指定起点
- 向量运算（加减/数乘）、向量动画
- 向量持久化（与函数一致：内存态，随会话历史恢复）
- 清空二次确认
