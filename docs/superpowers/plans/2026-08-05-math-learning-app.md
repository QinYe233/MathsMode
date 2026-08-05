# 数学学习助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一个本地运行的 Web 数学学习应用：AI（OpenAI 兼容 API）解答数学题，涉及函数时自动画图并计算单调性/奇偶性/极值/零点/渐近线/周期/定义域。

**Architecture:** Vite + React + TS 单页应用。核心逻辑分独立纯函数模块（analysisEngine 各分析器 + aiClient + structuredParser + historyStore），UI 层（ChatPanel / GraphPanel / SettingsModal / HistorySidebar）通过 useChat hook 串联。AI 回复末尾携带 `<!-- MATH_FUNCTIONS -->` JSON 注释块，前端解析出函数表达式，交给本地分析引擎计算特性。

**Tech Stack:** Vite 5、React 18、TypeScript 5、mathjs（表达式解析/求导/求值）、function-plot（画图）、KaTeX（公式渲染）、Vitest + jsdom + Testing Library（测试）、localStorage（持久化）。

---

## 文件结构总览

```
MathsMode/
├── package.json / vite.config.ts / tsconfig.json / index.html / .gitignore
├── src/
│   ├── main.tsx / App.tsx / vite-env.d.ts
│   ├── types/function-plot.d.ts          # function-plot 无官方类型，声明模块
│   ├── types.ts                          # 共享类型
│   ├── core/
│   │   ├── mathUtil.ts                   # 表达式求值器 + 符号求导
│   │   ├── aiClient.ts                   # OpenAI 兼容 API 客户端（SSE 流式）
│   │   ├── structuredParser.ts           # 从 AI 回复提取函数定义
│   │   ├── historyStore.ts               # localStorage 会话持久化
│   │   ├── settingsStore.ts              # localStorage 设置持久化
│   │   └── analysisEngine/
│   │       ├── roots.ts                  # 数值求根
│   │       ├── domain.ts                 # 定义域推断
│   │       ├── parity.ts                 # 奇偶性
│   │       ├── monotonic.ts              # 单调性 + 极值
│   │       ├── asymptotes.ts             # 渐近线
│   │       ├── period.ts                 # 周期
│   │       └── index.ts                  # 编排 + 中文摘要
│   ├── hooks/useChat.ts
│   ├── components/
│   │   ├── ChatPanel.tsx / MessageBubble.tsx
│   │   ├── GraphPanel.tsx / PropertyCard.tsx
│   │   ├── SettingsModal.tsx / HistorySidebar.tsx
│   └── styles/global.css
└── src/test/setup.ts                     # 测试 setup
```

模块依赖方向：`analysisEngine/*` 只依赖 `mathUtil` + `types`（纯函数）；UI 依赖 core；core 不依赖 React。

---

### Task 0: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`（最小占位）
- Create: `src/vite-env.d.ts`
- Create: `src/types/function-plot.d.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "mathmate",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "function-plot": "^1.23.0",
    "katex": "^0.16.11",
    "mathjs": "^13.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/katex": "^0.16.7",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 写 vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 3: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 写 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>数学学习助手</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 写 .gitignore**

```
node_modules/
dist/
.superpowers/
*.local
```

- [ ] **Step 6: 写 src/vite-env.d.ts**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: 写 src/types/function-plot.d.ts**

```ts
declare module 'function-plot' {
  interface FunctionPlotOptions {
    target: HTMLElement;
    width?: number;
    height?: number;
    xAxis?: { domain?: [number, number]; label?: string };
    yAxis?: { domain?: [number, number]; label?: string };
    grid?: boolean;
    disableZoom?: boolean;
    tip?: { xLine?: boolean; yLine?: boolean };
    data?: { fn?: string; color?: string; graphType?: 'polyline' | 'scatter' }[];
    annotations?: { x?: number; y?: number; text: string }[];
  }
  export default function functionPlot(options: FunctionPlotOptions): void;
}
```

- [ ] **Step 8: 写 src/test/setup.ts**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 9: 写 src/main.tsx 和最小 App**

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```tsx
// src/App.tsx
export default function App() {
  return <div className="app">数学学习助手</div>;
}
```

```css
/* src/styles/global.css */
:root {
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #12141a;
  color: #e6e8ee;
  font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;
}
.app {
  display: grid;
  grid-template-columns: 44px 1fr 420px;
  height: 100vh;
}
```

- [ ] **Step 10: 安装依赖并验证**

Run: `npm install`
Expected: 安装成功无报错。

- [ ] **Step 11: 初始化 git 并提交**

```bash
git init
git add .
git commit -m "chore: scaffold vite react-ts project"
```

---

### Task 1: 共享类型 + 数学工具

**Files:**
- Create: `src/types.ts`
- Create: `src/core/mathUtil.ts`
- Test: `src/core/mathUtil.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/mathUtil.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeEvaluator, derivativeExpr } from './mathUtil';

describe('makeEvaluator', () => {
  it('计算多项式取值', () => {
    const f = makeEvaluator('x^2 - 2x - 3');
    expect(f(0)).toBe(-3);
    expect(f(1)).toBe(-4);
    expect(f(-1)).toBe(0);
  });
  it('非法输入返回 NaN 而不是抛错', () => {
    const f = makeEvaluator('log(x)');
    expect(f(-1)).toBeNaN();
  });
  it('除零返回 Infinity（不吞掉）', () => {
    const f = makeEvaluator('1/x');
    expect(f(0)).toBe(Infinity);
  });
});

describe('derivativeExpr', () => {
  it('符号求导', () => {
    expect(derivativeExpr('x^3')).toContain('3');
    expect(derivativeExpr('x^3')).toContain('x');
  });
  it('无法求导时返回空字符串', () => {
    expect(derivativeExpr('???')).toBe('');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/mathUtil.test.ts`
Expected: FAIL，找不到模块 ./mathUtil。

- [ ] **Step 3: 写 `src/types.ts`**

```ts
export interface Interval {
  lo: number;
  hi: number;
  loOpen: boolean;
  hiOpen: boolean;
}

export type Parity = 'odd' | 'even' | 'neither';

export interface MonotonicSegment {
  interval: string;
  trend: 'inc' | 'dec' | 'const';
}

export interface Extremum {
  x: number;
  y: number;
  type: 'max' | 'min';
}

export interface Asymptote {
  type: 'vertical' | 'horizontal' | 'oblique';
  value: string;
}

export interface FunctionAnalysis {
  expression: string;
  domain: Interval[];
  parity: Parity;
  monotonic: MonotonicSegment[];
  extrema: Extremum[];
  asymptotes: Asymptote[];
  period?: number;
  zeroPoints: number[];
  summary: string;
}

export interface FunctionDef {
  id: string;
  expr: string;
  domain?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  functions?: FunctionDef[];
  analysis?: FunctionAnalysis[];
  error?: boolean;
}

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  stream: boolean;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}
```

- [ ] **Step 4: 写 `src/core/mathUtil.ts`**

```ts
import { compile, derivative } from 'mathjs';

export function makeEvaluator(expr: string): (x: number) => number {
  let compiled: ReturnType<typeof compile>;
  try {
    compiled = compile(expr);
  } catch {
    return () => NaN;
  }
  return (x: number) => {
    try {
      const v = compiled.evaluate({ x });
      const n = Number(v);
      return Number.isNaN(n) ? NaN : n;
    } catch {
      return NaN;
    }
  };
}

export function derivativeExpr(expr: string): string {
  try {
    return derivative(expr, 'x').toString();
  } catch {
    return '';
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/core/mathUtil.test.ts`
Expected: PASS（3 个 describe 全绿）。

- [ ] **Step 6: 提交**

```bash
git add src/types.ts src/core/mathUtil.ts src/core/mathUtil.test.ts
git commit -m "feat: shared types and math evaluator"
```

---

### Task 2: 数值求根 roots.ts

**Files:**
- Create: `src/core/analysisEngine/roots.ts`
- Test: `src/core/analysisEngine/roots.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/analysisEngine/roots.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { findAllRoots } from './roots';

const within = (xs: number[], targets: number[], tol = 1e-5) => {
  for (const t of targets) {
    expect(xs.some((x) => Math.abs(x - t) < tol)).toBe(true);
  }
};

describe('findAllRoots', () => {
  it('二次函数两根', () => {
    const f = (x: number) => x * x - 2 * x - 3;
    const roots = findAllRoots(f, -100, 100);
    within(roots, [-1, 3]);
    expect(roots.every((r) => Math.abs(f(r)) < 1e-4)).toBe(true);
  });
  it('切点根（x^2 在 0）', () => {
    const f = (x: number) => x * x;
    const roots = findAllRoots(f, -100, 100);
    within(roots, [0]);
  });
  it('正切根有界（x^3 - x）', () => {
    const f = (x: number) => x * x * x - x;
    const roots = findAllRoots(f, -100, 100);
    within(roots, [-1, 0, 1]);
  });
  it('无根返回空数组（x^2+1）', () => {
    expect(findAllRoots((x) => x * x + 1, -100, 100)).toEqual([]);
  });
  it('不把极点当根（1/x）', () => {
    const f = (x: number) => 1 / x;
    expect(findAllRoots(f, -100, 100)).toEqual([]);
  });
  it('sin 的多个根且不重复', () => {
    const roots = findAllRoots(Math.sin, -10, 10);
    within(roots, [-3 * Math.PI, -2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI, 3 * Math.PI]);
    expect(roots.length).toBe(7);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/analysisEngine/roots.test.ts`
Expected: FAIL，找不到模块 ./roots。

- [ ] **Step 3: 写 `src/core/analysisEngine/roots.ts`**

```ts
export interface RootOptions {
  tolerance?: number;
  gridPoints?: number;
}

const DEFAULTS: Required<RootOptions> = { tolerance: 1e-9, gridPoints: 2000 };

export function findAllRoots(
  f: (x: number) => number,
  lo: number,
  hi: number,
  options?: RootOptions,
): number[] {
  const { tolerance, gridPoints } = { ...DEFAULTS, ...options };
  const roots: number[] = [];

  const push = (r: number) => {
    if (!Number.isFinite(r)) return;
    if (roots.some((p) => Math.abs(p - r) < 1e-6)) return;
    roots.push(r);
  };

  const verify = (r: number): boolean => {
    const eps = 1e-6;
    const scale = Math.max(1, Math.abs(f(r + eps)), Math.abs(f(r - eps)));
    const val = Math.abs(f(r));
    return val <= tolerance * scale * 10;
  };

  let prevX = lo;
  let prevY = f(lo);
  for (let i = 1; i <= gridPoints; i++) {
    const x = lo + ((hi - lo) * i) / gridPoints;
    const y = f(x);
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      if (prevY === 0) push(prevX);
      else if (y === 0) push(x);
      else if (prevY * y < 0) {
        let a = prevX;
        let b = x;
        let fa = prevY;
        let converged = false;
        for (let k = 0; k < 200; k++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (!Number.isFinite(fm)) break;
          if (fm === 0) {
            a = b = m;
            converged = true;
            break;
          }
          if (fa * fm < 0) {
            b = m;
          } else {
            a = m;
            fa = fm;
          }
          if (b - a < tolerance) {
            converged = true;
            break;
          }
        }
        if (converged && verify((a + b) / 2)) push((a + b) / 2);
      }
    } else if (Number.isFinite(y) && y === 0) {
      push(x);
    }
    prevX = x;
    prevY = y;
  }

  let cluster: number[] = [];
  const flushCluster = () => {
    if (cluster.length === 0) return;
    const c = cluster[Math.floor(cluster.length / 2)];
    const w = Math.max((hi - lo) / gridPoints, 1e-3);
    let a = c - w;
    let b = c + w;
    for (let k = 0; k < 120; k++) {
      const m1 = a + (b - a) / 3;
      const m2 = b - (b - a) / 3;
      if (Math.abs(f(m1)) < Math.abs(f(m2))) b = m2;
      else a = m1;
    }
    const r = (a + b) / 2;
    if (verify(r)) push(r);
    cluster = [];
  };

  for (let i = 0; i <= gridPoints; i++) {
    const x = lo + ((hi - lo) * i) / gridPoints;
    const y = f(x);
    if (Number.isFinite(y) && Math.abs(y) < 1e-4) cluster.push(x);
    else flushCluster();
  }
  flushCluster();

  roots.sort((p, q) => p - q);
  return roots;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/analysisEngine/roots.test.ts`
Expected: PASS（6 个 it 全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/core/analysisEngine/roots.ts src/core/analysisEngine/roots.test.ts
git commit -m "feat: numerical root finding with pole and tangency guards"
```

---

### Task 3: 定义域推断 domain.ts

**Files:**
- Create: `src/core/analysisEngine/domain.ts`
- Test: `src/core/analysisEngine/domain.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/analysisEngine/domain.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { inferDomain, inDomain, parseDomainString, fmtInterval } from './domain';

describe('inferDomain', () => {
  it('多项式为全体实数', () => {
    expect(fmtInterval(inferDomain('x^2 - 2x - 3'))).toEqual(['(−∞, +∞)']);
  });
  it('分式排除分母零点', () => {
    expect(fmtInterval(inferDomain('1/x'))).toEqual(['(−∞, 0)', '(0, +∞)']);
  });
  it('对数要求真数大于零', () => {
    expect(fmtInterval(inferDomain('log(x)'))).toEqual(['(0, +∞)']);
  });
  it('平方根要求被开方数非负', () => {
    expect(fmtInterval(inferDomain('sqrt(1 - x^2)'))).toEqual(['[-1, 1]']);
  });
  it('正切排除极点', () => {
    const ivs = inferDomain('tan(x)');
    expect(ivs.every((iv) => Math.abs(Math.cos((iv.lo + iv.hi) / 2)) > 0.5)).toBe(true);
    expect(ivs[0].lo).toBeLessThan(-1.5);
  });
});

describe('inDomain', () => {
  it('区间判定', () => {
    const ivs = inferDomain('1/x');
    expect(inDomain(-1, ivs)).toBe(true);
    expect(inDomain(0, ivs)).toBe(false);
    expect(inDomain(1, ivs)).toBe(true);
  });
});

describe('parseDomainString', () => {
  it('解析并集字符串', () => {
    const ivs = parseDomainString('(-inf, -1) ∪ (1, inf)');
    expect(ivs).not.toBeNull();
    expect(fmtInterval(ivs!)).toEqual(['(−∞, −1)', '(1, +∞)']);
  });
  it('非法字符串返回 null', () => {
    expect(parseDomainString('haha')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/analysisEngine/domain.test.ts`
Expected: FAIL，找不到模块 ./domain。

- [ ] **Step 3: 写 `src/core/analysisEngine/domain.ts`**

```ts
import { parse } from 'mathjs';
import { findAllRoots } from './roots';
import { makeEvaluator } from '../mathUtil';
import type { Interval } from '../../types';

export const INF = Number.POSITIVE_INFINITY;

interface Constraint {
  sub: string;
  kind: 'geq' | 'gt' | 'neq';
}

export function inferDomain(expr: string, domainStr?: string): Interval[] {
  if (domainStr) {
    const parsed = parseDomainString(domainStr);
    if (parsed) return parsed;
  }
  const constraints = collectConstraints(expr);
  if (constraints.length === 0) {
    return [{ lo: -INF, hi: INF, loOpen: true, hiOpen: true }];
  }
  let valid: Interval[] = [{ lo: -INF, hi: INF, loOpen: true, hiOpen: true }];
  for (const c of constraints) {
    const evalSub = makeEvaluator(c.sub);
    const roots = findAllRoots(evalSub, -1000, 1000, { gridPoints: 4000 });
    const regions: Interval[] = [];
    const probe = (x: number): number => {
      const v = evalSub(x);
      return Number.isFinite(v) ? v : NaN;
    };
    const sign = (x: number): number => (probe(x) > 0 ? 1 : -1);
    const prev = probe(-2000);
    if (Number.isFinite(prev) && prev > 0) {
      regions.push({ lo: -INF, hi: roots[0] ?? INF, loOpen: true, hiOpen: false });
    }
    for (let i = 0; i < roots.length; i++) {
      const a = roots[i];
      const b = roots[i + 1] ?? INF;
      const mid = Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : Number.isFinite(a) ? a + 1 : a - 1;
      const s = sign(mid);
      if (s > 0 || (s >= 0 && c.kind === 'geq' && mid === a)) {
        regions.push({ lo: a, hi: b, loOpen: true, hiOpen: true });
      }
    }
    const last = probe(2000);
    if (Number.isFinite(last) && last > 0) {
      regions.push({
        lo: roots.length ? roots[roots.length - 1] : -INF,
        hi: INF,
        loOpen: true,
        hiOpen: true,
      });
    }
    valid = intersectIntervals(valid, c.kind === 'neq' ? neqRegions(roots) : regions);
  }
  return valid;
}

function neqRegions(roots: number[]): Interval[] {
  const regions: Interval[] = [];
  let prev = -INF;
  for (const r of roots) {
    regions.push({ lo: prev, hi: r, loOpen: true, hiOpen: true });
    prev = r;
  }
  regions.push({ lo: prev, hi: INF, loOpen: true, hiOpen: true });
  return regions;
}

function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) {
    for (const y of b) {
      const lo = Math.max(x.lo, y.lo);
      const hi = Math.min(x.hi, y.hi);
      if (lo > hi || (lo === hi && (x.loOpen || y.loOpen || x.hiOpen || y.hiOpen))) continue;
      const loOpen = x.lo > y.lo ? x.loOpen : y.lo > x.lo ? y.loOpen : x.loOpen || y.loOpen;
      const hiOpen = x.hi < y.hi ? x.hiOpen : y.hi < x.hi ? y.hiOpen : x.hiOpen || y.hiOpen;
      out.push({ lo, hi, loOpen, hiOpen });
    }
  }
  return out;
}

export function inDomain(x: number, domain: Interval[]): boolean {
  return domain.some(
    (iv) =>
      (iv.loOpen ? x > iv.lo : x >= iv.lo) && (iv.hiOpen ? x < iv.hi : x <= iv.hi),
  );
}

function collectConstraints(expr: string): Constraint[] {
  const out: Constraint[] = [];
  let node: ReturnType<typeof parse>;
  try {
    node = parse(expr);
  } catch {
    return out;
  }
  const walk = (n: any) => {
    if (n.type === 'FunctionNode') {
      const name = String(n.fn?.name ?? '').toLowerCase();
      if (name === 'sqrt' && n.args?.[0]) out.push({ sub: n.args[0].toString(), kind: 'geq' });
      if ((name === 'log' || name === 'ln') && n.args?.[0]) out.push({ sub: n.args[0].toString(), kind: 'gt' });
      if (name === 'tan' && n.args?.[0]) out.push({ sub: `cos(${n.args[0].toString()})`, kind: 'neq' });
      n.args?.forEach(walk);
    } else if (n.type === 'OperatorNode' && n.op === '/' && n.args?.[1]) {
      out.push({ sub: n.args[1].toString(), kind: 'neq' });
      n.args.forEach(walk);
    } else {
      n.forEach?.(walk);
    }
  };
  walk(node);
  return out;
}

export function parseDomainString(s: string): Interval[] | null {
  const parts = s.split('∪').map((p) => p.trim());
  const out: Interval[] = [];
  for (const part of parts) {
    const m = part.match(/^([\[(])\s*([^,\]]+)\s*,\s*([^)\]]+)\s*([\])])$/);
    if (!m) return null;
    const loStr = m[2];
    const hiStr = m[3];
    const lo = loStr === '-inf' || loStr === '-∞' ? -INF : parseFloat(loStr);
    const hi = hiStr === 'inf' || hiStr === '∞' ? INF : parseFloat(hiStr);
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    out.push({ lo, hi, loOpen: m[1] === '(', hiOpen: m[4] === ')' });
  }
  return out.length ? out : null;
}

export function fmtNum(x: number): string {
  if (x === -INF) return '−∞';
  if (x === INF) return '+∞';
  return String(Math.round(x * 1e4) / 1e4);
}

export function fmtInterval(iv: Interval): string {
  return `${iv.loOpen ? '(' : '['}${fmtNum(iv.lo)}, ${fmtNum(iv.hi)}${iv.hiOpen ? ')' : ']'}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/analysisEngine/domain.test.ts`
Expected: PASS。若 `tan` 用例失败，检查 `collectConstraints` 对 `cos(x)` 的求根窗口内极点数量（应在 ±1000 内找到多个极点，`ivs[0].lo` 为最左极点 ≈ −1.5708 附近）。

- [ ] **Step 5: 提交**

```bash
git add src/core/analysisEngine/domain.ts src/core/analysisEngine/domain.test.ts
git commit -m "feat: structural domain inference with interval intersection"
```

---

### Task 4: 奇偶性 parity.ts

**Files:**
- Create: `src/core/analysisEngine/parity.ts`
- Test: `src/core/analysisEngine/parity.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/analysisEngine/parity.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { analyzeParity } from './parity';
import { inferDomain } from './domain';

const domain = (expr: string) => inferDomain(expr);

describe('analyzeParity', () => {
  it('偶函数', () => {
    expect(analyzeParity((x) => x * x, domain('x^2'))).toBe('even');
  });
  it('奇函数', () => {
    expect(analyzeParity((x) => x * x * x, domain('x^3'))).toBe('odd');
  });
  it('非奇非偶', () => {
    expect(analyzeParity((x) => x * x - 2 * x - 3, domain('x^2 - 2x - 3'))).toBe('neither');
  });
  it('定义域不对称 → neither（sqrt(x)）', () => {
    expect(analyzeParity((x) => Math.sqrt(x), domain('sqrt(x)'))).toBe('neither');
  });
  it('奇函数分式（1/x）', () => {
    expect(analyzeParity((x) => 1 / x, domain('1/x'))).toBe('odd');
  });
  it('正弦为奇函数', () => {
    expect(analyzeParity(Math.sin, domain('sin(x)'))).toBe('odd');
  });
  it('余弦为偶函数', () => {
    expect(analyzeParity(Math.cos, domain('cos(x)'))).toBe('even');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/analysisEngine/parity.test.ts`
Expected: FAIL，找不到模块 ./parity。

- [ ] **Step 3: 写 `src/core/analysisEngine/parity.ts`**

```ts
import type { Interval } from '../../types';
import type { Parity } from '../../types';
import { inDomain } from './domain';

export function analyzeParity(f: (x: number) => number, domain: Interval[]): Parity {
  if (!isSymmetric(domain)) return 'neither';
  const points = [0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 15];
  let even = true;
  let odd = true;
  let checked = 0;
  for (const x of points) {
    if (!inDomain(x, domain) || !inDomain(-x, domain)) continue;
    const fx = f(x);
    const fmx = f(-x);
    if (!Number.isFinite(fx) || !Number.isFinite(fmx)) continue;
    checked++;
    const scale = Math.max(1, Math.abs(fx), Math.abs(fmx));
    if (Math.abs(fx - fmx) > 1e-6 * scale) even = false;
    if (Math.abs(fx + fmx) > 1e-6 * scale) odd = false;
    if (!even && !odd) return 'neither';
  }
  if (checked === 0) return 'neither';
  if (even) return 'even';
  if (odd) return 'odd';
  return 'neither';
}

function isSymmetric(domain: Interval[]): boolean {
  const key = (iv: Interval) =>
    `${fmtK(-iv.hi)},${fmtK(-iv.lo)},${iv.hiOpen},${iv.loOpen}`;
  const set = new Set(domain.map(key));
  return domain.every((iv) => set.has(key(iv)));
}

function fmtK(x: number): string {
  if (x === Number.POSITIVE_INFINITY) return 'inf';
  if (x === Number.NEGATIVE_INFINITY) return '-inf';
  return String(Math.round(x * 1e6) / 1e6);
}
```

注意镜像判定：区间 `(a, b)` 的镜像应为 `(-b, -a)`，开放性也要互换（`loOpen` 与 `hiOpen` 交换）。上例 key 构造中 `-iv.hi` 对应镜像的 lo，`-iv.lo` 对应镜像的 hi，开放字段 `iv.hiOpen`（镜像 lo 的开放）= 原 hiOpen、`iv.loOpen`（镜像 hi 的开放）= 原 loOpen，正确。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/analysisEngine/parity.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/analysisEngine/parity.ts src/core/analysisEngine/parity.test.ts
git commit -m "feat: parity analysis with domain symmetry check"
```

---

### Task 5: 单调性与极值 monotonic.ts

**Files:**
- Create: `src/core/analysisEngine/monotonic.ts`
- Test: `src/core/analysisEngine/monotonic.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/analysisEngine/monotonic.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { analyzeMonotonic } from './monotonic';
import { inferDomain } from './domain';
import { findAllRoots } from './roots';
import { makeEvaluator, derivativeExpr } from '../mathUtil';

const analyze = (expr: string) => {
  const f = makeEvaluator(expr);
  const domain = inferDomain(expr);
  const fpExpr = derivativeExpr(expr);
  const fprime = makeEvaluator(fpExpr);
  const critical = findAllRoots(fprime, -1000, 1000);
  return analyzeMonotonic(fprime, f, critical, domain);
};

describe('analyzeMonotonic', () => {
  it('二次函数：先减后增，极值在 x=1', () => {
    const { segments, extrema } = analyze('x^2 - 2x - 3');
    expect(segments.map((s) => `${s.interval}:${s.trend}`)).toEqual([
      '(−∞, 1):dec',
      '(1, +∞):inc',
    ]);
    expect(extrema).toHaveLength(1);
    expect(extrema[0].type).toBe('min');
    expect(Math.abs(extrema[0].x - 1) < 1e-4).toBe(true);
    expect(Math.abs(extrema[0].y + 4) < 1e-4).toBe(true);
  });
  it('x^3 - 3x：两段增中间减，极大极小各一', () => {
    const { segments, extrema } = analyze('x^3 - 3x');
    expect(segments.map((s) => s.trend)).toEqual(['inc', 'dec', 'inc']);
    expect(extrema.some((e) => e.type === 'max')).toBe(true);
    expect(extrema.some((e) => e.type === 'min')).toBe(true);
  });
  it('1/x 两段都递减', () => {
    const { segments } = analyze('1/x');
    expect(segments.map((s) => s.trend)).toEqual(['dec', 'dec']);
  });
  it('常数函数为 const', () => {
    const { segments } = analyze('3');
    expect(segments).toEqual([{ interval: '(−∞, +∞)', trend: 'const' }]);
  });
  it('sin 在 (π/2, 3π/2) 递减', () => {
    const { segments } = analyze('sin(x)');
    expect(segments.some((s) => s.trend === 'dec' && s.interval.includes('1.5708'))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/analysisEngine/monotonic.test.ts`
Expected: FAIL，找不到模块 ./monotonic。

- [ ] **Step 3: 写 `src/core/analysisEngine/monotonic.ts`**

```ts
import type { Interval, MonotonicSegment, Extremum } from '../../types';
import { INF, fmtNum } from './domain';

export function analyzeMonotonic(
  fprime: (x: number) => number,
  f: (x: number) => number,
  criticalPoints: number[],
  domain: Interval[],
): { segments: MonotonicSegment[]; extrema: Extremum[] } {
  const breakpoints = new Set<number>(criticalPoints.filter(Number.isFinite));
  for (const iv of domain) {
    if (Number.isFinite(iv.lo)) breakpoints.add(iv.lo);
    if (Number.isFinite(iv.hi)) breakpoints.add(iv.hi);
  }
  const sorted = [...breakpoints].sort((a, b) => a - b);
  const windows: [number, number][] = [];
  if (sorted.length === 0) windows.push([-INF, INF]);
  else {
    windows.push([-INF, sorted[0]]);
    for (let i = 0; i + 1 < sorted.length; i++) windows.push([sorted[i], sorted[i + 1]]);
    windows.push([sorted[sorted.length - 1], INF]);
  }

  const segments: MonotonicSegment[] = [];
  for (const [a, b] of windows) {
    if (!overlapsDomain(a, b, domain)) continue;
    const mid = finiteMid(a, b);
    const signs: number[] = [];
    for (const m of [mid, mid + 1e-3, mid - 1e-3]) {
      const v = fprime(m);
      if (Number.isFinite(v)) signs.push(v);
    }
    if (signs.length === 0) continue;
    const avg = signs.reduce((s, v) => s + v, 0) / signs.length;
    const trend: MonotonicSegment['trend'] = avg > 1e-8 ? 'inc' : avg < -1e-8 ? 'dec' : 'const';
    segments.push({ interval: `(${fmtNum(a)}, ${fmtNum(b)})`, trend });
  }

  const extrema: Extremum[] = [];
  for (const c of sorted) {
    if (!Number.isFinite(c) || !interiorOfDomain(c, domain)) continue;
    const left = fprime(c - 1e-4);
    const right = fprime(c + 1e-4);
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    const y = f(c);
    if (!Number.isFinite(y)) continue;
    if (left < -1e-8 && right > 1e-8) extrema.push({ x: c, y, type: 'min' });
    else if (left > 1e-8 && right < -1e-8) extrema.push({ x: c, y, type: 'max' });
  }
  return { segments, extrema };
}

function overlapsDomain(a: number, b: number, domain: Interval[]): boolean {
  return domain.some((iv) => {
    const lo = Math.max(a, iv.lo);
    const hi = Math.min(b, iv.hi);
    if (lo >= hi) return false;
    return !(lo === iv.lo && iv.loOpen) || !(hi === iv.hi && iv.hiOpen);
  });
}

function interiorOfDomain(c: number, domain: Interval[]): boolean {
  return domain.some((iv) => {
    const loOk = iv.loOpen ? c > iv.lo + 1e-9 : c >= iv.lo + 1e-9;
    const hiOk = iv.hiOpen ? c < iv.hi - 1e-9 : c <= iv.hi - 1e-9;
    return loOk && hiOk;
  });
}

function finiteMid(a: number, b: number): number {
  if (a === -INF && b === INF) return 0;
  if (a === -INF) return b - 1;
  if (b === INF) return a + 1;
  return (a + b) / 2;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/analysisEngine/monotonic.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/analysisEngine/monotonic.ts src/core/analysisEngine/monotonic.test.ts
git commit -m "feat: monotonicity segments and extrema from derivative sign"
```

---

### Task 6: 渐近线 asymptotes.ts

**Files:**
- Create: `src/core/analysisEngine/asymptotes.ts`
- Test: `src/core/analysisEngine/asymptotes.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/analysisEngine/asymptotes.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { analyzeAsymptotes } from './asymptotes';
import { inferDomain } from './domain';
import { makeEvaluator } from '../mathUtil';

const analyze = (expr: string) => {
  const f = makeEvaluator(expr);
  return analyzeAsymptotes(f, inferDomain(expr));
};

describe('analyzeAsymptotes', () => {
  it('1/x：垂直 x=0 与水平 y=0', () => {
    const as = analyze('1/x');
    expect(as.some((a) => a.type === 'vertical' && a.value.includes('0'))).toBe(true);
    expect(as.some((a) => a.type === 'horizontal' && a.value.includes('0'))).toBe(true);
  });
  it('1/(x-2)：垂直 x=2', () => {
    const as = analyze('1/(x - 2)');
    expect(as.some((a) => a.type === 'vertical' && a.value.includes('2'))).toBe(true);
  });
  it('log(x)：垂直 x=0', () => {
    const as = analyze('log(x)');
    expect(as.some((a) => a.type === 'vertical')).toBe(true);
  });
  it('(x^2+1)/x：斜渐近线 y=x', () => {
    const as = analyze('(x^2 + 1)/x');
    const obl = as.find((a) => a.type === 'oblique');
    expect(obl).toBeDefined();
    expect(obl!.value.replace(/\s+/g, '').startsWith('y=x')).toBe(true);
  });
  it('二次函数无渐近线', () => {
    expect(analyze('x^2 - 2x - 3')).toEqual([]);
  });
  it('tan 有垂直渐近线', () => {
    const as = analyze('tan(x)');
    expect(as.some((a) => a.type === 'vertical')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/analysisEngine/asymptotes.test.ts`
Expected: FAIL，找不到模块 ./asymptotes。

- [ ] **Step 3: 写 `src/core/analysisEngine/asymptotes.ts`**

```ts
import type { Interval, Asymptote } from '../../types';

const EPS_BIG = 1e-6;
const EPS_TINY = 1e-12;

export function analyzeAsymptotes(f: (x: number) => number, domain: Interval[]): Asymptote[] {
  const out: Asymptote[] = [];

  for (const iv of domain) {
    if (Number.isFinite(iv.lo) && iv.loOpen && diverges(f, iv.lo, 1)) {
      out.push({ type: 'vertical', value: `x = ${round(iv.lo)}` });
    }
    if (Number.isFinite(iv.hi) && iv.hiOpen && diverges(f, iv.hi, -1)) {
      out.push({ type: 'vertical', value: `x = ${round(iv.hi)}` });
    }
  }

  for (const p of findPoles(f)) {
    if (!out.some((a) => a.type === 'vertical' && Math.abs(parseFloat(a.value.slice(4)) - p) < 1e-3)) {
      out.push({ type: 'vertical', value: `x = ${round(p)}` });
    }
  }

  for (const side of [1, -1] as const) {
    const x1 = side * 1e8;
    const x2 = side * 1e12;
    const f1 = f(x1);
    const f2 = f(x2);
    if (!Number.isFinite(f1) || !Number.isFinite(f2)) continue;
    if (Math.abs(f1 - f2) < 1e-4 && Math.abs(f1) < 1e6) {
      out.push({ type: 'horizontal', value: `y = ${round(f1)}` });
      continue;
    }
    const k1 = f1 / x1;
    const k2 = f2 / x2;
    if (Number.isFinite(k1) && Number.isFinite(k2) && Math.abs(k1 - k2) < 1e-8 && Math.abs(k1) < 1e3) {
      const b = f2 - k2 * x2;
      if (Number.isFinite(b) && Math.abs(b) < 1e8) {
        out.push({ type: 'oblique', value: formatOblique(k1, b) });
      }
    }
  }
  return out;
}

function diverges(f: (x: number) => number, c: number, dir: 1 | -1): boolean {
  const a = f(c + dir * EPS_BIG);
  const s = f(c + dir * EPS_TINY);
  if (!Number.isFinite(a) || !Number.isFinite(s)) return Number.isFinite(s) || true;
  return Math.abs(s) > Math.abs(a) * 1.5 && Math.abs(s) > 1e-3;
}

function findPoles(f: (x: number) => number): number[] {
  const poles: number[] = [];
  const step = 0.02;
  let cluster: number[] = [];
  for (let x = -1000; x <= 1000; x += step) {
    const v = f(x);
    if (Number.isFinite(v) && Math.abs(v) > 1e4) cluster.push(x);
    else if (cluster.length) {
      poles.push(refinePole(f, cluster, step));
      cluster = [];
    }
  }
  if (cluster.length) poles.push(refinePole(f, cluster, step));
  return poles.filter((p) => Math.abs(p) < 1000);
}

function refinePole(f: (x: number) => number, cluster: number[], step: number): number {
  const c = cluster[Math.floor(cluster.length / 2)];
  let a = c - step;
  let b = c + step;
  for (let k = 0; k < 80; k++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (Math.abs(f(m1)) > Math.abs(f(m2))) a = m1;
    else b = m2;
  }
  const p = (a + b) / 2;
  const s = Math.abs(f(p - 1e-9)) + Math.abs(f(p + 1e-9));
  return s > 1e8 ? p : NaN;
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function formatOblique(k: number, b: number): string {
  const kStr = Math.abs(k - 1) < 1e-6 ? '' : `${round(k)}`;
  const bPart = Math.abs(b) < 1e-6 ? '' : `${b >= 0 ? '+' : '-'} ${round(Math.abs(b))}`;
  return `y = ${kStr}x${bPart ? ` ${bPart}` : ''}`.trim().replace(/\s+/g, ' ');
}
```

注意：`diverges` 中对 `!Number.isFinite(a)` 时直接返回 true 会让 sqrt(1-x²) 边界被误判——检查：f(1 - 1e-6) 有限、f(1 - 1e-12) 有限，两者都有限 → 走正常分支 → |1.4e-6| > |1.4e-3|*1.5 为 false → 不是渐近线 ✓。而 log(x) 在 0：f(1e-6) = −13.8、f(1e-12) = −27.6 → |−27.6| > |−13.8|·1.5=20.7 ✓ 且 > 1e-3 ✓ → 垂直渐近线 ✓。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/analysisEngine/asymptotes.test.ts`
Expected: PASS。若 tan 用例失败（极点检测），检查 `findPoles` 阈值（tan 极点处 |f| 极大，应命中）。

- [ ] **Step 5: 提交**

```bash
git add src/core/analysisEngine/asymptotes.ts src/core/analysisEngine/asymptotes.test.ts
git commit -m "feat: asymptote detection (vertical/horizontal/oblique)"
```

---

### Task 7: 周期 period.ts

**Files:**
- Create: `src/core/analysisEngine/period.ts`
- Test: `src/core/analysisEngine/period.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/analysisEngine/period.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { analyzePeriod } from './period';
import { inferDomain } from './domain';
import { makeEvaluator } from '../mathUtil';

const analyze = (expr: string) => {
  const f = makeEvaluator(expr);
  return analyzePeriod(expr, f, inferDomain(expr));
};

describe('analyzePeriod', () => {
  it('sin(x) → 2π', () => {
    expect(Math.abs(analyze('sin(x)')! - 2 * Math.PI) < 1e-6).toBe(true);
  });
  it('cos(2x) → π', () => {
    expect(Math.abs(analyze('cos(2x)')! - Math.PI) < 1e-6).toBe(true);
  });
  it('tan(x) → π', () => {
    expect(Math.abs(analyze('tan(x)')! - Math.PI) < 1e-6).toBe(true);
  });
  it('sin(x) + sin(3x) → 2π（最小公倍数）', () => {
    expect(Math.abs(analyze('sin(x) + sin(3x)')! - 2 * Math.PI) < 1e-6).toBe(true);
  });
  it('非周期函数返回 undefined', () => {
    expect(analyze('x^2')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/analysisEngine/period.test.ts`
Expected: FAIL，找不到模块 ./period。

- [ ] **Step 3: 写 `src/core/analysisEngine/period.ts`**

```ts
import { parse } from 'mathjs';
import type { Interval } from '../../types';
import { inDomain } from './domain';

export function analyzePeriod(
  expr: string,
  f: (x: number) => number,
  domain: Interval[],
): number | undefined {
  const trig = collectTrig(expr);
  if (trig.length > 0) {
    let period: number | undefined;
    for (const [name, arg] of trig) {
      const a = linearCoeff(arg);
      if (a === undefined || a === 0) return undefined;
      const base = name === 'tan' ? Math.PI : 2 * Math.PI;
      const T = base / Math.abs(a);
      period = period === undefined ? T : lcmApprox(period, T);
      if (period === undefined) return undefined;
    }
    return period;
  }
  const candidates = [2 * Math.PI, Math.PI, (2 / 3) * Math.PI, Math.PI / 2, 4, 2, 1, 0.5];
  for (const T of candidates) {
    if (isPeriod(f, T, domain)) return T;
  }
  return undefined;
}

function collectTrig(expr: string): [string, string][] {
  const out: [string, string][] = [];
  let node: ReturnType<typeof parse>;
  try {
    node = parse(expr);
  } catch {
    return out;
  }
  const walk = (n: any) => {
    if (n.type === 'FunctionNode') {
      const name = String(n.fn?.name ?? '').toLowerCase();
      if ((name === 'sin' || name === 'cos' || name === 'tan') && n.args?.[0]) {
        out.push([name, n.args[0].toString()]);
      }
      n.args?.forEach(walk);
    } else {
      n.forEach?.(walk);
    }
  };
  walk(node);
  return out;
}

function linearCoeff(arg: string): number | undefined {
  try {
    const n = parse(arg);
    const getX = (node: any): number | undefined => {
      if (node.type === 'SymbolNode') return node.name === 'x' ? 1 : undefined;
      if (node.type === 'OperatorNode' && node.op === '*') {
        const [l, r] = node.args;
        const lv = l.type === 'ConstantNode' ? Number(l.value) : undefined;
        const rv = r.type === 'SymbolNode' && r.name === 'x' ? 1 : undefined;
        if (lv !== undefined && rv !== undefined) return lv;
        const lv2 = l.type === 'SymbolNode' && l.name === 'x' ? 1 : undefined;
        const rv2 = r.type === 'ConstantNode' ? Number(r.value) : undefined;
        if (lv2 !== undefined && rv2 !== undefined) return rv2;
      }
      return undefined;
    };
    if (n.type === 'OperatorNode' && (n.op === '+' || n.op === '-')) {
      const a = getX(n.args[0]);
      const b = getX(n.args[1]);
      if (a !== undefined && b === undefined) return a;
      if (a === undefined && b !== undefined) return n.op === '+' ? b : -b;
      if (a !== undefined && b !== undefined) return n.op === '+' ? a + b : a - b;
      return undefined;
    }
    return getX(n);
  } catch {
    return undefined;
  }
}

function lcmApprox(a: number, b: number): number | undefined {
  for (let m = 1; m <= 30; m++) {
    for (let n = 1; n <= 30; n++) {
      if (Math.abs(m * a - n * b) < 1e-6 * Math.max(m * a, n * b)) {
        return m * a;
      }
    }
  }
  return undefined;
}

function isPeriod(f: (x: number) => number, T: number, domain: Interval[]): boolean {
  let checked = 0;
  for (let i = 0; i < 30; i++) {
    const x = -10 + i * 0.7;
    if (!inDomain(x, domain) || !inDomain(x + T, domain)) continue;
    const a = f(x);
    const b = f(x + T);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    checked++;
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    if (Math.abs(a - b) > 1e-6 * scale) return false;
  }
  return checked >= 10;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/analysisEngine/period.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/analysisEngine/period.ts src/core/analysisEngine/period.test.ts
git commit -m "feat: period detection (structural trig + numeric fallback)"
```

---

### Task 8: 分析引擎编排 index.ts

**Files:**
- Create: `src/core/analysisEngine/index.ts`
- Test: `src/core/analysisEngine/index.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/analysisEngine/index.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { analyzeFunction } from './index';

describe('analyzeFunction', () => {
  it('二次函数完整分析', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    expect(a.parity).toBe('neither');
    expect(a.monotonic.map((s) => `${s.interval}:${s.trend}`)).toEqual([
      '(−∞, 1):dec',
      '(1, +∞):inc',
    ]);
    expect(a.extrema).toHaveLength(1);
    expect(Math.abs(a.extrema[0].x - 1) < 1e-4).toBe(true);
    expect(a.zeroPoints.some((z) => Math.abs(z + 1) < 1e-4)).toBe(true);
    expect(a.zeroPoints.some((z) => Math.abs(z - 3) < 1e-4)).toBe(true);
    expect(a.asymptotes).toEqual([]);
    expect(a.period).toBeUndefined();
    expect(a.summary).toContain('单调');
  });

  it('1/x：奇函数、渐近线、无零点', () => {
    const a = analyzeFunction({ id: 'f', expr: '1/x' });
    expect(a.parity).toBe('odd');
    expect(a.asymptotes.some((x) => x.type === 'vertical')).toBe(true);
    expect(a.asymptotes.some((x) => x.type === 'horizontal')).toBe(true);
    expect(a.zeroPoints).toEqual([]);
  });

  it('sin(x)：奇函数、周期 2π、有零点', () => {
    const a = analyzeFunction({ id: 'f', expr: 'sin(x)' });
    expect(a.parity).toBe('odd');
    expect(Math.abs(a.period! - 2 * Math.PI) < 1e-6).toBe(true);
    expect(a.zeroPoints.length).toBeGreaterThan(3);
  });

  it('log(x)：定义域 (0, +∞)，单调递增', () => {
    const a = analyzeFunction({ id: 'f', expr: 'log(x)' });
    expect(a.parity).toBe('neither');
    expect(a.monotonic.every((s) => s.trend === 'inc')).toBe(true);
    expect(a.zeroPoints.some((z) => Math.abs(z - 1) < 1e-4)).toBe(true);
  });

  it('x^2：偶函数，极小值在 0', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2' });
    expect(a.parity).toBe('even');
    expect(a.extrema.some((e) => e.type === 'min' && Math.abs(e.x) < 1e-4)).toBe(true);
  });

  it('AI 提供定义域时使用之', () => {
    const a = analyzeFunction({ id: 'f', expr: '1/x', domain: '(0, inf)' });
    expect(a.domain).toHaveLength(1);
    expect(a.domain[0].lo).toBe(0);
    expect(a.parity).toBe('neither');
  });

  it('常量函数', () => {
    const a = analyzeFunction({ id: 'f', expr: '3' });
    expect(a.monotonic).toEqual([{ interval: '(−∞, +∞)', trend: 'const' }]);
    expect(a.parity).toBe('even');
    expect(a.zeroPoints).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/analysisEngine/index.test.ts`
Expected: FAIL，找不到模块 ./index。

- [ ] **Step 3: 写 `src/core/analysisEngine/index.ts`**

```ts
import { makeEvaluator, derivativeExpr } from '../mathUtil';
import { findAllRoots } from './roots';
import { inferDomain, fmtInterval } from './domain';
import type { Interval } from '../../types';
import { analyzeParity } from './parity';
import { analyzeMonotonic } from './monotonic';
import type { MonotonicSegment, Extremum } from '../../types';
import { analyzeAsymptotes } from './asymptotes';
import { analyzePeriod } from './period';
import type { FunctionAnalysis, FunctionDef, Asymptote, Parity } from '../../types';

export function analyzeFunction(def: FunctionDef): FunctionAnalysis {
  const expr = def.expr.trim();
  const raw = makeEvaluator(expr);
  const f = (x: number) => (Number.isFinite(raw(x)) ? raw(x) : NaN);

  const domain = safe(() => inferDomain(expr, def.domain), [
    { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true },
  ]);
  const parity = safe(() => analyzeParity(f, domain), 'neither' as Parity);

  let monotonic: MonotonicSegment[] = [];
  let extrema: Extremum[] = [];
  const fpExpr = derivativeExpr(expr);
  if (fpExpr) {
    const rawp = makeEvaluator(fpExpr);
    const fprime = (x: number) => (Number.isFinite(rawp(x)) ? rawp(x) : NaN);
    const critical = safe(() => findAllRoots(fprime, -1000, 1000), []);
    const mono = safe(() => analyzeMonotonic(fprime, f, critical, domain), {
      segments: [],
      extrema: [],
    });
    monotonic = mono.segments;
    extrema = mono.extrema;
  }

  const zeroPoints = safe(
    () => findAllRoots(f, -1000, 1000).filter((z) => Math.abs(f(z)) < 1e-4),
    [],
  );
  const asymptotes = safe(() => analyzeAsymptotes(f, domain), [] as Asymptote[]);
  const period = safe(() => analyzePeriod(expr, f, domain), undefined);

  const summary = buildSummary(parity, monotonic, extrema, asymptotes, period, zeroPoints, domain);
  return {
    expression: expr,
    domain,
    parity,
    monotonic,
    extrema,
    asymptotes,
    period,
    zeroPoints,
    summary,
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function buildSummary(
  parity: Parity,
  monotonic: MonotonicSegment[],
  extrema: Extremum[],
  asymptotes: Asymptote[],
  period: number | undefined,
  zeroPoints: number[],
  domain: Interval[],
): string {
  const parts: string[] = [];
  parts.push(`定义域：${domain.map(fmtInterval).join(' ∪ ')}`);
  parts.push(`奇偶性：${parity === 'odd' ? '奇函数' : parity === 'even' ? '偶函数' : '非奇非偶'}`);
  if (monotonic.length) {
    const map = { inc: '递增', dec: '递减', const: '不变' } as const;
    parts.push(`单调性：${monotonic.map((s) => `${s.interval} 上${map[s.trend]}`).join('，')}`);
  }
  if (extrema.length) {
    parts.push(
      `极值：${extrema
        .map((e) => `x=${round(e.x)} 处${e.type === 'min' ? '最小值' : '最大值'} ${round(e.y)}`)
        .join('，')}`,
    );
  }
  if (zeroPoints.length) {
    parts.push(`零点：x = ${zeroPoints.map((z) => round(z)).join('、')}`);
  }
  if (asymptotes.length) {
    parts.push(`渐近线：${asymptotes.map((a) => a.value).join('，')}`);
  }
  if (period !== undefined) {
    parts.push(`最小正周期：${round(period)}`);
  }
  return parts.join('；') + '。';
}

function round(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/analysisEngine/index.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/analysisEngine/index.ts src/core/analysisEngine/index.test.ts
git commit -m "feat: analysis engine orchestrator with chinese summary"
```

---

### Task 9: AI 客户端 aiClient.ts

**Files:**
- Create: `src/core/aiClient.ts`
- Test: `src/core/aiClient.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/aiClient.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamChat, ApiError } from './aiClient';

const settings = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  stream: true,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sseResponse = (chunks: string[]) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
};

afterEach(() => vi.restoreAllMocks());

describe('streamChat', () => {
  it('流式模式：逐段产出内容', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    );
    const out: string[] = [];
    for await (const piece of streamChat([{ role: 'user', content: 'hi' }], settings)) {
      out.push(piece);
    }
    expect(out).toEqual(['你', '好']);
  });

  it('非流式模式：一次性产出', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '完整回答' } }] }),
      ),
    );
    const out: string[] = [];
    for await (const piece of streamChat([{ role: 'user', content: 'hi' }], { ...settings, stream: false })) {
      out.push(piece);
    }
    expect(out).toEqual(['完整回答']);
  });

  it('HTTP 错误抛出 ApiError 且带状态码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Invalid API key' } }, 401)),
    );
    await expect(
      (async () => {
        for await (const _ of streamChat([{ role: 'user', content: 'hi' }], settings)) {
          /* noop */
        }
      })(),
    ).rejects.toMatchObject({ status: 401, name: 'ApiError' });
  });

  it('网络失败抛出 ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      (async () => {
        for await (const _ of streamChat([{ role: 'user', content: 'hi' }], settings)) {
          /* noop */
        }
      })(),
    ).rejects.toMatchObject({ name: 'ApiError' });
  });

  it('请求体包含 system prompt 与消息', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: '' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    for await (const _ of streamChat([{ role: 'user', content: 'x^2 的零点' }], { ...settings, stream: false })) {
      /* noop */
    }
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('x^2 的零点');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/aiClient.test.ts`
Expected: FAIL，找不到模块 ./aiClient。

- [ ] **Step 3: 写 `src/core/aiClient.ts`**

```ts
import type { AISettings } from '../types';

export const SYSTEM_PROMPT = `你是一位资深高中数学老师。请用中文解答学生的数学问题，步骤清晰，适当使用 LaTeX 公式（$...$ 行内，$$...$$ 独立成行）。

如果题目涉及函数（或你推导出需要画出函数图像辅助理解），在解答的最末尾附加如下 JSON 注释块（不含任何其他内容）：
<!-- MATH_FUNCTIONS -->
{"functions": [{"id": "f", "expr": "表达式", "domain": "(-inf, inf)"}]}
<!-- /MATH_FUNCTIONS -->

规则：
- expr 必须是 mathjs 兼容表达式，自变量为 x。支持 + - * / ^ 幂运算、括号、sin cos tan log（自然对数）exp sqrt abs 与常数 pi。
- 例：f(x)=x²-2x-3 写作 "x^2 - 2x - 3"；f(x)=1/(x-1) 写作 "1/(x - 1)"。
- domain 可选，默认全体实数；有特殊定义域时给出区间并集，如 "(-inf, -1) ∪ (1, inf)"，inf 表示无穷。
- 多个函数（如比较题）就输出多个对象。
- 题目不涉及函数时，不要输出该块。`;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

export async function* streamChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings: AISettings,
): AsyncGenerator<string> {
  const url = `${normalizeBase(settings.baseUrl)}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: settings.stream,
        temperature: 0.3,
      }),
    });
  } catch {
    throw new ApiError('网络错误，请检查网络连接或 Base URL 设置');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    throw new ApiError(detail ? `API 错误 (${res.status})：${detail}` : `API 错误 (${res.status})`, res.status);
  }

  if (!settings.stream) {
    const data = await res.json();
    yield data?.choices?.[0]?.message?.content ?? '';
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new ApiError('响应流不可用');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') yield delta;
      } catch {
        /* skip malformed chunk */
      }
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/aiClient.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/aiClient.ts src/core/aiClient.test.ts
git commit -m "feat: openai-compatible streaming chat client"
```

---

### Task 10: 结构化解析 structuredParser.ts

**Files:**
- Create: `src/core/structuredParser.ts`
- Test: `src/core/structuredParser.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/structuredParser.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { extractFunctions } from './structuredParser';

describe('extractFunctions', () => {
  it('解析完整 MATH_FUNCTIONS 块', () => {
    const reply = `解答如下：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3", "domain": "(-inf, inf)"}]}\n<!-- /MATH_FUNCTIONS -->`;
    const defs = extractFunctions(reply);
    expect(defs).toHaveLength(1);
    expect(defs[0].expr).toBe('x^2 - 2x - 3');
    expect(defs[0].domain).toBe('(-inf, inf)');
  });

  it('解析多函数块', () => {
    const reply = `<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2"}, {"id": "g", "expr": "x + 1"}]}\n<!-- /MATH_FUNCTIONS -->`;
    expect(extractFunctions(reply)).toHaveLength(2);
  });

  it('块损坏时用正则兜底提取 f(x)=', () => {
    const reply = `因为 f(x)=x^2-2x-3 且 g(x)=x+1，所以…`;
    const defs = extractFunctions(reply);
    expect(defs.length).toBeGreaterThanOrEqual(1);
    expect(defs[0].expr.replace(/\s+/g, '')).toBe('x^2-2x-3');
  });

  it('无函数时返回空数组', () => {
    expect(extractFunctions('这是一道概率题，不涉及函数。')).toEqual([]);
  });

  it('Unicode 符号归一化（× ÷ − π）', () => {
    const reply = `<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 − 3×x ÷ 2 + π"}]}\n<!-- /MATH_FUNCTIONS -->`;
    const defs = extractFunctions(reply);
    expect(defs[0].expr).toBe('x^2-3*x/2+pi');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/structuredParser.test.ts`
Expected: FAIL，找不到模块 ./structuredParser。

- [ ] **Step 3: 写 `src/core/structuredParser.ts`**

```ts
import type { FunctionDef } from '../types';

const BLOCK_RE = /<!--\s*MATH_FUNCTIONS\s*-->([\s\S]*?)<!--\s*\/MATH_FUNCTIONS\s*-->/;
const FN_RE = /(?:f|g|h)\s*\(\s*x\s*\)\s*=\s*([^,\n]{1,80})/g;

export function extractFunctions(reply: string): FunctionDef[] {
  const block = reply.match(BLOCK_RE);
  if (block) {
    try {
      const data = JSON.parse(block[1].trim());
      if (data && Array.isArray(data.functions)) {
        const defs = data.functions.filter(
          (d: unknown) =>
            typeof (d as { expr?: unknown })?.expr === 'string' &&
            (d as { expr: string }).expr.trim().length > 0,
        );
        if (defs.length > 0) {
          return defs.map((d: { id?: string; expr: string; domain?: string }, i: number) => ({
            id: d.id ?? `f${i + 1}`,
            expr: normalizeExpr(d.expr),
            domain: typeof d.domain === 'string' ? d.domain : undefined,
          }));
        }
      }
    } catch {
      /* fall through to regex */
    }
  }

  const fallback: FunctionDef[] = [];
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = FN_RE.exec(reply)) !== null && count < 3) {
    fallback.push({ id: `f${count + 1}`, expr: normalizeExpr(m[1].trim()) });
    count++;
  }
  return fallback;
}

function normalizeExpr(expr: string): string {
  return expr
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/\s+/g, '');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/structuredParser.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/structuredParser.ts src/core/structuredParser.test.ts
git commit -m "feat: extract function defs from AI reply with fallbacks"
```

---

### Task 11: 会话存储 historyStore.ts

**Files:**
- Create: `src/core/historyStore.ts`
- Test: `src/core/historyStore.test.ts`

- [ ] **Step 1: 写失败测试 `src/core/historyStore.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { historyStore } from './historyStore';

describe('historyStore', () => {
  beforeEach(() => localStorage.clear());

  it('空存储返回空数组', () => {
    expect(historyStore.load()).toEqual([]);
  });

  it('保存后可加载（往返）', () => {
    const s = historyStore.create();
    s.title = '二次函数';
    s.messages.push({ role: 'user', content: '求零点' });
    historyStore.save([s]);
    const loaded = historyStore.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('二次函数');
    expect(loaded[0].messages[0].content).toBe('求零点');
  });

  it('损坏的 JSON 返回空数组而不是抛错', () => {
    localStorage.setItem('mathmate.sessions.v1', '{bad json');
    expect(historyStore.load()).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/historyStore.test.ts`
Expected: FAIL，找不到模块 ./historyStore。

- [ ] **Step 3: 写 `src/core/historyStore.ts`**

```ts
import type { Session } from '../types';

const KEY = 'mathmate.sessions.v1';

export const historyStore = {
  load(): Session[] {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Session[]) : [];
    } catch {
      return [];
    }
  },
  save(sessions: Session[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(sessions));
    } catch {
      /* storage full or unavailable — ignore */
    }
  },
  create(): Session {
    return {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: '新会话',
      createdAt: Date.now(),
      messages: [],
    };
  },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/historyStore.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/historyStore.ts src/core/historyStore.test.ts
git commit -m "feat: localStorage session persistence"
```

---

### Task 12: 聊天 UI（ChatPanel + MessageBubble + useChat）

**Files:**
- Create: `src/hooks/useChat.ts`
- Create: `src/components/MessageBubble.tsx`
- Create: `src/components/ChatPanel.tsx`
- Test: `src/components/ChatPanel.test.tsx`

- [ ] **Step 1: 写失败测试 `src/components/ChatPanel.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  it('渲染历史消息与输入框', () => {
    render(
      <ChatPanel
        messages={[{ role: 'user', content: 'x^2 的零点？' }]}
        loading={false}
        onSend={() => {}}
      />,
    );
    expect(screen.getByText('x^2 的零点？')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/输入数学问题/)).toBeInTheDocument();
  });

  it('发送消息触发 onSend', async () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} loading={false} onSend={onSend} />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求导');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(onSend).toHaveBeenCalledWith('求导');
  });

  it('加载中显示状态', () => {
    render(
      <ChatPanel
        messages={[{ role: 'user', content: 'hi' }]}
        loading
        onSend={() => {}}
      />,
    );
    expect(screen.getByText(/思考中/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/ChatPanel.test.tsx`
Expected: FAIL，找不到模块 ./ChatPanel。

- [ ] **Step 3: 写 `src/hooks/useChat.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AISettings, ChatMessage, Session } from '../types';
import { historyStore } from '../core/historyStore';
import { streamChat } from '../core/aiClient';
import { extractFunctions } from '../core/structuredParser';
import { analyzeFunction } from '../core/analysisEngine';
import { loadSettings } from '../core/settingsStore';

export function useChat() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const loaded = historyStore.load();
    return loaded.length ? loaded : [historyStore.create()];
  });
  const [activeId, setActiveId] = useState<string>(() => sessions[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef<AISettings>(loadSettings());

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const messages = active?.messages ?? [];

  useEffect(() => {
    historyStore.save(sessions);
  }, [sessions]);

  const setSettings = (settings: AISettings) => {
    settingsRef.current = settings;
  };

  const patchActive = useCallback(
    (updater: (s: Session) => Session) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeId ? updater(s) : s)),
      );
    },
    [activeId],
  );

  const send = useCallback(
    async (text: string) => {
      const settings = settingsRef.current;
      if (!settings || !settings.apiKey || loading) return;
      const userMsg: ChatMessage = { role: 'user', content: text };
      patchActive((s) => ({
        ...s,
        title: s.messages.length === 0 ? text.slice(0, 20) : s.title,
        messages: [...s.messages, userMsg],
      }));
      setLoading(true);
      setError(null);
      let full = '';
      try {
        for await (const piece of streamChat(
          [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          settings,
        )) {
          full += piece;
          patchActive((s) => {
            const list = [...s.messages];
            const last = list[list.length - 1];
            if (last?.role === 'assistant' && !last.error) {
              list[list.length - 1] = { ...last, content: full };
            } else {
              list.push({ role: 'assistant', content: full });
            }
            return { ...s, messages: list };
          });
        }
        const defs = extractFunctions(full);
        const analysis = defs.map((d) => analyzeFunction(d));
        patchActive((s) => {
          const list = [...s.messages];
          const idx = list.length - 1;
          const last = list[idx];
          if (last?.role === 'assistant') {
            list[idx] = { ...last, functions: defs, analysis };
          }
          return { ...s, messages: list };
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '未知错误';
        setError(msg);
        patchActive((s) => {
          const list = [...s.messages];
          const last = list[list.length - 1];
          if (last?.role === 'assistant' && last.content === full && full) {
            list[list.length - 1] = { ...last, error: true };
          } else {
            list.push({ role: 'assistant', content: `⚠️ ${msg}`, error: true });
          }
          return { ...s, messages: list };
        });
      } finally {
        setLoading(false);
      }
    },
    [activeId, loading, messages, patchActive],
  );

  const newSession = () => {
    const s = historyStore.create();
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = historyStore.create();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  return {
    sessions,
    activeId,
    messages,
    loading,
    error,
    send,
    newSession,
    deleteSession,
    setActiveId,
    setSettings,
  };
}
```

- [ ] **Step 4: 写 `src/components/MessageBubble.tsx`**

```tsx
import { Fragment, ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ChatMessage } from '../types';

const TOKEN_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`bubble ${message.role}`}>
      {renderRichText(message.content)}
      {message.error && <div className="bubble-error">请求失败，请检查 API 配置后重试</div>}
    </div>
  );
}

function renderRichText(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(content)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{content.slice(last, m.index)}</span>);
    const tex = (m[1] ?? m[2]).trim();
    const html = katex.renderToString(tex, { displayMode: Boolean(m[1]), throwOnError: false });
    parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(<span key={key++}>{content.slice(last)}</span>);
  if (parts.length === 0) parts.push(<Fragment key="e" />);
  return parts;
}
```

- [ ] **Step 5: 写 `src/components/ChatPanel.tsx`**

```tsx
import { useState } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onAddFunction?: (expr: string) => void;
}

export function ChatPanel({ messages, loading, onSend, onAddFunction }: Props) {
  const [input, setInput] = useState('');
  const [funcInput, setFuncInput] = useState('');

  const submit = () => {
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            输入数学问题开始提问，例如：<br />
            「求 f(x)=x²-2x-3 的单调区间和极值」
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && <div className="bubble ai bubble-thinking">思考中…</div>}
      </div>
      <div className="chat-input-area">
        {onAddFunction && (
          <div className="func-input-row">
            <span className="func-input-label">f(x)=</span>
            <input
              className="func-input"
              value={funcInput}
              placeholder="手动输入函数，如 x^2 - 2x - 3（回车即画图）"
              onChange={(e) => setFuncInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && funcInput.trim()) {
                  onAddFunction(funcInput.trim());
                  setFuncInput('');
                }
              }}
            />
          </div>
        )}
        <textarea
          className="chat-input"
          value={input}
          placeholder="输入数学问题，支持 $LaTeX$ 公式…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="chat-actions">
          <button className="btn primary" onClick={submit} disabled={loading || !input.trim()}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/components/ChatPanel.test.tsx`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/hooks/useChat.ts src/components/MessageBubble.tsx src/components/ChatPanel.tsx src/components/ChatPanel.test.tsx
git commit -m "feat: chat panel with katex rendering and streaming hook"
```

---

### Task 13: 图像与特性面板（GraphPanel + PropertyCard）

**Files:**
- Create: `src/components/PropertyCard.tsx`
- Create: `src/components/GraphPanel.tsx`
- Test: `src/components/GraphPanel.test.tsx`

- [ ] **Step 1: 写失败测试 `src/components/GraphPanel.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphPanel } from './GraphPanel';
import { analyzeFunction } from '../core/analysisEngine';

vi.mock('function-plot', () => ({
  default: vi.fn(),
}));

import functionPlot from 'function-plot';
const mockedPlot = vi.mocked(functionPlot);

describe('GraphPanel', () => {
  it('无函数时显示空状态', () => {
    render(<GraphPanel analyses={[]} />);
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
  });

  it('有函数时调用 functionPlot 并展示特性卡片', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} />);
    expect(mockedPlot).toHaveBeenCalled();
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.data.length).toBe(1);
    expect(screen.getByText(/奇偶性/)).toBeInTheDocument();
    expect(screen.getByText(/非奇非偶/)).toBeInTheDocument();
    expect(screen.getByText(/定义域/)).toBeInTheDocument();
  });

  it('展示极值与零点标注', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<GraphPanel analyses={[a]} />);
    const call = mockedPlot.mock.calls[mockedPlot.mock.calls.length - 1][0];
    expect(call.annotations.length).toBeGreaterThanOrEqual(3); // min + 2 zeros
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/GraphPanel.test.tsx`
Expected: FAIL，找不到模块 ./GraphPanel。

- [ ] **Step 3: 写 `src/components/PropertyCard.tsx`**

```tsx
import type { FunctionAnalysis, MonotonicSegment } from '../types';

const TREND_LABEL: Record<MonotonicSegment['trend'], string> = {
  inc: '递增 ↑',
  dec: '递减 ↓',
  const: '不变 →',
};

const PARITY_LABEL = { odd: '奇函数', even: '偶函数', neither: '非奇非偶' } as const;

export function PropertyCard({ analysis }: { analysis: FunctionAnalysis }) {
  const rows: { label: string; value: string }[] = [];
  rows.push({
    label: '定义域',
    value: analysis.domain.map(fmt).join(' ∪ ') || '—',
  });
  rows.push({ label: '奇偶性', value: PARITY_LABEL[analysis.parity] });
  rows.push({
    label: '单调性',
    value: analysis.monotonic.length
      ? analysis.monotonic.map((s) => `${s.interval} ${TREND_LABEL[s.trend]}`).join('；')
      : '—',
  });
  rows.push({
    label: '极值',
    value: analysis.extrema.length
      ? analysis.extrema
          .map((e) => `x=${r3(e.x)} ${e.type === 'min' ? '最小' : '最大'} y=${r3(e.y)}`)
          .join('；')
      : '—',
  });
  rows.push({
    label: '零点',
    value: analysis.zeroPoints.length ? analysis.zeroPoints.slice(0, 12).map(r3).join('、') : '—',
  });
  rows.push({
    label: '渐近线',
    value: analysis.asymptotes.length ? analysis.asymptotes.map((a) => a.value).join('；') : '无',
  });
  rows.push({
    label: '周期',
    value: analysis.period !== undefined ? `T = ${r3(analysis.period)}` : '无',
  });

  return (
    <div className="property-card">
      {rows.map((row) => (
        <div className="property-row" key={row.label}>
          <span className="property-label">{row.label}</span>
          <span className="property-value">{row.value}</span>
        </div>
      ))}
      <details className="property-summary">
        <summary>AI 文字总结</summary>
        <p>{analysis.summary}</p>
      </details>
    </div>
  );
}

function fmt(iv: { lo: number; hi: number; loOpen: boolean; hiOpen: boolean }): string {
  const num = (x: number) =>
    x === Number.POSITIVE_INFINITY ? '+∞' : x === Number.NEGATIVE_INFINITY ? '−∞' : r3(x);
  return `${iv.loOpen ? '(' : '['}${num(iv.lo)}, ${num(iv.hi)}${iv.hiOpen ? ')' : ']'}`;
}

function r3(x: number): string {
  return String(Math.round(x * 1000) / 1000);
}
```

- [ ] **Step 4: 写 `src/components/GraphPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import functionPlot from 'function-plot';
import 'function-plot/dist/function-plot.css';
import type { FunctionAnalysis } from '../types';
import { PropertyCard } from './PropertyCard';

const COLORS = ['#4da3ff', '#ffb454', '#57d98a', '#ff6b6b', '#c678dd', '#5ccfe6'];

export function GraphPanel({ analyses }: { analyses: FunctionAnalysis[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<{ x: [number, number]; y: [number, number] } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || analyses.length === 0) return;
    const width = el.clientWidth || 400;
    const height = Math.max(el.clientHeight || 340, 260);
    const visible = analyses.filter((a) => !hidden[a.expression]);
    const viewBox = view ?? autoView(analyses);
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
        data: visible.map((a, i) => ({
          fn: a.expression,
          color: COLORS[i % COLORS.length],
          graphType: 'polyline',
        })),
        annotations: visible.flatMap((a, i) => {
          const c = COLORS[i % COLORS.length];
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
          void c;
          return anns;
        }),
      });
    } catch {
      /* 画图失败不崩溃 */
    }
  }, [analyses, hidden, view]);

  if (analyses.length === 0) {
    return <div className="graph-empty">未识别到函数，可在左侧手动输入，如 f(x)=x^2 - 2x - 3</div>;
  }

  return (
    <div className="graph-panel">
      <div className="graph-toolbar">
        {analyses.map((a, i) => (
          <button
            key={a.expression}
            className={`legend-btn ${hidden[a.expression] ? 'off' : ''}`}
            style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}
            onClick={() =>
              setHidden((h) => ({ ...h, [a.expression]: !h[a.expression] }))
            }
          >
            {a.expression}
          </button>
        ))}
        <button
          className="legend-btn zoom"
          onClick={() => setView(null)}
          title="重置视野"
        >
          重置视野
        </button>
      </div>
      <div className="graph-plot" ref={containerRef} />
      <div className="property-list">
        {analyses.map((a) => (
          <PropertyCard key={a.expression} analysis={a} />
        ))}
      </div>
    </div>
  );
}

function autoView(analyses: FunctionAnalysis[]): { x: [number, number]; y: [number, number] } {
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

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/components/GraphPanel.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/components/PropertyCard.tsx src/components/GraphPanel.tsx src/components/GraphPanel.test.tsx
git commit -m "feat: graph panel with function-plot and property cards"
```

---

### Task 14: 设置与历史（SettingsModal + HistorySidebar）

**Files:**
- Create: `src/core/settingsStore.ts`
- Create: `src/components/SettingsModal.tsx`
- Create: `src/components/HistorySidebar.tsx`

- [ ] **Step 1: 写 `src/core/settingsStore.ts`**

```ts
import type { AISettings } from '../types';

const SETTINGS_KEY = 'mathmate.settings.v1';

export const defaultSettings: AISettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  stream: true,
};

export function loadSettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultSettings;
}

export function saveSettings(s: AISettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
```

- [ ] **Step 2: 写 `src/components/SettingsModal.tsx`**

```tsx
import { useState } from 'react';
import type { AISettings } from '../types';
import { saveSettings as persistSettings } from '../core/settingsStore';

interface Props {
  open: boolean;
  settings: AISettings;
  onClose: () => void;
  onSave: (s: AISettings) => void;
}

export function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [form, setForm] = useState(settings);

  if (!open) return null;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>AI 设置</h3>
        <label>
          API Base URL
          <input
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-..."
          />
        </label>
        <label>
          模型名
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="gpt-4o-mini"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.stream}
            onChange={(e) => setForm({ ...form, stream: e.target.checked })}
          />
          流式输出
        </label>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => {
              persistSettings(form);
              onSave(form);
              onClose();
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写 `src/components/HistorySidebar.tsx`**

```tsx
import type { Session } from '../types';

interface Props {
  sessions: Session[];
  activeId: string;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function HistorySidebar({ sessions, activeId, collapsed, onToggle, onSelect, onNew, onDelete }: Props) {
  if (collapsed) {
    return (
      <div className="sidebar sidebar-collapsed">
        <button className="icon-btn" onClick={onToggle} title="展开">
          »
        </button>
        <button className="icon-btn" onClick={onNew} title="新会话">
          +
        </button>
      </div>
    );
  }
  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span>会话</span>
        <div>
          <button className="icon-btn" onClick={onNew} title="新会话">
            +
          </button>
          <button className="icon-btn" onClick={onToggle} title="收起">
            «
          </button>
        </div>
      </div>
      <div className="session-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${s.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="session-title">{s.title}</span>
            <button
              className="session-del"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add src/components/SettingsModal.tsx src/components/HistorySidebar.tsx
git commit -m "feat: settings modal and history sidebar"
```

---

### Task 15: App 集成 + 样式 + 最终验证

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: 写失败测试 `src/App.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

vi.mock('./core/aiClient', () => ({
  streamChat: vi.fn(),
  ApiError: class ApiError extends Error {},
}));
vi.mock('function-plot', () => ({ default: vi.fn() }));

import { streamChat } from './core/aiClient';
const mockedStream = vi.mocked(streamChat);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'mathmate.settings.v1',
    JSON.stringify({ baseUrl: 'https://x/v1', apiKey: 'sk-test', model: 'm', stream: false }),
  );
  mockedStream.mockReset();
});

describe('App', () => {
  it('完整流程：提问 → 回复 → 函数卡片出现', async () => {
    mockedStream.mockImplementation(async function* () {
      yield '由题可得：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3"}]}\n<!-- /MATH_FUNCTIONS -->';
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求单调区间');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText(/由题可得/)).toBeInTheDocument();
    expect(await screen.findByText(/奇偶性/)).toBeInTheDocument();
    expect(screen.getByText(/非奇非偶/)).toBeInTheDocument();
  });

  it('API 报错显示错误条', async () => {
    mockedStream.mockImplementation(async function* () {
      throw new Error('API 错误 (401)：Invalid API key');
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '你好');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText(/Invalid API key/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL（App 未实现完整功能）。

测试注：useChat 的 `send` 要求 `settings.apiKey` 非空，故 beforeEach 中已预写测试设置（见上方 beforeEach）。

- [ ] **Step 3: 重写 `src/App.tsx`**

```tsx
import { useState } from 'react';
import { useChat } from './hooks/useChat';
import { ChatPanel } from './components/ChatPanel';
import { GraphPanel } from './components/GraphPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { SettingsModal } from './components/SettingsModal';
import { loadSettings } from './core/settingsStore';
import type { AISettings, FunctionAnalysis } from './types';
import { extractFunctions } from './core/structuredParser';
import { analyzeFunction } from './core/analysisEngine';

export default function App() {
  const chat = useChat();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>(() => loadSettings());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [manualAnalyses, setManualAnalyses] = useState<FunctionAnalysis[]>([]);

  const saveSettings = (s: AISettings) => {
    setSettings(s);
    chat.setSettings(s);
  };

  const addManualFunction = (expr: string) => {
    const a = analyzeFunction({ id: `manual-${Date.now()}`, expr });
    setManualAnalyses((prev) => [...prev.filter((x) => x.expression !== expr), a]);
  };

  const visibleAnalyses = [
    ...chat.messages.flatMap((m) => m.analysis ?? []),
    ...manualAnalyses,
  ];

  return (
    <div className="app">
      <HistorySidebar
        sessions={chat.sessions}
        activeId={chat.activeId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onSelect={chat.setActiveId}
        onNew={chat.newSession}
        onDelete={chat.deleteSession}
      />
      <ChatPanel
        messages={chat.messages}
        loading={chat.loading}
        onSend={chat.send}
        onAddFunction={addManualFunction}
      />
      <div className="right-panel">
        <div className="right-panel-head">
          <span>函数图像与特性</span>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="AI 设置">
            ⚙
          </button>
        </div>
        <GraphPanel analyses={visibleAnalyses} />
      </div>
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
}
```

- [ ] **Step 4: 补充 `src/styles/global.css`（在 Task 0 基础上追加）**

```css
/* 聊天区 */
.chat-panel { display: flex; flex-direction: column; min-width: 0; background: #171a21; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.chat-empty { color: #5a6070; text-align: center; margin-top: 15vh; line-height: 1.8; }
.bubble { max-width: 86%; padding: 10px 14px; border-radius: 10px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; font-size: 14px; }
.bubble.user { align-self: flex-end; background: #2c3d5c; }
.bubble.ai { align-self: flex-start; background: #232833; border: 1px solid #2f3543; }
.bubble-thinking { opacity: 0.6; }
.bubble-error { margin-top: 8px; color: #ff6b6b; font-size: 12px; }
.chat-input-area { border-top: 1px solid #262b36; padding: 10px 14px; }
.func-input-row { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
.func-input-label { color: #7fb2ff; font-family: Consolas, monospace; font-size: 13px; }
.func-input { flex: 1; background: #10131a; border: 1px solid #2f3543; border-radius: 6px; color: #e6e8ee; padding: 6px 10px; font-family: Consolas, monospace; font-size: 12px; }
.chat-input { width: 100%; background: #10131a; border: 1px solid #2f3543; border-radius: 8px; color: #e6e8ee; padding: 10px 12px; min-height: 44px; resize: vertical; font-size: 14px; }
.chat-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

/* 按钮 */
.btn { background: #262b36; color: #e6e8ee; border: 1px solid #3a4050; border-radius: 6px; padding: 6px 16px; cursor: pointer; font-size: 13px; }
.btn.primary { background: #2c5fa8; border-color: #2c5fa8; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-btn { background: transparent; border: none; color: #8a8f9c; font-size: 16px; cursor: pointer; padding: 4px 8px; }
.icon-btn:hover { color: #e6e8ee; }

/* 侧栏 */
.sidebar { background: #12141a; border-right: 1px solid #262b36; display: flex; flex-direction: column; }
.sidebar-collapsed { align-items: center; padding-top: 8px; }
.sidebar-head { display: flex; justify-content: space-between; align-items: center; padding: 10px; color: #8a8f9c; font-size: 13px; }
.session-list { flex: 1; overflow-y: auto; }
.session-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; cursor: pointer; font-size: 13px; color: #c9cdd6; border-left: 3px solid transparent; }
.session-item:hover { background: #1a1e27; }
.session-item.active { background: #1a1e27; border-left-color: #4da3ff; }
.session-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }
.session-del { background: none; border: none; color: #5a6070; cursor: pointer; font-size: 14px; }

/* 右面板 */
.right-panel { display: flex; flex-direction: column; min-width: 0; background: #10131a; }
.right-panel-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; color: #8a8f9c; font-size: 13px; border-bottom: 1px solid #262b36; }
.graph-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.graph-toolbar { display: flex; gap: 6px; flex-wrap: wrap; padding: 8px 10px; }
.legend-btn { background: #1a1e27; border: 1px solid; border-radius: 12px; padding: 2px 10px; font-family: Consolas, monospace; font-size: 12px; cursor: pointer; }
.legend-btn.off { opacity: 0.3; text-decoration: line-through; }
.legend-btn.zoom { color: #8a8f9c !important; border-color: #3a4050 !important; }
.graph-plot { flex: 1; min-height: 260px; }
.graph-plot svg { display: block; margin: 0 auto; }
.graph-empty { padding: 40px 16px; color: #5a6070; text-align: center; line-height: 2; }
.property-list { max-height: 45%; overflow-y: auto; border-top: 1px solid #262b36; }
.property-card { padding: 10px 14px; border-bottom: 1px solid #262b36; }
.property-row { display: flex; gap: 12px; padding: 3px 0; font-size: 13px; }
.property-label { color: #8a8f9c; min-width: 52px; flex-shrink: 0; }
.property-value { color: #e6e8ee; word-break: break-all; }
.property-summary { margin-top: 6px; color: #8a8f9c; font-size: 12px; }
.property-summary p { color: #c9cdd6; line-height: 1.7; }

/* 弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #1a1e27; border: 1px solid #2f3543; border-radius: 10px; padding: 20px 24px; width: 380px; }
.modal h3 { margin: 0 0 14px; }
.modal label { display: block; margin-bottom: 12px; font-size: 13px; color: #8a8f9c; }
.modal input[type='text'], .modal input[type='password'] { width: 100%; margin-top: 4px; background: #10131a; border: 1px solid #2f3543; border-radius: 6px; color: #e6e8ee; padding: 8px 10px; }
.modal .checkbox-row { display: flex; align-items: center; gap: 8px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
```

- [ ] **Step 5: 运行全部测试**

Run: `npm test`
Expected: 全部 PASS（mathUtil / roots / domain / parity / monotonic / asymptotes / period / index / aiClient / structuredParser / historyStore / ChatPanel / GraphPanel / App）。

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: `tsc` 无类型错误 + `vite build` 成功产出 dist/。

- [ ] **Step 7: 手动冒烟清单**

Run: `npm run dev`，浏览器打开 http://localhost:5173：
- [ ] 输入「求 f(x)=x²-2x-3 的单调区间和极值」（未配 API Key 会显示错误条，属预期）
- [ ] 手动输入框输入 `x^2 - 2x - 3`，回车 → 右侧出现抛物线、特性卡片（定义域/奇偶性/单调性/极值/零点）
- [ ] 输入 `1/x` → 渐近线卡片显示 x = 0 与 y = 0
- [ ] 输入 `sin(x)` → 周期卡片 T = 6.283
- [ ] 输入 `log(x)` → 定义域 (0, +∞)
- [ ] 齿轮按钮 → 填入真实 API Key 后提问，验证流式回答与自动画图
- [ ] 刷新页面 → 会话与设置仍在

- [ ] **Step 8: 提交**

```bash
git add src/App.tsx src/App.test.tsx src/styles/global.css
git commit -m "feat: integrate app shell, styling, and e2e smoke tests"
```

---

## 自检记录（计划作者）

**Spec 覆盖对照：**
- AI 结构化输出协议（JSON 块）→ Task 9（SYSTEM_PROMPT）+ Task 10（解析）
- 分析引擎六特性 + 定义域 + 摘要 → Task 3–8
- 左右分栏布局 / KaTeX / 流式 / 手动输入 / 图例显隐 / 特性卡片顺序 / 设置弹窗 / 历史侧栏 / 深色主题 → Task 12–15
- 错误处理（API 错误条 / 解析失败空态 / 表达式非法走 safe + NaN / 历史损坏重置）→ Task 9、11、12、15
- 测试策略（≥20 引擎用例、解析三态、mock fetch、组件冒烟、App 端到端）→ Task 1–15 测试文件合计约 40 用例

**类型一致性抽查：** `Interval` 在 types.ts 定义，domain.ts 复用；`MonotonicSegment`/`Extremum`/`Asymptote`/`FunctionAnalysis` 全从 types.ts 导入；`inferDomain(expr, domainStr?)` 签名在 Task 3 定义、Task 8 调用一致；`findAllRoots(f, lo, hi, opts)` 在 Task 2 定义，Task 3/5/8 调用一致；`fmtInterval`/`fmtNum` 在 domain.ts 导出，monotonic.ts 与 index.ts 引用一致；`analyzeParity`/`analyzeMonotonic`/`analyzeAsymptotes`/`analyzePeriod` 签名与调用处一致。

**已知限制（记录在案，不阻塞）：**
- 定义域推断的求根窗口为 [-1000, 1000]（如 log(x-5000) 会推断错误，高中数学题罕见）
- 周期只做结构检测 + 有限候选数值验证
- tan 的极点数量在 ±1000 内有约 637 个，性能可接受
