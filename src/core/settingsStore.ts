import type { AISettings } from '../types';

const SETTINGS_KEY = 'mathmate.settings.v1';

export const defaultSettings: AISettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  stream: true,
  theme: 'system',
};

export function loadSettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultSettings;
}

export function saveSettings(s: AISettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full or unavailable — ignore */
  }
}
