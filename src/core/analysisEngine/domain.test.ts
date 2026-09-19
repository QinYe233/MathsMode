import { describe, expect, it } from 'vitest';
import { inferDomain, inDomain, parseDomainString, fmtInterval, collectConstraintsDetailed } from './domain';

describe('inferDomain', () => {
  it('多项式为全体实数', () => {
    expect(fmtInterval(inferDomain('x^2 - 2x - 3'))).toEqual(['(−∞, +∞)']);
  });
  it('分式排除分母零点', () => {
    expect(fmtInterval(inferDomain('1/x'))).toEqual(['(−∞, 0)', '(0, +∞)']);
  });
  it('对数要求真数大于零', () => {
    expect(fmtInterval(inferDomain('log(x)'))).toEqual(['(0, +∞)']);
  });
  it('平方根要求被开方数非负', () => {
    expect(fmtInterval(inferDomain('sqrt(1 - x^2)'))).toEqual(['[−1, 1]']);
  });
  it('正切排除极点', () => {
    const ivs = inferDomain('tan(x)');
    expect(ivs.every((iv) => Math.abs(Math.cos((iv.lo + iv.hi) / 2)) > 0.5)).toBe(true);
    expect(ivs[0].lo).toBeLessThan(-1.5);
  });
  it('sqrt(1/x) 排除负数（子表达式极点分区）', () => {
    expect(fmtInterval(inferDomain('sqrt(1/x)'))).toEqual(['(0, +∞)']);
  });
  it('sqrt(x/(x-1)) 分式符号', () => {
    expect(fmtInterval(inferDomain('sqrt(x/(x - 1))'))).toEqual(['(−∞, 0]', '(1, +∞)']);
  });
  it('log(x^2 - 1) 多区间', () => {
    expect(fmtInterval(inferDomain('log(x^2 - 1)'))).toEqual(['(−∞, −1)', '(1, +∞)']);
  });
  it('1/(x-2000) 窗口外线性极点（解析解）', () => {
    expect(fmtInterval(inferDomain('1/(x - 2000)'))).toEqual(['(−∞, 2000)', '(2000, +∞)']);
  });
  it('交叉约束交集 sqrt(x) + 1/x', () => {
    expect(fmtInterval(inferDomain('sqrt(x) + 1/x'))).toEqual(['(0, +∞)']);
  });
  it('空定义域（sqrt(-x^2-1)）', () => {
    expect(inferDomain('sqrt(-x^2 - 1)')).toEqual([]);
  });
});

// 回归：缺陷 E2 —— 旧实现用逐函数 if 分支，漏判 asin/acos 等反三角函数，
// 把定义域算成全体实数（数学错误）。现改为声明式函数定义域表。
describe('inferDomain 反三角函数与分数幂（E2 回归）', () => {
  it('asin / acos 定义域为 [−1, 1]', () => {
    expect(fmtInterval(inferDomain('asin(x)'))).toEqual(['[−1, 1]']);
    expect(fmtInterval(inferDomain('acos(x)'))).toEqual(['[−1, 1]']);
  });
  it('复合参数 asin(x/2) 定义域为 [−2, 2]', () => {
    expect(fmtInterval(inferDomain('asin(x/2)'))).toEqual(['[−2, 2]']);
  });
  it('asec / acsc 定义域为 |x| ≥ 1', () => {
    expect(fmtInterval(inferDomain('asec(x)'))).toEqual(['(−∞, −1]', '[1, +∞)']);
    expect(fmtInterval(inferDomain('acsc(x)'))).toEqual(['(−∞, −1]', '[1, +∞)']);
  });
  it('分数幂要求底数非负（x^0.5）', () => {
    expect(fmtInterval(inferDomain('x^0.5'))).toEqual(['[0, +∞)']);
  });
  it('非整数幂在实数域双分支（x^(1/3)）不应被限制为 x ≥ 0', () => {
    expect(fmtInterval(inferDomain('x^(1/3)'))).toEqual(['(−∞, +∞)']);
  });
});

// 回归：线性边界落在 [-1000,1000] 扫描窗口之外时，
// 旧实现误报「空定义域」（sqrt(x-2000)）或把边界当 ±∞。
describe('inferDomain 窗口外线性边界（E4 相邻回归）', () => {
  it('sqrt(x-2000) 定义域为 [2000, +∞)', () => {
    expect(fmtInterval(inferDomain('sqrt(x - 2000)'))).toEqual(['[2000, +∞)']);
  });
  it('sqrt(3000-x) 定义域为 (−∞, 3000]', () => {
    expect(fmtInterval(inferDomain('sqrt(3000 - x)'))).toEqual(['(−∞, 3000]']);
  });
  it('log(x-2000) 定义域为 (2000, +∞)', () => {
    expect(fmtInterval(inferDomain('log(x - 2000)'))).toEqual(['(2000, +∞)']);
  });
  it('未知函数被记录而不是静默当作全体实数', () => {
    expect(collectConstraintsDetailed('foo(x)').unknown).toEqual(['foo']);
    expect(collectConstraintsDetailed('sin(x) + atan(x)').unknown).toEqual([]);
  });

  // 区间算术交叉校验：即使定义域表漏了某个函数，也能靠包络为空兜住（E2 的纵深防御）
  it('区间算术交叉校验能排除被证明整段无定义的区间', () => {
    // asin 的表项若被删掉，这里仍应通过交叉校验排除 (2,3) 之类的区间
    expect(fmtInterval(inferDomain('asin(x)'))).toEqual(['[−1, 1]']);
    // sqrt 的边界在窗口外时同样成立
    expect(fmtInterval(inferDomain('sqrt(x - 2000)'))).toEqual(['[2000, +∞)']);
  });

  it('非整数幂不会被区间交叉校验误删（工具限制≠无定义）', () => {
    expect(fmtInterval(inferDomain('x^0.5'))).toEqual(['[0, +∞)']);
    expect(fmtInterval(inferDomain('x^(1/3)'))).toEqual(['(−∞, +∞)']);
  });
});

describe('inDomain', () => {
  it('区间判定', () => {
    const ivs = inferDomain('1/x');
    expect(inDomain(-1, ivs)).toBe(true);
    expect(inDomain(0, ivs)).toBe(false);
    expect(inDomain(1, ivs)).toBe(true);
  });
});

describe('parseDomainString', () => {
  it('解析并集字符串', () => {
    const ivs = parseDomainString('(-inf, -1) ∪ (1, inf)');
    expect(ivs).not.toBeNull();
    expect(fmtInterval(ivs!)).toEqual(['(−∞, −1)', '(1, +∞)']);
  });
  it('非法字符串返回 null', () => {
    expect(parseDomainString('haha')).toBeNull();
  });
});
