import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

/**
 * 错误边界（缺陷 W7）。
 *
 * 此前 `main.tsx` 直接 `createRoot().render(<App />)`，没有任何错误边界：
 * 组件树中任意一处抛错（例如 `PropertyCard` 的 KaTeX 渲染、`App` 的
 * `JSON.parse(analysesJson)`）都会导致**整页白屏**，用户既无提示也无法恢复。
 *
 * 本组件把兜底 UI 放在根位置，并提供两条恢复路径：
 * - 重新加载页面
 * - 清空本地数据（会话/设置），用于「坏数据导致启动即崩」的场景
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 控制台保留完整堆栈，便于定位；UI 只显示简短信息
    console.error('[MathMate] 未捕获的渲染错误:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearData = (): void => {
    try {
      localStorage.removeItem('mathmate.sessions.v1');
      localStorage.removeItem('mathmate.settings.v1');
      localStorage.removeItem('mathmate.drawer.v1');
    } catch {
      /* 存储不可用时忽略 */
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <div className="error-boundary-title">界面出现了一个错误</div>
          <div className="error-boundary-msg">{error.message || String(error)}</div>
          <div className="error-boundary-hint">
            你的会话记录通常仍然保留。若反复出现，可尝试清空本地数据后重新开始。
          </div>
          <div className="error-boundary-actions">
            <button className="btn" onClick={this.handleReload}>
              重新加载
            </button>
            <button className="btn danger" onClick={this.handleClearData}>
              清空本地数据并重载
            </button>
          </div>
        </div>
      </div>
    );
  }
}
