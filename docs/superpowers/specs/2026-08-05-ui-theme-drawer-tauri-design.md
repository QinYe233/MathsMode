# 数学学习助手 — 增量设计：浅色主题 + 抽屉面板 + Tauri 打包

日期：2026-08-05（基于 2026-08-05 基础设计文档的增量）
状态：已确认

## 1. 目标

在既有应用（Vite+React+TS，AI 解答 + 函数图像/特性）上做三个增量改造：
1. UI 全面切换为**浅色主题**（干净白 + 蓝色强调）
2. 右侧函数面板改为**抽屉式**：完全收起为边缘标签，展开后左边缘可拖拽调宽
3. 用 **Tauri 封装为 Windows 桌面应用**

## 2. 已确认决策

| 决策点 | 结论 |
|--------|------|
| 浅色风格 | 干净白底 + 蓝色强调（#2563eb 系） |
| 抽屉行为 | 完全收起 + 右侧竖向标签；展开后左边缘拖拽调宽（300–720px）；有函数时自动展开 |
| Tauri 范围 | 仅 Windows 安装包（NSIS），无额外桌面增强 |

## 3. 浅色主题

**配色变量**（global.css 定义 `:root` CSS 变量，全部组件类改引用变量）：

| 变量 | 值 | 用途 |
|------|-----|------|
| --bg | #f5f7fa | 应用背景 |
| --panel | #ffffff | 面板/卡片/弹窗 |
| --panel-2 | #f8fafc | 次级面板（输入框/图例按钮底） |
| --text | #1a2233 | 主文字 |
| --text-dim | #64748b | 次要文字/标签 |
| --border | #e2e8f0 | 边框/分隔线 |
| --accent | #2563eb | 强调蓝（主按钮/选中态/标签） |
| --accent-soft | #dbeafe | 浅蓝底（用户气泡/悬停） |
| --danger | #dc2626 | 错误/删除 |

- 用户气泡：accent 底 + 白字；AI 气泡：panel-2 底 + text 字 + border 边
- 图例曲线色加深适配白底：`['#2563eb', '#f59e0b', '#16a34a', '#ef4444', '#8b5cf6', '#06b6d4']`
- function-plot 浅色覆盖（`.function-plot` 后代选择器）：坐标轴/网格线 `#e2e8f0`，文字 `#64748b`，tip 白底深字
- `color-scheme: light`
- 弹窗、侧栏、输入框、错误横幅同步浅色

## 4. 抽屉式右面板

**布局**：`.app` grid 三列 `44px | 1fr | 可变宽`。右面板宽度为 App 状态 `drawerWidth`（默认 420），拖拽范围钳制 300–720，**持久化** localStorage key `mathmate.drawer.v1`。

**收起态**：不渲染右面板，改为右侧边缘固定竖向标签「函数图像」（accent 蓝底白字，竖排，点击展开）。

**展开态**：右面板含左边缘拖拽手柄（6px 悬停区，`cursor: col-resize`；Pointer Events：down 捕获 → move 更新宽度（钳制）→ up 持久化）+ 头部折叠按钮（»）。

**自动展开**：`visibleAnalyses` 从 0 → >0（AI 回复带函数或手动输入）时自动展开（用 ref 记录上次数量，仅在 0→n 跳变时触发，不打扰用户手动收起）。

**组件**：
- `App.tsx`：drawerOpen / drawerWidth 状态、布局切换、自动展开 effect
- 新建 `src/components/DrawerPanel.tsx`：拖拽手柄 + 头部 + GraphPanel 组合（props: open, width, onResize, onClose, analyses）
- 标签作为独立小组件（可放 DrawerPanel 内导出 `DrawerTab`）

## 5. Tauri（仅 Windows）

- devDep：`@tauri-apps/cli@^2`
- `src-tauri/`：`Cargo.toml`（tauri 2 / tauri-build 2）、`build.rs`、`src/main.rs`（默认 App.run）、`tauri.conf.json`（productName `MathMate`、identifier `com.mathmate.app`、窗口 1280×800 min 960×640、devUrl http://localhost:5173、frontendDist ../dist、beforeDevCommand `npm run dev`、beforeBuildCommand `npm run build`）、`capabilities/default.json`（core:default）
- 图标：PowerShell System.Drawing 生成 1024×1024 PNG（蓝底白字）→ `npx tauri icon` 导出全套
- `vite.config.ts`：`server: { port: 5173, strictPort: true }`
- `.gitignore` 追加 `src-tauri/target/`
- package.json 增加 script `"tauri": "tauri"`
- 验证：`npm run tauri build` 产出 `src-tauri/target/release/bundle/nsis/*.exe`；现有 vitest 不受影响

## 6. 测试

- vitest：App.test 现有用例需兼容抽屉初始收起（自动展开逻辑保证函数卡片仍出现）；新增抽屉用例（初始收起显示标签 → 点击展开显示空态）
- Playwright 冒烟更新：初始=抽屉收起（标签可见）→ 点标签展开 → 函数特性检查（沿用）→ 拖拽手柄调宽断言 → 设置/错误/持久化沿用
- 全量验证：`npx vitest run`、`npx tsc --noEmit`、`npm run build`、`npm run tauri build`、Playwright 冒烟

## 7. 已知限制

- Tauri 首构建需编译全部 Rust 依赖（约 5–15 分钟，取决于机器）
- 抽屉拖拽宽度只持久化宽度，不持久化开合状态（每次启动默认收起，遇函数自动展开）
