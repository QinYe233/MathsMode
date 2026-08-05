import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from './hooks/useChat';
import { ChatPanel } from './components/ChatPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { SettingsModal } from './components/SettingsModal';
import { DrawerPanel, DrawerTab } from './components/DrawerPanel';
import { loadSettings } from './core/settingsStore';
import { parseVector } from './core/mathUtil';
import type { AISettings, FunctionAnalysis, VectorDef } from './types';
import { analyzeFunction } from './core/analysisEngine';

const DRAWER_KEY = 'mathmate.drawer.v1';
const DRAWER_MIN = 300;
const DRAWER_MAX = 720;

function loadDrawerWidth(): number {
  try {
    const v = Number(localStorage.getItem(DRAWER_KEY));
    if (Number.isFinite(v) && v >= DRAWER_MIN && v <= DRAWER_MAX) return v;
  } catch {
    /* ignore */
  }
  return 420;
}

export default function App() {
  const chat = useChat();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>(() => loadSettings());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [manualAnalyses, setManualAnalyses] = useState<FunctionAnalysis[]>([]);
  const [vectorDefs, setVectorDefs] = useState<VectorDef[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerWidth, setDrawerWidthState] = useState<number>(loadDrawerWidth);

  const saveSettings = (s: AISettings) => {
    setSettings(s);
    chat.setSettings(s);
  };

  const setDrawerWidth = (w: number) => {
    const c = Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, Math.round(w)));
    setDrawerWidthState(c);
  };

  const persistDrawerWidth = () => {
    try {
      localStorage.setItem(DRAWER_KEY, String(drawerWidth));
    } catch {
      /* ignore */
    }
  };

  const addManualFunction = (expr: string) => {
    const a = analyzeFunction({ id: `manual-${Date.now()}`, expr });
    setManualAnalyses((prev) => [...prev.filter((x) => x.expression !== expr), a]);
  };

  const addVector = (input: string): string | null => {
    const r = parseVector(input);
    if ('error' in r) return r.error;
    setVectorDefs((prev) => {
      const others = prev.filter(
        (v) => !(v.name && v.name === r.name) && !(!r.name && v.x === r.x && v.y === r.y),
      );
      return [...others, { id: `vector-${Date.now()}`, name: r.name, x: r.x, y: r.y }];
    });
    return null;
  };

  const handleClear = () => {
    chat.clearPlot();
    setManualAnalyses([]);
    setVectorDefs([]);
  };

  const analysesKey = [
    ...chat.messages.flatMap((m) => m.analysis ?? []),
    ...manualAnalyses,
  ]
    .map((a) => a.expression)
    .join('|');

  const visibleAnalyses = useMemo(
    () => [...chat.messages.flatMap((m) => m.analysis ?? []), ...manualAnalyses],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysesKey],
  );

  // 自动展开：分析结果从无到有时打开抽屉
  const initialCount = [
    ...chat.messages.flatMap((m) => m.analysis ?? []),
    ...manualAnalyses,
  ].length + vectorDefs.length;
  const prevAnalysesCount = useRef(initialCount);
  useEffect(() => {
    const n = visibleAnalyses.length + vectorDefs.length;
    if (n > 0 && prevAnalysesCount.current === 0) setDrawerOpen(true);
    prevAnalysesCount.current = n;
  }, [visibleAnalyses.length, vectorDefs.length]);

  return (
    <div
      className="app"
      style={{
        gridTemplateColumns: drawerOpen ? `44px 1fr ${drawerWidth}px` : '44px 1fr',
      }}
    >
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
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {drawerOpen ? (
        <DrawerPanel
          analyses={visibleAnalyses}
          vectors={vectorDefs}
          width={drawerWidth}
          onResize={setDrawerWidth}
          onClose={() => setDrawerOpen(false)}
          onResizeEnd={persistDrawerWidth}
          onClear={handleClear}
          onAddVector={addVector}
        />
      ) : (
        <DrawerTab onClick={() => setDrawerOpen(true)} />
      )}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
}
