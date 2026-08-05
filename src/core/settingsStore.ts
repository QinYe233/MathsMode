import type { AISettings } from '../types';

const KEY = 'mathmate.settings.v1';

// NOTE: full implementation arrives in Task 14; API is final.

export function loadSettings(): AISettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      return {
        baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : 'https://api.openai.com/v1',
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
        model: typeof parsed.model === 'string' ? parsed.model : 'gpt-4o-mini',
        stream: typeof parsed.stream === 'boolean' ? parsed.stream : true,
      };
    }
  } catch {
    /* ignore */
  }
  return { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', stream: true };
}

export function saveSettings(settings: AISettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage full or unavailable — ignore */
  }
}
