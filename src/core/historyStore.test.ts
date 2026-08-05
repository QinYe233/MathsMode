import { beforeEach, describe, expect, it } from 'vitest';
import { historyStore } from './historyStore';

describe('historyStore', () => {
  beforeEach(() => localStorage.clear());

  it('空存储返回空数组', () => {
    expect(historyStore.load()).toEqual([]);
  });

  it('保存后可加载（往返）', () => {
    const s = historyStore.create();
    s.title = '二次函数';
    s.messages.push({ role: 'user', content: '求零点' });
    historyStore.save([s]);
    const loaded = historyStore.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('二次函数');
    expect(loaded[0].messages[0].content).toBe('求零点');
  });

  it('损坏的 JSON 返回空数组而不是抛错', () => {
    localStorage.setItem('mathmate.sessions.v1', '{bad json');
    expect(historyStore.load()).toEqual([]);
  });
});
