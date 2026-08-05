import { select } from 'd3-selection';
import { registerGraphType } from 'function-plot';
import type { Chart, FunctionPlotDatum, FunctionPlotScale } from 'function-plot';

interface VectorDatum extends FunctionPlotDatum {
  vector: [number, number];
  color: string;
}

export const vectorGraphTypeBuilder =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (chart: Chart) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (selection: any): void => {
    const xScale = chart.meta.xScale as FunctionPlotScale;
    const yScale = chart.meta.yScale as FunctionPlotScale;
    selection.each(function (this: Element, d: VectorDatum) {
      const [vx, vy] = d.vector;
      const x1 = xScale(0);
      const y1 = yScale(0);
      const x2 = xScale(vx);
      const y2 = yScale(vy);

      const lines = select(this)
        .selectAll<SVGLineElement, VectorDatum>(':scope > line.vector-arrow')
        .data([d]);
      const linesEnter = lines.enter().append('line').attr('class', `vector-arrow vector-arrow-${d.index}`);
      lines
        .merge(linesEnter)
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', d.color)
        .attr('stroke-width', 2);

      const heads = select(this)
        .selectAll<SVGPolygonElement, VectorDatum>(':scope > polygon.vector-head')
        .data([d]);
      const headsEnter = heads.enter().append('polygon').attr('class', `vector-head vector-head-${d.index}`);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        heads.merge(headsEnter).attr('points', '');
        return;
      }
      const ux = dx / len;
      const uy = dy / len;
      const s = 9;
      const tip = `${x2},${y2}`;
      const b1 = `${x2 - s * (ux * 0.9 - uy * 0.45)},${y2 - s * (uy * 0.9 + ux * 0.45)}`;
      const b2 = `${x2 - s * (ux * 0.9 + uy * 0.45)},${y2 - s * (uy * 0.9 - ux * 0.45)}`;
      heads
        .merge(headsEnter)
        .attr('points', `${tip} ${b1} ${b2}`)
        .attr('fill', d.color)
        .attr('stroke', d.color);
    });
};

registerGraphType('vector', vectorGraphTypeBuilder);
