import 'function-plot';

declare module 'function-plot' {
  interface FunctionPlotDatum {
    graphType?: 'polyline' | 'interval' | 'scatter' | 'text' | 'vector';
  }
}
