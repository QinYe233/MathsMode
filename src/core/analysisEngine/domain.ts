/**
 * 定义域（兼容门面）。
 *
 * 实现已迁至 `core/expression/domain.ts`，并改为**声明式函数定义域表**
 * （修复缺陷 E2：旧实现漏判 `asin`/`acos` 等反三角函数）。
 *
 * 本文件保留原有导入路径，使 `analysisEngine` 内部与既有测试无需改动。
 * 新代码请直接从 `core/expression` 或 `core/expression/domain` 导入。
 */
export {
  INF,
  inferDomain,
  inferDomainExact,
  domainMismatch,
  inDomain,
  parseDomainString,
  fmtNum,
  fmtInterval,
  collectConstraints,
  collectConstraintsDetailed,
} from '../expression/domain';
export type { Constraint, ConstraintKind, ConstraintCollection } from '../expression/domain';
