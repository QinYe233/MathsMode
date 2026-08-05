import { useMemo, useState } from 'react';
import { useChat } from './hooks/useChat';
import { ChatPanel } from './components/ChatPanel';
import { GraphPanel } from './components/GraphPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { SettingsModal } from './components/SettingsModal';
import { loadSettings } from './core/settingsStore';
import type { AISettings, FunctionAnalysis } from './types';
import { analyzeFunction } from './core/analysisEngine';

export default function App() {
  const chat = useChat();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>(() => loadSettings());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [manualAnalyses, setManualAnalyses] = useState<FunctionAnalysis[]>([]);

  const saveSettings = (s: AISettings) => {
    setSettings(s);
    chat.setSettings(s);
  };

  const addManualFunction = (expr: string) => {
    const a = analyzeFunction({ id: `manual-${Date.now()}`, expr });
    setManualAnalyses((prev) => [...prev.filter((x) => x.expression !== expr), a]);
  };

  const analysisKey = [
    ...chat.messages.flatMap((m) => m.analysis ?? []),
    ...manualAnalyses,
  ]
    .map((a) => a.expression)
    .join('|');
  const visibleAnalyses = useMemo(
    () => [...chat.messages.flatMap((m) => m.analysis ?? []), ...manualAnalyses],
    [analysisKey, manualAnalyses],
  );

  return (
    <div className="app">
      <HistorySidebar
        sessions={chat.sessions}
        activeId={chat.activeId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onSelect={chat.setActiveId}
        onNew={chat.newSession}
        onDelete={chat.deleteSession}
      />
      <ChatPanel
        messages={chat.messages}
        loading={chat.loading}
        error={chat.error}
        onSend={chat.send}
        onRetry={chat.retry}
        onAddFunction={addManualFunction}
      />
      <div className="right-panel">
        <div className="right-panel-head">
          <span>函数图像与特性</span>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="AI 设置">
            ⚙
          </button>
        </div>
        <GraphPanel analyses={visibleAnalyses} />
      </div>
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
}
