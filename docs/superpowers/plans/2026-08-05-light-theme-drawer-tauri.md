# 浅色主题 + 抽屉面板 + Tauri 打包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有数学学习应用上完成三项改造：浅色主题（干净白+蓝强调）、右侧函数面板改为可拖拽调宽的抽屉、用 Tauri 封装为 Windows 桌面应用。

**Architecture:** 纯前端改造 + 桌面壳。浅色主题通过 global.css 的 `:root` CSS 变量集中切换（全部组件类引用变量，GraphPanel 曲线色加深，function-plot 用后代选择器覆盖浅色）；抽屉由 App 状态（drawerOpen/drawerWidth，宽度持久化 localStorage）驱动三列 grid 布局，DrawerPanel 组件含 Pointer Events 拖拽手柄；Tauri 2 作为打包壳（src-tauri 标准结构），不引入任何前端运行时依赖。

**Tech Stack:** 现有 Vite+React+TS；新增 @tauri-apps/cli、src-tauri（tauri 2 + tauri-build 2）。

---

### Task A: 浅色主题

**Files:**
- Modify: `src/styles/global.css`（全量重写）
- Modify: `src/components/GraphPanel.tsx`（COLORS 数组）

- [ ] **Step 1: 全量重写 `src/styles/global.css`（浅色）**

```css
:root {
  color-scheme: light;
  --bg: #f5f7fa;
  --panel: #ffffff;
  --panel-2: #f8fafc;
  --text: #1a2233;
  --text-dim: #64748b;
  --border: #e2e8f0;
  --accent: #2563eb;
  --accent-soft: #dbeafe;
  --danger: #dc2626;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;
}
.app {
  display: grid;
  grid-template-columns: 44px 1fr;
  height: 100vh;
}

/* 聊天区 */
.chat-panel { display: flex; flex-direction: column; min-width: 0; background: var(--panel); }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.chat-empty { color: var(--text-dim); text-align: center; margin-top: 15vh; line-height: 1.8; }
.bubble { max-width: 86%; padding: 10px 14px; border-radius: 10px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; font-size: 14px; }
.bubble.user { align-self: flex-end; background: var(--accent); color: #ffffff; }
.bubble.ai { align-self: flex-start; background: var(--panel-2); border: 1px solid var(--border); }
.bubble-thinking { opacity: 0.6; }
.bubble-error { margin-top: 8px; color: var(--danger); font-size: 12px; }
.chat-input-area { border-top: 1px solid var(--border); padding: 10px 14px; }
.chat-error-banner { background: #fef2f2; border: 1px solid #fecaca; color: var(--danger); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.func-input-row { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
.func-input-label { color: var(--accent); font-family: Consolas, monospace; font-size: 13px; }
.func-input { flex: 1; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 6px 10px; font-family: Consolas, monospace; font-size: 12px; }
.func-input.invalid { border-color: var(--danger); }
.func-input-error { color: var(--danger); font-size: 12px; margin-top: 2px; }
.chat-input { width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 10px 12px; min-height: 44px; resize: vertical; font-size: 14px; }
.chat-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

/* 按钮 */
.btn { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 16px; cursor: pointer; font-size: 13px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #ffffff; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-btn { background: transparent; border: none; color: var(--text-dim); font-size: 16px; cursor: pointer; padding: 4px 8px; }
.icon-btn:hover { color: var(--text); }

/* 侧栏 */
.sidebar { background: var(--panel); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.sidebar-collapsed { align-items: center; padding-top: 8px; }
.sidebar-head { display: flex; justify-content: space-between; align-items: center; padding: 10px; color: var(--text-dim); font-size: 13px; }
.session-list { flex: 1; overflow-y: auto; }
.session-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; cursor: pointer; font-size: 13px; color: var(--text); border-left: 3px solid transparent; }
.session-item:hover { background: var(--panel-2); }
.session-item.active { background: var(--panel-2); border-left-color: var(--accent); }
.session-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }
.session-del { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px; }

/* 抽屉（右面板） */
.drawer-panel { position: relative; display: flex; flex-direction: column; min-width: 0; background: var(--panel); }
.drawer-handle { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 10; }
.drawer-handle:hover { background: var(--accent-soft); }
.drawer-tab {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%);
  writing-mode: vertical-rl;
  background: var(--accent); color: #ffffff; border: none;
  border-radius: 8px 0 0 8px;
  padding: 14px 8px; font-size: 13px; cursor: pointer; z-index: 20;
  box-shadow: -2px 2px 8px rgba(37, 99, 235, 0.25);
}
.drawer-tab:hover { background: #1d4ed8; }
.right-panel-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; color: var(--text-dim); font-size: 13px; border-bottom: 1px solid var(--border); }
.graph-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.graph-toolbar { display: flex; gap: 6px; flex-wrap: wrap; padding: 8px 10px; }
.legend-btn { background: var(--panel); border: 1px solid; border-radius: 12px; padding: 2px 10px; font-family: Consolas, monospace; font-size: 12px; cursor: pointer; }
.legend-btn.off { opacity: 0.3; text-decoration: line-through; }
.legend-btn.zoom { color: var(--text-dim) !important; border-color: var(--border) !important; }
.graph-plot { flex: 1; min-height: 260px; }
.graph-plot svg { display: block; margin: 0 auto; }
.graph-empty { padding: 40px 16px; color: var(--text-dim); text-align: center; line-height: 2; }
.property-list { max-height: 45%; overflow-y: auto; border-top: 1px solid var(--border); }
.property-card { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.property-row { display: flex; gap: 12px; padding: 3px 0; font-size: 13px; }
.property-label { color: var(--text-dim); min-width: 52px; flex-shrink: 0; }
.property-value { color: var(--text); word-break: break-all; }
.property-summary { margin-top: 6px; color: var(--text-dim); font-size: 12px; }
.property-summary p { color: var(--text); line-height: 1.7; }

/* function-plot 浅色覆盖 */
.function-plot .axis path, .function-plot .axis line, .function-plot .grid line { stroke: var(--border); }
.function-plot .axis .domain { stroke: var(--border); }
.function-plot text { fill: var(--text-dim); }
.function-plot .tip { background: rgba(255, 255, 255, 0.95) !important; color: var(--text) !important; border: 1px solid var(--border) !important; }
.function-plot .tip .legend { color: var(--text) !important; }

/* 弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; width: 380px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15); }
.modal h3 { margin: 0 0 14px; }
.modal label { display: block; margin-bottom: 12px; font-size: 13px; color: var(--text-dim); }
.modal input[type='text'], .modal input[type='password'] { width: 100%; margin-top: 4px; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 8px 10px; }
.modal .checkbox-row { display: flex; align-items: center; gap: 8px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
```

- [ ] **Step 2: GraphPanel 曲线色加深**

`src/components/GraphPanel.tsx` 中：

```ts
const COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#ef4444', '#8b5cf6', '#06b6d4'];
```

- [ ] **Step 3: 验证**

Run: `npx vitest run` — 全部通过（86）；`npx tsc --noEmit` — 无错误；`npm run build` — 成功。
说明：组件类名未变，测试不受影响；`.right-panel` 类已被 `.drawer-panel` 取代（Task B 同步改 App 结构）。

- [ ] **Step 4: 提交**

```bash
git add src/styles/global.css src/components/GraphPanel.tsx
git commit -m "style: light theme with blue accent"
```

---

### Task B: 抽屉式右面板

**Files:**
- Create: `src/components/DrawerPanel.tsx`（含 DrawerTab 导出）
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`（新增抽屉用例）

- [ ] **Step 1: 写 `src/components/DrawerPanel.tsx`**

```tsx
import { useRef } from 'react';
import type { FunctionAnalysis } from '../types';
import { GraphPanel } from './GraphPanel';

interface Props {
  analyses: FunctionAnalysis[];
  width: number;
  onResize: (w: number) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function DrawerPanel({ analyses, width, onResize, onClose, onOpenSettings }: Props) {
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startW: width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    onResize(dragRef.current.startW - dx);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="drawer-panel">
      <div
        className="drawer-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="拖拽调整宽度"
      />
      <div className="right-panel-head">
        <span>函数图像与特性</span>
        <div>
          <button className="icon-btn" onClick={onOpenSettings} title="AI 设置">
            ⚙
          </button>
          <button className="icon-btn" onClick={onClose} title="收起">
            »
          </button>
        </div>
      </div>
      <GraphPanel analyses={analyses} />
    </div>
  );
}

export function DrawerTab({ onClick }: { onClick: () => void }) {
  return (
    <button className="drawer-tab" onClick={onClick} title="展开函数面板">
      函数图像
    </button>
  );
}
```

- [ ] **Step 2: 改 `src/App.tsx`**

完整替换为：

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from './hooks/useChat';
import { ChatPanel } from './components/ChatPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { SettingsModal } from './components/SettingsModal';
import { DrawerPanel, DrawerTab } from './components/DrawerPanel';
import { loadSettings } from './core/settingsStore';
import type { AISettings, FunctionAnalysis } from './types';
import { analyzeFunction } from './core/analysisEngine';

const DRAWER_KEY = 'mathmate.drawer.v1';
const DRAWER_MIN = 300;
const DRAWER_MAX = 720;

function loadDrawerWidth(): number {
  try {
    const v = Number(localStorage.getItem(DRAWER_KEY));
    if (Number.isFinite(v) && v >= DRAWER_MIN && v <= DRAWER_MAX) return v;
  } catch {
    /* ignore */
  }
  return 420;
}

export default function App() {
  const chat = useChat();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>(() => loadSettings());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [manualAnalyses, setManualAnalyses] = useState<FunctionAnalysis[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerWidth, setDrawerWidthState] = useState<number>(loadDrawerWidth);

  const saveSettings = (s: AISettings) => {
    setSettings(s);
    chat.setSettings(s);
  };

  const setDrawerWidth = (w: number) => {
    const c = Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, Math.round(w)));
    setDrawerWidthState(c);
    try {
      localStorage.setItem(DRAWER_KEY, String(c));
    } catch {
      /* ignore */
    }
  };

  const addManualFunction = (expr: string) => {
    const a = analyzeFunction({ id: `manual-${Date.now()}`, expr });
    setManualAnalyses((prev) => [...prev.filter((x) => x.expression !== expr), a]);
  };

  const analysesKey = [
    ...chat.messages.flatMap((m) => m.analysis ?? []),
    ...manualAnalyses,
  ]
    .map((a) => a.expression)
    .join('|');

  const visibleAnalyses = useMemo(
    () => [...chat.messages.flatMap((m) => m.analysis ?? []), ...manualAnalyses],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysesKey],
  );

  // 自动展开：分析结果从无到有时打开抽屉
  const prevAnalysesCount = useRef(0);
  useEffect(() => {
    const n = visibleAnalyses.length;
    if (n > 0 && prevAnalysesCount.current === 0) setDrawerOpen(true);
    prevAnalysesCount.current = n;
  }, [visibleAnalyses.length]);

  return (
    <div
      className="app"
      style={{
        gridTemplateColumns: drawerOpen
          ? `44px 1fr ${drawerWidth}px`
          : '44px 1fr',
      }}
    >
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
      {drawerOpen ? (
        <DrawerPanel
          analyses={visibleAnalyses}
          width={drawerWidth}
          onResize={setDrawerWidth}
          onClose={() => setDrawerOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <DrawerTab onClick={() => setDrawerOpen(true)} />
      )}
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

- [ ] **Step 3: 更新 `src/App.test.tsx`**

在既有 beforeEach/render 基础上，把测试文件完整替换为：

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
  it('初始收起：显示边缘标签，无右侧面板', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /函数图像/ })).toBeInTheDocument();
    expect(document.querySelector('.drawer-panel')).toBeNull();
  });

  it('点击标签展开抽屉显示空态', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    expect(screen.getByText(/未识别到函数/)).toBeInTheDocument();
    expect(document.querySelector('.drawer-panel')).not.toBeNull();
  });

  it('完整流程：提问 → 回复 → 抽屉自动展开 + 函数卡片出现', async () => {
    mockedStream.mockImplementation(async function* () {
      yield '由题可得：\n<!-- MATH_FUNCTIONS -->\n{"functions": [{"id": "f", "expr": "x^2 - 2x - 3"}]}\n<!-- /MATH_FUNCTIONS -->';
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '求单调区间');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText(/由题可得/)).toBeInTheDocument();
    expect(await screen.findByText(/奇偶性/)).toBeInTheDocument();
    expect(screen.getByText(/非奇非偶/)).toBeInTheDocument();
    expect(document.querySelector('.drawer-panel')).not.toBeNull();
  });

  it('API 报错显示错误横幅与重试', async () => {
    mockedStream.mockImplementation(async function* () {
      throw new Error('API 错误 (401)：Invalid API key');
    });
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/输入数学问题/), '你好');
    await userEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(await screen.findByText(/Invalid API key/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(mockedStream).toHaveBeenCalledTimes(2);
  });

  it('抽屉宽度持久化', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /函数图像/ }));
    expect(localStorage.getItem('mathmate.drawer.v1')).toBeNull();
  });
});
```

- [ ] **Step 4: 验证**

Run: `npx vitest run` — 全部通过（新增 5 个用例，共 91）；`npx tsc --noEmit` — 无错误；`npm run build` — 成功。

- [ ] **Step 5: 提交**

```bash
git add src/components/DrawerPanel.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: collapsible resizable right drawer"
```

---

### Task C: Tauri 封装（Windows）

**Files:**
- Modify: `package.json`（script + devDep）
- Modify: `vite.config.ts`
- Modify: `.gitignore`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/*`（由 tauri icon 生成）
- Create: `app-icon.png`（图标源，提交到仓库）

- [ ] **Step 1: 安装依赖并改配置**

```bash
npm i -D @tauri-apps/cli@^2
```

`package.json` scripts 增加：

```json
"tauri": "tauri"
```

`vite.config.ts` 改为：

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

`.gitignore` 追加：

```
src-tauri/target/
src-tauri/gen/
```

- [ ] **Step 2: 生成图标源并导出全套**

PowerShell（项目根目录执行）生成 1024×1024 蓝底白"∑"图标：

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1024,1024
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(37,99,235))
$g.FillRectangle($bg, 0, 0, 1024, 1024)
$font = New-Object System.Drawing.Font('Segoe UI Symbol', 460, [System.Drawing.FontStyle]::Bold)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$g.DrawString([char]0x2211, $font, $white, (New-Object System.Drawing.RectangleF 0,0,1024,1024), $sf)
$g.Dispose()
$bmp.Save('app-icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
```

然后：

```bash
npx tauri icon app-icon.png
```

Expected: 生成 `src-tauri/icons/`（32x32.png、128x128.png、128x128@2x.png、icon.icns、icon.ico、icon.png 等）。

- [ ] **Step 3: 写 `src-tauri/Cargo.toml`**

```toml
[package]
name = "mathmate"
version = "0.1.0"
description = "数学学习助手"
authors = ["MathMate"]
edition = "2021"

[build-dependencies]
tauri-build = "2"

[dependencies]
tauri = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 4: 写 `src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 5: 写 `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6: 写 `src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "MathMate",
  "version": "0.1.0",
  "identifier": "com.mathmate.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "数学学习助手",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 640,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 7: 写 `src-tauri/capabilities/default.json`**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "default capability for the main window",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

- [ ] **Step 8: 构建验证**

Run: `npm run tauri build`（首次编译 Rust 依赖约 5–15 分钟，timeout 设 30 分钟）
Expected: 成功产出 `src-tauri/target/release/bundle/nsis/MathMate_0.1.0_x64-setup.exe`。
若构建报错（如 WebView2/CSP/图标），按错误修复后重试。

- [ ] **Step 9: 提交**

```bash
git add app-icon.png src-tauri package.json vite.config.ts .gitignore
git commit -m "feat: tauri desktop shell for windows"
```

---

### Task D: 冒烟测试更新 + 全量验证

**Files:**
- Create: `C:\Users\QinYe\AppData\Local\Temp\opencode\smoke_mathmate2.py`（新版冒烟脚本）

- [ ] **Step 1: 写新版冒烟脚本**

```python
import sys, time
from playwright.sync_api import sync_playwright

SHOT = r"C:\Users\QinYe\AppData\Local\Temp\opencode"
failures = []

def check(name, cond):
    print(("PASS" if cond else "FAIL") + " | " + name)
    if not cond:
        failures.append(name)

def wait_for_cards(page, count, timeout_ms=20000):
    page.wait_for_function(
        f"document.querySelectorAll('.property-card').length >= {count}",
        timeout=timeout_ms,
    )

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    time.sleep(0.5)

    # 浅色主题
    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    check("浅色背景", bg == "rgb(245, 247, 250)")

    # 抽屉初始收起
    check("抽屉收起：边缘标签可见", page.locator(".drawer-tab").count() == 1)
    check("抽屉收起：无右面板", page.locator(".drawer-panel").count() == 0)
    page.screenshot(path=f"{SHOT}/smoke2-1-collapsed.png")

    # 点击标签展开
    page.locator(".drawer-tab").click()
    page.wait_for_timeout(400)
    check("点击标签展开：右面板出现", page.locator(".drawer-panel").count() == 1)
    check("展开后空态", page.locator(".graph-empty").count() == 1)
    page.screenshot(path=f"{SHOT}/smoke2-2-expanded.png")

    # 拖拽调宽
    w0 = page.locator(".drawer-panel").bounding_box()["width"]
    handle = page.locator(".drawer-handle")
    hb = handle.bounding_box()
    page.mouse.move(hb["x"] + 3, hb["y"] + 300)
    page.mouse.down()
    page.mouse.move(hb["x"] - 120, hb["y"] + 300, steps=10)
    page.mouse.up()
    page.wait_for_timeout(400)
    w1 = page.locator(".drawer-panel").bounding_box()["width"]
    check(f"拖拽调宽生效（{int(w0)} -> {int(w1)}）", w1 < w0 - 60 and w1 >= 300)
    page.screenshot(path=f"{SHOT}/smoke2-3-resized.png")

    # 函数特性（沿用）
    func_input = page.locator("input.func-input")
    cards = page.locator(".property-card")
    func_input.fill("x^2 - 2x - 3")
    func_input.press("Enter")
    wait_for_cards(page, 1)
    t0 = cards.nth(0).inner_text()
    check("二次函数：非奇非偶", "非奇非偶" in t0)
    check("二次函数：递减", "递减" in t0)

    func_input.fill("1/x")
    func_input.press("Enter")
    wait_for_cards(page, 2)
    t1 = cards.nth(1).inner_text()
    check("1/x：渐近线", "x = 0" in t1 and "y = 0" in t1)

    func_input.fill("sin(x)")
    func_input.press("Enter")
    wait_for_cards(page, 3)
    t2 = cards.nth(2).inner_text()
    check("sin(x)：周期", "6.283" in t2)

    func_input.fill("log(x)")
    func_input.press("Enter")
    wait_for_cards(page, 4)
    t3 = cards.nth(3).inner_text()
    check("log(x)：定义域", "(0, +∞)" in t3)
    page.screenshot(path=f"{SHOT}/smoke2-4-functions.png")

    # 收起按钮
    page.locator("button[title='收起']").click()
    page.wait_for_timeout(400)
    check("收起按钮：回到边缘标签", page.locator(".drawer-tab").count() == 1)
    # 手动输入函数后自动展开
    page.locator(".drawer-tab").click()
    page.wait_for_timeout(300)
    page.locator("button[title='收起']").click()
    page.wait_for_timeout(300)
    func_input.fill("abs(x)")
    func_input.press("Enter")
    page.wait_for_timeout(800)
    check("有函数时自动展开", page.locator(".drawer-panel").count() == 1)

    # 设置弹窗 + 错误横幅 + 持久化（沿用）
    page.locator("button[title='AI 设置']").click()
    page.wait_for_timeout(300)
    check("设置弹窗", page.locator(".modal").count() == 1)
    page.locator(".modal input[placeholder='sk-...']").fill("sk-fake-key-123")
    page.locator(".modal .btn.primary").click()
    page.wait_for_timeout(300)
    page.locator("textarea.chat-input").fill("求 f(x)=x^2-2x-3 的单调区间")
    page.locator("button.btn.primary").click()
    page.wait_for_selector(".chat-error-banner", timeout=15000)
    check("错误横幅 + 重试", page.locator("button", has_text="重试").count() >= 1)
    page.screenshot(path=f"{SHOT}/smoke2-5-error.png")

    page.reload()
    page.wait_for_load_state("networkidle")
    time.sleep(0.5)
    page.locator(".drawer-tab").click()
    page.wait_for_timeout(300)
    page.locator("button[title='AI 设置']").click()
    page.wait_for_timeout(300)
    key_val = page.locator(".modal input[placeholder='sk-...']").input_value()
    check("刷新后 API Key 持久化", key_val == "sk-fake-key-123")
    page.locator(".modal .btn:not(.primary)").click()
    page.wait_for_timeout(200)
    check("刷新后会话保留", "求 f(x)=x^2-2x-3 的单调区间" in page.locator(".chat-messages").inner_text())
    check("刷新后抽屉宽度持久化", abs(page.locator(".drawer-panel").bounding_box()["width"] - w1) < 3)

    browser.close()

print()
if failures:
    print(f"RESULT: {len(failures)} FAILED -> {failures}")
    sys.exit(1)
print("RESULT: ALL PASS")
```

- [ ] **Step 2: 运行冒烟**

```bash
python scripts/with_server.py --server "npm run dev --prefix C:\Users\QinYe\Desktop\MathsMode" --port 5173 --timeout 60 -- python C:\Users\QinYe\AppData\Local\Temp\opencode\smoke_mathmate2.py
```

（用 `D:\Program Files\Python3.13\python.exe` 作为 python。）
Expected: 除"无 console 错误"类噪声项外全部 PASS（假 Key 会触发浏览器 CORS 日志，属预期噪声，不作为失败判定）。

- [ ] **Step 3: 全量验证**

Run: `npx vitest run`（91 全绿）、`npx tsc --noEmit`（无错误）、`npm run build`（成功）、`npm run tauri build`（成功产出 NSIS 安装包）。

- [ ] **Step 4: 最终提交（如有测试遗漏修正）**

---

## 自检记录（计划作者）

**Spec 覆盖对照：**
- 浅色主题三要素（白底/蓝强调/图表适配）→ Task A
- 抽屉（边缘标签/拖拽 300–720/宽度持久化/自动展开）→ Task B（含 5 个测试用例）
- Tauri Windows 打包（tauri.conf 窗口参数/图标/NSIS）→ Task C
- 冒烟更新与全量验证 → Task D

**类型一致性：** `DrawerPanel` props（analyses/width/onResize/onClose/onOpenSettings）与 App 调用一致；`DrawerTab` 导出与 App 导入一致；`visibleAnalyses` 的 useMemo 依赖 analysesKey（字符串签名）——依赖数组含 eslint-disable 注释（项目无 eslint，仅为可读性）。

**已知注意：** Task A 中 `.right-panel` 类名被替换为 `.drawer-panel`，App 结构在 Task B 同步改；Task B 与 Task A 顺序不能颠倒（B 依赖 A 的 CSS 类）。Tauri 首次构建耗时长（约 5–15 分钟）。
