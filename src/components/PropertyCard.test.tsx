import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyCard } from './PropertyCard';
import { analyzeFunction } from '../core/analysisEngine';

describe('PropertyCard', () => {
  it('极值行渲染 KaTeX 数学', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<PropertyCard analysis={a} />);
    expect(document.querySelectorAll('.property-value .katex').length).toBeGreaterThan(0);
  });

  it('点击极值行触发 onFocus', async () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    const onFocus = vi.fn();
    const user = userEvent.setup();
    render(<PropertyCard analysis={a} onFocus={onFocus} />);
    await user.click(screen.getByText(/极小值/));
    expect(onFocus).toHaveBeenCalled();
  });

  it('无 onFocus 时行不可点击', () => {
    const a = analyzeFunction({ id: 'f', expr: 'x^2 - 2x - 3' });
    render(<PropertyCard analysis={a} />);
    expect(document.querySelector('.property-row.focusable')).not.toBeInTheDocument();
  });
});
