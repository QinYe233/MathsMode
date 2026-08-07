import { useCallback, useEffect, useRef, useState } from 'react';
import type { AISettings, ChatMessage, Session } from '../types';
import { historyStore, nextId } from '../core/historyStore';
import { streamChat } from '../core/aiClient';
import { extractFunctions } from '../core/structuredParser';
import { analyzeFunction } from '../core/analysisEngine';
import { loadSettings } from '../core/settingsStore';

export function useChat() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const loaded = historyStore.load();
    return loaded.length ? loaded : [historyStore.create()];
  });
  const [activeId, setActiveId] = useState<string>(() => sessions[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef<AISettings>(loadSettings());

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const messages = active?.messages ?? [];

  useEffect(() => {
    const t = setTimeout(() => historyStore.save(sessions), 300);
    return () => clearTimeout(t);
  }, [sessions]);

  const setSettings = (settings: AISettings) => {
    settingsRef.current = settings;
  };

  const patchActive = useCallback(
    (updater: (s: Session) => Session) => {
      setSessions((prev) => prev.map((s) => (s.id === activeId ? updater(s) : s)));
    },
    [activeId],
  );

  const send = useCallback(
    async (text: string, options?: { appendUser?: boolean }) => {
      const settings = settingsRef.current;
      if (!settings || !settings.apiKey || loading) return;
      const appendUser = options?.appendUser ?? true;
      const userMsg: ChatMessage = { role: 'user', content: text, id: nextId() };
      if (appendUser) {
        patchActive((s) => ({
          ...s,
          title: s.messages.length === 0 ? text.slice(0, 20) : s.title,
          messages: [...s.messages, userMsg],
        }));
      }
      const context = appendUser ? [...messages, userMsg] : messages;
      setLoading(true);
      setError(null);
      let full = '';
      try {
        for await (const piece of streamChat(
          context.map((m) => ({ role: m.role, content: m.content })),
          settings,
        )) {
          full += piece;
          patchActive((s) => {
            const list = [...s.messages];
            const last = list[list.length - 1];
            if (last?.role === 'assistant' && !last.error) {
              list[list.length - 1] = { ...last, content: full };
            } else {
              list.push({ role: 'assistant', content: full, id: nextId() });
            }
            return { ...s, messages: list };
          });
        }
        const defs = extractFunctions(full);
        const analysis = defs.map((d) => analyzeFunction(d));
        patchActive((s) => {
          const list = [...s.messages];
          const idx = list.length - 1;
          const last = list[idx];
          if (last?.role === 'assistant') {
            list[idx] = { ...last, functions: defs, analysis };
          }
          return { ...s, messages: list };
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '未知错误';
        setError(msg);
        patchActive((s) => {
          const list = [...s.messages];
          const last = list[list.length - 1];
          if (last?.role === 'assistant' && last.content === full && full) {
            list[list.length - 1] = { ...last, error: true };
          } else {
            list.push({ role: 'assistant', content: `⚠️ ${msg}`, error: true, id: nextId() });
          }
          return { ...s, messages: list };
        });
      } finally {
        setLoading(false);
      }
    },
    [activeId, loading, messages, patchActive],
  );

  const newSession = () => {
    const s = historyStore.create();
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
  };

  const deleteSession = (id: string) => {
    const next = sessions.filter((s) => s.id !== id);
    if (next.length === 0) {
      const fresh = historyStore.create();
      setSessions([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setSessions(next);
    if (id === activeId) setActiveId(next[0].id);
  };

  const retry = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || loading) return;
    await send(lastUser.content, { appendUser: false });
  }, [messages, loading, send]);

  const clearPlot = useCallback(() => {
    patchActive((s) => ({
      ...s,
      messages: s.messages.map((m) => (m.analysis ? { ...m, analysis: undefined } : m)),
    }));
  }, [patchActive]);

  return {
    sessions,
    activeId,
    messages,
    loading,
    error,
    send,
    retry,
    clearPlot,
    newSession,
    deleteSession,
    setActiveId,
    setSettings,
  };
}
