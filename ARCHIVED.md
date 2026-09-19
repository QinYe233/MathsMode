# 项目已归档

> **本仓库已停止维护。** 不再接受新功能、缺陷修复、依赖更新或问题反馈。

| 项 | 值 |
|----|-----|
| 状态 | **已归档（Archived）** |
| 归档日期 | 2026-09-19 |
| 仓库 | `QinYe233/MathsMode`（分支 `master`） |
| **归档提交** | **`HEAD`** —— 提交信息以「`chore: 归档项目并合并全部修复成果`」开头 |
| 归档前的最后提交 | `51db9dd`（2026-08-07） |
| 项目名 | MathMate（数学学习助手） |
| 许可证 | MIT —— **归档不改变许可**，仍可自由使用、修改、分发 |
| 平台 | 仅 Windows（Tauri 2 / NSIS） |

> **归档提交就是 `HEAD`**（可用 `git log -1` 查看确切哈希）。
> 本文档不写死哈希 —— 因为文档本身也在这笔提交里，写死会导致每次修订都失效。
>
> 该提交**已包含归档前的全部修复与清理成果**，工作区干净。
> 因此 `git clone` 后即可得到与本文档描述一致的状态。

---

## 1. 归档意味着什么

**仍然可以做的事**（MIT 许可继续有效）：

- 阅读、克隆、派生（fork）本仓库
- 按 `README.md` 的步骤自行构建
- 修改并用于任何目的（含商业用途）

**不再做的事**：

- ❌ 不修复缺陷
- ❌ 不更新依赖（**因此下文 §4 的「已知开放项」将长期保持现状**）
- ❌ 不回应 issue / PR
- ❌ 不发布新的构建产物

> ⚠️ **安全提示**：依赖漏洞数据库会随时间增长。归档时（2026-09-19）本项目的
> npm 与 Rust 依赖均为 **0 已知漏洞**，但**归档后不会再有人升级依赖**。
> 若你要长期使用或部署，请自行重新执行 `npm audit` 与 `cargo audit` 并评估。

---

## 2. 归档时的状态快照（全部实测）

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 类型检查 | `npx tsc --noEmit` | ✅ 通过（严格模式） |
| 单元测试 | `npm test` | ✅ **21 文件 / 215 用例全绿** |
| 前端构建 | `npm run build` | ✅ 成功，~0.5 s |
| 依赖漏洞（JS） | `npm audit` | ✅ **0 漏洞**（332 包） |
| 依赖漏洞（Rust） | `cd src-tauri && cargo audit` | ✅ **0 漏洞**（430 crate） |
| 桌面打包 | `npm run tauri build` | ✅ 成功，NSIS 安装包 |
| exe 启动 | 启动 + 存活检查 | ✅ 进程存活，窗口标题 `数学学习助手` |

**构建产物**：

| 产物 | 大小 |
|------|------|
| `src-tauri/target/release/mathmate.exe` | 13.44 MB |
| `src-tauri/target/release/bundle/nsis/MathMate_0.1.0_x64-setup.exe` | 6.91 MB |

```
SHA256 (installer): DD8CECE94925D51802C45E0C03919897DEC8F4F9D644CC3B6A37B278FF6ABEE0
SHA256 (binary)   : 0BC7381AA1075A7DD3A2C33F3BA9794F58C2D109AAC3420602C525D8C3FA0B35
```

**技术栈（归档时的最终版本）**：

- React 18.3 · TypeScript 5.9 · Vite 8.3（Rolldown 内核）· Vitest 5.0
- mathjs 15.2 · function-plot 1.25 · d3-selection 3 · KaTeX 0.16 · react-markdown 10
- Tauri 2（`@tauri-apps/cli` 2.11）
- Node 要求：`^22.12.0 || >=24.0.0`

---

## 3. 归档前完成了什么

项目在被归档前经历了一轮系统性的缺陷审计与修复（详见 `PROJECT-STATUS.md` §10 / §12 / §13 / §14 / §15 / §16）：

**审计出 26 项缺陷并全部处理**：

| 等级 | 数量 | 内容概要 |
|------|------|----------|
| 🔴 Error | 5 | 表达式校验误拒合法输入、反三角函数定义域漏判、周期函数单调区间标注错误、求根窗口外解被静默丢弃、手动输入不支持 `x²`/`√x` |
| 🟡 Warning | 11 | 极点扫描范围自相矛盾、AI 定义域无交叉校验、奇偶性/周期采样不足、定义域输出爆炸、无错误边界、CSP 为空、图例配色漂移、分析阻塞主线程 等 |
| 🟢 Note | 10 | 字体 5.32 MB 无 woff2、审计工具不可用、无 CI、死依赖/死代码 等 |

**修复成效**：

- 测试从 **170 → 215** 用例（新增均为回归测试）
- 字体体积 **−67.4%**（5.32 MB TTF → 1.66 MB woff2，且 woff2 为首选加载项）
- 构建耗时 **6.7 s → 0.5 s**（Vite 8 / Rolldown）
- 分析移入 Web Worker，消除主线程 200–450 ms 冻结
- npm + Rust 双侧依赖漏洞 **清零**

**修复过程中另外发现并处理的问题**（不在原 26 项内）：

- `mathjs` 高危漏洞（影响求值路径）→ 升级 15.2.0
- `vitest` 严重漏洞 + `vite` 高危漏洞 → 升级 vite 8 / vitest 5
- `abs(sin(x))` 周期被算成 2π（实际 π）
- 求根自适应放宽后，残留过滤把刚找到的根丢掉

---

## 4. ⚠️ 已知开放项（归档时未完成，且不会再修）

这些是**明确记录在案、归档后保持现状**的遗留问题：

### 4.1 未验证的部分（不是「已知有错」，而是「没测过」）

| 项 | 说明 |
|----|------|
| **Web Worker 在真实 WebView2 中的执行** | Worker chunk 已确认正确产出、被引用、HTTP 可取，但与主线程共用同一分析函数这一层是静态验证。若 WebView2 拒绝 module worker，代码会自动回退主线程并**保证结果正确**，只是失去「不阻塞」的收益 |
| **Tauri CSP 的运行时影响** | `src-tauri/tauri.conf.json` 中已配置最小可用 CSP，但**单测覆盖不到**。若策略过严可能在运行期拦截资源 |
| **真实交互流程** | 只验证了「进程能启动 + 窗口标题正确」，**未**实测提问、绘图、抽屉等交互 |
| **安装包安装/卸载流程** | 未实际运行 `setup.exe` 走一遍 |
| **WebView2 运行时依赖** | Win10/11 通常预装；按需引导安装的路径未实测 |

### 4.2 经评估后有意保留的项

| 项 | 保留理由 |
|----|----------|
| `g.function` 位置索引（`GraphPanel`） | function-plot 无稳定的逐曲线标识，替代写法风险等价 |
| 绘图标注上限 40 | 高频函数的极值可达数百，该上限是**必要的防爆炸保护** |
| `App.tsx` 职责较重（~180 行） | 拆分 hook 的收益低于回归风险 |
| 定义域存在重复扫描 | 与新增的区间算术交叉校验有语义耦合，改动风险高于收益 |
| 求根窗口自适应仅覆盖多项式 | 非多项式无法给出严格根界，改用启发式曾导致单次分析从 60 ms 恶化到 65 s |

### 4.3 环境性限制

| 项 | 说明 |
|----|------|
| 字体子集化脚本 | `scripts/subset_font.py` 需要原始全量字体才能重新子集化；仅由现有 TTF 生成 woff2 则不需要 |
| `npm audit` | 需显式指定 `--registry=https://registry.npmjs.org`（镜像源 npmmirror 不实现 advisories 接口） |
| Rust 审计 | 需先 `cargo install cargo-audit`；忽略项逐条登记在 `src-tauri/.cargo/audit.toml`（均为 Windows 上不编译的 Linux/GTK 传递依赖） |

---

## 5. 如何自行构建与验证

```bash
# 前置：Node ^22.12.0 || >=24.0.0；Rust 工具链（含 x86_64-pc-windows-msvc target）
npm install

# 验证
npx tsc --noEmit            # 类型检查
npm test                    # 215 个用例
npm run build               # 前端构建

# 桌面运行 / 打包
npm run tauri dev           # 开发模式运行
npm run tauri build         # 产出 NSIS 安装包
```

依赖安全复核（归档后建议自行重跑）：

```bash
npm audit --registry=https://registry.npmjs.org
cd src-tauri && cargo audit
```

---

## 6. 文档导航

本仓库的文档分为两层，**阅读时请注意区分**：

### 状态类（描述「实际是什么」，可作事实依据）

| 文档 | 内容 |
|------|------|
| **`PROJECT-STATUS.md`** | **单一事实来源**：验证基线、技术栈实际版本、模块职责、实测性能、已知问题、各轮修复记录 |
| **`DEFECT-AUDIT.md`** | 26 项缺陷的分级审计，含**运行时实测证据**、复现方法与修复方案 |
| **`OPENSOURCE-ADOPTION.md`** | 开源项目调研与采纳评估（含「clone 替换」可行性判定） |

### 历史类（记录「当时打算做什么」，**部分内容与最终代码不符**）

| 文档 | 状态 |
|------|------|
| `README.md` | 已对齐最终代码 |
| `PLAN.md` / `PLAN-UI.md` | 历史计划；`PLAN-UI.md` 中的深色模式相关任务**已被撤销**（commit `4598f72`） |
| `docs/superpowers/**` | 设计快照与实施计划；已就地补注勘误，**不改写历史原文** |

> **重要**：`docs/` 目录在 `.gitignore` 中，因此这些历史文档**不在版本控制内**。
> 若你通过 clone 获取本仓库，可能看不到 `docs/`。这是既有约定，归档时保持原样。

---

## 7. 归档清理（2026-09-19）

归档时执行了一次**深度冗余清理**，让仓库只保留「源码 + 文档 + 发布产物」。

### 7.1 删除内容

| 项 | 大小/数量 | 删除理由 |
|----|-----------|----------|
| `src-tauri/target/` | **约 3.8 GB** | Rust 构建缓存，`npm run tauri build` 可完全重建（且本就在 `.gitignore` 中） |
| `dist/` | 10 MB | 前端构建产物，`npm run build` 可重建（且本就在 `.gitignore` 中） |
| `.superpowers/` | — | 外部工具（brainstorm）的运行状态，非项目材料 |
| `src-tauri/icons/{android,ios}/` + `Square*` + `StoreLogo*` | **45 个文件** | 由 `npx tauri icon` 一并导出，但本项目**仅打包 Windows NSIS**，从未被构建引用 |
| `lazy_check.txt` | 230 B | 早期懒加载验证的临时日志，所指的旧 chunk 文件名（Vite 5 时代）已完全失效 |
| `scripts/font_chars.txt` | 24 KB | 由 `subset_font.py` 的 `build_charset()` **确定性生成**；已改为写入系统临时目录，不再落盘到仓库 |
| `scripts/__pycache__/` | — | Python 字节码缓存 |

**共释放约 3,818 MB**（工作区从 3,985.7 MB 降至 167.0 MB）。

### 7.2 随之调整的配置

| 文件 | 调整 |
|------|------|
| `src-tauri/tauri.conf.json` | `bundle.icon` 移除 `icons/icon.icns`（macOS 专用 —— 本项目无 macOS 目标，且其依赖的 iOS 图标已删） |
| `scripts/subset_font.py` | 字符集清单改为写入**临时文件**（`tempfile`），并在用后清理；不再污染仓库 |
| `.gitignore` | 补 `__pycache__/`、`*.pyc`；并显式注明 `release/` 下的发布产物**有意提交** |

### 7.3 保留内容及理由

| 项 | 保留理由 |
|----|----------|
| `app-icon.png` | **图标源文件**。保留它即可用 `npx tauri icon app-icon.png` 重新导出全套图标（含已删除的移动端/Store 图标） |
| `src-tauri/icons/{32x32,128x128,128x128@2x}.png`、`icon.ico` | `tauri.conf.json` 实际引用 |
| `src-tauri/icons/{64x64,icon}.png`、`icon.icns` | 未被当前配置引用，但体积极小（52 KB）、属标准图标集，保留以备将来扩展目标平台 |
| `MapleMono-CN-Regular.ttf`（5.07 MB） | woff2 的回退字体（`@font-face` 的第二源）。虽绝大多数环境只加载 woff2，但删掉会失去回退能力 |
| `release/0.1.0/` | **发布产物**：NSIS 安装包 + 独立 exe + SHA256 校验和。归档的核心价值之一就是「拿到就能用」 |
| `package-lock.json` / `src-tauri/Cargo.lock` | 锁定依赖版本 —— 归档项目尤其需要，否则将来无法复现构建 |
| `docs/` | 历史设计与计划文档（虽在 `.gitignore` 中，但保留在磁盘上供追溯） |

### 7.4 清理后的验证

清理**不是**只删文件就结束——删完必须证明项目仍可构建。已重跑全链路：

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 通过 |
| `npm test` | ✅ **21 文件 / 215 用例全绿** |
| `npm run build` | ✅ 成功（437 ms） |
| `npm run tauri build` | ✅ 成功 —— 证明删除移动端图标后 NSIS 打包**未受影响** |

---

## 8. 仓库状态

**归档提交（`HEAD`）已包含全部修复、清理与文档成果，工作区干净（`git status` 无输出）。**

归档提交的内容规模：

```
107 files changed, 4878 insertions(+), 674 deletions(-)
  新增 27 个文件 · 修改 33 个 · 删除 47 个（冗余清理）
```

因此 `git clone` 后即可得到与本文件描述**完全一致**的状态，无需任何额外步骤。

> **关于行尾**：`.gitattributes` 声明 `* text=auto eol=lf`。归档提交时
> `PLAN.md`、`PLAN-UI.md` 等原本为 CRLF 的文件被规范化为 LF，
> 但这**没有**造成整文件 diff（实测 `PLAN.md` 仅 +97/−71 行，为内容标注而非行尾重写）。

---

## 9. 致谢

MIT 许可下的版权声明与许可条款继续有效，详见 [`LICENSE`](LICENSE)。

感谢所有为这个项目付出过的时间。
