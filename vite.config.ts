/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 700, // mathjs 单 chunk ~666KB（gzip ~192KB），属正常
    // Vite 8 底层换成 Rolldown：`rollupOptions` 已废弃（改用 `rolldownOptions`），
    // 且 `output.manualChunks` 被移除（会报 "manualChunks is not a function"）。
    // 等价能力是 `output.codeSplitting.groups`——每个 group 用 `test` 匹配模块 id。
    rolldownOptions: {
      output: {
        // 注意：function-plot / d3 刻意**不分组**——随 DrawerPanel 动态导入树自然成 chunk，
        // 才能实现绘图模块真正懒加载（分组会导致组件树被提升进主 chunk 而首屏加载）。
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'katex', test: /[\\/]node_modules[\\/]katex[\\/]/, priority: 20 },
            { name: 'math', test: /[\\/]node_modules[\\/]mathjs[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
