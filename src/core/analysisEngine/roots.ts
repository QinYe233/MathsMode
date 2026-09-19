/**
 * 数值求根（兼容门面）。
 *
 * 实现已迁至 `core/expression/roots.ts`——定义域推断依赖求根，
 * 而定义域属于表达式核心层，故一并上移以解除
 * `mathUtil ↔ analysisEngine` 的循环依赖。
 *
 * 新代码请直接从 `core/expression` 导入。
 */
export { findAllRoots } from '../expression/roots';
export type { RootOptions } from '../expression/roots';
