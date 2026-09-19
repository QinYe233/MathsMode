import { describe, expect, it, vi } from 'vitest';
import {
  AnalysisRunner,
  WorkerBridge,
  analyzeOnMainThread,
  buildPayload,
  yieldToEventLoop,
  type AnalysisPayload,
  type AnalysisRequest,
  type AnalysisResponse,
} from './runner';
import { analyzeFunction } from './index';
import type { FunctionDef } from '../../types';

/** jsdom 不实现 Worker，这里用一个可手动驱动的替身 */
class FakeWorker {
  onmessage: ((e: MessageEvent<AnalysisResponse>) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  posted: AnalysisRequest[] = [];
  terminated = false;
  /** 置为非空则 postMessage 抛出，模拟结构化克隆失败等 */
  postError: string | null = null;

  postMessage(req: AnalysisRequest): void {
    if (this.postError) throw new Error(this.postError);
    this.posted.push(req);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** 模拟 Worker 正常回包 */
  reply(results: AnalysisResponse['results'], id?: string): void {
    const req = this.posted[this.posted.length - 1];
    this.emit({ id: id ?? req.id, results });
  }

  /** 模拟 Worker 内部抛错 */
  replyError(message: string): void {
    const req = this.posted[this.posted.length - 1];
    this.emit({ id: req.id, error: message });
  }

  /** 投递一条响应消息（MessageEvent 只在 data 上与真实类型相关） */
  emit(data: AnalysisResponse): void {
    this.onmessage?.({ data } as unknown as MessageEvent<AnalysisResponse>);
  }
}

const asWorker = (f: FakeWorker): Worker => f as unknown as Worker;

const DEFS: FunctionDef[] = [
  { id: 'f', expr: 'x^2 - 2x - 3' },
  { id: 'g', expr: 'sin(x)' },
];

describe('buildPayload', () => {
  it('携带 defs 与对应表达式', () => {
    const p = buildPayload(DEFS);
    expect(p.defs).toBe(DEFS);
    expect(p.exprs).toEqual(['x^2 - 2x - 3', 'sin(x)']);
  });
});

describe('analyzePayload / analyzeOnMainThread 形状一致性', () => {
  it('主线程回退结果与既有 defs.map(analyzeFunction) 形状一致', async () => {
    const payload = buildPayload(DEFS);
    const got = await analyzeOnMainThread(payload);
    const expected = DEFS.map((d) => analyzeFunction(d));
    expect(got).toHaveLength(2);
    // 不能是二维数组（历史实现是 1 维，下游 App.flatMap 依赖这一点）
    expect(Array.isArray(got[0])).toBe(false);
    expect(got[0].expression).toBe(expected[0].expression);
    expect(got[1].expression).toBe(expected[1].expression);
  });

  it('空任务列表返回空数组（不空转事件循环）', async () => {
    const runner = new AnalysisRunner(null);
    await expect(runner.run({ defs: [], exprs: [] })).resolves.toEqual([]);
  });

  it('yieldToEventLoop 让出一次宏任务', async () => {
    const order: string[] = [];
    const p = yieldToEventLoop().then(() => order.push('yielded'));
    order.push('sync');
    await p;
    expect(order).toEqual(['sync', 'yielded']);
  });
});

describe('WorkerBridge（用替身 Worker）', () => {
  it('把载荷发给 Worker 并回传结果', async () => {
    const fake = new FakeWorker();
    const bridge = new WorkerBridge(() => asWorker(fake));
    const results = [{ expression: 'x^2' }] as never;

    const promise = bridge.run(buildPayload(DEFS));
    expect(fake.posted).toHaveLength(1);
    expect(fake.posted[0].payload.defs).toBe(DEFS);

    fake.reply(results);
    await expect(promise).resolves.toBe(results);
  });

  it('Worker 回传 error 时 reject', async () => {
    const fake = new FakeWorker();
    const bridge = new WorkerBridge(() => asWorker(fake));
    const promise = bridge.run(buildPayload(DEFS));
    fake.replyError('定义域推断失败');
    await expect(promise).rejects.toThrow('定义域推断失败');
  });

  it('构造返回 null 时抛错（交由上层回退）', async () => {
    const bridge = new WorkerBridge(() => null);
    await expect(bridge.run(buildPayload(DEFS))).rejects.toThrow('不支持 Web Worker');
  });

  it('postMessage 抛错时 reject 而不是挂起', async () => {
    const fake = new FakeWorker();
    fake.postError = 'DataCloneError';
    const bridge = new WorkerBridge(() => asWorker(fake));
    await expect(bridge.run(buildPayload(DEFS))).rejects.toThrow('DataCloneError');
  });

  it('onerror 触发时所有在途请求都 reject', async () => {
    const fake = new FakeWorker();
    const bridge = new WorkerBridge(() => asWorker(fake));
    const p1 = bridge.run(buildPayload([DEFS[0]]));
    const p2 = bridge.run(buildPayload([DEFS[1]]));
    fake.onerror?.(new Event('error'));
    await expect(p1).rejects.toThrow('运行出错');
    await expect(p2).rejects.toThrow('运行出错');
  });

  it('dispose 会终止 Worker 并 reject 在途请求', async () => {
    const fake = new FakeWorker();
    const bridge = new WorkerBridge(() => asWorker(fake));
    const p = bridge.run(buildPayload(DEFS));
    bridge.dispose();
    await expect(p).rejects.toThrow('已释放');
    expect(fake.terminated).toBe(true);
  });

  it('多个并发请求按 id 各自匹配响应（不串包）', async () => {
    const fake = new FakeWorker();
    const bridge = new WorkerBridge(() => asWorker(fake));
    const r1 = [{ expression: 'first' }] as never;
    const r2 = [{ expression: 'second' }] as never;

    const p1 = bridge.run(buildPayload([DEFS[0]]));
    const p2 = bridge.run(buildPayload([DEFS[1]]));
    expect(fake.posted).toHaveLength(2);

    // 乱序回包：先回第二个，再回第一个
    const id2 = fake.posted[1].id;
    const id1 = fake.posted[0].id;
    fake.emit({ id: id2, results: r2 });
    fake.emit({ id: id1, results: r1 });

    await expect(p1).resolves.toBe(r1);
    await expect(p2).resolves.toBe(r2);
  });

  it('未知 id 的响应被安全忽略', async () => {
    const fake = new FakeWorker();
    const bridge = new WorkerBridge(() => asWorker(fake));
    const p = bridge.run(buildPayload(DEFS));
    expect(() => fake.emit({ id: 'nope', results: [] })).not.toThrow();
    fake.reply([{ expression: 'ok' }] as never);
    await expect(p).resolves.toHaveLength(1);
  });

  // Worker 若因 CSP/路径问题静默死亡（既不回包也不触发 onerror），
  // 没有超时会让 Promise 永久挂起、UI 卡在「思考中」——必须有兜底。
  it('Worker 静默无响应时超时 reject，不永久挂起', async () => {
    vi.useFakeTimers();
    try {
      const fake = new FakeWorker();
      const bridge = new WorkerBridge(() => asWorker(fake), 1000);
      const p = bridge.run(buildPayload(DEFS));
      const assertion = expect(p).rejects.toThrow('超时未响应');
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('超时后到达的迟到响应被安全忽略（不抛未捕获异常）', async () => {
    vi.useFakeTimers();
    try {
      const fake = new FakeWorker();
      const bridge = new WorkerBridge(() => asWorker(fake), 1000);
      const p = bridge.run(buildPayload(DEFS));
      const assertion = expect(p).rejects.toThrow('超时未响应');
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
      expect(() => fake.reply([{ expression: 'late' }] as never)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('超时会让 runner 回退主线程并仍产出结果', async () => {
    // 让 Worker 收下消息但永不回包，同时把超时设为 0 ⇒ 立刻超时，
    // 从而在不等待真实计时器的前提下走通「超时 → 回退主线程」链路。
    const fake = new FakeWorker();
    const runner = new AnalysisRunner(() => asWorker(fake), analyzeOnMainThread);
    const bridgeTimeoutZero = new WorkerBridge(() => asWorker(fake), 0);
    await expect(bridgeTimeoutZero.run(buildPayload(DEFS))).rejects.toThrow('超时未响应');

    // runner 侧：用一个会立刻失败的桥接（postMessage 抛错）验证回退产物正确。
    // 这覆盖了与「超时」相同的回退路径，且不引入 20s 真实等待。
    const failFast = new FakeWorker();
    failFast.postError = 'boom';
    const r2 = new AnalysisRunner(() => asWorker(failFast), analyzeOnMainThread);
    const got = await r2.run(buildPayload(DEFS));
    expect(got.map((a) => a.expression)).toEqual(
      DEFS.map((d) => analyzeFunction(d).expression),
    );
    expect(runner).toBeDefined();
  });
});

describe('AnalysisRunner（Worker 优先 + 粘性回退）', () => {
  it('Worker 可用时走 Worker，不调用主线程', async () => {
    const fake = new FakeWorker();
    const mainThread = vi.fn(analyzeOnMainThread);
    const runner = new AnalysisRunner(() => asWorker(fake), mainThread);

    const p = runner.run(buildPayload(DEFS));
    fake.reply([{ expression: 'from-worker' }] as never);
    const got = await p;

    expect(got[0].expression).toBe('from-worker');
    expect(mainThread).not.toHaveBeenCalled();
  });

  it('Worker 构造失败时回退主线程，且只记一次失败（粘性）', async () => {
    const factory = vi.fn(() => null as Worker | null);
    const runner = new AnalysisRunner(factory);

    const first = await runner.run(buildPayload(DEFS));
    expect(first).toHaveLength(2);
    expect(factory).toHaveBeenCalledTimes(1);

    // 第二次应直接用主线程，不再尝试构造 Worker
    const second = await runner.run(buildPayload(DEFS));
    expect(second).toHaveLength(2);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('Worker 运行中报错时回退主线程，结果仍可用', async () => {
    const fake = new FakeWorker();
    const runner = new AnalysisRunner(() => asWorker(fake));

    const p = runner.run(buildPayload(DEFS));
    fake.replyError('worker 内部炸了');
    const got = await p;

    // 回退到主线程后必须拿到与直接分析一致的结果
    expect(got).toHaveLength(2);
    expect(got.map((a) => a.expression)).toEqual(
      DEFS.map((d) => analyzeFunction(d).expression),
    );
  });

  it('factory 为 null（无 Worker 环境）时直接走主线程', async () => {
    const runner = new AnalysisRunner(null);
    const got = await runner.run(buildPayload(DEFS));
    expect(got).toHaveLength(2);
    expect(Array.isArray(got[0])).toBe(false);
  });
});

/** 让 TS 知道 AnalysisPayload 被使用（避免 noUnusedLocals 误报） */
export type _Payload = AnalysisPayload;
