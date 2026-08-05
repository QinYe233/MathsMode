declare module 'function-plot' {
  interface FunctionPlotOptions {
    target: HTMLElement;
    width?: number;
    height?: number;
    xAxis?: { domain?: [number, number]; label?: string };
    yAxis?: { domain?: [number, number]; label?: string };
    grid?: boolean;
    disableZoom?: boolean;
    tip?: { xLine?: boolean; yLine?: boolean };
    data?: { fn?: string; color?: string; graphType?: 'polyline' | 'scatter' }[];
    annotations?: { x?: number; y?: number; text: string }[];
  }
  export default function functionPlot(options: FunctionPlotOptions): void;
}
