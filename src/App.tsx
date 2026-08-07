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

function resolveTheme(t: AISettings['theme']): 'light' | 'dark' {
  if (t === 'system') {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return t;
}

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

  // 应用外观主题（含跟随系统的实时监听）
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      document.documentElement.dataset.theme = resolveTheme('system');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [settings.theme]);

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
    const id = `vector-${Date.now()}`;
    setVectorDefs((prev) => {
      const others = prev.filter(
        (v) =>
          !(v.name && r.name && v.name === r.name) &&
          !(!v.name && !r.name && v.x === r.x && v.y === r.y),
      );
      return [...others, { id, name: r.name, x: r.x, y: r.y }];
    });
    return null;
  };

  const handleClear = () => {
    chat.clearPlot();
    setManualAnalyses([]);
    setVectorDefs([]);
  };

  // 以分析结果 JSON 为 memo key：同表达式重新分析后内容变化也能触发刷新；
  // 流式期间 analysis 未变化时保持引用稳定，避免逐 token 重绘图形。
  const analysesJson = JSON.stringify([
    ...chat.messages.flatMap((m) => m.analysis ?? []),
    ...manualAnalyses,
  ]);
  const visibleAnalyses = useMemo<FunctionAnalysis[]>(
    () => JSON.parse(analysesJson),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysesJson],
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
