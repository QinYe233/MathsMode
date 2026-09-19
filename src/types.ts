export interface Interval {
  lo: number;
  hi: number;
  loOpen: boolean;
  hiOpen: boolean;
}

export type Parity = 'odd' | 'even' | 'neither';

export interface MonotonicSegment {
  interval: string;
  trend: 'inc' | 'dec' | 'const';
}

export interface Extremum {
  x: number;
  y: number;
  type: 'max' | 'min';
}

export interface Asymptote {
  type: 'vertical' | 'horizontal' | 'oblique';
  value: string;
}

export interface FunctionAnalysis {
  expression: string;
  domain: Interval[];
  parity: Parity;
  monotonic: MonotonicSegment[];
  extrema: Extremum[];
  asymptotes: Asymptote[];
  period?: number;
  zeroPoints: number[];
  summary: string;
  /**
   * 本次分析实际扫描的 x 区间。
   *
   * 数值方法只能在有限窗口内搜索，`±1000` 是内部实现细节，**不是数学边界**。
   * 把它显式带出来，供 UI 在区间端点落在窗口边界时标注「扫描范围内」，
   * 避免把 `(1000, +∞)` 这类内部截断当成真实结论展示（缺陷 E3）。
   */
  scanWindow?: { lo: number; hi: number };
  /**
   * AI/外部声明的定义域过宽、已被表达式推导值收窄（缺陷 W2）。
   *
   * 为 `true` 时 UI 应提示用户：AI 给出的定义域与表达式不符，
   * 当前结果按「声明值 ∩ 表达式推导值」计算。
   */
  domainNarrowed?: boolean;
  /**
   * 周期由**数值采样**兜底判定，而非解析求解（缺陷 W5）。
   *
   * 为 `true` 时该周期只是「在采样范围内表现像周期」，可信度低于
   * 三角函数的严格解析结果，UI 应标注。
   */
  periodUncertain?: boolean;
}

export interface FunctionDef {
  id: string;
  expr: string;
  domain?: string;
}

export interface VectorDef {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  functions?: FunctionDef[];
  analysis?: FunctionAnalysis[];
  error?: boolean;
}

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  stream: boolean;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}
