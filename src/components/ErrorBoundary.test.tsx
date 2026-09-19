import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('渲染炸了');
}

describe('ErrorBoundary（缺陷 W7）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正常子组件原样渲染', () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('子组件抛错时显示兜底界面而不是白屏', () => {
    // React 会把捕获到的错误继续打到 console.error，这里静音以免污染测试输出
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('界面出现了一个错误')).toBeInTheDocument();
    expect(screen.getByText('渲染炸了')).toBeInTheDocument();
  });

  it('兜底界面提供两条恢复路径', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空本地数据并重载' })).toBeInTheDocument();
  });
});
