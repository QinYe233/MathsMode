import { useEffect, useState } from 'react';
import type { AISettings } from '../types';
import { saveSettings as persistSettings } from '../core/settingsStore';

interface Props {
  open: boolean;
  settings: AISettings;
  onClose: () => void;
  onSave: (s: AISettings) => void;
}

export function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [form, setForm] = useState(settings);

  useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  if (!open) return null;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>AI 设置</h3>
        <label>
          API Base URL
          <input
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-..."
          />
          <span className="field-hint">仅保存在本机浏览器 localStorage，不会上传到任何服务器</span>
        </label>
        <label>
          模型名
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="gpt-4o-mini"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.stream}
            onChange={(e) => setForm({ ...form, stream: e.target.checked })}
          />
          流式输出
        </label>
        <div className="theme-group">
          <span className="theme-label">外观</span>
          <div className="theme-options">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <label className="radio-row" key={t}>
                <input
                  type="radio"
                  name="theme"
                  checked={form.theme === t}
                  onChange={() => setForm({ ...form, theme: t })}
                />
                {t === 'system' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => {
              persistSettings(form);
              onSave(form);
              onClose();
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
