import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import type { AISettings } from '../types';

const settings: AISettings = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  stream: true,
  theme: 'system',
};

describe('SettingsModal', () => {
  it('API Key 旁显示本机存储提示', () => {
    render(<SettingsModal open settings={settings} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/仅保存在本机浏览器/)).toBeInTheDocument();
  });

  it('外观设置提供 跟随系统/浅色/深色 三选项', () => {
    render(<SettingsModal open settings={settings} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('radio', { name: /跟随系统/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /浅色/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /深色/ })).not.toBeChecked();
  });
});
