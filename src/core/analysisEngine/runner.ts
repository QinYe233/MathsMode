import type { FunctionAnalysis, FunctionDef } from '../../types';
import { analyzeFunction } from './index';

/**
 * 函数特性分析的任务调度（缺陷 W11）。
 *
 * ## 问题
 *
 * `analyzeFunction` 是同步且昂贵的：实测单函数 53–146 ms（`tan(x)` 最重），
 * 比较题 3 个函数可达 200–450 ms。`useChat` 此前用
 * `defs.map(d => analyzeFunction(d))` 一次性串行调用，
 * 期间**主线程完全冻结**——流式回复刚结束，UI 会卡住数百毫秒。
 *
 * ## 方案（两级）
 *
 * 1. **首选 Web Worker**：`analysisEngine` 本来就是纯函数、不依赖 React，
 *    天然适合搬进 Worker。单例桥接负责按 id 匹配请求/响应。
 * 2. **回退主线程 + 分片让出**：Worker 不可用时（jsdom 测试环境、受限 WebView 等）
 *    退回主线程，但**每算完一个函数就 `await` 让出一次事件循环**，
 *    使已算完的结果能先渲染出来，而不是整段阻塞。
 *
 * 两条路径对外行为一致（都返回 `FunctionAnalysis[]`），调用方无需区分。
 */

/** 送入 Worker / 主线程回退的载荷 */
export interface AnalysisPayload {
  defs: FunctionDef[];
  /** 每个 def 对应的表达式（与 defs 等长） */
  exprs: string[];
}

export interface AnalysisRequest {
  id: string;
  payload: AnalysisPayload;
}

export interface AnalysisResponse {
  id: string;
  results?: FunctionAnalysis[];
  error?: string;
}

/**
 * 由任务列表构建载荷。
 *
 * `FunctionAnalysis.expression` 正是 `analyzeFunction` 内部 trim 后的输入，
 * 因此这里把 exprs 一并传出，便于诊断与未来扩展。
 */
export function buildPayload(defs: FunctionDef[]): AnalysisPayload {
  return { defs, exprs: defs.map((d) => d.expr) };
}

/**
 * 主线程分析：与 Worker 内执行的逻辑完全一致，保证两条路径结果相同。
 *
 * 返回值形状与既有 `defs.map(d => analyzeFunction(d))` **完全一致**
 * （`FunctionAnalysis[]`，每个 def 一个分析结果），故下游类型无需改动。
 */
export function analyzePayload(payload: AnalysisPayload): FunctionAnalysis[] {
  return payload.defs.map((d) => analyzeFunction(d));
}

/** 让出一次事件循环，使已完成的渲染有机会提交 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 主线程回退路径：**逐函数**分析，每个之间让出一次事件循环。
 *
 * 与一次性 map 的区别：首个函数算完后 UI 即可渲染该函数的特性卡片，
 * 而不是等到全部算完。总耗时略增，但**可感知的冻结时长降为单函数量级**。
 */
export async function analyzeOnMainThread(
  payload: AnalysisPayload,
): Promise<FunctionAnalysis[]> {
  const out: FunctionAnalysis[] = [];
  for (const d of payload.defs) {
    out.push(analyzeFunction(d));
    // 最后一个之后无需再让出（调用方马上要提交结果）
    if (out.length < payload.defs.length) await yieldToEventLoop();
  }
  return out;
}

/** 构造 Worker 的工厂；测试可注入替身。返回 null 表示该环境不可用 */
export type WorkerFactory = () => Worker | null;

interface Pending {
  resolve: (results: FunctionAnalysis[]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Worker 桥接：单例 Worker + 按 id 匹配的请求/响应表。
 *
 * 任何环节失败（构造抛错、onerror、worker 内异常、超时）都会 reject，
 * 由上层 `AnalysisRunner` 决定是否回退主线程。
 *
 * ⚠️ 超时兜底是必要的：若 Worker 脚本因 CSP/路径问题**静默死亡**
 * （既不触发 onerror 也不回包），没有超时就会让 Promise 永久挂起，
 * UI 卡在「思考中」——这比明确失败更糟。
 */
export class WorkerBridge {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, Pending>();
  private seq = 0;

  constructor(
    private readonly factory: WorkerFactory,
    /** 单次请求超时（毫秒）；超时即视为 Worker 不可用 */
    private readonly timeoutMs = 20_000,
  ) {}

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = this.factory();
    if (!w) throw new Error('当前环境不支持 Web Worker');
    w.onmessage = (e: MessageEvent<AnalysisResponse>) => this.handleMessage(e.data);
    w.onerror = () => this.failAll(new Error('分析 Worker 运行出错'));
    this.worker = w;
    return w;
  }

  private handleMessage(data: AnalysisResponse): void {
    const entry = this.pending.get(data.id);
    if (!entry) return; // 已超时或已释放的请求
    this.pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.error) entry.reject(new Error(data.error));
    else entry.resolve(data.results ?? []);
  }

  private failAll(err: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }

  async run(payload: AnalysisPayload): Promise<FunctionAnalysis[]> {
    const worker = this.ensureWorker();
    const id = `an-${++this.seq}`;
    return new Promise<FunctionAnalysis[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('分析 Worker 超时未响应'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        const req: AnalysisRequest = { id, payload };
        worker.postMessage(req);
      } catch (e) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** 释放 Worker（应用退出或需要重置时调用） */
  dispose(): void {
    this.failAll(new Error('分析 Worker 已释放'));
    this.worker?.terminate();
    this.worker = null;
  }
}

/**
 * 任务运行器：优先 Worker，失败则回退主线程分片。
 *
 * 具备**粘性回退**：一旦 Worker 失败过，后续请求直接走主线程，
 * 避免每次分析都先付出一次失败的构造开销。
 */
export class AnalysisRunner {
  private bridge: WorkerBridge | null = null;
  private workerUnavailable = false;

  constructor(
    private readonly factory: WorkerFactory | null,
    private readonly mainThread: (
      payload: AnalysisPayload,
    ) => Promise<FunctionAnalysis[]> = analyzeOnMainThread,
  ) {}

  async run(payload: AnalysisPayload): Promise<FunctionAnalysis[]> {
    if (payload.defs.length === 0) return [];

    if (this.factory && !this.workerUnavailable) {
      try {
        this.bridge ??= new WorkerBridge(this.factory);
        return await this.bridge.run(payload);
      } catch {
        // Worker 路径不可用：粘性关闭并回退
        this.workerUnavailable = true;
        this.bridge?.dispose();
        this.bridge = null;
      }
    }
    return this.mainThread(payload);
  }

  dispose(): void {
    this.bridge?.dispose();
    this.bridge = null;
  }
}
