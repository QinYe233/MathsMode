import type { Session } from '../types';

const KEY = 'mathmate.sessions.v1';

export function nextId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const historyStore = {
  load(): Session[] {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Session[]) : [];
    } catch {
      return [];
    }
  },
  save(sessions: Session[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(sessions));
    } catch {
      /* storage full or unavailable — ignore */
    }
  },
  create(): Session {
    return {
      id: nextId(),
      title: '新会话',
      createdAt: Date.now(),
      messages: [],
    };
  },
};
