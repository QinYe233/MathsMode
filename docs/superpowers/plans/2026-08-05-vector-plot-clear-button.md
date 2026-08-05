# 清空绘图按钮 + 平面向量绘图 实施计划

> **Status:** 已实施（2026-08-05）。全量验证：vitest 115/115、tsc 干净、build 成功、Playwright 冒烟 25/25。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 图板工具栏新增「清空绘图」按钮（清空全部函数与向量），并支持手动输入向量（如 `a=(3,2)`）以箭头形式绘制在坐标系中，与函数曲线共存。

**Architecture:** 向量数据（`VectorDef[]`）放 App 状态，与 `manualAnalyses` 并列（图板收起再展开不丢）；通过 function-plot 的公共 `registerGraphType` API 注册自定义 `vector` 图元（用 `chart.meta.xScale/yScale` 画箭头，缩放/平移自动跟随）；「清空」在数据层剥离消息的 `analysis` + 清空 manual/vector 状态。

**Tech Stack:** React 18 + TypeScript + Vite + vitest/testing-library；function-plot@1.25.4（注册自定义图元）；d3-selection@^3（图元 builder 用，需加为直接依赖）。

**⚠️ 与已确认 spec 的一处偏差（规划时发现）：** spec 原写「清空不持久化，刷新后曲线随历史恢复」——但 `useChat` 对 sessions 变更自动持久化（`historyStore.save` 300ms debounce）。因此清空操作**会**随会话持久化，刷新后保持清空。此为更符合直觉的行为（聊天文本仍保留，可重新提问恢复分析），Task 0 会更新 spec 并提交。

**技术事实（已核实）：**
- function-plot 1.25.4 无内置 `vector` graphType；`registerGraphType` 是公共导出（`dist/index.js`）。
- `Chart` 有公开只读 `markerId`、`meta.xScale/yScale`（d3 scale）；builder 模式 `(chart) => (selection) => selection.each(function(d){...})`（参照自带 scatter builder）。
- tip 对 `skipTip: true` 的 datum 跳过求值（`tip.js` 检查 `data[i].skipTip`）——vector datum 必须设 `skipTip: true`，否则 hover 时对无 `fn` 的 datum 求值出 NaN。
- 包自带类型已含 `FunctionPlotDatum.vector?: [number, number]` 与 `skipTip?: boolean`；仅 `graphType` 联合类型缺 `'vector'`，需模块扩充。
- `src/types/function-plot.d.ts` 现有内容是纯 ambient 声明，与包自带类型并存；改为带 `import 'function-plot'` 的模块扩充形式以合并接口。
- d3-selection@3.0.0 已在 node_modules（function-plot 的传递依赖，npm hoisted），`npm install d3-selection@^3.0.0` 应为瞬时完成。
- GraphPanel.test / App.test 中 `vi.mock('function-plot', () => ({ default: vi.fn() }))` 必须补上 `registerGraphType: vi.fn()`，否则 vectorGraphType 模块 import 时崩溃。

---

## Task 0: 更新 spec（清空持久化行为）

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-vector-plot-clear-button-design.md`

- [ ] **Step 1: 修改「数据流」一节**

将：

```
- 清空不持久化：刷新后历史会话恢复，曲线随历史消息重新出现——数据源是历史消息，此为可接受行为。
```

替换为：

```
- 清空随会话持久化：`useChat` 对 sessions 变更自动保存（historyStore 300ms debounce），因此清空后刷新保持清空状态——聊天文本不受影响，重新提问即可恢复分析。
```

- [ ] **Step 2: 修改「范围外」一节**

将：

```
- 向量持久化（与函数一致：内存态，随会话历史恢复）
```

替换为：

```
- 向量持久化（向量为临时绘图输入，随页面刷新消失；函数清空持久化，见功能 1）
```

- [ ] **Step 3: 提交**

```bash
git add docs/superpowers/specs/2026-08-05-vector-plot-clear-button-design.md
git commit -m "docs: amend clear-persistence behavior discovered during planning"
```

---

## Task 1: `parseVector`（mathUtil）+ 单元测试

**Files:**
- Modify: `src/core/mathUtil.ts`（文件末尾追加）
- Test: `src/core/mathUtil.test.ts`（末尾追加 describe）

- [ ] **Step 1: 写失败测试**

在 `src/core/mathUtil.test.ts` 末尾追加：

```ts
import { parseVector } from './mathUtil';

describe('parseVector', () => {
  it('解析带名向量 a=(3,2)', () => {
    expect(parseVector('a=(3,2)')).toEqual({ name: 'a', x: 3, y: 2 });
  });

  it('解析带名向量（空格、负号、小数）', () => {
    expect(parseVector('AB = (-3, 2.5)')).toEqual({ name: 'AB', x: -3, y: 2.5 });
  });

  it('解析无名向量 (3,2)', () => {
    expect(parseVector('(3,2)')).toEqual({ name: '', x: 3, y: 2 });
  });

  it('解析无名裸坐标 -3,2', () => {
    expect(parseVector('-3,2')).toEqual({ name: '', x: -3, y: 2 });
  });

  it('拒绝缺少逗号', () => {
    expect(parseVector('(3 2)')).toHaveProperty('error');
  });

  it('拒绝非数字分量', () => {
    expect(parseVector('a=(x,2)')).toHaveProperty('error');
    expect(parseVector('a=(3,)')).toHaveProperty('error');
  });

  it('拒绝多余字符', () => {
    expect(parseVector('a=(3,2);')).toHaveProperty('error');
    expect(parseVector('a=3,2')).toHaveProperty('error'); // 带名必须带括号
  });

  it('拒绝超过 2 字符的名字', () => {
    expect(parseVector('abc=(3,2)')).toHaveProperty('error');
  });
});
```

注意：文件顶部已有 import 块；`import { parseVector } from './mathUtil';` 若顶部 import 已存在同文件导入，则合并进现有 import（检查文件顶部 `import { ... } from './mathUtil'` 语句，把 `parseVector` 加进去，不要新增重复 import 语句）。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/mathUtil.test.ts`
Expected: FAIL — `parseVector is not a function`（或类似）。

- [ ] **Step 3: 实现**

在 `src/core/mathUtil.ts` 末尾追加：

```ts
export function parseVector(
  input: string,
): { name: string; x: number; y: number } | { error: string } {
  const s = input.trim();
  const num = '(-?\\d+(?:\\.\\d+)?)';
  const named = new RegExp(`^([a-zA-Z]{1,2})\\s*=\\s*\\(\\s*${num}\\s*,\\s*${num}\\s*\\)$`);
  const anonParen = new RegExp(`^\\(\\s*${num}\\s*,\\s*${num}\\s*\\)$`);
  const anonBare = new RegExp(`^${num}\\s*,\\s*${num}$`);
  const m = named.exec(s) ?? anonParen.exec(s) ?? anonBare.exec(s);
  if (!m) return { error: '格式应为 a=(3,2)，坐标支持负号和小数' };
  const x = parseFloat(m[m.length - 2]);
  const y = parseFloat(m[m.length - 1]);
  const name = named.test(s) ? m[1] : '';
  return { name, x, y };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/core/mathUtil.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add src/core/mathUtil.ts src/core/mathUtil.test.ts
git commit -m "feat: parseVector for plane vector input"
```

---

## Task 2: 类型扩展（VectorDef + function-plot 模块扩充）+ d3-selection 依赖

**Files:**
- Modify: `src/types.ts`
- Modify: `src/types/function-plot.d.ts`（整体重写为模块扩充）
- Modify: `package.json`（npm install 自动改）

- [ ] **Step 1: types.ts 加 VectorDef**

在 `src/types.ts` 的 `FunctionDef` 接口后追加：

```ts
export interface VectorDef {
  id: string;
  name: string;
  x: number;
  y: number;
}
```

- [ ] **Step 2: 删除 function-plot.d.ts（已核实：模块扩充是死代码）**

实施时验证：TS 接口合并不会拓宽联合类型（`graphType` 联合缺 `'vector'` 的重声明触发 TS2717），且 `skipLibCheck: true` 掩盖该错误——扩充文件对 tsc 无实际效果。**直接删除 `src/types/function-plot.d.ts`**（包自带类型已含 `FunctionPlotDatum.vector` / `skipTip`；Task 4 在 data 构造处做一次类型断言）。

- [ ] **Step 3: 安装 d3-selection 与类型包**

Run: `npm install d3-selection@^3.0.0`
Run: `npm install -D @types/d3-selection`
（d3-selection v3 无内置类型，TS7016 不被 skipLibCheck 抑制；@types 必须有。）

- [ ] **Step 4: 验证类型**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 5: 提交**

```bash
git add src/types.ts src/types/function-plot.d.ts package.json package-lock.json
git commit -m "feat: VectorDef type and function-plot module augmentation"
```

---

## Task 3: 自定义 vector 图元（注册 + builder + 测试）

**Files:**
- Create: `src/core/vectorGraphType.ts`
- Test: `src/core/vectorGraphType.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/core/vectorGraphType.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import { vectorGraphTypeBuilder } from './vectorGraphType';

describe('vectorGraphType', () => {
  const xScale = ((v: number) => 100 + v * 10) as never;
  const yScale = ((v: number) => 200 - v * 10) as never;
  const chart = { meta: { xScale, yScale } } as never;

  function renderVector(datum: { vector: [number, number]; color: string; index: number }) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(g);
    document.body.appendChild(svg);
    const plotter = vectorGraphTypeBuilder(chart);
    plotter(select(g).datum(datum));
    return { svg, g };
  }

  it('绘制从原点到 (3,4) 的箭头线', () => {
    const { g } = renderVector({ vector: [3, 4], color: '#2563eb', index: 0 });
    const line = g.querySelector('line.vector-arrow')!;
    expect(line).not.toBeNull();
    expect(line.getAttribute('x1')).toBe('100');
    expect(line.getAttribute('y1')).toBe('200');
    expect(line.getAttribute('x2')).toBe('130');
    expect(line.getAttribute('y2')).toBe('160');
    expect(line.getAttribute('stroke')).toBe('#2563eb');
    expect(line.getAttribute('stroke-width')).toBe('2');
  });

  it('箭头头部为填充同色的三角形 polygon', () => {
    const { g } = renderVector({ vector: [3, 4], color: '#f59e0b', index: 1 });
    const head = g.querySelector('polygon.vector-head')!;
    expect(head).not.toBeNull();
    expect(head.getAttribute('points')).toContain('130,160');
    expect(head.getAttribute('fill')).toBe('#f59e0b');
  });

  it('零长向量 (0,0) 不崩溃且不画头部', () => {
    const { g } = renderVector({ vector: [0, 0], color: '#16a34a', index: 2 });
    expect(g.querySelector('line.vector-arrow')).not.toBeNull();
    const head = g.querySelector('polygon.vector-head');
    expect(head?.getAttribute('points')).toBe('');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/vectorGraphType.test.ts`
Expected: FAIL — `Failed to resolve import "./vectorGraphType"`。

- [ ] **Step 3: 实现**

创建 `src/core/vectorGraphType.ts`：

```ts
import { select } from 'd3-selection';
import { registerGraphType } from 'function-plot';
import type { FunctionPlotDatum } from 'function-plot';

interface VectorDatum extends FunctionPlotDatum {
  vector: [number, number];
  color: string;
}

export const vectorGraphTypeBuilder =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (chart: any) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (selection: any) => {
    const xScale = chart.meta.xScale as (v: number) => number;
    const yScale = chart.meta.yScale as (v: number) => number;
    selection.each(function (this: Element, d: VectorDatum) {
      const [vx, vy] = d.vector;
      const x1 = xScale(0);
      const y1 = yScale(0);
      const x2 = xScale(vx);
      const y2 = yScale(vy);

      const lines = select(this)
        .selectAll<SVGLineElement, VectorDatum>(':scope > line.vector-arrow')
        .data([d]);
      const linesEnter = lines.enter().append('line').attr('class', `vector-arrow vector-arrow-${d.index}`);
      lines
        .merge(linesEnter)
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', d.color)
        .attr('stroke-width', 2);

      const heads = select(this)
        .selectAll<SVGPolygonElement, VectorDatum>(':scope > polygon.vector-head')
        .data([d]);
      const headsEnter = heads.enter().append('polygon').attr('class', `vector-head vector-head-${d.index}`);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        heads.merge(headsEnter).attr('points', '');
        return;
      }
      const ux = dx / len;
      const uy = dy / len;
      const s = 9;
      const tip = `${x2},${y2}`;
      const b1 = `${x2 - s * (ux * 0.9 - uy * 0.45)},${y2 - s * (uy * 0.9 + ux * 0.45)}`;
      const b2 = `${x2 - s * (ux * 0.9 + uy * 0.45)},${y2 - s * (uy * 0.9 - ux * 0.45)}`;
      heads
        .merge(headsEnter)
        .attr('points', `${tip} ${b1} ${b2}`)
        .attr('fill', d.color)
        .attr('stroke', d.color);
    });
  };

registerGraphType('vector', vectorGraphTypeBuilder);
```

说明：`vectorGraphTypeBuilder` 单独导出以便单元测试直接调用；`registerGraphType` 在模块加载时执行一次（全局注册）。`this` 为 d3 selection 回调内的 `<g>` 元素。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/core/vectorGraphType.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/core/vectorGraphType.ts src/core/vectorGraphType.test.ts
git commit -m "feat: custom vector graph type for function-plot"
```

---

## Task 4: GraphPanel 支持向量 + 清空按钮

**Files:**
- Modify: `src/components/GraphPanel.tsx`
- Modify: `src/components/GraphPanel.test.tsx`
- Modify: `src/components/DrawerPanel.tsx`（透传 props）

- [ ] **Step 1: 更新测试（含失败的新测试）**

将 `src/components/GraphPanel.test.tsx` 全文替换为：

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphPanel } from './GraphPanel';
import { analyzeFunction } from '../core/analysisEngine';
import type { VectorDef } from '../types';

vi.mock('function-plot', () => ({
  default: vi.fn(),
  registerGraphType: vi.fn(),
}));

import functionPlot from 'function-plot';
const mockedPlot = vi.mocked(functionPlot);

const V: VectorDef[] = [{ id: 'v1', name: 'a', x: 3, y: 2 }];

describe('GraphPanel', () => {
  it('无函数时显示空状态', () => {
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} />);
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
  });

  it('有函数时调用 functionPlot 并展示特性卡片', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} />);
    expect(mockedPlot).toHaveBeenCalled();
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data!.length).toBe(1);
    expect(screen.getByText('奇偶性')).toBeInTheDocument();
    expect(screen.getByText('非奇非偶')).toBeInTheDocument();
    expect(screen.getByText('定义域')).toBeInTheDocument();
  });

  it('展示极值与零点标注', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} vectors={[]} onClear={() => {}} />);
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.annotations!.length).toBeGreaterThanOrEqual(3); // min + 2 zeros
  });

  it('向量以 vector 图元传入 functionPlot 且 skipTip', () => {
    render(<GraphPanel analyses={[]} vectors={V} onClear={() => {}} />);
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data).toContainEqual({ vector: [3, 2], color: '#2563eb', graphType: 'vector', skipTip: true });
    expect(screen.getByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
  });

  it('向量图例可隐藏：点击后不再传入 vector 图元', async () => {
    render(<GraphPanel analyses={[]} vectors={V} onClear={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'a=(3,2)' }));
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data!.some((d: { graphType?: string }) => d.graphType === 'vector')).toBe(false);
  });

  it('向量输入非法时显示行内错误', async () => {
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} />);
    const input = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(input, 'a=(x,2)');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText(/格式应为/)).toBeInTheDocument();
  });

  it('向量输入合法时回调 onAddVector 并清空输入框', async () => {
    const onAddVector = vi.fn(() => null);
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} onAddVector={onAddVector} />);
    const input = screen.getByPlaceholderText(/回车添加/);
    await userEvent.type(input, 'b=(1,-2.5)');
    await userEvent.keyboard('{Enter}');
    expect(onAddVector).toHaveBeenCalledWith('b=(1,-2.5)');
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/格式应为/)).toBeNull();
  });

  it('空内容时清空按钮禁用', () => {
    render(<GraphPanel analyses={[]} vectors={[]} onClear={() => {}} />);
    expect(screen.getByRole('button', { name: /清空绘图/ })).toBeDisabled();
  });

  it('有内容时点击清空回调触发', async () => {
    const onClear = vi.fn();
    render(<GraphPanel analyses={[analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' })]} vectors={V} onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: /清空绘图/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
```

注意「向量输入合法」用例：`onAddVector` 是必传 prop（上一步测试代码已含）。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/components/GraphPanel.test.tsx`
Expected: FAIL（类型/API 变化导致的失败）。

- [ ] **Step 3: 实现 GraphPanel**

重写 `src/components/GraphPanel.tsx` 为（关键部分）：

```tsx
import { useEffect, useRef, useState } from 'react';
import functionPlot from 'function-plot';
import type { FunctionAnalysis, VectorDef } from '../types';
import { PropertyCard } from './PropertyCard';
import '../core/vectorGraphType';

const COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#ef4444', '#8b5cf6', '#06b6d4'];

interface Props {
  analyses: FunctionAnalysis[];
  vectors: VectorDef[];
  onClear: () => void;
  onAddVector: (input: string) => string | null;
}

export function GraphPanel({ analyses, vectors, onClear, onAddVector }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [resetKey, setResetKey] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [vecInput, setVecInput] = useState('');
  const [vecError, setVecError] = useState<string | null>(null);

  const total = analyses.length + vectors.length;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [analyses.length, vectors.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || total === 0) return;
    const width = size?.w || el.clientWidth || 400;
    const height = Math.max(size?.h || el.clientHeight || 340, 260);
    const visible = analyses.filter((a) => !hidden[a.expression]);
    const visibleVectors = vectors.filter((v) => !hidden[`v:${v.id}`]);
    const viewBox = autoView(analyses, vectors);
    try {
      functionPlot({
        target: el,
        width,
        height,
        grid: true,
        disableZoom: false,
        tip: { xLine: true, yLine: true },
        xAxis: { domain: viewBox.x, label: 'x' },
        yAxis: { domain: viewBox.y, label: 'y' },
        data: [
          ...visible.map((a, i) => ({
            fn: a.expression,
            color: COLORS[i % COLORS.length],
            graphType: 'polyline' as const,
          })),
          ...visibleVectors.map((v, i) => ({
            vector: [v.x, v.y] as [number, number],
            color: COLORS[(visible.length + i) % COLORS.length],
            graphType: 'vector' as const,
            skipTip: true,
          })),
        ],
        annotations: [
          ...visible.flatMap((a) => {
            const inView = (x: number, y: number) =>
              x > viewBox.x[0] && x < viewBox.x[1] && y > viewBox.y[0] && y < viewBox.y[1];
            const anns = a.extrema
              .filter((e) => inView(e.x, e.y))
              .map((e) => ({ x: e.x, y: e.y, text: e.type === 'min' ? 'min' : 'max' }));
            a.zeroPoints.forEach((z) => {
              if (inView(z, 0)) anns.push({ x: z, y: 0, text: '0' });
            });
            a.asymptotes.forEach((as) => {
              if (as.type === 'vertical') {
                const x = parseFloat(as.value.slice(4));
                if (x > viewBox.x[0] && x < viewBox.x[1]) {
                  anns.push({ x, y: viewBox.y[0] + (viewBox.y[1] - viewBox.y[0]) * 0.15, text: '渐近线' });
                }
              }
            });
            return anns;
          }),
          ...visibleVectors.flatMap((v) => {
            const tx = v.x + 0.25;
            const ty = v.y + 0.25;
            if (tx > viewBox.x[0] && tx < viewBox.x[1] && ty > viewBox.y[0] && ty < viewBox.y[1]) {
              return [{ x: tx, y: ty, text: v.name ? `${v.name}(${v.x},${v.y})` : `(${v.x},${v.y})` }];
            }
            return [];
          }),
        ],
      });
    } catch {
      /* 画图失败不崩溃 */
    }
  }, [analyses, vectors, hidden, resetKey, size, total]);

  const addVector = () => {
    const text = vecInput.trim();
    if (!text) return;
    const err = onAddVector(text);
    setVecError(err);
    if (!err) setVecInput('');
  };

  if (total === 0) {
    return (
      <div className="graph-panel">
        <div className="graph-toolbar">
          <button className="legend-btn danger" onClick={onClear} disabled>
            清空绘图
          </button>
        </div>
        <div className="func-input-row vector-input-row">
          <span className="func-input-label">向量</span>
          <input
            className={`func-input${vecError ? ' invalid' : ''}`}
            value={vecInput}
            placeholder="a=(3,2)，回车添加"
            onChange={(e) => {
              setVecInput(e.target.value);
              if (vecError) setVecError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addVector();
            }}
          />
        </div>
        {vecError && <div className="func-input-error">{vecError}</div>}
        <div className="graph-empty">
          未识别到函数或向量，可在左侧手动输入函数，或在下方输入向量，如 a=(3,2)
        </div>
      </div>
    );
  }

  return (
    <div className="graph-panel">
      <div className="graph-toolbar">
        {analyses.map((a, i) => (
          <button
            key={a.expression + '-' + i}
            className={`legend-btn ${hidden[a.expression] ? 'off' : ''}`}
            style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}
            onClick={() => setHidden((h) => ({ ...h, [a.expression]: !h[a.expression] }))}
          >
            {a.expression}
          </button>
        ))}
        {vectors.map((v, i) => (
          <button
            key={v.id}
            className={`legend-btn ${hidden[`v:${v.id}`] ? 'off' : ''}`}
            style={{ borderColor: COLORS[(analyses.length + i) % COLORS.length], color: COLORS[(analyses.length + i) % COLORS.length] }}
            onClick={() => setHidden((h) => ({ ...h, [`v:${v.id}`]: !h[`v:${v.id}`] }))}
          >
            {v.name ? `${v.name}=(${v.x},${v.y})` : `(${v.x},${v.y})`}
          </button>
        ))}
        <button className="legend-btn zoom" onClick={() => setResetKey((k) => k + 1)} title="重置视野">
          重置视野
        </button>
        <button className="legend-btn danger" onClick={onClear} disabled={total === 0} title="清空所有函数和向量">
          清空绘图
        </button>
      </div>
      <div className="func-input-row vector-input-row">
        <span className="func-input-label">向量</span>
        <input
          className={`func-input${vecError ? ' invalid' : ''}`}
          value={vecInput}
          placeholder="a=(3,2)，回车添加"
          onChange={(e) => {
            setVecInput(e.target.value);
            if (vecError) setVecError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addVector();
          }}
        />
      </div>
      {vecError && <div className="func-input-error">{vecError}</div>}
      <div className="graph-plot" ref={containerRef} />
      <div className="property-list">
        {analyses.map((a, i) => (
          <PropertyCard key={a.expression + '-' + i} analysis={a} />
        ))}
      </div>
    </div>
  );
}

function autoView(
  analyses: FunctionAnalysis[],
  vectors: VectorDef[],
): { x: [number, number]; y: [number, number] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const a of analyses) {
    a.zeroPoints.forEach((z) => {
      if (Math.abs(z) < 1e4) xs.push(z);
    });
    a.extrema.forEach((e) => {
      if (Math.abs(e.x) < 1e4 && Math.abs(e.y) < 1e6) {
        xs.push(e.x);
        ys.push(e.y);
      }
    });
  }
  for (const v of vectors) {
    if (Math.abs(v.x) < 1e4) xs.push(v.x);
    if (Math.abs(v.y) < 1e6) ys.push(v.y);
  }
  const pad = (v: number) => (Math.abs(v) > 20 ? Math.abs(v) * 1.2 : 5);
  const x0 = xs.length ? Math.min(...xs) : -10;
  const x1 = xs.length ? Math.max(...xs) : 10;
  const y0 = ys.length ? Math.min(...ys) : -10;
  const y1 = ys.length ? Math.max(...ys) : 10;
  const xc = (x0 + x1) / 2;
  const yc = (y0 + y1) / 2;
  const xr = Math.max(pad(x1 - x0), Math.abs(x0), Math.abs(x1), 5);
  const yr = Math.max(pad(y1 - y0), Math.abs(y0), Math.abs(y1), 5);
  const clamp = (v: number) => Math.max(5, Math.min(v, 50));
  return {
    x: [xc - clamp(xr), xc + clamp(xr)],
    y: [yc - clamp(yr), yc + clamp(yr)],
  };
}
```

注意：
- 空状态分支与主分支都渲染「清空按钮（禁用）+ 向量输入行 + 错误行」——空状态下仍可输入第一个向量；仅 graph-plot 与 property-list 只出现在主分支。
- `import '../core/vectorGraphType';` 触发注册（副作用导入）。
- 包类型 `graphType` 联合无 `'vector'`（`skipLibCheck` 掩盖扩充，Task 2 已删除本地 d.ts）：data 数组构造处整体 `as never` 断言一次传入（或 `as unknown as FunctionPlotDatum[]`），以 tsc 干净为准。

- [ ] **Step 4: 更新 DrawerPanel 透传**

修改 `src/components/DrawerPanel.tsx`：

- Props 接口改为：

```tsx
interface Props {
  analyses: FunctionAnalysis[];
  vectors: VectorDef[];
  onResize: (w: number) => void;
  onClose: () => void;
  onResizeEnd?: () => void;
  onClear: () => void;
  onAddVector: (input: string) => string | null;
}
```

- import 增加 `import type { FunctionAnalysis, VectorDef } from '../types';`
- `<GraphPanel analyses={analyses} vectors={vectors} onClear={onClear} onAddVector={onAddVector} />`

- [ ] **Step 5: 运行测试**

Run: `npx vitest run src/components/GraphPanel.test.tsx`
Expected: PASS（全部用例）。

- [ ] **Step 6: 提交**

```bash
git add src/components/GraphPanel.tsx src/components/GraphPanel.test.tsx src/components/DrawerPanel.tsx
git commit -m "feat: vector plotting and clear button in graph panel"
```

---

## Task 5: useChat.clearPlot + App 接线

**Files:**
- Modify: `src/hooks/useChat.ts`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: useChat 加 clearPlot**

在 `src/hooks/useChat.ts` 的 `retry` 定义后追加：

```ts
const clearPlot = useCallback(() => {
  patchActive((s) => ({
    ...s,
    messages: s.messages.map((m) => (m.analysis ? { ...m, analysis: undefined } : m)),
  }));
}, [patchActive]);
```

返回值对象中加 `clearPlot,`（在 `retry` 后）。

- [ ] **Step 2: App 接线**

修改 `src/App.tsx`：

1. import 增加：`import type { VectorDef } from './types';`、`import { parseVector } from './core/mathUtil';`（检查 App.tsx 现有 import 是否有 mathUtil 导入，合并）。
2. 状态（`manualAnalyses` 声明后）：

```ts
const [vectorDefs, setVectorDefs] = useState<VectorDef[]>([]);
```

3. 方法（`addManualFunction` 后）：

```ts
const addVector = (input: string): string | null => {
  const r = parseVector(input);
  if ('error' in r) return r.error;
  setVectorDefs((prev) => {
    const others = prev.filter(
      (v) => !(v.name && v.name === r.name) && !(!r.name && v.x === r.x && v.y === r.y),
    );
    return [...others, { id: `vector-${Date.now()}`, name: r.name, x: r.x, y: r.y }];
  });
  return null;
};

const handleClear = () => {
  chat.clearPlot();
  setManualAnalyses([]);
  setVectorDefs([]);
};
```

4. 自动展开计数扩展（`prevAnalysesCount` 处）：

```ts
const initialCount = [
  ...chat.messages.flatMap((m) => m.analysis ?? []),
  ...manualAnalyses,
].length + vectorDefs.length;
const prevAnalysesCount = useRef(initialCount);
useEffect(() => {
  const n = visibleAnalyses.length + vectorDefs.length;
  if (n > 0 && prevAnalysesCount.current === 0) setDrawerOpen(true);
  prevAnalysesCount.current = n;
}, [visibleAnalyses.length, vectorDefs.length]);
```

5. DrawerPanel 传参：

```tsx
<DrawerPanel
  analyses={visibleAnalyses}
  vectors={vectorDefs}
  width={drawerWidth}
  onResize={setDrawerWidth}
  onClose={() => setDrawerOpen(false)}
  onResizeEnd={persistDrawerWidth}
  onClear={handleClear}
  onAddVector={addVector}
/>
```

注意：`handleClear` 内调 `chat.clearPlot()` 会触发 sessions 变更 → debounce 持久化（Task 0 已确认此行为）。

- [ ] **Step 3: App.test 增加用例**

在 `src/App.test.tsx` 的 `vi.mock('function-plot', ...)` 改为：

```ts
vi.mock('function-plot', () => ({ default: vi.fn(), registerGraphType: vi.fn() }));
```

并在文件末尾 describe 内追加：

```tsx
it('向量输入后出现图例，非法输入显示错误', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
  const vecInput = screen.getByPlaceholderText(/回车添加/);
  await userEvent.type(vecInput, 'a=(3,2)');
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
  await userEvent.type(vecInput, 'bad');
  await userEvent.keyboard('{Enter}');
  expect(screen.getByText(/格式应为/)).toBeInTheDocument();
});

it('清空绘图清空函数与向量', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
  await userEvent.type(screen.getByPlaceholderText(/手动输入函数/), 'x^2');
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('button', { name: 'x^2' })).toBeInTheDocument();
  const vecInput = screen.getByPlaceholderText(/回车添加/);
  await userEvent.type(vecInput, 'a=(3,2)');
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('button', { name: 'a=(3,2)' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /清空绘图/ }));
  expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'x^2' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'a=(3,2)' })).toBeNull();
});

it('清空后重新提问可恢复分析曲线', async () => {
  mockedStream.mockImplementation(async function* () {
    yield '由题可得：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3"}]}\n<!-- /MATH_FUNCTIONS -->';
  });
  render(<App />);
  await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求单调区间');
  await userEvent.click(screen.getByRole('button', { name: /发送/ }));
  expect(await screen.findByText('奇偶性')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /清空绘图/ }));
  expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '再来一次');
  await userEvent.click(screen.getByRole('button', { name: /发送/ }));
  expect(await screen.findByText('奇偶性')).toBeInTheDocument();
});
```

注意：手动函数输入框 placeholder 是 `手动输入函数，如 x^2 - 2x - 3（回车即画图）`，用 `/手动输入函数/` 匹配。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useChat.ts src/App.tsx src/App.test.tsx
git commit -m "feat: wire vector state and clear handler through app"
```

---

## Task 6: CSS

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: 追加样式**

在 `src/styles/global.css` 的 `.legend-btn.zoom` 规则后追加：

```css
.legend-btn.danger { color: var(--danger) !important; border-color: var(--danger) !important; }
.legend-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.vector-input-row { margin: 0 10px; }
```

（`var(--danger)` 变量已存在于主题定义中——检查确认，若不存在则用 `#ef4444` 字面量。）

- [ ] **Step 2: 验证无编译问题**

Run: `npx tsc --noEmit`
Expected: 无错误（CSS 不参与 tsc，仅为习惯性确认）。

- [ ] **Step 3: 提交**

```bash
git add src/styles/global.css
git commit -m "style: clear button and vector input row"
```

---

## Task 7: 全量回归 + 冒烟更新

**Files:**
- Test: `C:\Users\QinYe\AppData\Local\Temp\opencode\smoke_mathmate2.py`（追加两条检查）

- [ ] **Step 1: 单元测试全量**

Run: `npx vitest run`
Expected: 全部 PASS（预计 90 + 新增 ≈ 100+）。

- [ ] **Step 2: 类型与构建**

Run: `npx tsc --noEmit`、`npm run build`
Expected: 均无错误。

- [ ] **Step 3: 冒烟脚本追加两条检查**

在 `smoke_mathmate2.py` 的测试列表中追加（沿用该文件的断言/截图模式）：

1. 「向量输入绘制」：点击 `函数图像` 标签打开抽屉 → 填充 `input[placeholder*='回车添加']` 为 `a=(3,2)` → 回车 → 断言 `button` 文本 `a=(3,2)` 可见 → 截图 `smoke_vector.png`。
2. 「清空绘图」：断言清空按钮初始禁用 → 添加向量后按钮可用 → 点击 `清空绘图` → 断言「未识别到函数」文本可见、`a=(3,2)` 图例消失 → 截图 `smoke_clear.png`。

预期 20 条旧检查 + 2 条新检查全部 PASS。

- [ ] **Step 4: 运行冒烟**

Run（workdir `C:\Users\QinYe\.agents\skills\webapp-testing`，python 用 `D:\Program Files\Python3.13\python.exe`）：

```
python scripts/with_server.py --server "npm run dev --prefix C:\Users\QinYe\Desktop\MathsMode" --port 5173 --timeout 60 -- python C:\Users\QinYe\AppData\Local\Temp\opencode\smoke_mathmate2.py
```

Expected: 22/22 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "test: extend smoke with vector and clear-button checks"
```

---

## Task 8: 文档收尾

**Files:**
- Modify: `docs/superpowers/plans/2026-08-05-vector-plot-clear-button.md`（本文件）
- Modify: `docs/superpowers/specs/2026-08-05-vector-plot-clear-button-design.md`

- [ ] **Step 1: 标记完成**

本文件标题下加：

```markdown
**Status:** 已实施（2026-08-05）。全量验证：vitest 全绿、tsc 干净、build 成功、Playwright 冒烟 22/22。
```

spec 末尾「范围外」一节后加：

```markdown
## 实施状态

2026-08-05 已实施。清空按钮持久化行为见 Task 0 修订。
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "docs: mark vector/clear-button plan and spec as implemented"
```

---

## 验证清单（最终）

- [ ] `npx vitest run` 全绿
- [ ] `npx tsc --noEmit` 无错误
- [ ] `npm run build` 成功
- [ ] Playwright 冒烟 22/22 PASS
- [ ] 截图：向量箭头、清空后空态
