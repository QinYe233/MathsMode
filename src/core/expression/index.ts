/**
 * 表达式核心层（core/expression）。
 *
 * 本模块是**唯一的**表达式处理入口，统一承担：
 * - 归一化：把人所书写的数学转成 mathjs 语法（`normalize`）
 * - 编译求值：数值求值器与符号求导（`compile`）
 * - 定义域：声明式函数定义域表 + 区间推断（`domain`）
 * - 求根：数值求根（`roots`）
 * - 校验：域感知的表达式校验（`validate`）
 *
 * ## 为什么要抽这一层
 *
 * 此前 `core/mathUtil` 与 `core/analysisEngine` 互相 import，形成双向依赖：
 * 校验需要定义域，而定义域又需要 `mathUtil` 的求值器。后果是**校验只能
 * 用 5 个写死的样本点瞎猜**（缺陷 E1），且手动输入无法复用 AI 链路的
 * 归一化（缺陷 E5）。
 *
 * 抽出本层后依赖方向变为单向：`analysisEngine` → `expression`，
 * 循环解除，两条链路得以共用同一套归一化与定义域能力。
 */

export { normalizeExpr, normalizeForValidation } from './normalize';
export { makeEvaluator, canCompile, derivativeExpr } from './compile';
export { findAllRoots } from './roots';
export type { RootOptions } from './roots';
export { validateExpression } from './validate';
export {
  inferDomain,
  inferDomainExact,
  domainMismatch,
  inDomain,
  parseDomainString,
  fmtNum,
  fmtInterval,
  collectConstraints,
  collectConstraintsDetailed,
  INF,
} from './domain';
export type { Constraint, ConstraintKind, ConstraintCollection } from './domain';
