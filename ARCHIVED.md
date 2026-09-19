# 项目已归档

**本仓库自 2026-09-19 起停止维护**：不修缺陷、不更新依赖、不回应 issue / PR。

| | |
|---|---|
| 归档提交 | `HEAD`（提交信息以 `chore: 归档项目并合并全部修复成果` 开头） |
| 归档前提交 | `51db9dd`（2026-08-07） |
| 许可证 | MIT，归档不改变许可，仍可自由使用与分发 |
| 平台 | 仅 Windows（Tauri 2 / NSIS） |

## 归档时状态

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | 通过 |
| `npm test` | 21 文件 / 215 用例全绿 |
| `npm run build` | 成功 |
| `npm audit` / `cargo audit` | 0 漏洞 / 0 漏洞 |
| `npm run tauri build` | 成功 |

技术栈：React 18.3 · TypeScript 5.9 · Vite 8.3 · Vitest 5.0 · mathjs 15.2 · Tauri 2 · Node `^22.12.0 || >=24.0.0`

归档时的发布产物（NSIS 安装包 6.91 MB、独立 exe 13.44 MB、`SHA256SUMS.txt`）已从仓库移除，需要时用 `npm run tauri build` 重新构建。

> NSIS 会嵌入构建时间戳，同一源码两次构建哈希不同，属不可复现构建。

## 归档前完成的工作

审计出 26 项缺陷（Error 5 / Warning 11 / Note 10）并全部处理，测试从 170 增至 215 用例。主要修复：

- **表达式校验**不再误拒 `log(x-4)`、`sqrt(x-5)` 等定义域外有效的表达式
- **定义域推断**改为声明式函数表，修正 `asin`/`acos` 被算成全体实数
- **求根**支持窗口外的根（Cauchy 根界），修正 `(x-2000)(x-1)` 只报一个零点
- **周期**修正 `abs(sin(x))` 被算成 2π（实际 π）
- **手动输入**支持 `x²`、`√x` 等写法（此前只归一化 AI 返回的表达式）
- **分析移入 Web Worker**，消除流式结束后主线程 200–450 ms 冻结
- **字体** TTF → woff2，5.32 MB → 1.66 MB
- **依赖漏洞**：mathjs 升级 15.2.0、vite 升级 8.3、vitest 升级 5.0，两侧审计归零

详见 [PROJECT-STATUS.md](PROJECT-STATUS.md)。

## 已知开放项

均不会再修，列出以免误用。

**未验证**（非已知有错，是没测过）：

- Web Worker 在真实 WebView2 中是否正常执行 —— 若被拒绝会自动回退主线程，结果仍正确，只是失去不阻塞的收益
- Tauri CSP 的运行时影响 —— 单元测试覆盖不到，策略过严可能在运行期拦截资源
- 真实交互流程（提问、绘图、抽屉）与安装包安装/卸载流程

**有意保留**：

- 求根窗口自适应仅覆盖多项式 —— 非多项式无严格根界，改用启发式曾使单次分析从 60 ms 恶化到 65 s
- 绘图标注上限 40 —— 高频函数极值可达数百，该上限是必要的防爆炸保护
- `App.tsx` 分工未拆 —— 收益低于回归风险

**环境限制**：

- 依赖审计需用官方源：镜像源（npmmirror）不实现 advisories 接口
- Rust 侧审计需先 `cargo install cargo-audit`；忽略项登记在 `src-tauri/.cargo/audit.toml`
- 字体重新子集化需要原始全量字体；仅生成 woff2 则不需要

## 自行构建

```bash
npm install
npx tsc --noEmit
npm test
npm run tauri build     # 需要 Rust 工具链与 x86_64-pc-windows-msvc target
```

## 归档清理

归档时删除了可再生产物，释放约 3.8 GB：

| 删除项 | 说明 |
|---|---|
| `src-tauri/target/` | Rust 构建缓存，可完全重建 |
| `dist/` | 前端构建产物 |
| 移动端与 Windows Store 图标 45 个 | `npx tauri icon` 一并导出，本项目仅打包 NSIS，从未被引用 |
| `lazy_check.txt` | 早期验证日志，所指 chunk 名已随 Vite 8 失效 |
| `scripts/font_chars.txt` | 由脚本确定性生成，已改为写临时目录 |

保留 `app-icon.png`（图标源，可用 `npx tauri icon app-icon.png` 重新导出全套）与 `MapleMono-CN-Regular.ttf`（woff2 的回退源）。

清理后已从零完整重建验证通过。

## 文档说明

| 文件 | 性质 | 在版本控制内 |
|---|---|---|
| `ARCHIVED.md`、`PROJECT-STATUS.md` | 事实依据，描述实际状态 | 是 |
| `OPENSOURCE-ADOPTION.md` | 归档前的开源项目调研记录 | 是 |
| `docs/**` | 开发过程的设计文档与实施计划 | **否** |

`docs/` 目录有意不入版本控制（见 `.gitignore`），其中包含 `docs/README.md` 索引与
`docs/superpowers/**` 的设计快照、实施计划。这些是开发过程的历史记录，部分内容与最终代码不符
（例如深色模式相关设计已作废）。clone 后看不到该目录属预期行为。

深色模式相关任务（原 1.3 / 1.4）虽曾标记为完成，实际已被撤销 —— 应用现为固定浅色主题。

## 说明

- 归档提交已包含全部成果，工作区干净，`git clone` 即可复现上述状态
- `.gitattributes` 声明 `* text=auto eol=lf`，归档提交时把原本 CRLF 的文件规范化为 LF，未造成整文件 diff
- 归档后依赖漏洞库仍会增长而无人升级，长期使用请自行重跑审计

MIT 许可与版权声明继续有效，详见 [LICENSE](LICENSE)。
