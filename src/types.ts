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
