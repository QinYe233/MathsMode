import type { FunctionAnalysis } from '../../types';
import {
  AnalysisRunner,
  analyzeOnMainThread,
  type AnalysisPayload,
  type WorkerFactory,
} from './runner';

/**
 * 分析 Worker 客户端：创建 Worker 并导出全局单例 runner。
 *
 * ## 为什么用 `new Worker(new URL(...), { type: 'module' })`
 *
 * 这是 Vite 原生支持的字面量形式：构建时会把 `analysis.worker.ts`
 * 单独打包成独立 chunk，并把这里的 URL 替换成最终资源路径。
 * 因此 Worker 与主包分离，且不会进首屏。
 *
 * ## 兜底
 *
 * 若运行环境没有 `Worker`（jsdom 测试、部分受限 WebView），
 * `createWorker()` 返回 `null`，`AnalysisRunner` 会自动走主线程分片路径。
 */

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    // 某些环境会因安全策略拒绝构造 Worker —— 交给调用方回退
    return null;
  }
}

/**
 * 全局单例 runner。
 *
 * 用单例的原因：Worker 构造有成本，且 `AnalysisRunner` 内部维护
 * 「Worker 不可用」的粘性标记，避免每次分析都重复尝试并失败。
 */
let runner: AnalysisRunner | null = null;

function getRunner(): AnalysisRunner {
  if (!runner) {
    // createWorker 内部已判空；这里再判一次 typeof Worker 是为了
    // 在完全没有 Worker 的环境下直接走主线程，连工厂都不传。
    const factory: WorkerFactory | null =
      typeof Worker === 'undefined' ? null : createWorker;
    runner = new AnalysisRunner(factory, analyzeOnMainThread);
  }
  return runner;
}

/**
 * 异步分析一组函数。
 *
 * 优先在 Worker 中执行（不阻塞主线程）；Worker 不可用时回退主线程，
 * 但仍然**逐函数让出事件循环**，使结果能边算边显示。
 */
export function analyzeFunctions(defs: AnalysisPayload['defs']): Promise<FunctionAnalysis[]> {
  return getRunner().run({ defs, exprs: defs.map((d) => d.expr) });
}

/** 释放单例 Worker（测试收尾或需要重置时使用） */
export function disposeAnalysisWorker(): void {
  runner?.dispose();
  runner = null;
}
