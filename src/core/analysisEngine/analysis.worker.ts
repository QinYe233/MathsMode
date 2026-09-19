import type { AnalysisRequest, AnalysisResponse } from './runner';
import { analyzePayload } from './runner';

/**
 * 分析 Worker 入口。
 *
 * 这里只做「收消息 → 调纯函数 → 回消息」，不含任何业务判断，
 * 以保证 Worker 路径与主线程回退路径的结果**逐字节一致**
 * （两条路径都调用同一个 `analyzePayload`）。
 */
self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  const { id, payload } = e.data;
  try {
    const results = analyzePayload(payload);
    const res: AnalysisResponse = { id, results };
    self.postMessage(res);
  } catch (err) {
    // 计算失败要回传错误，否则调用方会一直等下去
    const res: AnalysisResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(res);
  }
};
