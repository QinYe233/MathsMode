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
    chunkSizeWarningLimit: 700, // mathjs 单 chunk ~607KB（gzip ~150KB），属正常
    rollupOptions: {
      output: {
        // 对象形式：Rollup 自动把共享依赖归入合适 chunk，避免函数式拆分的循环依赖。
        // 注意：function-plot/d3 刻意不分组——随 DrawerPanel 动态导入树自然成 chunk，
        // 才能实现绘图模块真正懒加载（分组会导致组件树被提升进主 chunk 而首屏加载）。
        manualChunks: {
          react: ['react', 'react-dom', 'scheduler'],
          katex: ['katex'],
          math: ['mathjs', 'complex.js', 'fraction.js', 'decimal.js'],
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
