import type { Session } from '../types';

interface Props {
  sessions: Session[];
  activeId: string;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function HistorySidebar({ sessions, activeId, collapsed, onToggle, onSelect, onNew, onDelete }: Props) {
  if (collapsed) {
    return (
      <div className="sidebar sidebar-collapsed">
        <button className="icon-btn" onClick={onToggle} aria-label="展开侧边栏" title="展开">
          »
        </button>
        <button className="icon-btn" onClick={onNew} aria-label="新会话" title="新会话">
          +
        </button>
      </div>
    );
  }
  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-brand">MathMate</span>
        <div className="sidebar-actions">
          <button className="icon-btn" onClick={onNew} aria-label="新会话" title="新会话">
            ＋
          </button>
          <button className="icon-btn" onClick={onToggle} aria-label="收起侧边栏" title="收起">
            «
          </button>
        </div>
      </div>
      <div className="session-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${s.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="session-info">
              <span className="session-title">{s.title}</span>
              <span className="session-meta">
                {formatTime(s.createdAt)} · {s.messages.length} 条
              </span>
            </div>
            <button
              className="session-del"
              aria-label={`删除会话 ${s.title}`}
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `今天 ${hh}:${mm}`;
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
