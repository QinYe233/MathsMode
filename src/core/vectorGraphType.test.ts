import { describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import { vectorGraphTypeBuilder } from './vectorGraphType';

describe('vectorGraphType', () => {
  const xScale = ((v: number) => 100 + v * 10) as never;
  const yScale = ((v: number) => 200 - v * 10) as never;
  const chart = { meta: { xScale, yScale } } as never;

  function renderVector(datum: { vector: [number, number]; color: string; index: number }) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(g);
    document.body.appendChild(svg);
    const plotter = vectorGraphTypeBuilder(chart);
    plotter(select(g).datum(datum));
    return { svg, g };
  }

  it('绘制从原点到 (3,4) 的箭头线', () => {
    const { g } = renderVector({ vector: [3, 4], color: '#2563eb', index: 0 });
    const line = g.querySelector('line.vector-arrow')!;
    expect(line).not.toBeNull();
    expect(line.getAttribute('x1')).toBe('100');
    expect(line.getAttribute('y1')).toBe('200');
    expect(line.getAttribute('x2')).toBe('130');
    expect(line.getAttribute('y2')).toBe('160');
    expect(line.getAttribute('stroke')).toBe('#2563eb');
    expect(line.getAttribute('stroke-width')).toBe('2');
  });

  it('箭头头部为填充同色的三角形 polygon', () => {
    const { g } = renderVector({ vector: [3, 4], color: '#f59e0b', index: 1 });
    const head = g.querySelector('polygon.vector-head')!;
    expect(head).not.toBeNull();
    expect(head.getAttribute('points')).toContain('130,160');
    expect(head.getAttribute('fill')).toBe('#f59e0b');
  });

  it('零长向量 (0,0) 不崩溃且不画头部', () => {
    const { g } = renderVector({ vector: [0, 0], color: '#16a34a', index: 2 });
    expect(g.querySelector('line.vector-arrow')).not.toBeNull();
    const head = g.querySelector('polygon.vector-head');
    expect(head?.getAttribute('points')).toBe('');
  });
});
