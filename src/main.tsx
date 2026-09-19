import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 错误边界位于根部：组件树任一处抛错时给出可恢复的兜底界面，而非整页白屏 */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
