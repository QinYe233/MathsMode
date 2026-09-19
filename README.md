# 数学学习助手 (MathMate)

> **已归档，停止维护（2026-09-19）。** 详见 [ARCHIVED.md](ARCHIVED.md)。MIT 许可不变。

面向高中数学的 Windows 桌面应用：AI 解答数学问题，自动识别其中的函数并绘图、计算函数特性。React + TypeScript + Vite 构建，Tauri 2 打包。

## 特性

- **AI 解答**：OpenAI 兼容 API，SSE 流式输出，120s 超时
- **富文本回复**：Markdown + LaTeX（`$...$`、`$$...$$`、`\(...\)`、`\[...\]`）
- **函数绘图**：多函数对比、图例显隐、缩放平移、悬停坐标
- **特性分析**：定义域、奇偶性、单调区间、极值、零点、渐近线、周期。本地数值计算，不依赖 AI
- **手动输入**：直接输入表达式画图，与 AI 识别的函数走同一分析链路
- **平面向量**：输入 `a=(3,2)` 以箭头绘制
- **会话管理**：多会话增删切换，localStorage 持久化

## 数据流

```
提问 → aiClient（SSE 流式）
     → structuredParser 提取函数（MATH_FUNCTIONS JSON 块 → 正则兜底）
     → analysisEngine 计算特性（Web Worker 中执行）
     → GraphPanel 绘图 + PropertyCard 特性卡片
```

AI 需在解答末尾附上函数元数据块；解析失败时降级为正则扫描 `f(x)=...`，再失败则只显示文字解答。

```json
<!-- MATH_FUNCTIONS -->
{"functions": [{"id": "f", "expr": "x^2 - 2x - 3", "domain": "(-inf, inf)"}]}
<!-- /MATH_FUNCTIONS -->
```

## 技术栈

| | |
|---|---|
| 前端 | React 18 · TypeScript 5.9 · Vite 8（Rolldown） |
| 数学 | mathjs 15 · function-plot 1.25 · d3-selection · KaTeX |
| 桌面 | Tauri 2（仅 Windows NSIS） |
| 测试 | Vitest 5 · Testing Library（jsdom，21 文件 / 215 用例） |

Node 要求 `^22.12.0 || >=24.0.0`。

## 开发

```bash
npm install
npm run dev          # 开发服务器 http://localhost:5173
npm run test         # 测试
npm run build        # tsc 严格检查 + 构建
npm run tauri build  # 打包 Windows NSIS 安装包
```

### 构建产物

`release/0.1.0/` 存放归档时的发布产物（安装包 + exe + SHA256）。自行构建产出在 `src-tauri/target/release/`。

前端构建约 0.5s；Rust release 编译首次约 1m45s，增量约 37s。

### 字体

`src/assets/fonts/` 下 woff2（1.66 MB，首选）与 ttf（5.07 MB，回退）。

```bash
python scripts/subset_font.py                      # 由现有 TTF 生成 woff2
python scripts/subset_font.py --src <全量字体路径>  # 重新子集化 + 转换
```

### 注意事项

- 绘图模块经 `React.lazy` 懒加载。`vite.config.ts` 刻意不为 function-plot / d3 配置 chunk 分组，一旦分组会导致其被提升进主 chunk、懒加载失效。
- 分析在 Web Worker 中执行，不可用时回退主线程。
- 依赖审计需用官方源（镜像源不支持 advisories 接口）：

```bash
npm audit --registry=https://registry.npmjs.org
cd src-tauri && cargo audit
```

## 文档

| 文件 | 内容 |
|------|------|
| [ARCHIVED.md](ARCHIVED.md) | 归档说明、状态、已知开放项 |
| [PROJECT-STATUS.md](PROJECT-STATUS.md) | 技术现状：模块、性能、已知问题、修复记录 |
| [OPENSOURCE-ADOPTION.md](OPENSOURCE-ADOPTION.md) | 开源项目调研 |
| `docs/` | 历史设计与计划（未纳入版本控制），部分内容与代码不符 |

## 许可证

[MIT](LICENSE)
