import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import type { AISettings } from '../types';

const settings: AISettings = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  stream: true,
};

describe('SettingsModal', () => {
  it('API Key 旁显示本机存储提示', () => {
    render(<SettingsModal open settings={settings} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/仅保存在本机浏览器/)).toBeInTheDocument();
  });
});
