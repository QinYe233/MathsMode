/**
 * `interval-arithmetic-eval` 的类型声明。
 *
 * 该包（0.5.3）未发布任何 `.d.ts`，但其导出面很小且稳定：
 * `compile(expression)` 返回带 `eval(scope)` 的求值器。
 * 这里按实际运行行为补声明，不做额外假设。
 */
declare module 'interval-arithmetic-eval' {
  /** 宽松的区间端点（本模块只依赖 lo/hi） */
  export interface IntervalLike {
    lo: number;
    hi: number;
  }

  export interface IntervalEvaluator {
    /**
     * 在给定作用域下求值。
     * 数值会被当作单点区间，`{lo, hi}` 会被当作区间。
     */
    eval(scope?: Record<string, number | IntervalLike | [number, number]>): IntervalLike;
  }

  /**
   * 编译表达式为区间求值器。
   * 表达式语法不受支持时**抛错**，调用方需自行 try/catch。
   */
  export default function compile(expression: string): IntervalEvaluator;
}
