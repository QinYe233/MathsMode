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
        <button className="icon-btn" onClick={onToggle} title="展开">
          »
        </button>
        <button className="icon-btn" onClick={onNew} title="新会话">
          +
        </button>
      </div>
    );
  }
  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span>会话</span>
        <div>
          <button className="icon-btn" onClick={onNew} title="新会话">
            +
          </button>
          <button className="icon-btn" onClick={onToggle} title="收起">
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
            <span className="session-title">{s.title}</span>
            <button
              className="session-del"
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
